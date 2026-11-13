import process from 'node:process'

import { closeDialog, pickItem, placeVideoWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

// The RTSP stream added under Settings → Video on the Standalone machine running this case.
const RTSP = process.env.COCKPIT_E2E_RTSP_STREAM ?? 'RTSP'

export const meta = {
  title: 'An RTSP stream plays in the Video widget (Standalone)',
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
}

export const setup = quietStart

const playback = (page, hash) =>
  page.eval(`(() => { const v = document.querySelector('[data-e2e-widget="${hash}"] video')
    return v ? { width: v.videoWidth, time: v.currentTime } : null })()`)

/**
 * Pick the RTSP stream in a Video widget: the selection carries the RTSP chip and the video plays.
 */
export default async function run({ page }) {
  await page.caption('Edit interface: add a Video Player and open its cog')
  const widget = await placeVideoWidget(page)
  await page.caption(`Stream: the RTSP stream "${RTSP}"`)
  await pickItem(page, 'Stream', { prefix: RTSP })
  const chip = await page.eval(`(() => { const f = [...document.querySelectorAll('.v-overlay--active .v-field')]
      .find((f) => f.querySelector('label')?.textContent.trim().startsWith('Stream'))
    return f?.querySelector('.v-chip')?.innerText.trim() ?? '' })()`)
  await closeDialog(page)
  await page.wait(8000)
  const t0 = await playback(page, widget.hash)
  await page.wait(2000)
  const t1 = await playback(page, widget.hash)
  const stored = (await widgetByHash(page, widget.hash))?.options.internalStreamName
  await page.check('The selection shows the RTSP chip and the stream plays', () => ({
    ok: chip === 'RTSP' && stored === RTSP && t1?.width > 0 && t1.time > (t0?.time ?? Infinity),
    detail: `chip "${chip}", option ${stored}; width ${t1?.width}, time ${t0?.time?.toFixed(1)} → ${t1?.time?.toFixed(
      1
    )} s`,
  }))
}
