#!/usr/bin/env node
// Runs release-test cases against a live Cockpit and a simulated vehicle, one fresh browser
// profile per case, and records each one to mp4 with its checks burned in.
//
//   node e2e/run.mjs <ID or prefix ...> --vehicle HOST [--url URL] [--headed] [--build LABEL] [--out DIR]
//                    [--app /Applications/Cockpit.app] [--remote SSH_HOST]
//                    [--arms recorded,bare] [--reps N] [--capture WIDTHxQUALITY]
//                    [--hdmi DEVICE] [--hdmi-mode 1920x1080@60] [--no-box-stats]
//
// --app drives that Cockpit Standalone (Electron) build instead of a web build in Chrome; with
// --remote it is a Cockpit.exe on that Windows machine (see README). --arms, --reps and --capture
// shape performance runs; --hdmi records them through a capture card instead.
// IDs match e2e/cases/<ID>.mjs; a prefix like `POI-12` or `MP-` selects a group. URL and vehicle
// default to $COCKPIT_E2E_URL / $COCKPIT_E2E_VEHICLE.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, win32 } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BASE_STATION_DEFAULT } from './lib/base-station.mjs'
import { attachBoxStats, startBoxStats, stopBoxStats } from './lib/box-stats.mjs'
import { openCockpit, seedFor, TEST_USER } from './lib/cockpit.mjs'
import { launch } from './lib/driver.mjs'
import { burnOverlays } from './lib/overlay-burn.mjs'
import { finishSampling, SAMPLER, startSampling } from './lib/perf.mjs'
import { overlayFrameRate } from './lib/perf-video.mjs'
import { vehicle as vehicleApi } from './lib/vehicle.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const ignore = () => undefined
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(name)
  if (i === -1) return fallback
  const [value] = argv.splice(i, 2).slice(1)
  return value
}
const bool = (name) => {
  const i = argv.indexOf(name)
  if (i !== -1) argv.splice(i, 1)
  return i !== -1
}

const app = flag('--app')
// What a case's `meta.platforms` names: a Standalone build is 'electron', any build in a browser is 'web'.
const platform = app ? 'electron' : 'web'
const remote = flag('--remote')
const remotePage = (exe) =>
  `file:///${win32.join(win32.dirname(exe), 'resources/app.asar/dist/index.html').replace(/\\/g, '/')}`
