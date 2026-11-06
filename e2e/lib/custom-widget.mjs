// A custom widget built the way an operator builds one: a Collapsible Container dragged onto the
// view in edit mode, and Button elements dropped into it, each set to run a Cockpit action.

import { chooseOption } from './cockpit.mjs'

const centre = (page, expr) =>
  page.eval(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

// Element palette cards are picked up by their handle and dragged with the mouse (SortableJS in fallback mode).
export const elementHandle = (name) =>
  `[...document.querySelectorAll('.palette-card')].find((e) => e.getClientRects().length &&
    e.querySelector('.palette-card-label')?.innerText.trim().toLowerCase() === ${JSON.stringify(
      name.toLowerCase()
    )})?.querySelector('.palette-card-handle')`

/**
 * Main menu → Edit Interface.
 * @param {object} page - Driver page
 */
export async function enterEditMode(page) {
  await page.click('.mdi-menu-right', { settle: 900 })
  await page.click('text=Edit Interface', { settle: 2500 })
}

/**
 * Drag a Collapsible Container from the regular widgets onto the middle of the view.
 * @param {object} page - Driver page
 */
export async function addCollapsibleContainer(page) {
  const from = await centre(
    page,
    `[...document.querySelectorAll('[draggable=true]')].find((e) => e.innerText.includes('Collapsible Container'))`
  )
  await page.drag(from, { x: page.width * 0.56, y: page.height * 0.35 }, { html5: true, duration: 1200, settle: 2000 })
}

/**
 * Drop a Button element at `at` (inside the container), label it and pick its action.
 * @param {object} page - Driver page
 * @param {{x: number, y: number}} at - Drop point
 * @param {string} label - Button label
 * @param {string} action - Action name as listed under "Action to trigger"
 */
export async function addActionButton(page, at, label, action) {
  if (!(await page.eval(`!!${elementHandle('Button')}`))) await page.click('text=INPUT', { settle: 1200 })
  await page.drag(await centre(page, elementHandle('Button')), at, { duration: 1000, settle: 1500 })
  // A new element is labelled "Click Here" until it is given a label.
  await page.click(
    await centre(
      page,
      `[...document.querySelectorAll('button')].find((b) => b.getClientRects().length && /^click here$/i.test(b.innerText.trim()))`
    ),
    { settle: 1500 }
  )
  await page.fill(
    await centre(
      page,
      `[...document.querySelectorAll('input')].find((i) => i.getClientRects().length && i.value === 'Click Here')`
    ),
    label
  )
  await page.wait(500)
  await chooseOption(
    page,
    `[...document.querySelectorAll('select')].find((s) => s.getClientRects().length && [...s.options].some((o) => o.text === 'Mavlink arm'))`,
    action
  )
}

/**
 * Leave edit mode.
 * @param {object} page - Driver page
 * @returns {Promise<void>} Once out of edit mode
 */
export const exitEditMode = (page) => page.click('text=Exit', { settle: 2500 })
