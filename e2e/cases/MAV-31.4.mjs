import { closeMenu, inspectorMessage, openMenuPage, trackMessage } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'The inspector keeps its tracked messages when reopened', route: '/', needs: ['vehicle'] }

const trackedTypes = (page) =>
  page.eval(
    `[...document.querySelectorAll('.font-bold span')].map((s) => s.textContent.trim()).filter((t) => /^[A-Z0-9_]+$/.test(t))`
  )

/**
 * Track two messages, close the MAVLink page, open it again, and check they are still tracked and updating.
 */
export default async function run({ page }) {
  await page.caption('Main menu → Tools → MAVLink, track HEARTBEAT and ATTITUDE')
  await openMenuPage(page, 'Tools', 'MAVLink')
  await trackMessage(page, 'HEARTBEAT')
  await trackMessage(page, 'ATTITUDE')
  await page.caption('Close the page and open it again')
  await closeMenu(page)
  await page.wait(1000)
  await openMenuPage(page, 'Tools', 'MAVLink')
  await page.check('Both messages are still tracked', async () => {
    const tracked = await trackedTypes(page)
    return { ok: ['HEARTBEAT', 'ATTITUDE'].every((t) => tracked.includes(t)), detail: tracked.join(', ') || 'none' }
  })
  await page.check('They keep updating', async () => {
    const first = (await inspectorMessage(page, 'ATTITUDE', 'incoming'))?.time_boot_ms
    await page.wait(1500)
    const later = (await inspectorMessage(page, 'ATTITUDE', 'incoming'))?.time_boot_ms
    return { ok: Number.isFinite(first) && later > first, detail: `time_boot_ms ${first} → ${later}` }
  })
  await page.wait(1500)
}
