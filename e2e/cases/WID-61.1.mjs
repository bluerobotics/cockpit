import { STREAM, STREAM_720P } from '../lib/video.mjs'
import { closeDialog, openWidgetConfig, pickItem, placeVideoWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

const STREAMS = [STREAM, STREAM_720P]

export const meta = {
  title: 'Switch the Video widget between two streams',
  route: '/',
  needs: ['vehicle', 'camera'],
}

export const setup = quietStart

const playback = (page, hash) =>
  page.eval(`(() => { const v = document.querySelector('[data-e2e-widget="${hash}"] video')
    return v ? { width: v.videoWidth, height: v.videoHeight, time: v.currentTime } : null })()`)

/**
 * Pick `stream` in the widget's config, close it, let it play, and check the widget stores the stream
 * and shows moving frames.
 * @param {object} page - Driver page
 * @param {{hash: string, name: string}} widget - The Video widget
 * @param {string} stream - Stream name
 * @param {boolean} reopen - Open the config first
 */
async function switchTo(page, widget, stream, reopen) {
  if (reopen) await openWidgetConfig(page, widget.name)
  await page.caption(`Video widget config → Stream: "${stream}"`)
  await pickItem(page, 'Stream', { prefix: stream })
  await closeDialog(page)
  await page.caption(`"${stream}" for 10 s`)
  await page.wait(8000)
  const t0 = await playback(page, widget.hash)
  await page.wait(2000)
  const t1 = await playback(page, widget.hash)
  const stored = (await widgetByHash(page, widget.hash))?.options.internalStreamName
  const blocked = await page.eval(
    `document.querySelector('[data-e2e-widget="${widget.hash}"] .no-video-alert')?.innerText.trim() ?? ''`
  )
  await page.check(`"${stream}" plays in the widget`, () => ({
    ok: stored === stream && t1?.width > 0 && t1.time > (t0?.time ?? Infinity) && !blocked,
    detail: `option ${stored}; ${t1?.width}×${t1?.height}, time ${t0?.time?.toFixed(1)} → ${t1?.time?.toFixed(1)} s${
      blocked ? `; "${blocked.slice(0, 80)}"` : ''
    }`,
  }))
}

/**
 * Add a Video widget, pick one stream, then the other, then the first again: each plays.
 */
export default async function run({ page }) {
  await page.caption('Edit interface: add a Video Player and open its cog')
  const widget = await placeVideoWidget(page)
  await switchTo(page, widget, STREAMS[0], false)
  await switchTo(page, widget, STREAMS[1], true)
  await switchTo(page, widget, STREAMS[0], true)
}
