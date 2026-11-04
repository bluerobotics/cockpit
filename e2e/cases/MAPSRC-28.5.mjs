import { addUrlProvider, PROVIDER, selectBaseMap, tileLayers } from '../lib/map-sources.mjs'
import { reopenAsAnotherComputer } from '../lib/mission.mjs'

export const meta = { title: 'Custom providers follow the user to another computer', route: '/', needs: ['vehicle'] }

/**
 * The custom provider, added before recording.
 */
export async function setup({ page }) {
  await addUrlProvider(page, PROVIDER)
}

/**
 * Open Cockpit on a brand-new profile with the same user and pick the provider there.
 */
export default async function run(ctx) {
  const { page } = ctx
  // Settings sync to the vehicle a few seconds after the last change.
  await page.caption('Letting the settings sync, then opening Cockpit as another computer')
  await page.wait(6000)
  await reopenAsAnotherComputer(ctx, '/')
  await page.check('The provider is known on the new computer', async () => {
    const names = () => page.store('mission', 's.customTileProviders.map((p) => p.name)')
    await page.waitFor(async () => (await names()).includes(PROVIDER.name), { timeout: 20000 }).catch(() => undefined)
    return { ok: (await names()).includes(PROVIDER.name), detail: (await names()).join(', ') || 'none' }
  })
  await page.caption(`Map layers: pick "${PROVIDER.name}"`)
  await selectBaseMap(page, PROVIDER.name)
  const host = new URL(PROVIDER.url.replace(/[{}]/g, '')).host
  await page
    .waitFor(async () => (await tileLayers(page, 'widget')).some((l) => l.host === host), { timeout: 20000 })
    .catch(() => undefined)
  await page.check('Its tiles load there', async () => (await tileLayers(page, 'widget')).some((l) => l.host === host))
  await page.wait(2500)
}
