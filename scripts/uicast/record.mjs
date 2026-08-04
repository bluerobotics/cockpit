#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-env node */
// Record a scripted browser session as an mp4, using the system Chrome and ffmpeg.
//
//   node scripts/uicast/record.mjs <scenario.mjs> <out.mp4> [--size WxH] [--fps N] [--origin URL]
//
// The scenario is a module whose default export receives the page helpers below.
// Headless Chrome draws no pointer, so one is drawn into the page and moved in step with
// the real mouse events — hover and click behaviour stays genuine, the cursor is just paint.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Chrome ships under a different name on every platform and CI image. CHROME_BIN is taken as
// given (it may be a bare command on PATH); the fallbacks cover a mac laptop and Linux runners.
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

const CHROME = process.env.CHROME_BIN ?? CHROME_CANDIDATES.find((path) => existsSync(path))
if (!CHROME) throw new Error(`no Chrome found; set CHROME_BIN (looked at ${CHROME_CANDIDATES.join(', ')})`)

// `yarn install` drops a full ffmpeg under binaries/ffmpeg, so CI needs no extra package.
const FFMPEG = process.env.FFMPEG_BIN ?? 'ffmpeg'
const PORT = Number(process.env.UICAST_PORT ?? 9334)

const [scenarioPath, out, ...rest] = process.argv.slice(2)
if (!scenarioPath || !out) {
  console.error('usage: record.mjs <scenario.mjs> <out.mp4> [--size WxH] [--fps N] [--origin URL]')
  process.exit(1)
}

