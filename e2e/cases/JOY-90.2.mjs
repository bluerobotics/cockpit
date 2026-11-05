import { buttonAction, JOY_META, joystickSetup, mapButton, openJoystickPage, row, setAxis } from '../lib/joystick.mjs'

export const meta = { ...JOY_META, title: 'Table tab matches the mapping' }

export const setup = joystickSetup

const NEW_FUNCTION = 'Toggle bottom bar'

const rowsOf = (kind) =>
  `[...document.querySelectorAll('tr')].filter((r) => r.querySelector('td:first-child p')?.textContent.trim() === '${kind}')`
const axisRows = (page) =>
  page.eval(`${rowsOf('axis')}.map((r) => { const td = r.querySelectorAll('td')
    return { direction: [...(td[2].querySelector('i')?.classList ?? [])].find((c) => c.startsWith('mdi-pan')),
      min: td[3].querySelector('input')?.value, action: td[4].innerText.trim(), max: td[5].querySelector('input')?.value } })`)
const buttonFunctions = (page) =>
  page.eval(`${rowsOf('button')}.map((r) => r.querySelectorAll('td')[1].innerText.trim())`)

/**
 * Check every axis and button row of the Table tab against the stored mapping, watch an axis Preview
 * follow the stick, then change button 0 and find the new function on both tabs.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Table tab')
  await openJoystickPage(page)
  const mapping = await page.store('controller', 's.protocolMapping')
  const axes = await axisRows(page)
  const buttons = await buttonFunctions(page)

  await page.check('One axis row per gamepad axis, with its Direction, Min, function and Max', () => {
    const bad = axes.filter((a, i) => {
      const m = mapping.axesCorrespondencies[i]
      const direction = [0, 2].includes(i) ? 'mdi-pan-horizontal' : 'mdi-pan-vertical'
      return (
        a.direction !== direction || Number(a.min) !== m.min || a.action !== m.action.name || Number(a.max) !== m.max
      )
    })
    return {
      ok: axes.length === 6 && bad.length === 0,
      detail: `${axes.length} rows; mismatched: ${JSON.stringify(bad)}`,
    }
  })
  await page.check('One button row per gamepad button, showing its function', () => {
    const bad = buttons.filter((text, i) => text !== mapping.buttonsCorrespondencies.regular[i]?.action.name)
    return {
      ok: buttons.length === 17 && bad.length === 0,
      detail: `${buttons.length} rows; mismatched: ${bad.join(', ')}`,
    }
  })

  await page.caption('Move the left stick right: the axis 0 Preview follows')
  await setAxis(page, 0, 0.8)
  await page.wait(1000)
  const preview = await page.eval(`${row('axis', 0)}?.querySelectorAll('td')[1].querySelector('p')?.textContent.trim()`)
  await setAxis(page, 0, 0)
  await page.check('The Preview shows the stick at 0.80', () => ({ ok: preview === '0.80', detail: preview }))

  await page.caption(`Button 0 → "${NEW_FUNCTION}", then back to the Visual tab`)
  await mapButton(page, 0, NEW_FUNCTION)
  const inTable = await page.eval(`${row('button', 0)}?.querySelectorAll('td')[1].innerText.trim()`)
  await page.click('text=Visual', { settle: 2500 })
  const inVisual = await page.eval(
    `[...document.querySelectorAll('div.absolute.pointer-events-none')].some((d) => d.textContent.trim() === ${JSON.stringify(
      NEW_FUNCTION
    )})`
  )
  const stored = await buttonAction(page, 0)
  await page.check('The new function is stored once and shown on both tabs', () => ({
    ok: stored?.id === 'toggle_bottom_bar' && inTable === NEW_FUNCTION && inVisual,
    detail: `stored ${stored?.id}; table "${inTable}"; visual label ${inVisual}`,
  }))
  await page.wait(1500)
}
