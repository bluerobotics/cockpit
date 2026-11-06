import { exitEditMode } from '../lib/custom-widget.mjs'
import { closeDialog, placeWidget, quietStart, servePage } from '../lib/widgets.mjs'

const TEXT = 'Release test page'

export const meta = {
  title: 'IFrame shows the URL set in its settings',
  route: '/',
  needs: ['vehicle'],
  // Headless Chrome leaves cross-origin iframes out of the screencast unless they share the page's process.
  browserArgs: ['--disable-features=IsolateOrigins,site-per-process', '--disable-site-isolation-trials'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  ctx.site = await servePage(TEXT)
}

/**
 * Add an IFrame, type a local page's URL in "Iframe Source" and set it: the widget loads that page.
 */
export default async function run({ page, site }) {
  await page.caption('Edit interface: add an IFrame and open its cog')
  await placeWidget(page, 'IFrame', { configure: true })
  await page.caption(`Iframe Source: ${site.url}, then Set`)
  await page.fill('.v-overlay--active input[placeholder="http://example.com"]', site.url)
  await page.click('.v-overlay--active .mdi-check', { settle: 2000 })
  await closeDialog(page)
  await exitEditMode(page)
  await page.wait(2000)
  await page.check('The iframe shows the page and it was served', async () => {
    // The iframe is teleported out of the widget, onto the view.
    const src = await page.eval(
      `[...document.querySelectorAll('.widgets-view iframe')].map((f) => f.src).find((s) => s === ${JSON.stringify(
        site.url
      )}) ?? ''`
    )
    return {
      ok: src === site.url && site.hits.some((h) => h.path === '/release-test' && h.status === 200),
      detail: `src ${src || 'none'}; ${site.hits.length} request(s) to the page`,
    }
  })
  site.close()
}
