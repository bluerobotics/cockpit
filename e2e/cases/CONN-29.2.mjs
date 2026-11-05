import { openMenuPage } from '../lib/mavlink-tools.mjs'
import { setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'The web build explains that vehicle discovery is Standalone-only',
  route: '/',
  needs: ['vehicle'],
  platforms: ['web'],
}

export const setup = quiet

const PANEL = `[...document.querySelectorAll('*')].find((e) => e.childElementCount === 0
  && e.textContent.trim() === 'Vehicle network connection (global address)' && e.getClientRects().length)`

/**
 * Settings → General → the global address panel, where Standalone offers "Search for vehicles": the web
 * build cannot scan the network, so it should say that the search needs Standalone.
 */
export default async function run({ page }) {
  await page.caption('Settings → General → Vehicle network connection: look for the vehicle search')
  await openMenuPage(page, 'Settings', 'General')
  await page.eval(`${PANEL}?.scrollIntoView({ block: 'start' })`)
  await page.hover(
    await page.eval(
      `(() => { const r = ${PANEL}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`
    ),
    1500
  )
  const electron = await page.eval('!!window.electronAPI')
  const searchButton = await page.exists('text=Search for vehicles')
  await page.check('This is the web build, and it offers no network search', () => ({
    ok: !electron && !searchButton,
    detail: `Standalone ${electron}, "Search for vehicles" button ${searchButton}`,
  }))
  // The address panel is where Standalone offers the search, so that is where the web build should explain it.
  const said = await page.eval(`(() => { const panel = ${PANEL}?.closest('.text-white.w-full') ?? document.body
    return /standalone/i.test(panel.innerText) })()`)
  await page.check('It says that finding vehicles needs Cockpit Standalone', () => ({
    ok: said,
    detail: said ? 'the panel mentions Standalone' : 'nothing in the panel mentions Standalone or the search',
  }))
}