const opt = (name, fallback) => {
  const i = rest.indexOf(name)
  return i === -1 ? fallback : rest[i + 1]
}
const [width, height] = opt('--size', '1440x900').split('x').map(Number)
const fps = Number(opt('--fps', 30))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A browser already on the port would be adopted instead of a fresh one, and scripts injected
// for the next document would never run on its already-loaded page — a recording with no cursor.
const squatter = await fetch(`http://127.0.0.1:${PORT}/json/version`).catch(() => null)
if (squatter) throw new Error(`port ${PORT} is already taken; kill the leftover browser first`)

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'uicast-'))}`,
  `--window-size=${width},${height}`,
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
  // Containerised CI has no user namespaces and a 64 MB /dev/shm; Chrome dies on both without these.
  ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
  'about:blank',
])
// Chrome's stderr has to be drained or the pipe fills and blocks it, and it is almost all GPU
// and font noise. Keep just the tail, so a run that dies on an unfamiliar image says why.
let chromeErr = ''
chrome.stderr.on('data', (chunk) => {
  chromeErr = (chromeErr + chunk).slice(-4000)
})
const withChromeErr = (msg) => (chromeErr ? `${msg}\n--- chrome stderr (tail) ---\n${chromeErr}` : msg)

/**
 * Poll Chrome's devtools endpoint until it reports a page target.
 * @returns {Promise<string>} The websocket debugger url of the page target.
 */
async function devtoolsTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const page = (await res.json()).find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome not listening yet.
    }
    await sleep(200)
  }
  throw new Error(withChromeErr('Chrome devtools endpoint never came up'))
}

const ws = new WebSocket(await devtoolsTarget())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let nextId = 1
const pending = new Map()
const listeners = new Map()

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve: ok, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : ok(msg.result)
  } else if (msg.method) {
    listeners.get(msg.method)?.forEach((fn) => fn(msg.params))
  }
}

const send = (method, params = {}) =>
  new Promise((ok, reject) => {
    const id = nextId++
    pending.set(id, { resolve: ok, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

const on = (method, fn) => {
  const list = listeners.get(method) ?? []
  listeners.set(method, list)
  list.push(fn)
}
const once = (method) => new Promise((ok) => on(method, ok))

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

// `text=Save` matches a clickable element by its label; anything else is a CSS selector.
const find = (selector) =>
  selector.startsWith('text=')
    ? `(() => {
         const text = ${JSON.stringify(selector.slice(5))}
         const matches = (list) => [...document.querySelectorAll(list)].filter((el) => el.textContent.trim() === text)
         return matches('button, a, [role="button"], summary')[0] ?? matches('div, span, li, th, td, p, h1, h2, h3, h4, h5, h6').pop() ?? null
       })()`
    : `document.querySelector(${JSON.stringify(selector)})`

// Installed on every document, so it survives navigation. Appended to <body> rather than the
// app root, which Vue replaces wholesale on a route change; a div parented to <html> is in the
// DOM but never painted.
/* eslint-disable max-len, vue/max-len */
const CURSOR_SCRIPT = `
(() => {
  const install = () => {
    if (window.__uicast || !document.body) return
    const style = document.createElement('style')
    style.textContent = '#__vue-devtools-container__, #vue-devtools-anchor, #vue-inspector-container { display: none !important }'
    document.documentElement.appendChild(style)
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;line-height:0'
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 1.5 L3 15.5 L6.9 11.9 L9.4 17.2 L12 16 L9.5 10.8 L14.6 10.8 Z" fill="#fff" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/></svg>'
    document.body.appendChild(el)
    const captionEl = document.createElement('div')
    captionEl.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;padding:9px 18px;border-radius:9999px;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#e2e8f0;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 6px 20px rgba(0,0,0,.45);opacity:0;transition:opacity .25s'
    document.body.appendChild(captionEl)
    window.__uicast = {
      move: (x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px' },
      click: (x, y) => {
        const ring = document.createElement('div')
        ring.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;border-radius:50%;border:2px solid #2599d1;background:rgba(37,153,209,.25)'
        Object.assign(ring.style, { left: (x - 9) + 'px', top: (y - 9) + 'px', width: '18px', height: '18px' })
        document.body.appendChild(ring)
        ring.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 480, easing: 'ease-out' })
          .finished.then(() => ring.remove()).catch(() => ring.remove())
      },
      caption: (text) => {
        captionEl.textContent = text || ''
        captionEl.style.opacity = text ? '1' : '0'
      },
    }
  }
  install()
  document.addEventListener('DOMContentLoaded', install)
})()
`
/* eslint-enable max-len, vue/max-len */

await send('Page.enable')
await send('Runtime.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: CURSOR_SCRIPT })
// Headless denies clipboard reads, and a scenario that copies a link wants to prove what landed.
await send('Browser.grantPermissions', {
  origin: opt('--origin', 'http://localhost:5199'),
  permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
}).catch(() => {})

// --- frame capture -------------------------------------------------------------------
const frames = []
on('Page.screencastFrame', ({ data, sessionId }) => {
  frames.push({ data, at: Date.now() })
  send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

// --- page helpers handed to the scenario ---------------------------------------------
let cursor = { x: width / 2, y: height - 60 }

const boxOf = async (selector) => {
  const box = await evaluate(
    `(() => { const el = ${find(selector)}; if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } })()`
  )
  if (!box) throw new Error(`no element matched ${selector}`)
  return box
}

const mouse = (type, x, y, buttons = 0) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 })

/**
 * Ease the pointer to a target, dispatching real mouse moves so hover states fire.
 * @param {string|{x: number, y: number}} target - Selector or viewport point.
 * @param {number} [duration] - Travel time in milliseconds.
 * @returns {Promise<{x: number, y: number}>} The point the cursor came to rest on.
 */
async function moveTo(target, duration = 620) {
  const to = typeof target === 'string' ? await boxOf(target) : target
  const from = { ...cursor }
  const steps = Math.max(2, Math.round(duration / 16))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const x = from.x + (to.x - from.x) * e
    const y = from.y + (to.y - from.y) * e
    await Promise.all([mouse('mouseMoved', x, y), evaluate(`__uicast.move(${x}, ${y})`)])
    await sleep(8)
  }
  cursor = { x: to.x, y: to.y }
  return cursor
}

const page = {
  async goto(url) {
    const loaded = once('Page.loadEventFired')
    await send('Page.navigate', { url })
    await loaded
    await evaluate(`__uicast.move(${cursor.x}, ${cursor.y})`).catch(() => {})
  },
  async waitFor(selector, timeout = 20000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      if (await evaluate(`!!(${find(selector)})`)) return
      await sleep(150)
    }
    throw new Error(`timed out waiting for ${selector}`)
  },
  moveTo,
  async click(target, { settle = 450 } = {}) {
    const at = await moveTo(target)
    await sleep(120)
    await evaluate(`__uicast.click(${at.x}, ${at.y})`)
    await mouse('mousePressed', at.x, at.y, 1)
    await sleep(60)
    await mouse('mouseReleased', at.x, at.y, 0)
    await sleep(settle)
  },
  async caption(text) {
    await evaluate(`__uicast.caption(${JSON.stringify(text ?? '')})`)
  },
  async scroll(y, target) {
    const at = target ? await boxOf(target) : cursor
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: y })
    await sleep(400)
  },
  eval: evaluate,
  wait: sleep,
  box: boxOf,
  send,
  size: { width, height },
}

// --- run ------------------------------------------------------------------------------
const scenario = (await import(resolve(scenarioPath))).default

await send('Page.startScreencast', {
  format: 'jpeg',
  quality: 90,
  maxWidth: width,
  maxHeight: height,
  everyNthFrame: 1,
})

// A scenario that throws must still take its browser down with it: a survivor keeps the
// debugging port, and the next run silently attaches to its stale page instead of a fresh one.
try {
  await scenario(page)
} catch (err) {
  err.message = withChromeErr(err.message)
  throw err
} finally {
  await sleep(600)
  await send('Page.stopScreencast').catch(() => {})
  ws.close()
  chrome.kill()
}

// --- encode ---------------------------------------------------------------------------
if (frames.length < 2) throw new Error(`captured only ${frames.length} frames`)

// The screencast starts on about:blank, so the first second is a white page — which is what
// every player picks as the thumbnail. A blank frame compresses to a fraction of a painted
// one, so the leading run of tiny frames is the run to drop.
// ponytail: byte size stands in for "is this frame blank"; decoding the JPEGs would need a
// dependency. If a scenario ever opens on a genuinely near-empty page, compare pixels instead.
const median = [...frames].sort((a, b) => a.data.length - b.data.length)[frames.length >> 1].data.length
while (frames.length > 1 && frames[0].data.length < median * 0.25) frames.shift()

const dir = mkdtempSync(join(tmpdir(), 'uicast-frames-'))
const lines = []
frames.forEach((frame, i) => {
  const file = join(dir, `f${String(i).padStart(5, '0')}.jpg`)
  writeFileSync(file, Buffer.from(frame.data, 'base64'))
  const next = frames[i + 1]?.at ?? frame.at + 1000
  lines.push(`file '${file}'`, `duration ${Math.max(0.016, (next - frame.at) / 1000).toFixed(3)}`)
})
// The concat demuxer ignores the final duration unless the last file is repeated.
lines.push(`file '${join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'`)
const list = join(dir, 'list.txt')
writeFileSync(list, lines.join('\n'))

// prettier-ignore
const ff = spawnSync(FFMPEG, [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', list,
  '-vf', `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  out,
], { encoding: 'utf8' })
if (ff.status !== 0) throw new Error(ff.stderr?.slice(-2000) ?? 'ffmpeg failed')

rmSync(dir, { recursive: true, force: true })
const seconds = (frames.at(-1).at - frames[0].at) / 1000
console.log(`wrote ${out} — ${frames.length} frames, ${seconds.toFixed(1)}s`)
process.exit(0)
