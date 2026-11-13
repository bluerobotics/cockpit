// Talks to the vehicle through BlueOS's mavlink2rest, independently of Cockpit. Checks use it as
// the ground truth ("the vehicle really has this mission"), and teardown uses it to leave the
// simulator disarmed and empty for the next case.

import { execFile } from 'node:child_process'

import { sleep } from './driver.mjs'

const GCS = { system_id: 255, component_id: 190, sequence: 0 }
const ignore = () => undefined

// curl rather than fetch: on macOS a process started from a terminal without LAN permission gets
// EHOSTUNREACH for the vehicle, and the system curl is exempt from that gate.
const http = (url, body) =>
  new Promise((resolve, reject) => {
    const args = ['-sS', '-m', '5', '-w', '\n%{http_code}', url]
    if (body !== undefined) args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body))
    execFile('curl', args, (error, stdout) => {
      if (error) return reject(new Error(`curl ${url}: ${error.message}`))
      const cut = stdout.lastIndexOf('\n')
      resolve({ status: Number(stdout.slice(cut + 1)), text: stdout.slice(0, cut) })
    })
  })

/**
 * Bind the helpers to one vehicle.
 * @param {string} host - BlueOS address (host or host:port)
 * @param {object} [ids] - Target ids
 * @param {number} [ids.system] - Vehicle system id
 * @param {number} [ids.component] - Autopilot component id
 * @returns {object} Vehicle helpers
 */
