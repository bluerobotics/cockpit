import { inspectorListed, openMenuPage } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'Filtering messages in the inspector', route: '/', needs: ['vehicle'] }

/**
 * Type a message name in the inspector search and show only matching types remain.
 */
export default async function run({ page }) {
  await page.caption('Main menu → Tools → MAVLink')
  await openMenuPage(page, 'Tools', 'MAVLink')
  const before = await inspectorListed(page)
  await page.caption('Search "attitude"')
  await page.fill('input[placeholder="Search messages..."]', 'attitude')
  await page.wait(800)
  await page.check('Only matching messages remain', async () => {
    const after = await inspectorListed(page)
    return {
      ok: after.length > 0 && after.length < before.length && after.every((t) => t.includes('ATTITUDE')),
      detail: `${before.length} → ${after.length}: ${after.slice(0, 6).join(', ')}`,
    }
  })
  await page.wait(2000)
}
