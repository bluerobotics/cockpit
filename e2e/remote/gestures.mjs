// Runs on the measured machine: plays a gesture plan into the app through its local debugging port, so the input of
// a measured window keeps its pace whatever the driving machine and the network are doing.
//   node gestures.mjs <port>    (one JSON plan per stdin line, one JSON log per stdout line, until stdin closes)
// It is started once per app launch and then waits, so neither it nor the ssh shell hosting it starts up inside a
// measured window.
// The plan is [{ t, params }] or [{ t, mark }]: ms from the start, and either Input.dispatchMouseEvent parameters or a
// label for the page's performance sampler, which places the measured window exactly around the input. The log is
// [{ at, ok }] per step: the epoch ms it was sent at on this machine, and whether the browser accepted it.

import process from 'node:process'
import { createInterface } from 'node:readline'

const port = process.argv[2]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The page target is looked up for every plan, since the app may have restarted since the last one.
const play = async (plan) => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  const targets = await response.json()
  const target = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
  if (!target) throw new Error(`no page target on port ${port}`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('could not open the page target'))
  })
  let nextId = 1
  const pending = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    pending.get(msg.id)?.(!msg.error)
    pending.delete(msg.id)
  }
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const dispatch = (step) =>
    step.mark === undefined
      ? send('Input.dispatchMouseEvent', step.params)
      : send('Runtime.evaluate', { expression: `window.__perf.mark(${JSON.stringify(step.mark)})` })

  const log = []
  const sent = []
  const start = performance.now()
  for (const step of plan) {
    const wait = start + step.t - performance.now()
    if (wait > 0) await sleep(wait)
    const entry = { at: Date.now(), ok: false }
    log.push(entry)
    // Not awaited: a slow app gets the same input as a fast one, and has to queue it.
    sent.push(dispatch(step).then((ok) => (entry.ok = ok)))
  }
  await Promise.all(sent)
  ws.close()
  return log
}

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue
  try {
    process.stdout.write(JSON.stringify({ log: await play(JSON.parse(line)) }) + '\n')
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message }) + '\n')
  }
}
