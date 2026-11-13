import {
  rawRecordingInLibrary,
  recordFor,
  RECORDING_MINUTES,
  setUpRecording,
  STREAM,
  videoPlayback,
} from '../lib/video.mjs'

export const meta = {
  title: `${RECORDING_MINUTES}-minute recording in Web with the 1080p stream on WebRTC`,
  route: '/',
  needs: ['vehicle', 'camera'],
}

/**
 * A Video widget on the 1080p stream and the mini recorder, set up before recording.
 */
export async function setup({ page }) {
  await setUpRecording(page)
}

/**
 * Record the 1080p stream for the configured time and show the recording in the library with
 * that duration.
 */
export default async function run({ page }) {
  await page.caption(`"${STREAM}" playing live in a Video widget`)
  await page.check('The 1080p video is live', async () => {
    const v = await videoPlayback(page)
    return { ok: v?.width > 0, detail: v ? `${v.width}×${v.height}` : 'no video' }
  })
  await recordFor(page, RECORDING_MINUTES)
  await page.caption('The recording is in the video library')
  const group = await rawRecordingInLibrary(page)
  await page.check(`Library holds about ${RECORDING_MINUTES} min of video`, () => {
    const expected = RECORDING_MINUTES * 60
    return { ok: Math.abs(group.seconds - expected) <= Math.max(0.03 * expected, 10), detail: group.text }
  })
  await page.wait(2500)
}