// On macOS `--app` is the .app bundle; elsewhere it is the folder electron-builder unpacks to (`dist/linux-unpacked`).
const resources = process.platform === 'darwin' ? 'Contents/Resources' : 'resources'
const appPage = app && (remote ? remotePage(app) : pathToFileURL(join(app, resources, 'app.asar/dist/index.html')).href)
const url = flag('--url', appPage ?? process.env.COCKPIT_E2E_URL ?? 'http://localhost:5050')
// No default: every case force-disarms the vehicle and wipes its mission and fence, so the target is always named.
const vehicleHost = flag('--vehicle', process.env.COCKPIT_E2E_VEHICLE)
const headed = bool('--headed')
// Performance A/B: every case runs once per arm per repetition. `bare` is the same script with no
// screencast and nothing painted over the page, which prices what recording costs.
const arms = flag('--arms', 'recorded').split(',')
const reps = Number(flag('--reps', '1'))
// `--capture 800x60`: record at 800 px wide, JPEG quality 60, to make recording cheaper on a weak machine.
const [captureWidth, captureQuality] = (flag('--capture', '') || '').split('x').map(Number)
const capture = captureWidth ? { width: captureWidth, quality: captureQuality || undefined } : undefined
// `--hdmi "<device>"`: record through a capture card on this machine instead of the screencast, so the
// measured machine spends nothing on recording. Every arm then runs maximised, so arms stay comparable.
const hdmiDevice = flag('--hdmi')
const hdmiMode = flag('--hdmi-mode')
// `--no-box-stats`: skip sampling the remote machine's CPU and memory, to measure what sampling costs.
const boxStats = !bool('--no-box-stats')
const gitBuild = () => {
  try {
    return execFileSync('git', ['describe', '--tags', '--always', '--dirty'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown build'
  }
}
const appBuild = () =>
  process.platform === 'darwin'
    ? `Standalone ${execFileSync('defaults', ['read', join(app, 'Contents/Info.plist'), 'CFBundleShortVersionString'], {
        encoding: 'utf8',
      }).trim()}`
    : `Standalone ${gitBuild()}`
// A remote build is labelled by the folder it was unpacked to (`Cockpit-builds\1.19.0-beta.18`).
const remoteBuild = () => `Standalone ${win32.basename(win32.dirname(app))} on ${remote}`
const build = flag('--build', remote ? remoteBuild() : app ? appBuild() : gitBuild())
// Absolute, since Chrome is told to save downloads there.
const outRoot = resolve(flag('--out', join(root, 'output')))
const selectors = argv

const casesDir = join(root, 'cases')
const all = (existsSync(casesDir) ? readdirSync(casesDir) : [])
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => f.slice(0, -4))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const chosen = all.filter((id) => selectors.some((s) => id === s || id.startsWith(s)))
if (!vehicleHost) {
  console.error('name the simulated vehicle with --vehicle or $COCKPIT_E2E_VEHICLE')
  process.exit(2)
}
if (!chosen.length) {
  console.error(`no case matches "${selectors.join(' ')}"; available: ${all.join(', ') || `none in ${casesDir}`}`)
  process.exit(2)
}

const vehicle = vehicleApi(vehicleHost)
// SIM_* parameters exist only in SITL builds, so a real autopilot is refused before anything is sent to it.
if ((await vehicle.readParam('SIM_SPEEDUP')) === undefined) {
  console.error(`${vehicleHost} is not an ArduPilot SITL (no SIM_SPEEDUP parameter); refusing to run`)
  process.exit(2)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = join(outRoot, stamp)
mkdirSync(outDir, { recursive: true })

// What a fresh install of Cockpit on a boat ends up with once it has imported the boat defaults. Written up front,
// rather than left to that import, so every case starts from the same layout without waiting on Cockpit.
const BOAT_DEFAULTS = JSON.parse(readFileSync(join(root, 'fixtures/boat-defaults.json'), 'utf8'))
const settingsVehicleId = await vehicle.settingsVehicleId()
const wiredAddresses = await vehicle.wiredAddresses()
const results = []

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const titleCard = (meta) => `
  <div style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#e2e8f0;max-width:70vw">
    <div style="font-size:22px;opacity:.7;letter-spacing:.08em">${escape(meta.id)}</div>
    <div style="font-size:38px;font-weight:700;margin:14px 0 26px">${escape(meta.title)}</div>
    <div style="font-size:18px;opacity:.75">Cockpit ${escape(build)} · ${escape(url)} · vehicle ${escape(
  vehicleHost
)}</div>
    <div style="font-size:18px;opacity:.75;margin-top:6px">${new Date().toLocaleString()}</div>
  </div>`
const endCard = (meta, ok, checks, error) => `
  <div style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#e2e8f0;max-width:70vw">
    <div style="font-size:64px;font-weight:800;color:${ok ? '#4ade80' : '#f87171'}">${ok ? 'PASS' : 'FAIL'}</div>
    <div style="font-size:22px;margin:10px 0 22px">${escape(meta.id)} — ${escape(meta.title)}</div>
    <div style="font-size:17px;text-align:left;display:inline-block">${checks
      .map(
        (c) =>
          `<div style="color:${c.ok ? '#86efac' : '#fca5a5'}">${c.ok ? '✓' : '✗'} ${escape(c.label)}${
            c.detail ? ` — ${escape(c.detail)}` : ''
          }</div>`
      )
      .join('')}${error ? `<div style="color:#fca5a5;margin-top:10px">Error: ${escape(error)}</div>` : ''}</div>
  </div>`

const PERF_COLUMNS = [
  ['fps', 'fps'],
  ['frameP95', 'p95 frame ms'],
  ['worstFrame', 'worst frame ms'],
  ['stalledMs', 'stalled ms'],
  ['longTaskMs', 'long tasks ms'],
  ['responseP95', 'response p95 ms'],
  ['videoFps', 'video fps'],
]
const perfTable = (rows, cell) =>
  `<table><tr><th></th>${PERF_COLUMNS.map(([, h]) => `<th>${h}</th>`).join('')}</tr>${rows
    .map(
      ([name, row]) =>
        `<tr><td>${escape(name)}</td>${PERF_COLUMNS.map(([k]) => `<td>${cell(row, k)}</td>`).join('')}</tr>`
    )
    .join('')}</table>`
// Median and range of every metric, per window and arm, over the repetitions.
const perfSummary = () => {
  const groups = new Map()
  for (const r of results) {
    for (const w of r.perf ?? []) {
      const name = `${r.id} · ${w.label} · ${r.arm}`
      groups.set(name, [...(groups.get(name) ?? []), w])
    }
  }
  if (!groups.size) return ''
  const cell = (ws, k) => {
    const v = ws
      .map((w) => w[k])
      .filter((x) => x !== null && x !== undefined)
      .sort((a, b) => a - b)
    if (!v.length) return '—'
    const median = v[Math.floor(v.length / 2)]
    return v.length > 1 ? `${median} <small>(${v[0]}–${v.at(-1)})</small>` : `${median}`
  }
  return `<h2>Performance</h2><p>Median (range) over ${reps} repetition(s).</p>${perfTable([...groups], cell)}`
}

const checkItem = (r, c) => {
  const seek =
    c.t === null
      ? ''
      : ` onclick="const v=document.getElementById('v-${escape(r.key ?? r.id)}');v.currentTime=${c.t};v.play()"`
  const when = c.t === null ? '' : ` <small>(${c.t.toFixed(1)}s)</small>`
  const detail = c.detail ? ` — ${escape(c.detail)}` : ''
  return `<li class="${c.ok ? 'pass' : 'fail'}"${seek}>${c.ok ? '✓' : '✗'} ${escape(c.label)}${detail}${when}</li>`
}
const caseSection = (r) => {
  const video = r.video
    ? `<video id="v-${escape(r.key ?? r.id)}" src="${escape(r.video)}" controls preload="metadata"></video>`
    : `<p>No video${r.arm === 'bare' ? ' (unrecorded arm)' : ''}.</p>`
  const skipped = r.status === 'skip'
  const error = r.error ? `<p class="${r.status}">${skipped ? 'Skipped' : 'Error'}: ${escape(r.error)}</p>` : ''
  const mark = { pass: '✓', skip: '–' }[r.status] ?? '✗'
  const checks = r.checks.map((c) => checkItem(r, c)).join('')
  const perf = r.perf?.length
    ? perfTable(
        r.perf.map((w) => [w.label, w]),
        (w, k) => w[k] ?? '—'
      )
    : ''
  return `<h2 class="${r.status}">${mark} ${escape(r.key ?? r.id)} — ${escape(
    r.title
  )}</h2><section>${video}<div><ul>${checks}</ul>${perf}${error}</div></section>`
}

// Rewritten after every case, so an interrupted run still leaves a report of what it got through.
const writeReport = () => {
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2))
  const style = `body{font:15px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;margin:24px}
section{display:grid;grid-template-columns:minmax(0,960px) 1fr;gap:20px;margin-bottom:36px}video{width:100%;border-radius:8px;background:#000}
.pass{color:#4ade80}.fail{color:#f87171}li[onclick]{cursor:pointer}
table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #334155;padding:4px 8px;text-align:right}td:first-child{text-align:left}`
  const head = `<!doctype html><meta charset="utf-8"><title>Cockpit release tests ${stamp}</title><style>${style}</style>`
  const summary = `<h1>Cockpit release tests</h1><p>${escape(build)} · ${escape(url)} · vehicle ${escape(
    vehicleHost
  )} · ${stamp}</p>`
  writeFileSync(
    join(outDir, 'index.html'),
    `${head}\n${summary}\n${perfSummary()}\n${results.map(caseSection).join('\n')}`
  )
}

