import { createFakeStream, deleteFakeStream } from '../lib/fake-streams.mjs'
import { STREAM, STREAM_4K } from '../lib/video.mjs'
import { closeDialog, openWidgetConfig, pickItem, placeVideoWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

export const meta = {
  title: 'A 4K stream and a 1080p stream play in the Video widget',
  route: '/',
  needs: ['vehicle', 'camera'],
}

// The 4K test stream is served for this case only: encoding it all run long starves everything else of CPU.
export const setup = async (ctx) => {
  await createFakeStream(ctx.vehicleHost, STREAM_4K)
  await quietStart(ctx)
}

const playback = (page, hash) =>
  page.eval(`(() => { const v = document.querySelector('[data-e2e-widget="${hash}"] video')
    return v ? { width: v.videoWidth, time: v.currentTime } : null })()`)

/**
 * Pick the 4K stream, then the 1080p one: both play at their own resolution.
 */
export default async function run({ page, vehicleHost }) {
  try {
    await playBoth(page)
  } finally {
    await deleteFakeStream(vehicleHost, STREAM_4K)
  }
}

const playBoth = async (page) => {
  await page.caption('Edit interface: add a Video Player and open its cog')
  const widget = await placeVideoWidget(page)
  for (const [i, [stream, width]] of [
    [STREAM_4K, 3840],
    [STREAM, 1920],
  ].entries()) {
    if (i) await openWidgetConfig(page, widget.name)
    await page.caption(`Stream: "${stream}", then until it plays`)
    await pickItem(page, 'Stream', { prefix: stream })
    await closeDialog(page)
    // A 4K stream's first keyframe can take a while to come through, and nothing plays until it does.
    await page
      .waitFor(async () => (await playback(page, widget.hash))?.width === width, {
        label: `${stream} at ${width}`,
        timeout: 40000,
      })
      .catch(() => undefined)
    const t0 = await playback(page, widget.hash)
    await page.wait(2000)
    const t1 = await playback(page, widget.hash)
    const stored = (await widgetByHash(page, widget.hash))?.options.internalStreamName
    await page.check(`"${stream}" plays`, () => ({
      ok: stored === stream && t1?.width === width && t1.time > (t0?.time ?? Infinity),
      detail: `option ${stored}; width ${t1?.width}, time ${t0?.time?.toFixed(1)} → ${t1?.time?.toFixed(1)} s`,
    }))
  }
}
