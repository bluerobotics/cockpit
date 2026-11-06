import process from 'node:process'

import { closeDialog, openWidgetConfig, pickItem, placeVideoWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

// Set these to the streams a RadCam vehicle offers; the CI vehicle has neither.
const RADCAM = process.env.COCKPIT_E2E_RADCAM_STREAM ?? 'RadCam'
const USBCAM = process.env.COCKPIT_E2E_USBCAM_STREAM ?? 'Stream /dev/video2'

export const meta = {
  title: 'A RadCam stream and a UsbCam stream play in the Video widget',
  route: '/',
  needs: ['vehicle', 'camera', 'radcam'],
}

export const setup = quietStart

const playback = (page, hash) =>
  page.eval(`(() => { const v = document.querySelector('[data-e2e-widget="${hash}"] video')
    return v ? { width: v.videoWidth, time: v.currentTime } : null })()`)

/**
 * Pick the RadCam stream, then the UsbCam one: both play.
 */
export default async function run({ page }) {
  await page.caption('Edit interface: add a Video Player and open its cog')
  const widget = await placeVideoWidget(page)
  for (const [i, stream] of [RADCAM, USBCAM].entries()) {
    if (i) await openWidgetConfig(page, widget.name)
    await page.caption(`Stream: "${stream}", then 10 s`)
    await pickItem(page, 'Stream', { prefix: stream })
    await closeDialog(page)
    await page.wait(8000)
    const t0 = await playback(page, widget.hash)
    await page.wait(2000)
    const t1 = await playback(page, widget.hash)
    const stored = (await widgetByHash(page, widget.hash))?.options.internalStreamName
    await page.check(`"${stream}" plays`, () => ({
      ok: stored === stream && t1?.width > 0 && t1.time > (t0?.time ?? Infinity),
      detail: `option ${stored}; width ${t1?.width}, time ${t0?.time?.toFixed(1)} → ${t1?.time?.toFixed(1)} s`,
    }))
  }
}
