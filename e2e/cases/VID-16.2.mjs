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
  // The recorder starts a moment after the click on a loaded machine, so its timer, not the wall clock, is what the
  // library should hold.
  const recorded = await recordFor(page, RECORDING_MINUTES)
  await page.caption('The recording is in the video library')
  const group = await rawRecordingInLibrary(page)
  await page.check(`Library holds about ${RECORDING_MINUTES} min of video`, () => {
    // The library estimates the length from its one-second chunks, and a loaded browser merges some of them, so the
    // estimate can fall short of the recording but never run over it.
    return {
      ok: group.seconds <= recorded + 10 && group.seconds >= recorded - Math.max(0.05 * recorded, 10),
      detail: `${group.text}; the recorder showed ${recorded} s`,
    }
  })
  await page.wait(2500)
}