export function vehicle(host, { system = 1, component = 1 } = {}) {
  const base = `http://${host}/mavlink2rest/mavlink`
  const target = { target_system: system, target_component: component }
  const missionType = { type: 'MAV_MISSION_TYPE_MISSION' }

  // The last received message of a type, with its age in ms, or null if never seen.
  const read = async (name) => {
    const res = await http(`${base}/vehicles/${system}/components/${component}/messages/${name}`)
    if (res.status !== 200) return null
    // mavlink2rest answers "None", still with a 200, for a message it has never received.
    let body
    try {
      body = JSON.parse(res.text)
    } catch {
      return null
    }
    const last = Date.parse(body.status?.time?.last_update ?? '')
    return { ...body.message, ageMs: Number.isNaN(last) ? Infinity : Date.now() - last }
  }

  const send = async (message) => {
    const res = await http(base, { header: GCS, message })
    if (res.status !== 200) throw new Error(`mavlink2rest refused ${message.type}: ${res.status} ${res.text}`)
  }

  const command = (cmd, params = []) => {
    const [param1 = 0, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0] = params
    const values = { param1, param2, param3, param4, param5, param6, param7 }
    return send({ type: 'COMMAND_LONG', ...target, command: { type: cmd }, confirmation: 0, ...values })
  }

  // Poll `read(name)` until `match` accepts a message received after `since` (by default, the call).
  const waitFor = async (name, match = () => true, timeout = 5000, since = Date.now()) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const msg = await read(name)
      if (msg && msg.ageMs <= Date.now() - since + 50 && match(msg)) return msg
      await sleep(100)
    }
    return null
  }

  // The mission stored on the vehicle, item by item. mavlink2rest keeps only the last message of
  // each type, so the protocol runs one request at a time.
  const readMission = async (type = 'MAV_MISSION_TYPE_MISSION') => {
    const listType = { type }
    await send({ type: 'MISSION_REQUEST_LIST', ...target, mission_type: listType })
    const count = await waitFor('MISSION_COUNT')
    if (!count) throw new Error('vehicle did not answer MISSION_REQUEST_LIST')
    const items = []
    for (let seq = 0; seq < count.count; seq++) {
      let item = null
      for (let attempt = 0; attempt < 3 && !item; attempt++) {
        await send({ type: 'MISSION_REQUEST_INT', ...target, seq, mission_type: listType })
        item = await waitFor('MISSION_ITEM_INT', (m) => m.seq === seq, 1500)
      }
      if (!item) throw new Error(`vehicle did not send mission item ${seq}`)
      const params = [item.param1, item.param2, item.param3, item.param4]
      items.push({ seq, command: item.command.type, lat: item.x / 1e7, lon: item.y / 1e7, alt: item.z, params })
    }
    await send({ type: 'MISSION_ACK', ...target, mavtype: { type: 'MAV_MISSION_ACCEPTED' }, mission_type: listType })
    return items
  }

  // Put waypoints on the vehicle with the mission protocol, without Cockpit: for cases that need a
  // mission there before the app starts. The autopilot asks for items in order, with MISSION_REQUEST_INT
  // or, after a simulator restart, the legacy MISSION_REQUEST; an unanswered request is re-sent.
  const writeMissionOnce = async (points, { timeout = 180000 } = {}) => {
    const item = (seq) => ({
      type: 'MISSION_ITEM_INT',
      ...target,
      seq,
      frame: { type: 'MAV_FRAME_GLOBAL_RELATIVE_ALT_INT' },
      command: { type: 'MAV_CMD_NAV_WAYPOINT' },
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 2,
      param3: 0,
      param4: 0,
      x: Math.round(points[seq].lat * 1e7),
      y: Math.round(points[seq].lon * 1e7),
      z: 0,
      mission_type: missionType,
    })
    const requested = async () => {
      const seen = (await Promise.all([read('MISSION_REQUEST_INT'), read('MISSION_REQUEST')])).filter(Boolean)
      return seen.sort((a, b) => a.ageMs - b.ageMs)[0]
    }
    const started = Date.now()
    await send({ type: 'MISSION_COUNT', ...target, count: points.length, mission_type: missionType })
    let last = -1
    let quietSince = Date.now()
    // The acknowledgment can land before the wait for it starts, so it counts from the last item sent.
    let lastSent = Date.now()
    while (Date.now() - started < timeout) {
      const request = await requested()
      const fresh = request && request.ageMs < Date.now() - started
      if (fresh && request.seq !== last && request.seq < points.length) {
        last = request.seq
        quietSince = Date.now()
        lastSent = Date.now()
        await send(item(last))
        if (last === points.length - 1) break
      } else if (Date.now() - quietSince > 1500 && last >= 0) {
        quietSince = Date.now()
        await send(item(last))
      }
    }
    const ack = await waitFor('MISSION_ACK', (m) => m.mission_type?.type === missionType.type, 5000, lastSent)
    if (ack?.mavtype?.type !== 'MAV_MISSION_ACCEPTED') {
      throw new Error(`mission upload ended with ${ack?.mavtype?.type ?? 'no acknowledgment'} at item ${last}`)
    }
  }

  // The simulator now and then stops asking for items mid-upload; one fresh attempt gets past it.
  const writeMission = async (points, options) => {
    try {
      await writeMissionOnce(points, options)
    } catch (e) {
      console.log(`   mission upload failed (${e.message}); retrying once`)
      await sleep(2000)
      await writeMissionOnce(points, options)
    }
  }

  // A parameter's value as the autopilot reports it.
  const chars = (name) => [...name.padEnd(16, '\0')].slice(0, 16)
  const sameName = (msg, name) =>
    (Array.isArray(msg.param_id) ? msg.param_id.join('') : msg.param_id).replace(/\0/g, '') === name
  const readParam = async (name) => {
    await send({ type: 'PARAM_REQUEST_READ', ...target, param_id: chars(name), param_index: -1 })
    return (await waitFor('PARAM_VALUE', (m) => sameName(m, name), 3000))?.param_value
  }
  const setParam = async (name, value) => {
    await send({
      type: 'PARAM_SET',
      ...target,
      param_id: chars(name),
      param_value: value,
      param_type: { type: 'MAV_PARAM_TYPE_REAL32' },
    })
    return (await waitFor('PARAM_VALUE', (m) => sameName(m, name), 3000))?.param_value
  }

  // Overwrite one of a user's synced Cockpit settings on the vehicle. Stamped with the current
  // time, so a fresh browser profile adopts it on its first sync.
  const setSyncedSetting = async (user, key, value) => {
    const url = `http://${host}/bag/v1.0/set/cockpit/settings-v2/${user}/${key}`
    const res = await http(url, { epochLastChangedLocally: Date.now(), value })
    if (res.status !== 200) throw new Error(`could not write ${key} for ${user}: ${res.status} ${res.text}`)
  }

  // Replace every synced Cockpit setting of a user with these, in one write, so nothing a previous run left behind
  // survives. Returns the package as written, for seeding the browser's local copy to match.
  const replaceSyncedSettings = async (user, settings) => {
    const epochLastChangedLocally = Date.now()
    const pack = Object.fromEntries(
      Object.entries(settings).map(([k, value]) => [k, { epochLastChangedLocally, value }])
    )
    const res = await http(`http://${host}/bag/v1.0/set/cockpit/settings-v2/${user}`, pack)
    if (res.status !== 200) throw new Error(`could not write the settings of ${user}: ${res.status} ${res.text}`)
    return pack
  }

  // The id Cockpit files this vehicle's synced settings under, given one if it has none yet.
  const settingsVehicleId = async () => {
    const res = await http(`http://${host}/bag/v1.0/get/cockpit/cockpit-vehicle-id`)
    if (res.status === 200) return JSON.parse(res.text)
    const id = 'release-tests-vehicle'
    const set = await http(`http://${host}/bag/v1.0/set/cockpit/cockpit-vehicle-id`, id)
    if (set.status !== 200) throw new Error(`could not give the vehicle a settings id: ${set.status} ${set.text}`)
    return id
  }

  // The vehicle's wired addresses, as BlueOS's beacon reports them: the video routes Cockpit prefers.
  const wiredAddresses = async () => {
    const res = await http(`http://${host}/beacon/v1.0/services`)
    if (res.status !== 200) throw new Error(`could not read the vehicle's addresses: ${res.status} ${res.text}`)
    const services = JSON.parse(res.text).filter((s) => s.service_type === '_http' && s.interface_type === 'WIRED')
    return [...new Set(services.map((s) => s.ip))]
  }

  const getSyncedSetting = async (user, key) => {
    const res = await http(`http://${host}/bag/v1.0/get/cockpit/settings-v2/${user}/${key}`)
    return res.status === 200 ? JSON.parse(res.text).value : undefined
  }

  // Disarm, park in HOLD (Rover's mode 4), clear the mission and the fence and disable the fence, so the
  // next case starts from the same place.
  const reset = async ({ holdMode = 4 } = {}) => {
    // 21196 forces the disarm even while moving; this is a simulator.
    await command('MAV_CMD_COMPONENT_ARM_DISARM', [0, 21196]).catch(ignore)
    // Independent of each other once disarmed, so they go out together.
    await Promise.all(
      [
        command('MAV_CMD_DO_SET_MODE', [1, holdMode]),
        send({ type: 'MISSION_CLEAR_ALL', ...target, mission_type: missionType }),
        send({ type: 'MISSION_CLEAR_ALL', ...target, mission_type: { type: 'MAV_MISSION_TYPE_FENCE' } }),
        setParam('FENCE_ENABLE', 0),
      ].map((p) => p.catch(ignore))
    )
    await sleep(500)
  }

  return {
    read,
    send,
    command,
    waitFor,
    readMission,
    writeMission,
    readParam,
    setParam,
    setSyncedSetting,
    replaceSyncedSettings,
    settingsVehicleId,
    wiredAddresses,
    getSyncedSetting,
    reset,
    heartbeat: () => read('HEARTBEAT'),
    isArmed: async () => {
      const hb = await read('HEARTBEAT')
      return Boolean(hb && hb.base_mode.bits & 128)
    },
    position: async () => {
      const p = await read('GLOBAL_POSITION_INT')
      return p && { lat: p.lat / 1e7, lon: p.lon / 1e7, heading: p.hdg / 100 }
    },
  }
}

/**
 * Great-circle distance in metres.
 * @param {{lat: number, lon: number}} a - First point
 * @param {{lat: number, lon: number}} b - Second point
 * @returns {number} Distance in metres
 */
export function distance(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h))
}
