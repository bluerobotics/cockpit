// Drives a Chromium page over the DevTools Protocol like a person would, and records it to mp4.
// Headless Chrome draws no pointer, so one is painted into the page and moved in lockstep with
// real `Input.dispatchMouseEvent` calls: hover, click and drag go through the browser's own input
// pipeline, only the arrow is paint. Adapted from the ui-demo-video recorder; no dependencies
// beyond Chrome and ffmpeg.

import { Buffer } from 'node:buffer'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { flashTimes, startCapture, timelineFromFlashes } from './hdmi.mjs'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const ignore = () => undefined

const DEFAULT_CHROME_APP = '/Applications/Google Chrome.app'

// A Standalone on another machine (`--remote`): a Windows box reached over ssh, where the app is
// started by the E2ELaunch scheduled task so it opens on the logged-in desktop (see README)
// and its DevTools port is forwarded here.
const remoteShell = (host, command) =>
  spawnSync('ssh', ['-o', 'BatchMode=yes', host, command], { encoding: 'utf8', timeout: 60000 })
// Plays measured gestures on the remote machine itself (see `gestures` below).
const GESTURES_SCRIPT = fileURLToPath(new URL('../remote/gestures.mjs', import.meta.url))
// Samples the remote machine's load during a case (lib/box-stats.mjs).
const BOX_STATS_SCRIPT = fileURLToPath(new URL('../remote/box-stats.ps1', import.meta.url))
const LAUNCH_SCRIPT = fileURLToPath(new URL('../remote/launch.ps1', import.meta.url))
const remoteProfile = (name) => `(Join-Path $env:USERPROFILE 'e2e\\profiles\\${name}')`
// Only the app under test may run on that machine: any Cockpit or Electron app, ours from an earlier
// case or one opened by hand, is load on the very thing being measured. This kills them all and prints
// how many are still alive after up to 10 s.
const KILL_ALL_APPS = `$apps = { @(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(Cockpit|electron)\\.exe$' }) }
  & $apps | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 40 -and (& $apps).Count; $i++) { Start-Sleep -Milliseconds 250 }
  Write-Output "apps-left:$((& $apps).Count)"`
const appsLeft = (result) => Number(result.stdout.match(/apps-left:(\d+)/)?.[1] ?? NaN)

/**
 * Open a CDP session on the first page target reachable at `port`.
 * @param {number} port - Remote debugging port
 * @returns {Promise<{send: Function, on: Function, close: Function}>} The session
 */
async function connect(port) {
  let wsUrl
  for (let i = 0; i < 150 && !wsUrl; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      wsUrl = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))?.webSocketDebuggerUrl
    } catch {
      // Browser not listening yet.
    }
    if (!wsUrl) await sleep(200)
  }
  if (!wsUrl) throw new Error(`no page target on port ${port}`)

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error(`could not open ${wsUrl}`))
  })
  let nextId = 1
  const pending = new Map()
  const listeners = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method) {
      listeners.get(msg.method)?.forEach((fn) => fn(msg.params))
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) return reject(new Error('DevTools socket closed'))
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  // A crashed browser would otherwise leave every awaited command hanging until the job times out.
  ws.onclose = () => {
    pending.forEach(({ reject }) => reject(new Error('DevTools socket closed')))
    pending.clear()
  }
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn])
  return { send, on, close: () => ws.close() }
}

// Installed on every document so it survives reloads. Appended to <body>, not the app root that
// Vue replaces wholesale.
export const OVERLAY_SCRIPT = `
(() => {
  const install = () => {
    if (window.__e2e || !document.body) return
    const style = document.createElement('style')
    style.textContent = '#__vue-devtools-container__, #vue-devtools-anchor, #vue-inspector-container { display: none !important }'
    document.documentElement.appendChild(style)
    const layer = (css) => {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;' + css
      document.body.appendChild(el)
      return el
    }
    const cursor = layer('left:-50px;top:-50px;z-index:2147483647;line-height:0')
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 20 20">'
      + '<path d="M3 1.5 L3 15.5 L6.9 11.9 L9.4 17.2 L12 16 L9.5 10.8 L14.6 10.8 Z" fill="#fff" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/></svg>'
    const font = 'font:600 15px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#e2e8f0;'
    const caption = layer('left:50%;bottom:26px;transform:translateX(-50%);max-width:80vw;text-align:center;padding:9px 18px;border-radius:9999px;'
      + font + 'background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 6px 20px rgba(0,0,0,.45);opacity:0;transition:opacity .25s')
    const checks = layer('right:16px;top:64px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;max-width:46vw')
    const keys = layer('left:16px;bottom:26px;padding:6px 12px;border-radius:8px;' + font + 'background:rgba(15,23,42,.92);opacity:0;transition:opacity .2s')
    const card = layer('inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.94);z-index:2147483645')
    let keysTimer
    window.__e2e = {
      move: (x, y) => { cursor.style.left = x + 'px'; cursor.style.top = y + 'px' },
      click: (x, y, color) => {
        const ring = layer('border-radius:50%;border:2px solid ' + color + ';width:18px;height:18px;left:' + (x - 9) + 'px;top:' + (y - 9) + 'px')
        ring.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 480, easing: 'ease-out' })
          .finished.then(() => ring.remove()).catch(() => ring.remove())
      },
      caption: (text) => { caption.textContent = text || ''; caption.style.opacity = text ? '1' : '0' },
      keys: (text) => {
        keys.textContent = text; keys.style.opacity = '1'
        clearTimeout(keysTimer); keysTimer = setTimeout(() => { keys.style.opacity = '0' }, 1400)
      },
      check: (label, ok, detail) => {
        const el = document.createElement('div')
        el.style.cssText = 'padding:7px 12px;border-radius:8px;' + font + 'font-size:14px;background:' + (ok ? 'rgba(21,128,61,.94)' : 'rgba(185,28,28,.96)')
        el.textContent = (ok ? '\\u2713 ' : '\\u2717 ') + label + (detail ? ' \\u2014 ' + detail : '')
        checks.appendChild(el)
        while (checks.children.length > 6) checks.firstChild.remove()
      },
      card: (html) => {
        card.innerHTML = html || ''
        card.style.display = html ? 'flex' : 'none'
      },
    }
  }
  install()
  document.addEventListener('DOMContentLoaded', install)
})()
`

