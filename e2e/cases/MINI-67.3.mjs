import { fieldByLabel } from '../lib/cockpit.mjs'
import { exitEditMode } from '../lib/custom-widget.mjs'
import { addVgi, armInManual, dialogButton, lake, quietStart, turnBy, vgiShown } from '../lib/widgets.mjs'

const HEADING = '/mavlink/1/1/VFR_HUD/heading'

export const meta = {
  title: 'VGI template mode',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * A VGI whose Variable is a text template around the heading: it shows "Hdg <n>°" and follows a turn.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Edit interface → Mini: a Very Generic Indicator, Custom → Variable: a template')
  const hash = await addVgi(page)
  await page.click('text=Custom', { settle: 800 })
  await page.fill(await fieldByLabel(page, 'Variable'), `Hdg {{ ${HEADING} }}°`)
  await page.wait(800)
  await dialogButton(page, 'Done')
  await exitEditMode(page)
  await page.wait(1500)
  const read = async () => (await vgiShown(page, hash))?.value ?? ''
  const start = await read()
  await page.check('It shows "Hdg <heading>°"', async () => {
    const heading = await lake(page, HEADING)
    return { ok: start === `Hdg ${heading}°`, detail: `"${start}", heading ${heading}` }
  })
  await page.caption('Arm in Manual and drive a turn')
  await armInManual(vehicle)
  await turnBy(vehicle, 90)
  await page.wait(1500)
  const end = await read()
  const heading = await lake(page, HEADING)
  await page.check('After the turn it shows the new heading', () => ({
    ok: end !== start && end === `Hdg ${heading}°`,
    detail: `"${start}" → "${end}", heading ${heading}`,
  }))
}
