import { chooseOption } from '../lib/cockpit.mjs'
import { addCollapsibleContainer, enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  axisMapping,
  editAxis,
  JOY_META,
  joystickSetup,
  lakeValue,
  openJoystickPage,
  setAxis,
  typeInto,
  watchManualControl,
} from '../lib/joystick.mjs'
import { closeMenu } from '../lib/mavlink-tools.mjs'

export const meta = { ...JOY_META, title: 'MANUAL_CONTROL axis fed by a non-joystick input' }

export const setup = async (ctx) => {
  await joystickSetup(ctx)
  ctx.sent = await watchManualControl(ctx.page)
}

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'nearest', inline: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

const sliderHandle = `[...document.querySelectorAll('.palette-card')].find((e) => e.getClientRects().length &&
  e.querySelector('.palette-card-label')?.innerText.trim().toLowerCase() === 'slider')?.querySelector('.palette-card-handle')`

// The input of an option row in the element's configuration drawer.
const optionInput = (label) =>
  `[...document.querySelectorAll('p')].find((p) => p.getClientRects().length && p.textContent.trim() === '${label}')?.parentElement.querySelector('input')`

/**
 * Unmap Axis X from the joystick, then drive inputs/mavlink/axis-x from a custom-widget slider: Cockpit
 * sends the slider's value as MANUAL_CONTROL x.
 */
export default async function run({ page, sent }) {
  await page.caption('Settings → Joystick → Table: axis 1 (Axis X) → "No function"')
  await openJoystickPage(page)
  await editAxis(page, 1, { action: 'No function' })
  await page.check('No axis drives Axis X', async () => {
    const all = await page.store(
      'controller',
      'Object.values(s.protocolMapping.axesCorrespondencies).map((c) => c.action.id)'
    )
    return { ok: !all.includes('inputs/mavlink/axis-x'), detail: `axis 1: ${(await axisMapping(page, 1))?.action.id}` }
  })
  await closeMenu(page)
  // Cockpit builds the MANUAL_CONTROL state on a joystick update.
  await setAxis(page, 2, 0.2)
  await page.wait(300)
  await setAxis(page, 2, 0)

  await page.caption('Edit Interface: a Collapsible Container with a Slider, -1000 to 1000, on Axis X')
  await enterEditMode(page)
  await addCollapsibleContainer(page)
  if (!(await page.eval(`!!${sliderHandle}`))) await page.click('text=INPUT', { settle: 1200 })
  await page.drag(
    await centre(page, sliderHandle),
    { x: page.width * 0.56, y: page.height * 0.3 },
    { duration: 1000, settle: 1500 }
  )
  await page.click(
    await centre(page, `[...document.querySelectorAll('.slider-container')].find((e) => e.getClientRects().length)`),
    {
      settle: 1500,
    }
  )
  await typeInto(page, await centre(page, optionInput('Min Value')), -1000)
  await typeInto(page, await centre(page, optionInput('Max Value')), 1000)
  await page.click('text=select', { settle: 1000 })
  await chooseOption(
    page,
    `[...document.querySelectorAll('select')].find((s) => s.getClientRects().length && [...s.options].some((o) => o.text.trim() === 'Axis X'))`,
    'Axis X'
  )
  await exitEditMode(page)

  await page.caption('Move the slider to 500')
  const track =
    await page.eval(`(() => { const t = [...document.querySelectorAll('.slider-container .v-slider-track')].find((e) => e.getClientRects().length)
    if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.x + r.width * 0.75, y: r.y + r.height / 2 } })()`)
  if (!track) throw new Error('no slider on the view')
  await page.click(track, { settle: 2000 })
  const output = await lakeValue(page, 'outputs/mavlink/axis-x')
  await page.check('outputs/mavlink/axis-x follows the slider to about 500', () => ({
    ok: Math.abs(output - 500) <= 25,
    detail: `${output}`,
  }))
  await page.check('Cockpit sends MANUAL_CONTROL x at that value', () => ({
    ok: Math.abs(sent.last?.x - Math.round(output)) <= 1,
    detail: sent.last ? `x ${sent.last.x} (${sent.count} messages)` : 'nothing sent',
  }))
}
