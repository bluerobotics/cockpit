import { exitEditMode } from '../lib/custom-widget.mjs'
import { watchRequests } from '../lib/extensions.mjs'
import { closeDialog, placeWidget, quietStart, widgetByHash } from '../lib/widgets.mjs'

// A BlueOS page on the vehicle; its root is the one every BlueOS version serves.
const PAGE = '/'

export const meta = {
  title: 'IFrame with "Use vehicle address as base URL"',
  route: '/',
  needs: ['vehicle'],
  // Headless Chrome leaves cross-origin iframes out of the screencast unless they share the page's process.
  browserArgs: ['--disable-features=IsolateOrigins,site-per-process', '--disable-site-isolation-trials'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  ctx.requests = await watchRequests(ctx.page, ctx.vehicleHost)
}

/**
 * Add an IFrame, turn on "Use vehicle address as base URL" and set a path: it loads that
 * BlueOS page from the vehicle.
 */
export default async function run({ page, vehicleHost, requests }) {
  await page.caption('Edit interface: add an IFrame and open its cog')
  const widget = await placeWidget(page, 'IFrame', { configure: true })
  await page.caption('Advanced options: "Use vehicle address as base URL"')
  await page.click('text=Use vehicle address as base URL', { settle: 1000 })
  await page.caption(`Iframe Source: ${PAGE}, then Set`)
  await page.fill('.v-overlay--active input[placeholder="/my-service"]', PAGE)
  await page.click('.v-overlay--active .mdi-check', { settle: 2000 })
  await closeDialog(page)
  await exitEditMode(page)
  await page.wait(6000)
  const expected = `http://${vehicleHost}${PAGE}`
  await page.check(`The iframe loads ${expected}`, async () => {
    // The iframe is teleported out of the widget, onto the view.
    const src = await page.eval(
      `[...document.querySelectorAll('.widgets-view iframe')].map((f) => f.src).find((s) => s === ${JSON.stringify(
        expected
      )}) ?? ''`
    )
    const { options } = await widgetByHash(page, widget.hash)
    const served = requests.find((r) => r.url === expected)
    return {
      ok: src === expected && options.useVehicleAddressAsBase === true && served?.status === 200,
      detail: `src ${src || 'none'}; base option ${options.useVehicleAddressAsBase}; response ${
        served?.status ?? served?.error ?? 'none'
      }`,
    }
  })
}
