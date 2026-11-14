// Gives a camera-less BlueOS container the H264 test-pattern streams most cases use: 720p and 1080p over WebRTC, and
// 720p over RTSP. The 4K one is costly to encode, so the case that needs it adds it for itself. Idempotent: a stream
// that already exists is left alone.
//
//   node e2e/ci/fake-streams.mjs localhost

import process from 'node:process'

import { sleep } from '../lib/driver.mjs'
import { createFakeStream, streamNames } from '../lib/fake-streams.mjs'
import { RTSP_STREAM, STREAM, STREAM_720P } from '../lib/video.mjs'

const host = process.argv[2] ?? 'localhost'

const deadline = Date.now() + 180000
while (!(await streamNames(host).catch(() => null))) {
  if (Date.now() > deadline) throw new Error('mavlink-camera-manager never answered')
  await sleep(2000)
}
for (const name of [STREAM_720P, STREAM, RTSP_STREAM]) await createFakeStream(host, name)
console.log(`streams: ${(await streamNames(host)).join(', ')}`)
