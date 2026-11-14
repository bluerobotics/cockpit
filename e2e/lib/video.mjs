// Steps shared by the VID cases: a Video widget on the 1080p stream and the mini recorder in the
// bottom bar, a long recording whose quiet middle is time-lapsed, and the video library afterwards.

import process from 'node:process'

// The vehicle's test-pattern streams, all H264, which e2e/ci/fake-streams.mjs creates.
export const STREAM_720P = 'Fake 720p'
export const STREAM = 'Fake 1080p'
export const STREAM_4K = 'Fake 4K'
export const RTSP_STREAM = 'Fake RTSP'

// How long the recording runs. The checklist asks for an hour; a few minutes proves the script.
export const RECORDING_MINUTES = Number(process.env.COCKPIT_E2E_RECORDING_MINUTES ?? 60)

const centre = (page, selector) =>
  page.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(
    selector
  )})].find((e) => e.checkVisibility({ visibilityProperty: true }))
    if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

export const recordButton = (page) => centre(page, '.bg-red-lighten-1')
export const libraryButton = (page) => centre(page, '.mdi-video-box')
export const recorderTimer = (page) =>
  page.eval(`document.querySelector('.w-16.text-justify')?.textContent?.trim() ?? ''`)
export const isRecording = (page, stream = STREAM) =>
  page.store('video', `s.isRecording(${JSON.stringify(stream)})`).catch(() => false)

// Frames shown by the Video widget: size and how far playback has got.
export const videoPlayback = (page) =>
  page.eval(`(() => { const v = [...document.querySelectorAll('video')].find((e) => e.checkVisibility({ visibilityProperty: true }))
    return v ? { width: v.videoWidth, height: v.videoHeight, time: v.currentTime } : null })()`)

/**
 * Put a Video widget and a mini recorder in the bottom bar on each stream, through the widget
 * store. The next case starts from the test user's own layout again.
 * @param {object} page - Driver page
 * @param {string[]} [streams] - Streams to show and record, the 1080p one by default
 */
export async function setUpRecording(page, streams = [STREAM]) {
  await page.store(
    'widget-manager',
    `(() => { const view = s.currentView;
      ${JSON.stringify(streams)}.forEach((stream, i) => {
        view.miniWidgetContainers.find((c) => c.name === 'Bottom-left container').widgets
          .push({ hash: crypto.randomUUID(), component: 'MiniVideoRecorder', name: 'MiniVideoRecorder',
            options: { internalStreamName: stream } })
        const w = s.addWidget({ component: 'VideoPlayer', name: 'VideoPlayer', options: { internalStreamName: stream } }, view)
        w.position = { x: 0.55, y: 0.08 + i * 0.44 }; w.size = { width: 0.42, height: 0.42 } })
      return true })()`
  )
  const playing = `[...document.querySelectorAll('video')].filter((v) => v.checkVisibility({ visibilityProperty: true }) && v.videoWidth > 0).length`
  await page.waitFor(async () => (await page.eval(playing)) >= streams.length, {
    timeout: 30000,
    label: streams.length > 1 ? "every stream's video" : 'the 1080p video',
  })
}

/**
 * The record button of the mini recorder set to `stream`.
 * @param {object} page - Driver page
 * @param {string} stream - Stream name
 * @returns {Promise<{x: number, y: number}|null>} Its centre
 */
