import { fieldByLabel } from '../lib/cockpit.mjs'
import { closeMenu, openMenuPage } from '../lib/mavlink-tools.mjs'
import { closeDialog, pickItem, placeVideoWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

export const meta = {
  title: 'An RTSP stream plays in the Video widget (Standalone)',
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
}

// The test camera serves RTSP itself; Standalone finds only ONVIF cameras on its own, so the stream is added the way
// any other RTSP camera is.
const rtspUrl = (host) => `rtsp://${host}:8554/fake`

/**
 * Add the test camera's RTSP address under Settings → Video, before recording.
 * @param {object} ctx - Case context
 */
export async function setup(ctx) {
  await quietStart(ctx)
  const { page, vehicleHost } = ctx
  await openMenuPage(page, 'settings-video')
  await page.fill(await fieldByLabel(page, 'RTSP URL'), rtspUrl(vehicleHost))
  await page.key('Enter')
  await page.wait(1000)
  await closeMenu(page)
}

const playback = (page, hash) =>
  page.eval(`(() => { const v = document.querySelector('[data-e2e-widget="${hash}"] video')
    return v ? { width: v.videoWidth, time: v.currentTime } : null })()`)

/**
 * Pick the RTSP stream in a Video widget: the selection carries the RTSP chip and the video plays.
 */
export default async function run({ page, vehicleHost }) {
  await page.caption('Edit interface: add a Video Player and open its cog')
  const widget = await placeVideoWidget(page)
  // mavlink-camera-manager also offers the stream over WebRTC as "Fake RTSP", so the entry is picked by its address.
  const url = JSON.stringify(rtspUrl(vehicleHost))
  const rtsp = await page.store('video', `s.streamsCorrespondency.find((c) => c.rtspUrl === ${url})?.name ?? null`)
  if (!rtsp) throw new Error(`no stream entry for ${rtspUrl(vehicleHost)}`)
  await page.caption(`Stream: the RTSP entry "${rtsp}"`)
  // Each item lists the name, then the address and the protocol chip on lines of their own.
  await pickItem(page, 'Stream', { prefix: `${rtsp}\n` })
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
    ok: chip === 'RTSP' && stored === rtsp && t1?.width > 0 && t1.time > (t0?.time ?? Infinity),
    detail: `chip "${chip}", option ${stored}; width ${t1?.width}, time ${t0?.time?.toFixed(1)} → ${t1?.time?.toFixed(
      1
    )} s`,
  }))
}
