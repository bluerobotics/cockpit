import { setUpActions } from '../lib/act-case.mjs'
import { editorText, reloadCockpit } from '../lib/act-dl.mjs'
import { clickActionButton, clickDialogButton, newAction, NO_ACTIONS } from '../lib/actions.mjs'
import { fieldByLabel } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { openMenuPage } from '../lib/mavlink-tools.mjs'

const LOGGING_KEY = 'cockpit-enable-system-logging'

export const meta = {
  title: "A JavaScript action's console.log reaches the system log",
  route: '/',
  needs: [],
  synced: { ...NO_ACTIONS, [LOGGING_KEY]: true },
}

const LINE = 'release-test JS ran'
const CODE = `console.log('${LINE}')`

// System logging is read once at start, and a fresh profile only learns the setting from the vehicle after that.
export const setup = async (ctx) => {
  await dismissFeaturesDialog(ctx.page)
  if (await ctx.page.eval(`console.log.toString().includes('[native code]')`)) await reloadCockpit(ctx.page, false)
  await setUpActions(ctx, false)
}

// Every message the current web session saved, from the "Cockpit - System Logs" IndexedDB store.
const SAVED_MESSAGES = `new Promise((resolve, reject) => {
  const open = indexedDB.open('Cockpit - System Logs')
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const all = open.result.transaction('cockpit-system-logs-db').objectStore('cockpit-system-logs-db').getAll()
    all.onsuccess = () => resolve(all.result.flatMap((log) => log?.events ?? []).map((e) => e.msg))
    all.onerror = () => reject(all.error)
  }
})`

/**
 * Write a JavaScript action that logs a line, Test it, create it, play it, and find the line twice
 * in the system log: in the console viewer under Settings → Dev, and in what the session saved.
 */
export default async function run({ page }) {
  await page.check('System logging is on', async () => ({
    ok: !(await page.eval(`console.log.toString().includes('[native code]')`)),
    detail: 'console calls go through the system logger',
  }))
  await page.caption('Settings → Actions → New action → JavaScript Action "Log (release)"')
  await newAction(page, 'JavaScript Action')
  await page.fill(await fieldByLabel(page, 'Action Name'), 'Log (release)')
  await page.fill('.monaco-editor .view-lines', CODE)
  await page.wait(800)
  await page.check('The editor holds the code', async () => {
    const text = await editorText(page)
    return { ok: text === CODE, detail: text }
  })
  await page.caption('Test Action, then Create')
  await clickDialogButton(page, 'Test Action', { settle: 1500 })
  await page.click('text=Create', { settle: 1500 })
  await page.caption('Play it')
  await clickActionButton(page, 'Log (release)', 'play')

  await page.caption('Settings → Dev → Open console, filtered on the line')
  await openMenuPage(page, 'settings-dev')
  await page.click('text=Open console', { settle: 1500 })
  await page.fill('input[placeholder="Filter…"]', LINE)
  await page.wait(1500)
  await page.check('The console shows the line twice (test and play)', async () => {
    const shown =
      await page.eval(`[...document.querySelectorAll('span.truncate')].filter((s) => s.checkVisibility({ visibilityProperty: true }))
      .map((s) => s.textContent.trim()).filter((t) => t.includes(${JSON.stringify(LINE)}))`)
    return { ok: shown.length === 2, detail: `${shown.length}: ${shown.join(' | ')}` }
  })
  await page.check('The saved system log has the line twice', async () => {
    const lines = (await page.eval(SAVED_MESSAGES)).filter((m) => m.trim() === LINE)
    return { ok: lines.length === 2, detail: `${lines.length} saved` }
  })
  await page.wait(1500)
}