export const recordButtonFor = (page, stream) =>
  page.eval(`(() => { const name = [...document.querySelectorAll('.scroll-text')].find((e) => e.textContent.trim() === ${JSON.stringify(
    stream
  )} && e.checkVisibility({ visibilityProperty: true }))
    const el = name?.closest('.w-40.h-9')?.querySelector('.bg-red-lighten-1'); if (!el) return null
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

const clock = (text) => text.split(':').reduce((s, part) => s * 60 + Number(part), 0)

/**
 * Start recording with the mini recorder, let it run `minutes` (time-lapsed in the video), and stop it.
 * @param {object} page - Driver page
 * @param {number} minutes - Recording length
 * @returns {Promise<number>} How long the recorder's timer said it had recorded when stopped, in seconds
 */
export async function recordFor(page, minutes) {
  await page.caption(`Start recording "${STREAM}"`)
  await page.click(await recordButton(page), { settle: 1500 })
  await page.check('Recording started, timer running', async () => {
    const t0 = clock(await recorderTimer(page))
    await page.wait(2500)
    const t1 = clock(await recorderTimer(page))
    return { ok: (await isRecording(page)) && t1 > t0, detail: await recorderTimer(page) }
  })

  let stalled = 0
  let lastVideo = (await videoPlayback(page))?.time ?? 0
  await page.timelapse(minutes * 60000 - 5000, {
    every: Math.min(60000, Math.max(10000, (minutes * 60000) / 60)),
    onTick: async () => {
      const video = (await videoPlayback(page))?.time ?? 0
      if (video <= lastVideo) stalled++
      lastVideo = video
      await page.caption(`Recording · ${await recorderTimer(page)} · time-lapse, one frame per tick`)
    },
  })
  await page.check(`Recorded for ${minutes} min without the timer stopping`, async () => {
    const elapsed = clock(await recorderTimer(page))
    return { ok: (await isRecording(page)) && elapsed >= minutes * 60 - 10, detail: await recorderTimer(page) }
  })
  await page.check('The live video never froze while recording', () => ({
    ok: stalled === 0,
    detail: `${stalled} frozen ticks`,
  }))

  await page.caption('Stop recording')
  const recorded = clock(await recorderTimer(page))
  await page.click(await recordButton(page), { settle: 2500 })
  await page.check('Recording stopped', async () => !(await isRecording(page)))
  return recorded
}

/**
 * Open the video library on its raw tab and read the newest chunk group's duration.
 * @param {object} page - Driver page
 * @returns {Promise<{text: string, seconds: number}>} The group line as shown, and its duration
 */
export async function rawRecordingInLibrary(page) {
  await page.click(await libraryButton(page), { settle: 2000 })
  await page.click('text=RAW', { settle: 1500 }).catch(() => undefined)
  const text = await page.eval(`[...document.querySelectorAll('.v-overlay--active')].map((e) => e.innerText).join(' ')`)
  const line = text.match(/(\d+) chunks[^\n]*?~([\dhms ]+) duration[^\n]*/)
  if (!line) return { text: text.replace(/\s+/g, ' ').slice(0, 120), seconds: NaN }
  const seconds = [...line[2].matchAll(/(\d+)\s*([hms])/g)].reduce(
    (s, [, n, u]) => s + Number(n) * { h: 3600, m: 60, s: 1 }[u],
    0
  )
  return { text: line[0], seconds }
}

/**
 * Record every stream at once with their mini recorders for `seconds`, then stop them all.
 * @param {object} page - Driver page
 * @param {string[]} streams - Streams, each with a mini recorder from setUpRecording
 * @param {number} seconds - Recording length
 */
export async function recordStreams(page, streams, seconds) {
  // A recording recorder shows its timer instead of the stream name, so the buttons are found first.
  const buttons = []
  for (const stream of streams) buttons.push(await recordButtonFor(page, stream))
  if (buttons.includes(null))
    throw new Error(`no mini recorder for ${streams.filter((_, i) => !buttons[i]).join(', ')}`)
  for (const button of buttons) await page.click(button, { settle: 800 })
  for (const stream of streams) {
    await page.waitFor(() => isRecording(page, stream), { timeout: 10000, label: `"${stream}" to record` })
  }
  await page.wait(seconds * 1000)
  for (const button of buttons) await page.click(button, { settle: 800 })
  for (const stream of streams) {
    await page.waitFor(async () => !(await isRecording(page, stream)), { timeout: 15000, label: `"${stream}" to stop` })
  }
}
