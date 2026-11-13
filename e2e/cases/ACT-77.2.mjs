import { setUpActions } from '../lib/act-case.mjs'
import { angleDiff, armInManual, drive, editorText, HEADING, lake } from '../lib/act-dl.mjs'
import { clickActionButton, newAction, NO_ACTIONS } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'

export const meta = {
  title: 'A JavaScript action reads a data-lake variable picked with {{',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = async (ctx) => {
  await setUpActions(ctx, false)
  await armInManual(ctx.vehicle)
}

const NAME = 'Copy heading (release)'
const COPY = 'release-test/heading-copy'
const CODE = `cockpit.setDataLakeVariableData('${COPY}', cockpit.getDataLakeVariableData('${HEADING}'))`

/**
 * Write a JavaScript action that copies the heading into a variable, picking the heading by typing
 * "{{" and choosing it from the suggestions; play it, turn the boat, play again: the copy follows.
 */
export default async function run({ page, vehicle }) {
  await page.caption('New JavaScript Action; "{{" offers the data-lake variables')
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), NAME)
  await page.fill('.monaco-editor .view-lines', `cockpit.setDataLakeVariableData('${COPY}', {{VFR_HUD/head`)
  await page.wait(1500)
  await page.key('Enter')
  await page.type(')')
  await page.wait(800)
  await page.check('Picking the heading inserted its getDataLakeVariableData call', async () => {
    const text = await editorText(page)
    return { ok: text === CODE, detail: text }
  })
  await page.click('text=Create', { settle: 1500 })

  const playAndCompare = async (label) => {
    await clickActionButton(page, NAME, 'play')
    const [copy, heading] = await Promise.all([lake(page, COPY), lake(page, HEADING)])
    await page.check(label, () => ({
      ok: typeof copy === 'number' && angleDiff(copy, heading) <= 3,
      detail: `${COPY} = ${copy}, heading now ${heading}`,
    }))
    return copy
  }
  await page.caption('Play it')
  const first = await playAndCompare('The copy equals the heading')
  await page.caption('Turn the boat')
  await drive(vehicle, {
    steering: 1900,
    ms: 30000,
    until: async () => angleDiff(await lake(page, HEADING), first) >= 45,
  })
  await page.wait(2000)
  await page.caption('Play it again')
  const second = await playAndCompare('The copy follows the new heading')
  await page.check('The heading really changed between the plays', () => ({
    ok: angleDiff(second, first) >= 30,
    detail: `${first}° then ${second}°`,
  }))
}