// `text=Save` matches by visible label (buttons and links first); anything else is CSS.
const finder = (selector) =>
  selector.startsWith('text=')
    ? `(() => {
         const text = ${JSON.stringify(selector.slice(5))}.toLowerCase()
         const visible = (el) => el.getClientRects().length > 0
         // Matches inside the viewport win over ones parked off-screen (hidden drawers, the widget picker).
         const inView = (el) => { const r = el.getBoundingClientRect(); return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight }
         const all = (list) => {
           const found = [...document.querySelectorAll(list)].filter((el) => visible(el) && el.textContent.trim().toLowerCase() === text)
           const shown = found.filter(inView)
           return shown.length ? shown : found
         }
         return all('button, a, [role="button"], [role="menuitem"], [role="option"], .v-list-item, summary')[0]
           ?? all('div, span, li, th, td, p, label, h1, h2, h3, h4, h5, h6').pop() ?? null
       })()`
    : `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.getClientRects().length > 0) ?? null`

const MODIFIERS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }
const KEYS = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { code: 'Escape', keyCode: 27 },
  Tab: { code: 'Tab', keyCode: 9 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Delete: { code: 'Delete', keyCode: 46 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
}
const modifierMask = (list = []) => list.reduce((mask, m) => mask | (MODIFIERS[m] ?? 0), 0)

/**
 * Launch (or attach to) a browser and return a page driver.
 * @param {object} options - Launch options
 * @param {number} [options.width] - Viewport width
 * @param {number} [options.height] - Viewport height
 * @param {number} [options.attachPort] - Attach to an already running browser/Electron on this port
 * @param {string} [options.userDataDir] - Reuse a profile directory (kept on close)
 * @param {boolean} [options.headed] - Show the browser window
 * @param {string} [options.chrome] - Chrome app bundle on macOS, binary elsewhere
 * @param {string} [options.app] - An Electron app bundle (Cockpit Standalone) to drive instead of Chrome
 * @param {string} [options.remote] - ssh host where `app` is a Windows Cockpit.exe to start and drive
 * @param {{width?: number, quality?: number}} [options.capture] - Recording size and JPEG quality
 * @param {boolean} [options.screen] - Keep the app's own window size instead of a fixed viewport; a remote app is
 *   maximised, so it fills the screen a capture card records
 * @param {{device: string, mode?: string}} [options.hdmi] - Record through this capture device (lib/hdmi.mjs) instead
 *   of the screencast
 * @param {boolean} [options.bare] - No painted cursor, captions, cards or screencast: the unrecorded arm of a
 *   performance A/B, so the page runs only what is being measured
 * @param {string[]} [options.args] - Extra browser command-line switches
 * @param {Record<string, string>} [options.seed] - localStorage entries written before the app runs, when absent
 * @returns {Promise<object>} The page driver
 */
export async function launch(options = {}) {
  // With `screen`, the app keeps its own window size (maximised on a remote machine) and these become
  // whatever the page measures once it is open.
  let width = options.width ?? 1600
  let height = options.height ?? 1000
  const attached = Boolean(options.attachPort)
  const port = options.attachPort ?? 9400 + Math.floor(Math.random() * 400)
  const throwaway = []
  const remote = options.remote
  let profile = options.userDataDir
  const newRemoteProfile = () => `cockpit-e2e-${Date.now().toString(36)}-${port}`
  if (remote) profile = newRemoteProfile()
  if (!attached && !profile) {
    profile = mkdtempSync(join(tmpdir(), 'cockpit-e2e-'))
    throwaway.push(profile)
  }
  // The remote gesture player is started with the app and then waits for plans, so the ssh shell hosting it never
  // starts up inside a measured window.
  let player
  const startPlayer = () => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', remote, `node "$env:USERPROFILE\\e2e\\gestures.mjs" ${port}`])
    const waiting = []
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    createInterface({ input: child.stdout }).on('line', (line) => waiting.shift()?.resolve(line))
    child.on('close', () => {
      const reason = new Error(err.trim().split('\n').slice(-3).join(' ') || 'exited')
      waiting.splice(0).forEach(({ reject }) => reject(reason))
    })
    const play = (plan) =>
      new Promise((resolve, reject) => {
        if (child.exitCode !== null) return reject(new Error(err.trim() || 'exited'))
        waiting.push({ resolve, reject })
        child.stdin.write(JSON.stringify(plan) + '\n')
      })
    return { child, play }
  }

  // macOS gates LAN access per app. Spawned as our child, Chrome inherits the terminal's
  // permission (often none: the vehicle is "unreachable"); opened through LaunchServices it
  // uses Chrome's own.
  const spawnBrowser = () => {
    if (remote) {
      const args = [`--remote-debugging-port=${port}`, ...(options.args ?? [])]
      // Copied on every start, so the machine always runs the launcher, gesture player and load sampler of this checkout.
      const copied = spawnSync(
        'scp',
        ['-q', '-o', 'BatchMode=yes', GESTURES_SCRIPT, BOX_STATS_SCRIPT, LAUNCH_SCRIPT, `${remote}:e2e/`],
        {
          encoding: 'utf8',
          timeout: 60000,
        }
      )
      if (copied.status !== 0)
        throw new Error(`could not copy the launcher, gesture player and load sampler to ${remote}: ${copied.stderr}`)
      const start = remoteShell(
        remote,
        `${KILL_ALL_APPS}
        $p = ${remoteProfile(profile)}; $a = @(${args.map((a) => `'${a}'`).join(',')}, "--user-data-dir=$p");
        @{ exe = '${options.app}'; args = $a; maximize = $${Boolean(
          options.screen
        )} } | ConvertTo-Json | Set-Content (Join-Path $env:USERPROFILE 'e2e\\launch.json');
        Start-ScheduledTask E2ELaunch`
      )
      if (start.status !== 0)
        throw new Error(`could not start ${options.app} on ${remote}: ${start.stderr.slice(-300)}`)
      if (appsLeft(start) !== 0)
        throw new Error(`${appsLeft(start)} other Cockpit or Electron app(s) on ${remote} would not close`)
      const tunnel = spawn('ssh', [
        '-o',
        'BatchMode=yes',
        '-o',
        'ExitOnForwardFailure=yes',
        '-N',
        '-L',
        `${port}:127.0.0.1:${port}`,
        remote,
      ])
      tunnel.stderr.on('data', ignore)
      player ??= startPlayer()
      return tunnel
    }
    if (options.app) {
      // Electron takes the same two switches; it has no headless mode, so the window opens in the background.
      const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...(options.args ?? [])]
      const child = spawn('open', ['-n', '-g', '-W', '-a', options.app, '--args', ...args])
      child.stderr.on('data', ignore)
      return child
    }
    const args = [
      ...(options.headed ? [] : ['--headless=new']),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--autoplay-policy=no-user-gesture-required',
      ...(options.args ?? []),
      'about:blank',
    ]
    const child =
      process.platform === 'darwin'
        ? spawn('open', ['-n', '-g', '-W', '-a', options.chrome ?? DEFAULT_CHROME_APP, '--args', ...args])
        : spawn(options.chrome ?? 'google-chrome', args)
    child.stderr.on('data', ignore)
    return child
  }

  // The session is swapped when the browser restarts mid-case, so listeners and on-new-document
  // scripts are kept here and replayed onto each new one.
  let session
  let browser
  const listeners = []
  const scripts = []
  const send = (method, params) => session.send(method, params)
  const on = (method, fn) => {
    listeners.push([method, fn])
    session.on(method, fn)
  }
  const once = (method) => new Promise((resolve) => session.on(method, resolve))
  const addScript = async (source) => {
    scripts.push(source)
    await send('Page.addScriptToEvaluateOnNewDocument', { source })
  }
  const open = async () => {
    if (!attached) browser = spawnBrowser()
    session = await connect(port)
    listeners.forEach(([method, fn]) => session.on(method, fn))
    await send('Page.enable')
    await send('Runtime.enable')
    if (options.screen) {
      // launch.ps1 maximises the window some time after it opens, and a maximised window's page is as wide as the
      // screen; reading earlier recorded the unmaximised viewport.
      let screenWidth
      for (let i = 0; i < 100; i++) {
        const { result } = await send('Runtime.evaluate', {
          expression: '[innerWidth, innerHeight, screen.availWidth]',
          returnByValue: true,
        })
        ;[width, height, screenWidth] = result.value
        if (!remote || width === screenWidth) break
        await sleep(200)
      }
      if (remote && width !== screenWidth) console.log(`   window not maximised: ${width}x${height}`)
    } else {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    }
    for (const source of scripts) await send('Page.addScriptToEvaluateOnNewDocument', { source })
  }
  const quitRemote = async () => {
    await Promise.race([send('Browser.close').catch(ignore), sleep(2000)])
    session.close()
    // Cockpit does not quit on Browser.close, and asking the box every second until it gave up cost close
    // to a minute per case. The profile is thrown away, so nothing is lost by not waiting: every app is
    // killed, and the call returns once none is left, in one round trip.
    const left = appsLeft(remoteShell(remote, KILL_ALL_APPS))
    browser.kill()
    player?.child.stdin.end()
    if (left !== 0) console.log(`   ${left} Cockpit or Electron app(s) still running on ${remote} after closing`)
  }
  const quit = async () => {
    if (remote && browser) return quitRemote()
    if (!browser) return session?.close()
    // `open -W` exits when Chrome does; killing `open` itself would leave Chrome running.
    const exited = new Promise((resolve) => (browser.exitCode !== null ? resolve() : browser.once('exit', resolve)))
    // With request interception on, Chrome can drop the socket without answering Browser.close.
    await Promise.race([send('Browser.close').catch(ignore), exited, sleep(10000)])
    const closed = await Promise.race([exited.then(() => true), sleep(10000).then(() => false)])
    session.close()
    // A Chrome that ignored Browser.close stays connected to the vehicle as a second ground station.
    if (!closed) spawnSync('pkill', ['-f', `--user-data-dir=${profile}`])
  }

  await open()
  if (!options.bare) await addScript(OVERLAY_SCRIPT)
  if (options.seed) {
    const seed = JSON.stringify(options.seed)
    await addScript(`(() => { if (!['http:', 'https:', 'file:'].includes(location.protocol)) return;
      for (const [k, v] of Object.entries(${seed})) if (localStorage.getItem(k) === null) localStorage.setItem(k, v) })()`)
    // Electron has already run Cockpit once before we attach, writing its own defaults; the profile
    // is fresh, so the seed simply replaces them.
    if (options.app) {
      await send('Runtime.evaluate', {
        expression: `for (const [k, v] of Object.entries(${seed})) localStorage.setItem(k, v)`,
      })
    }
  }

  const consoleErrors = []
  on('Runtime.exceptionThrown', ({ exceptionDetails }) =>
    consoleErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text)
  )

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }
  // With a capture card the page stays exactly as in the unrecorded arm: the overlay calls are only logged, with this
  // machine's time, and drawn onto the video afterwards (lib/overlay-burn.mjs).
  const overlayLog = []
  const overlay = (call) => {
    if (options.bare) return Promise.resolve()
    if (options.hdmi) {
      overlayLog.push({ at: Date.now(), call })
      return Promise.resolve()
    }
    return evaluate(`window.__e2e && window.__e2e.${call}`).catch(ignore)
  }

  // --- recording --------------------------------------------------------------------
  // Frames carry a virtual timestamp so time-lapse stretches can be squeezed; `offset` is how
  // much real time has been cut so far.
  // Each frame is written to disk as it arrives, so a long case does not hold its whole video in memory.
  const frames = []
  const frameDir = mkdtempSync(join(tmpdir(), 'cockpit-e2e-frames-'))
  const keepFrame = (data, frame) => {
    const file = join(frameDir, `f${String(frames.length).padStart(6, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, ...frame })
  }
  let recording = false
  let offset = 0
  const now = () => Date.now() - offset
  // `ts` is when the frame was drawn, on the page's own clock (epoch seconds), which is what lines the
  // video up with timings measured inside the page.
  on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    if (recording) keepFrame(data, { at: now(), ts: metadata?.timestamp })
    send('Page.screencastFrameAck', { sessionId }).catch(ignore)
  })
  // A smaller, rougher capture costs the page less: on a weak machine every captured frame is read
  // back from the GPU and JPEG-encoded on the same CPU that runs the app.
  const capture = options.capture ?? {}
  const startScreencast = () =>
    send('Page.startScreencast', {
      format: 'jpeg',
      quality: capture.quality ?? 88,
      maxWidth: capture.width ?? width,
      maxHeight: Math.round(((capture.width ?? width) * height) / width),
      everyNthFrame: 1,
    })

  // --- capture-card recording (lib/hdmi.mjs) -----------------------------------------
  let cardCapture
  let hdmiFile
  let hdmiTimeline = []
  const flashes = []
  // This machine's time when each flash was reported drawn, and the video times the capture saw them at: together
  // they place the logged overlay calls on the video.
  const flashesAt = []
  let flashesSeen = []
  // The page's clock origin (epoch ms on the measured machine), which turns its flash times into that machine's
  // epoch, and so its gesture log onto this machine's clock.
  let pageOrigin
  // Where the page sits on the captured screen, for drawing the overlays over it.
  let pagePlacement
  // Turn the whole page white for a moment and return the page time of the frame that showed it.
  const flash = () =>
    evaluate(`new Promise((resolve) => {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483647;pointer-events:none'
      requestAnimationFrame((t) => { document.body.appendChild(el); setTimeout(() => { el.remove(); resolve(t) }, 400) })
    })`)
  const encodeCapture = async (out) => {
    const seen = flashTimes(hdmiFile)
    flashesSeen = seen
    const probe = spawnSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', hdmiFile],
      {
        encoding: 'utf8',
      }
    )
    const seconds = Number(probe.stdout.trim())
    if (seen.length >= 2 && flashes.length >= 2) {
      const origin = await evaluate('performance.timeOrigin')
      hdmiTimeline = timelineFromFlashes([seen[0], seen.at(-1)], [flashes[0], flashes.at(-1)], origin, seconds)
    }
    const ff = spawnSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', hdmiFile, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22'].concat([
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        out,
      ]),
      { encoding: 'utf8' }
    )
    rmSync(dirname(hdmiFile), { recursive: true, force: true })
    if (ff.status !== 0) throw new Error(ff.stderr?.slice(-2000) ?? 'ffmpeg failed')
    return { seconds, flashesSeen: seen.length }
  }

  // --- input ------------------------------------------------------------------------
  let cursor = { x: width / 2, y: height - 80 }
  let held = 0

  const boxOf = async (target) => {
    if (typeof target !== 'string') return target
    const box = await evaluate(`(() => { const el = ${finder(target)}; if (!el) return null;
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } })()`)
    if (!box) throw new Error(`no visible element matches ${target}`)
    return box
  }

  // A move names a button only while one is held: `button: 'left'` on a plain move is a drag to Chrome.
  const mouse = (type, x, y, extra = {}) => {
    const button = type === 'mouseMoved' && !held ? 'none' : 'left'
    return send('Input.dispatchMouseEvent', { type, x, y, button, buttons: held, clickCount: 1, ...extra })
  }

  // Eased so the pointer reads as a hand moving rather than a jump cut.
  const moveTo = async (target, duration = 600, modifiers = 0) => {
    const to = await boxOf(target)
    const from = { ...cursor }
    const steps = Math.max(2, Math.round(duration / 16))
    // Steps go out on a 16 ms beat without waiting for each one to be acknowledged: awaited one by one,
    // every step cost a round trip, which over a tunnel to a slow machine stretched one click to seconds.
    const start = Date.now()
    const sent = []
    for (let i = 1; i <= steps; i++) {
      const wait = start + i * 16 - Date.now()
      if (wait > 0) await sleep(wait)
      const t = i / steps
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const x = from.x + (to.x - from.x) * e
      const y = from.y + (to.y - from.y) * e
      sent.push(mouse('mouseMoved', x, y, { modifiers }), overlay(`move(${x}, ${y})`))
    }
    await Promise.all(sent)
    cursor = { x: to.x, y: to.y }
    return cursor
  }

  const click = async (target, { settle = 450, button = 'left', count = 1, modifiers = [] } = {}) => {
    const mask = modifierMask(modifiers)
    const at = await moveTo(target, 600, mask)
    const color = JSON.stringify(button === 'right' ? '#f59e0b' : '#2599d1')
    const buttons = button === 'right' ? 2 : 1
    await sleep(120)
    for (let n = 1; n <= count; n++) {
      await overlay(`click(${at.x}, ${at.y}, ${color})`)
      const event = { x: at.x, y: at.y, button, clickCount: n, modifiers: mask }
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', buttons, ...event })
      await sleep(60)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...event })
      if (n < count) await sleep(90)
    }
    await sleep(settle)
    return at
  }

  // Leaflet starts a drag on mousedown and needs intermediate moves past its 3px tolerance.
  // `html5` is for draggable="true" elements: Chrome's own drag never reaches a CDP-driven page,
  // so it is intercepted as it starts and replayed as drag events along the same eased path.
  const drag = async (from, to, { duration = 900, settle = 500, html5 = false } = {}) => {
    const start = await moveTo(from)
    const relative = typeof to === 'object' && 'dx' in to
    const end = relative ? { x: start.x + to.dx, y: start.y + to.dy } : await boxOf(to)
    await sleep(150)
    if (html5) await send('Input.setInterceptDrags', { enabled: true })
    const intercepted = html5 ? once('Input.dragIntercepted') : undefined
    held = 1
    await overlay(`click(${start.x}, ${start.y}, '#2599d1')`)
    await mouse('mousePressed', start.x, start.y)
    await sleep(120)
    if (html5) {
      await moveTo({ x: start.x + 10, y: start.y - 10 }, 150)
      const timeout = sleep(3000).then(() => Promise.reject(new Error('no HTML5 drag started')))
      const { data } = await Promise.race([intercepted, timeout])
      const at = { ...cursor }
      await send('Input.dispatchDragEvent', { type: 'dragEnter', x: at.x, y: at.y, data })
      const steps = Math.max(2, Math.round(duration / 16))
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
        const x = at.x + (end.x - at.x) * e
        const y = at.y + (end.y - at.y) * e
        await Promise.all([
          send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data }),
          overlay(`move(${x}, ${y})`),
        ])
        await sleep(8)
      }
      cursor = { x: end.x, y: end.y }
      await sleep(120)
      await send('Input.dispatchDragEvent', { type: 'drop', x: end.x, y: end.y, data })
      held = 0
      await mouse('mouseReleased', end.x, end.y)
      await send('Input.setInterceptDrags', { enabled: false })
      await sleep(settle)
      return end
    }
    await moveTo(end, duration)
    await sleep(120)
    held = 0
    await mouse('mouseReleased', end.x, end.y)
    await sleep(settle)
    return end
  }

  // `Meta+z`, `Control+Shift+z`, `Enter`... The combo is shown on screen unless `show` is false.
  const key = async (combo, { show = true } = {}) => {
    const parts = combo.split('+')
    const name = parts.pop()
    const mask = modifierMask(parts)
    const single = name.length === 1
    const code = /^[a-z]$/i.test(name) ? `Key${name.toUpperCase()}` : /^\d$/.test(name) ? `Digit${name}` : name
    const typesText = single && !(mask & (MODIFIERS.Control | MODIFIERS.Meta))
    const spec = KEYS[name] ?? {
      code,
      keyCode: single ? name.toUpperCase().charCodeAt(0) : 0,
      text: typesText ? name : undefined,
    }
    const keyValue = single && mask & MODIFIERS.Shift ? name.toUpperCase() : name
    if (show) await overlay(`keys(${JSON.stringify(combo.replace('Meta', '⌘').replace('Control', 'Ctrl'))})`)
    const base = { modifiers: mask, key: keyValue, code: spec.code, windowsVirtualKeyCode: spec.keyCode }
    await send('Input.dispatchKeyEvent', { type: spec.text ? 'keyDown' : 'rawKeyDown', text: spec.text, ...base })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    await sleep(150)
  }

  // Typed one key at a time so the viewer sees the text appear.
  const typeText = async (text, { delay = 45 } = {}) => {
    for (const ch of text) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
      await sleep(delay)
    }
  }

  // --- checks -------------------------------------------------------------------------
  const checks = []
  let videoStart = 0

  // Assert something and show the verdict in the video. `fn` returns a boolean or `{ ok, detail }`.
  const check = async (label, fn) => {
    let ok = false
    let detail = ''
    try {
      const r = await fn()
      const structured = typeof r === 'object' && r !== null
      ok = structured ? Boolean(r.ok) : Boolean(r)
      detail = structured && r.detail !== undefined ? String(r.detail) : ''
    } catch (error) {
      detail = error.message
    }
    checks.push({ label, ok, detail, t: recording ? (now() - videoStart) / 1000 : null })
    await overlay(`check(${JSON.stringify(label)}, ${ok}, ${JSON.stringify(detail)})`)
    // A pause to read the verdict in the video; nothing to read without one.
    if (!options.bare) await sleep(900)
    return ok
  }

  // Poll a selector (or a predicate) until it holds.
  const waitFor = async (target, { timeout = 20000, label } = {}) => {
    const deadline = Date.now() + timeout
    const probe = typeof target === 'function' ? target : () => evaluate(`!!(${finder(target)})`)
    while (Date.now() < deadline) {
      try {
        if (await probe()) return true
      } catch {
        // Page mid-navigation; try again.
      }
      await sleep(150)
    }
    throw new Error(`timed out waiting for ${label ?? target}`)
  }

  // Play a gesture plan ([{ t, params }] or [{ t, mark }], see remote/gestures.mjs) at its own pace, without waiting for
  // the app. With a remote app it plays on that machine, so nothing crosses the network while the input runs.
  const gestures = async (plan) => {
    let log
    if (remote) {
      try {
        const reply = JSON.parse(await player.play(plan))
        if (reply.error) throw new Error(reply.error)
        log = reply.log
      } catch (e) {
        throw new Error(`gesture player on ${remote}: ${e.message}`)
      }
    } else {
      const start = Date.now()
      const sent = []
      log = []
      for (const step of plan) {
        const wait = start + step.t - Date.now()
        if (wait > 0) await sleep(wait)
        const entry = { at: Date.now(), ok: false }
        log.push(entry)
        const done =
          step.mark === undefined
            ? send('Input.dispatchMouseEvent', step.params)
            : evaluate(`window.__perf.mark(${JSON.stringify(step.mark)})`)
        sent.push(done.then(() => (entry.ok = true), ignore))
      }
      await Promise.all(sent)
    }
    const pointer = plan.map((step, i) => ({ ...step, log: log[i] })).filter((step) => step.params)
    if (options.hdmi) {
      for (const { params, log: entry } of pointer) {
        const call =
          params.type === 'mousePressed'
            ? `click(${params.x}, ${params.y}, '#2599d1')`
            : `move(${params.x}, ${params.y})`
        overlayLog.push(remote ? { remoteAt: entry.at, call } : { at: entry.at, call })
      }
    }
    const last = pointer.at(-1)?.params
    if (last) {
      cursor = { x: last.x, y: last.y }
      if (!options.hdmi) await overlay(`move(${last.x}, ${last.y})`)
    }
    return { sent: log.length, refused: log.filter((entry) => !entry.ok).length }
  }

  const page = {
    width,
    height,
    gestures,
    send,
    on,
    // Run `source` at the start of every document, including after a browser restart.
    addScript,
    eval: evaluate,
    wait: sleep,
    box: boxOf,
    moveTo,
    // Move only the painted cursor, for gestures that send their own mouse events.
    paintCursor: (x, y) => {
      cursor = { x, y }
      return overlay(`move(${x}, ${y})`)
    },
    hover: (target, ms = 600) => moveTo(target).then(() => sleep(ms)),
    click,
    rightClick: (target, opts = {}) => click(target, { ...opts, button: 'right' }),
    dblClick: (target, opts = {}) => click(target, { ...opts, count: 2 }),
    drag,
    key,
    type: typeText,
    check,
    waitFor,
    caption: (text) => overlay(`caption(${JSON.stringify(text ?? '')})`),
    exists: (selector) => evaluate(`!!(${finder(selector)})`),
    count: (selector) => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`),
    text: () => evaluate('document.body.innerText'),
    consoleErrors,
    checks,
    profile,

    // Click an input, select what is in it, type the new value.
    fill: async (target, value) => {
      await click(target, { settle: 200 })
      // Monaco keeps its text in a model, not in the focused element, so it needs its own select-all.
      const monaco = await evaluate(`!!document.activeElement?.closest('.monaco-editor')`)
      // Its select-all is Cmd+A on macOS and Ctrl+A elsewhere; a remote browser runs on Windows.
      const selectAll = process.platform === 'darwin' && !remote ? 'Meta+a' : 'Control+a'
      if (monaco) await key(selectAll, { show: false })
      else await evaluate(`(() => { const el = document.activeElement; if (el?.select) el.select() })()`)
      await typeText(String(value))
    },

    // Answer the file chooser that `action` opens (a click on an upload button) with `files`, the
    // way a person picks files in the dialog.
    chooseFiles: async (files, action) => {
      await send('Page.setInterceptFileChooserDialog', { enabled: true })
      const opened = once('Page.fileChooserOpened')
      await action()
      const { backendNodeId } = await Promise.race([opened, sleep(10000).then(() => ({}))])
      if (!backendNodeId) throw new Error('no file chooser opened')
      await send('DOM.setFileInputFiles', { files, backendNodeId })
      await send('Page.setInterceptFileChooserDialog', { enabled: false })
    },

    // Let downloads land in `dir`; returns the path of the first new file after `action`.
    download: async (dir, action, timeout = 30000) => {
      await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir })
      const before = new Set(readdirSync(dir))
      await action()
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const fresh = readdirSync(dir).filter((f) => !before.has(f) && !f.endsWith('.crdownload'))
        if (fresh.length) return join(dir, fresh[0])
        await sleep(300)
      }
      throw new Error('no download arrived')
    },

    // A Pinia store's state, read through the app instance Vue leaves on #app; `s` is the store.
    store: (id, expression = 's') =>
      evaluate(`(() => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get(${JSON.stringify(
        id
      )});
        return JSON.parse(JSON.stringify(${expression})) })()`),

    goto: async (url) => {
      // A hash-only change is an in-app route change: no load event will ever come.
      const current = await evaluate('location.href').catch(() => '')
      if (current.split('#')[0] === url.split('#')[0] && url.includes('#')) {
        await evaluate(`location.hash = ${JSON.stringify(url.slice(url.indexOf('#')))}`)
        await sleep(800)
        return
      }
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url })
      await loaded
      await overlay(`move(${cursor.x}, ${cursor.y})`)
    },
    reload: async () => {
      const loaded = once('Page.loadEventFired')
      await send('Page.reload')
      await loaded
      await overlay(`move(${cursor.x}, ${cursor.y})`)
    },

    bare: Boolean(options.bare),
    hdmi: Boolean(options.hdmi),
    // The overlay calls of a capture-card recording, and what places them on its video; null without both flashes.
    overlays: () =>
      flashesSeen.length >= 2 && flashesAt.length >= 2 && pagePlacement
        ? {
            // Entries from the measured machine's gesture log are moved onto this machine's clock by the first flash.
            log: overlayLog.map(({ at, remoteAt, call }) => ({
              call,
              at: remoteAt === undefined ? at : remoteAt + flashesAt[0] - (pageOrigin + flashes[0]),
            })),
            seen: [flashesSeen[0], flashesSeen.at(-1)],
            at: [flashesAt[0], flashesAt.at(-1)],
            placement: pagePlacement,
          }
        : null,
    // Screencast frames received so far, to see how much of the page's motion the video kept.
    recordedFrames: () => frames.length,
    // Where each recorded frame lands in the encoded video (s) and when the page drew it (epoch s).
    timeline: () =>
      options.hdmi
        ? hdmiTimeline
        : frames.filter((f) => f.ts).map((f) => ({ t: (f.at - frames[0].at) / 1000, ts: f.ts })),

    startRecording: async () => {
      if (options.bare) return
      if (options.hdmi) {
        hdmiFile = join(mkdtempSync(join(tmpdir(), 'cockpit-e2e-hdmi-')), 'capture.mkv')
        videoStart = now()
        cardCapture = await startCapture({ ...options.hdmi, out: hdmiFile })
        // The device takes a moment to deliver its first frames, and frames still in flight when ffmpeg
        // is told to stop are lost: both flashes need a margin to land in the file.
        await sleep(1500)
        // Maximised, the window's borders sit off screen and the rest of its frame is above the page.
        pagePlacement = await evaluate(`(() => { const border = (outerWidth - innerWidth) / 2;
          return { x: screenX + border, y: screenY + outerHeight - innerHeight - border, width: innerWidth,
            height: innerHeight, scale: devicePixelRatio } })()`)
        pageOrigin = await evaluate('performance.timeOrigin')
        flashes.push(await flash())
        flashesAt.push(Date.now())
        recording = true
        return
      }
      recording = true
      await startScreencast()
      await sleep(300)
      videoStart = now()
    },
    stopRecording: async () => {
      await sleep(600)
      if (options.hdmi && cardCapture) {
        flashes.push(await flash())
        flashesAt.push(Date.now())
        await sleep(1500)
        recording = false
        await cardCapture.stop()
        return
      }
      recording = false
      await send('Page.stopScreencast').catch(ignore)
    },

    // Wait a long time while keeping the video short: one still every `every` ms, each shown for
    // `show` ms. `onTick` runs before every still (checks, captions).
    timelapse: async (ms, { every = 30000, show = 500, onTick } = {}) => {
      await send('Page.stopScreencast').catch(ignore)
      const end = Date.now() + ms
      while (Date.now() < end) {
        await sleep(Math.min(every, end - Date.now()))
        if (onTick) await onTick()
        const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 })
        keepFrame(data, { at: now() })
        offset += Math.max(0, every - show)
      }
      await startScreencast()
    },

    // Full-screen card over the app; `keep` leaves it up (the closing card, until recording stops).
    card: async (html, ms = 2500, { keep = false } = {}) => {
      if (options.bare) return
      await overlay(`card(${JSON.stringify(html)})`)
      await sleep(ms)
      if (!keep) await overlay('card("")')
    },

    // Encode the recorded frames to an H.264 mp4 at `out`.
    encode: (out, fps = 30) => {
      if (options.hdmi) return encodeCapture(out)
      if (frames.length < 2) throw new Error(`captured only ${frames.length} frames`)
      const lines = []
      frames.forEach((frame, i) => {
        const next = frames[i + 1]?.at ?? frame.at + 1000
        lines.push(`file '${frame.file}'`, `duration ${Math.max(0.016, (next - frame.at) / 1000).toFixed(3)}`)
      })
      // The concat demuxer ignores the final duration unless the last file is repeated.
      lines.push(`file '${frames.at(-1).file}'`)
      writeFileSync(join(frameDir, 'list.txt'), lines.join('\n'))
      const filters = `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`
      const ff = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          join(frameDir, 'list.txt'),
          '-vf',
          filters,
          '-c:v',
          'libx264',
        ].concat(['-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]),
        { encoding: 'utf8' }
      )
      rmSync(frameDir, { recursive: true, force: true })
      if (ff.status !== 0) throw new Error(ff.stderr?.slice(-2000) ?? 'ffmpeg failed')
      return { frames: frames.length, seconds: (frames.at(-1).at - frames[0].at) / 1000 }
    },

    // Quit the browser and start it again, on the same profile or a brand-new one. Recording carries
    // on; the dead time in between is cut down to one second of the last frame.
    restartBrowser: async ({ freshProfile = false } = {}) => {
      if (attached) throw new Error('cannot restart a browser this driver did not start')
      const stoppedAt = Date.now()
      await quit()
      if (freshProfile) {
        profile = remote ? newRemoteProfile() : mkdtempSync(join(tmpdir(), 'cockpit-e2e-'))
        throwaway.push(profile)
        page.profile = profile
      }
      await open()
      if (recording) {
        offset += Math.max(0, Date.now() - stoppedAt - 1000)
        await startScreencast()
      }
    },

    // Close the session; quits a browser this driver started and deletes throwaway profiles.
    close: async () => {
      await quit()
      rmSync(frameDir, { recursive: true, force: true })
      if (remote) {
        for (const name of [profile, ...throwaway])
          remoteShell(remote, `Remove-Item -Recurse -Force ${remoteProfile(name)} -ErrorAction SilentlyContinue`)
        return
      }
      for (const dir of throwaway) {
        for (let i = 0; i < 10; i++) {
          try {
            rmSync(dir, { recursive: true, force: true })
            break
          } catch {
            await sleep(300)
          }
        }
      }
    },
  }
  return page
}
