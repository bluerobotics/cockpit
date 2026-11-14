import { addUrlProvider, PROVIDER, selectBaseMap, tileLayers } from '../lib/map-sources.mjs'
import { closeMenu, openMenuPage } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'Brightness and contrast of a provider', route: '/', needs: ['vehicle'] }

const host = new URL(PROVIDER.url.replace(/[{}]/g, '')).host

/**
 * The custom provider, added and selected before recording.
 */
export async function setup({ page }) {
  await addUrlProvider(page, PROVIDER)
  await selectBaseMap(page, PROVIDER.name)
}

/**
 * Raise the provider's brightness and contrast in Tools → Map and show the map change.
 */
export default async function run({ page }) {
  await page.check('Provider starts unadjusted', async () => {
    const layer = (await tileLayers(page, 'widget')).find((l) => l.host === host)
    return { ok: layer?.filter === '', detail: layer ? layer.filter || 'no filter' : 'provider not shown' }
  })
  await page.caption('Tools → Map: brightness and contrast of the provider')
  await openMenuPage(page, 'tools-map')
  await page.click('[aria-label="Brightness and contrast"]', { settle: 800 })
  for (const label of ['Brightness', 'Contrast']) {
    const track = await page.eval(`(() => {
      const slider = [...document.querySelectorAll('.v-overlay--active .v-slider')].find((s) => s.querySelector('label')?.textContent.trim() === '${label}')
      const r = slider?.querySelector('.v-slider-track')?.getBoundingClientRect(); return r ? { x: r.x + r.width * 0.85, y: r.y + r.height / 2 } : null })()`)
    if (!track) throw new Error(`no ${label} slider`)
    await page.click(track, { settle: 600 })
  }
  await page.key('Escape', { show: false })
  await closeMenu(page)
  await page.check('The map is drawn brighter and with more contrast', async () => {
    const layer = (await tileLayers(page, 'widget')).find((l) => l.host === host)
    const [, b, c] = layer?.filter.match(/brightness\(([\d.]+)\) contrast\(([\d.]+)\)/) ?? []
    return { ok: Number(b) > 1 && Number(c) > 1, detail: layer?.filter || 'no filter' }
  })
  await page.wait(2500)
}
