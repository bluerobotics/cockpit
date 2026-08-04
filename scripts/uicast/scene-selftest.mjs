/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */
// Smoke test for the recording rig, run before any real scenario so a broken rig fails loudly
// instead of quietly producing a video of nothing.
//
//   node scripts/uicast/record.mjs scripts/uicast/scene-selftest.mjs /tmp/selftest.mp4
//
// It proves the five things every scenario depends on: the app boots, the drawn cursor and
// caption overlay installed, the seeded layout put a widget on the view, synthetic clicks
// actually reach the app, and frames are captured.

import { boot, waitForMap, WITH_MAP } from './cockpit.mjs'

/**
 * @param {object} page - Scenario page helpers from the recorder.
 * @returns {Promise<void>}
 */
export default async function scene(page) {
  await boot(page, '/', WITH_MAP)

  const overlay = await page.eval('typeof window.__uicast?.caption')
  if (overlay !== 'function') throw new Error('the cursor/caption overlay did not install')

  // Without the seeded profile Cockpit shows "You currently have no widgets!", and every
  // widget scenario would film an empty view while still passing its own assertions.
  await waitForMap(page)

  await page.caption('Recording rig self-test')
  await page.wait(1200)

  // Opening the main menu is the cheapest proof that a synthetic click reaches the app: nothing
  // is created or persisted, but the DOM has to change for the assertion below to pass.
  await page.click('#menu-trigger', { settle: 1200 })
  const menuOpened = await page.eval(`document.body.textContent.includes('Settings')`)
  if (!menuOpened) throw new Error('clicking the main menu trigger did not open it')

  await page.caption('Clicks reach the app')
  await page.wait(1500)
  await page.caption('')
  await page.wait(600)
}
