import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import { addMiniWidget, miniWidgetEl, quietStart } from '../lib/widgets.mjs'

// How Cockpit names each GPS_RAW_INT fix_type.
const FIX = {
  GPS_FIX_TYPE_NO_GPS: 'No GPS',
  GPS_FIX_TYPE_NO_FIX: 'No fix',
  GPS_FIX_TYPE_2D_FIX: '2D fix',
  GPS_FIX_TYPE_3D_FIX: '3D fix',
  GPS_FIX_TYPE_DGPS: 'DGPS fix',
  GPS_FIX_TYPE_RTK_FLOAT: 'RTK float',
  GPS_FIX_TYPE_RTK_FIXED: 'RTK fix',
  GPS_FIX_TYPE_STATIC: 'Static',
  GPS_FIX_TYPE_PPP: 'PPP fix',
}

export const meta = {
  title: 'Satellite indicator shows sats and fix',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * Drag a Satellite Indicator into the top bar: it shows GPS_RAW_INT's visible satellites and fix type.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface → Mini: drag a Satellite Indicator into the top bar')
  await enterEditMode(page)
  const hash = await addMiniWidget(page, 'Satellite Indicator', 'top', 0)
  await exitEditMode(page)
  await page.wait(2000)
  const [texts, gps] = await Promise.all([
    page.eval(`[...(${miniWidgetEl(hash)}?.querySelectorAll('.font-mono') ?? [])].map((s) => s.textContent.trim())`),
    vehicle.read('GPS_RAW_INT'),
  ])
  await page.check('"<n> sats" and the fix match GPS_RAW_INT', () => ({
    ok: texts[0] === `${gps.satellites_visible} sats` && texts[1] === FIX[gps.fix_type?.type],
    detail: `shows ${texts.join(' / ')}; GPS_RAW_INT ${gps.satellites_visible} sats, ${gps.fix_type?.type}`,
  }))
}
