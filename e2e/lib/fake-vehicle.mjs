// A stand-in for a second vehicle on the network: a MAVLink2Rest-style WebSocket that announces an ArduPilot boat
// with its own system ID and reports a position going round a circle. The test network has one real vehicle, and
// the telemetry-only links read exactly this stream, so nothing else is needed to exercise them.

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

const EARTH_RADIUS_M = 6371000

// One unmasked text frame, which is all a server ever sends here.
const textFrame = (text) => {
  const payload = Buffer.from(text)
  const length = payload.length
  const header =
    length < 126
      ? Buffer.from([0x81, length])
      : length < 65536
      ? Buffer.from([0x81, 126, length >> 8, length & 0xff])
      : Buffer.concat([Buffer.from([0x81, 127]), Buffer.from(new BigUint64Array([BigInt(length)]).buffer).reverse()])
  return Buffer.concat([header, payload])
}

/**
 * Start the stand-in vehicle.
 * @param {object} options - Options
 * @param {number} options.systemId - The system ID it announces
 * @param {{lat: number, lon: number}} options.centre - Centre of the circle it goes round, in degrees
 * @param {number} [options.radius] - Circle radius, m
 * @param {number} [options.periodS] - Seconds for one lap
 * @returns {Promise<{url: string, position: Function, close: Function}>} Its WebSocket address, its current
 * position in degrees, and a way to stop it
 */
export async function startFakeVehicle({ systemId, centre, radius = 60, periodS = 120 }) {
  const started = Date.now()
  const position = () => {
    const angle = (2 * Math.PI * (Date.now() - started)) / (periodS * 1000)
    const north = radius * Math.cos(angle)
    const east = radius * Math.sin(angle)
    return {
      lat: centre.lat + (north / EARTH_RADIUS_M) * (180 / Math.PI),
      lon: centre.lon + (east / (EARTH_RADIUS_M * Math.cos((centre.lat * Math.PI) / 180))) * (180 / Math.PI),
    }
  }
  const sockets = new Set()
  let sequence = 0
  const send = (message) => {
    const text = JSON.stringify({
      header: { system_id: systemId, component_id: 1, sequence: sequence++ % 256 },
      message,
    })
    for (const socket of sockets) socket.write(textFrame(text))
  }

  const server = createServer((req, res) => res.writeHead(426).end())
  server.on('upgrade', (req, socket) => {
    const accept = createHash('sha1')
      .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    )
    sockets.add(socket)
    // A close frame from the client ends the link; anything else it sends is of no interest.
    socket.on('data', (data) => (data[0] & 0x0f) === 0x8 && socket.end())
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => sockets.delete(socket))
  })

  const heartbeat = setInterval(
    () =>
      send({
        type: 'HEARTBEAT',
        autopilot: { type: 'MAV_AUTOPILOT_ARDUPILOTMEGA' },
        base_mode: { bits: 1 },
        custom_mode: 4,
        mavlink_version: 3,
        mavtype: { type: 'MAV_TYPE_SURFACE_BOAT' },
        system_status: { type: 'MAV_STATE_STANDBY' },
      }),
    1000
  )
  const report = setInterval(() => {
    const { lat, lon } = position()
    send({
      type: 'GLOBAL_POSITION_INT',
      time_boot_ms: Date.now() - started,
      lat: Math.round(lat * 1e7),
      lon: Math.round(lon * 1e7),
      alt: 0,
      relative_alt: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hdg: 0,
    })
  }, 250)

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  // The run ends when its cases do, not when this vehicle stops talking.
  for (const handle of [server, heartbeat, report]) handle.unref()
  return {
    url: `ws://127.0.0.1:${server.address().port}/mavlink2rest/ws/mavlink`,
    position,
    close: () => {
      clearInterval(heartbeat)
      clearInterval(report)
      for (const socket of sockets) socket.destroy()
      server.close()
    },
  }
}
