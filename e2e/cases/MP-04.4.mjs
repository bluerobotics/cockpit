import { mapPoint } from '../lib/cockpit.mjs'
import { addWaypointHere, planningZoom, sawSnackbar } from '../lib/mission.mjs'

export const meta = { title: 'End of the undo/redo stack', route: '/mission-planning', needs: ['vehicle'] }

const disabled = (page, icon) => page.eval(`!!document.querySelector('button:has(.${icon})')?.disabled`)

/**
 * Undo past the start of the history and redo past its end, and show Cockpit says so.
 */
export default async function run({ page }) {
  await planningZoom(page)
  await page.caption('One waypoint')
  await addWaypointHere(page, await mapPoint(page, 'planning', 0.36, 0.36))
  await page.caption('Undo it')
  await page.click('button:has(.mdi-undo)', { settle: 1000 })
  await page.check('Undo button disabled at the start of the history', () => disabled(page, 'mdi-undo'))
  await page.caption('Undo once more from the keyboard')
  const noUndo = sawSnackbar(page, 'No more steps to undo.')
  await page.key('Meta+z')
  await page.check('"No more steps to undo."', () => noUndo)

  await page.caption('Redo it')
  await page.click('button:has(.mdi-redo)', { settle: 1000 })
  await page.check('Redo button disabled at the end of the history', () => disabled(page, 'mdi-redo'))
  await page.caption('Redo once more from the keyboard')
  const noRedo = sawSnackbar(page, 'No more steps to redo.')
  await page.key('Meta+Shift+z')
  await page.check('"No more steps to redo."', () => noRedo)
  await page.wait(1500)
}
