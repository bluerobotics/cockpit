import {
  DIALOG_CLOSE,
  dialogOpensWithin,
  EXTENSION,
  restartCockpit,
  UNDECIDED,
  watchRequests,
} from '../lib/extensions.mjs'

export const meta = {
  title: "An extension's widget can be added from the edit menu and loads",
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
  // Headless Chrome leaves cross-origin iframes out of the screencast unless they share the page's process.
  browserArgs: ['--disable-features=IsolateOrigins,site-per-process', '--disable-site-isolation-trials'],
}

// No extension on the test vehicle offers a widget, so 4K Cam Manager's extras get one in transit,
// shaped like the ones RadCam Manager ships: its own page, with its favicon as the card icon.
const WIDGET = { name: '4K Cam Manager', iframeUrl: '/', iconUrl: '/favicon.ico', useExtensionPathAsBaseUrl: true }
const addWidget = (extras) => ({ ...extras, widgets: [WIDGET] })

const card = (page) =>
  page.eval(`(() => { const img = [...document.querySelectorAll('img[alt=widget-icon]')].find((i) => i.src.includes('${EXTENSION}'))
    const c = img?.closest('[draggable=true]'); if (!c) return null; const r = c.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, icon: img.src, iconWidth: img.naturalWidth, label: c.innerText.trim() } })()`)

const iframeWidget = (page) =>
  page.store(
    'widget-manager',
    `s.currentView.widgets.filter((w) => w.component === 'IFrame').map((w) => ({ name: w.name, source: w.options.source }))`
  )

/**
 * Open the edit menu, find the extension's widget card with its icon, drag it onto the view, leave
 * edit mode and check the extension's page loads in it.
 */
export default async function run({ page }) {
  await restartCockpit(page, { editExtras: addWidget })
  if (await dialogOpensWithin(page, 15000)) {
    await page.click(DIALOG_CLOSE, { settle: 800 })
    await page.click('text=Close anyway', { settle: 800 })
  }
  await page.caption('Main menu → Edit interface')
  await page.click('.mdi-menu-right', { settle: 900 })
  await page.click('text=Edit Interface', { settle: 2500 })
  await page.waitFor(() => card(page), { label: "the extension's widget card" })
  const found = await card(page)
  await page.hover(found, 1200)
  await page.check("The extension's widget is offered, marked External, with its icon", () => ({
    ok: found.iconWidth > 0 && found.icon.includes(`/extensionv2/${EXTENSION}/`) && /External/.test(found.label),
    detail: `${found.label.replace(/\s+/g, ' ')} · icon ${found.iconWidth}px`,
  }))

  await page.caption('Drag it onto the view')
  const requests = await watchRequests(page, `/extensionv2/${EXTENSION}/`)
  const target = await page.eval(`(() => { const r = document.querySelector('.main-view').getBoundingClientRect()
    return { x: r.x + r.width * 0.55, y: r.y + r.height * 0.4 } })()`)
  await page.drag(found, target, { html5: true, duration: 1200, settle: 1500 })
  await page.check('An IFrame widget pointing at the extension is on the view', async () => {
    const widgets = await iframeWidget(page)
    return { ok: widgets.some((w) => w.source === `/extensionv2/${EXTENSION}/`), detail: JSON.stringify(widgets) }
  })

  await page.caption('Leave edit mode')
  await page.click('text=Exit', { settle: 3000 })
  await page.check("The extension's page loads inside it", async () => {
    const doc = requests.find((r) => r.method === 'GET' && r.url.endsWith(`/extensionv2/${EXTENSION}/`))
    const script = requests.find((r) => /\/assets\/.*\.js$/.test(r.url))
    const shown =
      await page.eval(`(() => { const f = document.querySelector('iframe[src*="${EXTENSION}"]'); const r = f?.getBoundingClientRect()
      return Boolean(r && r.width > 100 && r.height > 100) })()`)
    // Where the iframe gets its own process (Standalone), its requests are not this page's to watch,
    // but the frame shows up as a target of its own once its document is running.
    const { targetInfos } = await page.send('Target.getTargets')
    const ownProcess = targetInfos.some((t) => t.type === 'iframe' && t.url.includes(`/extensionv2/${EXTENSION}/`))
    const ok = doc?.status === 200 && (script?.status === 200 || ownProcess) && shown
    const scriptState = script?.status ?? script?.error ?? (ownProcess ? 'in its own process' : 'not requested')
    return {
      ok,
      detail: `page ${doc?.status ?? 'not requested'}, its script ${scriptState}, iframe ${
        shown ? 'on screen' : 'missing'
      }`,
    }
  })
  await page.wait(3000)
}
