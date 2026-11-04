import { addUrlProvider, PROVIDER, selectBaseMap, tileLayers } from '../lib/map-sources.mjs'

export const meta = { title: 'Add a custom tile provider', route: '/', needs: ['vehicle'] }

/**
 * Add a provider from a URL template through the map layers menu, pick it in the Map widget's layers, and show its tiles.
 */
export default async function run({ page }) {
  await page.caption('Map layers → "Add map provider": add one from a URL template')
  await addUrlProvider(page, PROVIDER)
  await page.caption(`Map layers: pick "${PROVIDER.name}"`)
  await selectBaseMap(page, PROVIDER.name)
  const host = new URL(PROVIDER.url.replace(/[{}]/g, '')).host
  await page
    .waitFor(async () => (await tileLayers(page, 'widget')).some((l) => l.host === host), { timeout: 20000 })
    .catch(() => undefined)
  await page.check('The map shows tiles from the new provider', async () => {
    const layers = await tileLayers(page, 'widget')
    return { ok: layers.some((l) => l.host === host), detail: layers.map((l) => l.host).join(', ') || 'no tiles' }
  })
  await page.wait(2500)
}
