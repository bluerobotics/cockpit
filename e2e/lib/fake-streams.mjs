// H264 test-pattern streams from mavlink-camera-manager, for a camera-less BlueOS. The names are the ones
// e2e/lib/video.mjs uses.

import { RTSP_STREAM, STREAM, STREAM_4K, STREAM_720P } from './video.mjs'

// A player shows nothing until a keyframe arrives, and the encoder spaces them by frames, so a low frame rate leaves a
// new viewer waiting many seconds. The two streams most cases use run at a camera's usual 30 fps; the RTSP and 4K
// ones, costlier or seldom used, at 15.
const FAKE_STREAMS = {
  [STREAM_720P]: { endpoint: 'udp://127.0.0.1:5600', width: 1280, height: 720, fps: 30 },
  [STREAM]: { endpoint: 'udp://127.0.0.1:5602', width: 1920, height: 1080, fps: 30 },
  [STREAM_4K]: { endpoint: 'udp://127.0.0.1:5604', width: 3840, height: 2160, fps: 15 },
  [RTSP_STREAM]: { endpoint: 'rtsp://0.0.0.0:8554/fake', width: 1280, height: 720, fps: 15 },
}

const api = (host) => `http://${host}/mavlink-camera-manager`

/**
 * The names of the streams the vehicle's camera manager serves.
 * @param {string} host - Vehicle address
 * @returns {Promise<string[]>} Stream names
 */
export async function streamNames(host) {
  const res = await fetch(`${api(host)}/streams`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`GET /streams: ${res.status}`)
  return (await res.json()).map((s) => s.video_and_stream?.name)
}

/**
 * Have the camera manager serve one of the test-pattern streams; one that already exists is left alone.
 * @param {string} host - Vehicle address
 * @param {string} name - One of the stream names in e2e/lib/video.mjs
 */
export async function createFakeStream(host, name) {
  if ((await streamNames(host)).includes(name)) return
  const { endpoint, width, height, fps } = FAKE_STREAMS[name]
  const body = {
    name,
    source: 'ball',
    stream_information: {
      endpoints: [endpoint],
      configuration: {
        type: 'video',
        encode: 'H264',
        width,
        height,
        frame_interval: { numerator: 1, denominator: fps },
      },
      extended_configuration: { thermal: false, disable_mavlink: false },
    },
  }
  const res = await fetch(`${api(host)}/streams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`could not create "${name}": ${res.status} ${await res.text()}`)
}

/**
 * Stop serving a test-pattern stream, so its encoder no longer takes the machine's time.
 * @param {string} host - Vehicle address
 * @param {string} name - Stream name
 */
export async function deleteFakeStream(host, name) {
  const url = `${api(host)}/delete_stream?name=${encodeURIComponent(name)}`
  const res = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`could not delete "${name}": ${res.status} ${await res.text()}`)
}
