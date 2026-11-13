import {
  ACTION_NAME,
  ACTION_URL_PART,
  dialogOpensWithin,
  plugVirtualGamepad,
  pressButton,
  restartCockpit,
  UNDECIDED,
  watchRequests,
} from '../lib/extensions.mjs'
import { sawSnackbar } from '../lib/mission.mjs'

export const meta = {
  title: "An extension's joystick suggestion can be applied, and the button works",
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
}

const GROUP = '4K Cam on any vehicle types'
const BUTTON = 10

const SUGGESTION_APPLY = `(() => { const card = [...document.querySelectorAll('.suggestion-item-compact')]
    .find((c) => c.getClientRects().length && c.querySelector('h4')?.textContent.trim() === ${JSON.stringify(
      ACTION_NAME
    )})
  return card && [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Apply') })()`

/**
 * Scroll the suggestion's Apply button into view (it sits below the fold of the dialog's list).
 * @param {object} page - Driver page
 * @returns {Promise<{x: number, y: number}|null>} Its centre, or null when there is no such suggestion
 */
async function suggestionApply(page) {
  if (
    !(await page.eval(
      `(() => { const b = ${SUGGESTION_APPLY}; b?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return !!b })()`
    ))
  )
    return null
  await page.wait(1200)
  return page.eval(
    `(() => { const r = ${SUGGESTION_APPLY}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
  )
}

// The confirmation dialog's own Apply, not the suggestion cards' behind it.
const confirmApply = (page) =>
  page.eval(`(() => { const card = [...document.querySelectorAll('.v-overlay--active .v-card')].find((c) => c.innerText.includes('Apply Joystick Mapping Suggestion'))
    const b = card && [...card.querySelectorAll('.v-card-actions button')].find((x) => x.textContent.trim() === 'Apply'); if (!b) return null
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)

const mappedAction = (page) =>
  page.store('controller', `s.protocolMapping.buttonsCorrespondencies.regular[${BUTTON}]?.action ?? null`)

/**
 * Accept the extension's action (the suggestion needs it), apply its joystick suggestion for
 * button 10, then press that button on a virtual gamepad and check the action reached the extension.
 */
export default async function run({ page }) {
  await page.caption('Start Cockpit and add the extension action the suggestion uses')
  await restartCockpit(page)
  if (!(await dialogOpensWithin(page))) throw new Error('the BlueOS Extension Features dialog did not open')
  await page.click('text=Add Action', { settle: 1500 })

  await page.caption('Joystick Mappings tab → "4K Cam on any vehicle types"')
  await page.click('text=Joystick Mappings', { settle: 1200 })
  await page.click(`text=${GROUP}`, { settle: 2500 })
  await page.check('Each suggestion card holds its own joystick drawing', async () => {
    const spill =
      await page.eval(`[...document.querySelectorAll('.suggestion-item-compact')].filter((c) => c.getClientRects().length)
      .map((c) => { const r = c.getBoundingClientRect(); const d = c.querySelector('.joystick-svg-container-small').getBoundingClientRect()
        return Math.round(Math.max(r.left - d.left, d.right - r.right, d.bottom - r.bottom, 0)) })`)
    const worst = Math.max(0, ...spill)
    return {
      ok: spill.length > 0 && worst <= 1,
      detail: `drawings reach ${worst} px past their cards (${spill.length} cards)`,
    }
  })
  const apply = await suggestionApply(page)
  if (!apply) throw new Error(`no "${ACTION_NAME}" suggestion with an Apply button`)
  await page.check(`It suggests "${ACTION_NAME}" on button ${BUTTON}`, async () => {
    const before = await mappedAction(page)
    return {
      ok: before?.id !== 'br4kcam_white_balance_all',
      detail: `button ${BUTTON} now: ${before?.name ?? 'nothing'}`,
    }
  })

  await page.caption('Apply it')
  await page.click(apply, { settle: 1200 })
  await page.check('The confirmation shows button 10 going to the action', async () => {
    const text = await page.eval(
      `[...document.querySelectorAll('.v-overlay--active .v-card')].find((c) => c.innerText.includes('Apply Joystick Mapping Suggestion'))?.innerText.replace(/\\s+/g, ' ') ?? ''`
    )
    return { ok: text.includes(`Button ${BUTTON}`) && text.includes(ACTION_NAME), detail: text.slice(0, 160) }
  })
  await page.wait(1000)
  await page.click(await confirmApply(page), { settle: 300 })
  await page.check('Cockpit says it was applied', async () => ({
    ok: await sawSnackbar(page, `Joystick mapping "${ACTION_NAME}" applied successfully.`),
  }))
  await page.check(`Button ${BUTTON} is mapped to the action`, async () => {
    const action = await mappedAction(page)
    return {
      ok: action?.id === 'br4kcam_white_balance_all' && action?.protocol === 'cockpit-action',
      detail: JSON.stringify(action),
    }
  })
  await page.click('.features-modal > .fixed button', { settle: 800 })
  if (await page.exists('text=Close anyway')) await page.click('text=Close anyway', { settle: 800 })

  await page.caption(`Plug in a (virtual) gamepad and press button ${BUTTON}`)
  const requests = await watchRequests(page, ACTION_URL_PART)
  await plugVirtualGamepad(page)
  await page.waitFor(() => page.store('controller', 's.joysticks.size > 0'), { label: 'Cockpit to see the gamepad' })
  await page.wait(1500)
  await pressButton(page, BUTTON)
  await page.wait(2500)
  await page.check('Pressing it sent the action to the extension, once', () => {
    const posts = requests.filter((r) => r.method === 'POST')
    const ok = posts.length === 1 && posts[0].status === 200 && /onceAWB/.test(posts[0].body ?? '')
    return { ok, detail: posts.map((p) => `POST ${p.status ?? p.error} ${p.body}`).join(' · ') || 'no request' }
  })
  await page.wait(1500)
}