// A stray rejection from a closing browser must not take the remaining cases down with it.
process.on('unhandledRejection', (reason) => console.error('unhandled rejection:', reason))

// Repetitions outermost and arms alternating in order, so a slow start or a drifting machine lands on
// every arm alike instead of always on whichever runs first.
const jobs = []
for (let rep = 1; rep <= reps; rep++) {
  for (const id of chosen) {
    for (const arm of rep % 2 ? arms : [...arms].reverse()) jobs.push({ id, arm, rep })
  }
}
const multi = jobs.length > chosen.length
const plots = []

for (const { id, arm, rep } of jobs) {
  // A case that does not load is reported like any other failure, not allowed to end the run.
  const mod = await import(pathToFileURL(join(root, 'cases', `${id}.mjs`)).href).catch((e) => {
    results.push({
      id,
      title: id,
      status: 'fail',
      error: `could not load the case: ${e.message}`,
      checks: [],
      video: null,
    })
    console.log(`✗ ${id} — could not load the case: ${e.message}`)
    writeReport()
    return null
  })
  if (!mod) continue
  const meta = { id, needs: [], route: '/', synced: {}, ...mod.meta }
  // A CI runner draws in software on shared cores, so what a case measures of the machine means nothing there.
  const skipReason =
    meta.platforms && !meta.platforms.includes(platform)
      ? `${meta.platforms.join('/')} only`
      : meta.hardware && process.env.CI
      ? 'real hardware only'
      : undefined
  if (skipReason) {
    results.push({ id, title: meta.title, status: 'skip', error: skipReason, checks: [], video: null })
    console.log(`- ${id} — skipped: ${skipReason}`)
    writeReport()
    continue
  }
  const needsVehicle = meta.needs.includes('vehicle')
  const started = Date.now()
  const jobKey = multi ? `${id}-${arm}-r${rep}` : id
  const video = join(outDir, `${jobKey}.mp4`)
  let page
  let error
  let perf
  let boxSampling = false
  // Where a case's wall time goes, phase by phase, so the cost around the test is visible next to it.
  const phases = {}
  let lapStart = Date.now()
  const lap = (name) => {
    phases[name] = Math.round((Date.now() - lapStart) / 100) / 10
    lapStart = Date.now()
  }
  console.log(`▶ ${jobKey} — ${meta.title}`)

  try {
    // The previous case's video work loads this machine, which then polls the vehicle too slowly for a mission upload
    // and the autopilot gives it up: it finishes first.
    await Promise.all(plots)
    // Clean slate on the vehicle side: simulator parked, and the synced state cases depend on
    // emptied so a fresh profile does not inherit the previous case's mission or POIs.
    await vehicle.reset()
    // Where an operator's maps were last left: over the boat, rather than Cockpit's default ~10 km away.
    const boat = await vehicle.position()
    const synced = {
      ...BOAT_DEFAULTS,
      ...(boat && {
        'cockpit-user-last-map-center': [boat.lat, boat.lon],
        'cockpit-default-map-center': [boat.lat, boat.lon],
      }),
      // The video routes Cockpit would pick from BlueOS on first use, which it otherwise does mid-case: the streams
      // reconnect and a notice covers the page.
      'cockpit-allowed-stream-ips': wiredAddresses,
      // Already run, as on any used profile: it would otherwise record every overlay variable in each case.
      'cockpit-migrations': { 'recorded-variables-from-overlay': true },
      'cockpit-points-of-interest': [],
      'cockpit-draft-mission': {},
      'cockpit-last-uploaded-mission': {},
      'cockpit-draft-fence': { version: 2, polygons: [], circles: [] },
      'cockpit-vehicle-fence': null,
      'cockpit-base-station-config': BASE_STATION_DEFAULT,
      'cockpit-map-overlays-v1': [],
      'cockpit-custom-tile-providers-v1': [],
      'cockpit-user-last-custom-map-provider-id': null,
      // The welcome tour only covers the map and costs a wait in every case; no case tests it.
      'cockpit-has-seen-tutorial': true,
      // Synced, so a case that follows the vehicle would leave every later one following it too.
      'cockpit-map-follow-vehicle': false,
      ...meta.synced,
    }
    // The whole test user is replaced, so nothing an earlier case changed carries over, and the browser profile gets
    // the same package: Cockpit opens on it and its first sync finds nothing to change.
    const pack = await vehicle.replaceSyncedSettings(TEST_USER, synced)
    const seed = {
      ...seedFor(vehicleHost),
      'cockpit-settings-v2': JSON.stringify({ [TEST_USER]: { [settingsVehicleId]: pack } }),
      'cockpit-last-connected-vehicle-id': settingsVehicleId,
    }
    // Vehicle-side state the app should find already there when it starts, like a loaded mission.
    if (mod.beforeLaunch) await mod.beforeLaunch({ vehicle, meta })
    lap('vehicle and settings reset')

    const bare = arm === 'bare'
    const hdmi = hdmiDevice && !bare ? { device: hdmiDevice, mode: hdmiMode } : undefined
    const screen = Boolean(hdmiDevice)
    page = await launch({
      seed,
      headed,
      app,
      remote,
      bare,
      capture,
      hdmi,
      screen,
      args: meta.browserArgs,
    })
    lap('app start')
    const ctx = { page, vehicle, url, vehicleHost, meta, outDir, user: TEST_USER }
    if (meta.perf) await page.addScript(SAMPLER)
    await openCockpit(page, { url, route: meta.route, needsVehicle })
    lap('app ready')
    // The machine's load during a performance case: started once the app is up, since processes started later are not
    // sampled.
    if (remote && meta.perf && boxStats) {
      const failed = startBoxStats(remote)
      boxSampling = !failed
      if (failed) console.log(`   box stats not sampled: ${failed}`)
    }
    if (mod.setup) await mod.setup(ctx)
    lap('case setup')

    if (meta.perf) await startSampling(page)
    await page.startRecording()
    await page.card(titleCard(meta), 2800)
    try {
      await mod.default(ctx)
    } catch (e) {
      error = e.message
      await page.check('Case ran to the end', () => ({ ok: false, detail: e.message })).catch(ignore)
    }
    await page.caption('')
    if (meta.perf) perf = await finishSampling(page)
    if (boxSampling) {
      boxSampling = false
      const skipped = attachBoxStats(perf, stopBoxStats(remote), join(outDir, `${jobKey}.box.csv`))
      if (skipped) console.log(`   box stats not added: ${skipped}`)
    }
    const ok = !error && page.checks.length > 0 && page.checks.every((c) => c.ok)
    await page.card(endCard(meta, ok, page.checks, error), 3500, { keep: true })
    await page.stopRecording()
    lap('case')
    const encoded = bare ? null : await page.encode(video)
    if (encoded?.flashesSeen !== undefined && encoded.flashesSeen < 2) {
      console.log(
        `   the capture saw ${encoded.flashesSeen} of the 2 sync flashes; is the app filling the captured screen?`
      )
    }
    lap('encode')
    if (perf) {
      perf.timeline = page.timeline()
      writeFileSync(join(outDir, `${jobKey}.perf.json`), JSON.stringify(perf))
    }
    // Drawn on this machine while the next case already runs on the measured one: a capture's overlays first, then the
    // frame-rate plot on top of them.
    const overlays = encoded ? page.overlays() : null
    if (overlays || (perf && !bare)) {
      const label = jobKey
      const timeline = perf?.timeline
      plots.push(
        (async () => {
          const skipped = overlays ? await burnOverlays(video, overlays) : null
          if (skipped) console.log(`   ${label}: overlays not drawn: ${skipped}`)
          const why = perf ? await overlayFrameRate(video, perf.raw, timeline) : null
          if (why) console.log(`   ${label}: frame-rate plot not added: ${why}`)
        })()
      )
    }
  } catch (e) {
    error ??= e.message
  } finally {
    if (boxSampling) stopBoxStats(remote)
    await page?.close().catch(ignore)
    await vehicle.reset().catch(ignore)
    lap('close and restore')
  }

  const checks = page?.checks ?? []
  const ok = !error && checks.length > 0 && checks.every((c) => c.ok)
  results.push({
    id,
    key: jobKey,
    arm,
    rep,
    title: meta.title,
    status: ok ? 'pass' : 'fail',
    perf: perf?.windows ?? null,
    env: perf?.env ?? null,
    viewport: page ? `${page.width}x${page.height}` : null,
    phases,
    error: error ?? null,
    checks,
    video: existsSync(video) ? relative(outDir, video) : null,
    seconds: Math.round((Date.now() - started) / 1000),
    build,
    url,
    vehicle: vehicleHost,
    consoleErrors: page?.consoleErrors.slice(0, 20) ?? [],
  })
  console.log(`${ok ? '✓' : '✗'} ${jobKey}${error ? ` — ${error}` : ''} (${results.at(-1).seconds}s)`)
  console.log(
    `   time: ${Object.entries(phases)
      .map(([k, v]) => `${k} ${v}s`)
      .join(' · ')}`
  )
  if (perf?.env) console.log(`   map: ${perf.env.map} · GPU: ${perf.env.gpu}`)
  for (const w of perf?.windows ?? []) {
    console.log(
      `   ${w.label}: ${w.fps} fps, worst frame ${w.worstFrame} ms, stalled ${w.stalledMs} ms, response p95 ${w.responseP95} ms`
    )
    if (w.box) {
      const roles = Object.entries(w.box.cockpitRoles)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')
      const top = w.box.top
        .slice(0, 3)
        .map((p) => `${p.name} ${p.cpu}`)
        .join(', ')
      console.log(
        `     box: cpu ${w.box.cpu.mean}% (max ${w.box.cpu.max}), Cockpit ${w.box.cockpitCpu}% [${roles}], ${w.box.cockpitMB} MB · others: ${top}`
      )
    }
  }
  writeReport()
}

await Promise.all(plots)
writeReport()

const failed = results.filter((r) => r.status === 'fail')
const ran = results.filter((r) => r.status !== 'skip')
console.log(`\n${ran.length - failed.length}/${ran.length} passed — ${join(outDir, 'index.html')}`)
process.exit(failed.length ? 1 : 0)
