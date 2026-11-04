// Gives a camera-less BlueOS container two video streams from mavlink-camera-manager's test-pattern source, so
// cases that need a camera can run: "Stream /dev/video2", the name BlueOS gives a UsbCam, and "PRTest Ball".
// Idempotent: a stream that already exists is left alone.
//
//   node e2e/ci/fake-streams.mjs localhost

import process from 'node:process'

import { sleep } from '../lib/driver.mjs'

const host = process.argv[2] ?? 'localhost'
const api = `http://${host}/mavlink-camera-manager`
const FAKE_STREAMS = [
  { name: 'Stream /dev/video2', port: 5600 },
  { name: 'PRTest Ball', port: 5602 },
]

const streams = async () => {
  const res = await fetch(`${api}/streams`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`GET /streams: ${res.status}`)
  return (await res.json()).map((s) => s.video_and_stream?.name)
}

const deadline = Date.now() + 180000
let names
while (!names) {
  names = await streams().catch((e) => {
    if (Date.now() > deadline) throw new Error(`mavlink-camera-manager never answered: ${e.message}`)
    return null
  })
  if (!names) await sleep(2000)
}

for (const { name, port } of FAKE_STREAMS) {
  if (names.includes(name)) continue
  const body = {
    name,
    source: 'ball',
    stream_information: {
      endpoints: [`udp://127.0.0.1:${port}`],
      configuration: {
        type: 'video',
        encode: 'H264',
        width: 640,
        height: 480,
        frame_interval: { numerator: 1, denominator: 30 },
      },
      extended_configuration: { thermal: false, disable_mavlink: false },
    },
  }
  const res = await fetch(`${api}/streams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`could not create "${name}": ${res.status} ${await res.text()}`)
}
console.log(`streams: ${(await streams()).join(', ')}`)
