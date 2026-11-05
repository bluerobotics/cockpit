import { JOY_META, joystickSetup, openJoystickPage, setAxis, setButton } from '../lib/joystick.mjs'

export const meta = { ...JOY_META, title: 'Visual tab follows the physical joystick' }

export const setup = joystickSetup

const svg = `document.querySelector('object[type="image/svg+xml"]')?.contentDocument`
const lit = (page, button) => page.eval(`${svg}?.getElementById('path_b${button}')?.getAttribute('fill') === 'red'`)
// Offset of a stick's dot, from the translate Cockpit puts on it.
const dot = (page, path) =>
  page.eval(`(() => { const t = ${svg}?.getElementById('${path}')?.getAttribute('transform') ?? ''
    const m = t.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/); return m ? [Number(m[1]), Number(m[2])] : null })()`)

/**
 * Press buttons 0-3 one at a time and move both sticks round a circle, on the Visual tab.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Visual tab')
  await openJoystickPage(page, 'Visual')
  await page.wait(1500)

  const buttons = []
  for (const button of [0, 1, 2, 3]) {
    await page.caption(`Press button ${button}`)
    await setButton(page, button, true)
    await page.wait(700)
    const others = await Promise.all([0, 1, 2, 3].filter((b) => b !== button).map((b) => lit(page, b)))
    buttons.push({ button, on: await lit(page, button), others: others.some(Boolean) })
    await setButton(page, button, false)
    await page.wait(500)
    buttons.at(-1).off = !(await lit(page, button))
  }
  await page.check('Each button lights up alone while pressed, and goes dark again', () => ({
    ok: buttons.every((b) => b.on && !b.others && b.off),
    detail: buttons.map((b) => `b${b.button}: ${b.on ? 'lit' : 'dark'}${b.others ? ', others lit' : ''}`).join('; '),
  }))

  await page.caption('Move both sticks round a circle')
  const wrong = []
  for (let step = 0; step <= 16; step++) {
    const angle = (step / 16) * 2 * Math.PI
    const [x, y] = [Math.cos(angle), Math.sin(angle)].map((v) => Number(v.toFixed(3)))
    for (const axis of [0, 2]) await setAxis(page, axis, x)
    for (const axis of [1, 3]) await setAxis(page, axis, y)
    await page.wait(250)
    for (const path of ['path_b10', 'path_b11']) {
      const at = await dot(page, path)
      // The dot moves 15 units per full deflection, in the stick's own directions.
      const off = !at || Math.abs(at[0] - 15 * x) > 1 || Math.abs(at[1] - 15 * y) > 1
      if (off) wrong.push(`${path} at (${x}, ${y}): ${at}`)
    }
  }
  for (const axis of [0, 1, 2, 3]) await setAxis(page, axis, 0)
  await page.check('Both stick dots follow the sticks', () => ({
    ok: wrong.length === 0,
    detail: wrong.length ? wrong.slice(0, 3).join('; ') : '17 positions per stick',
  }))
  await page.wait(1000)
}
