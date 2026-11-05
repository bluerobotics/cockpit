import { exitEditMode } from '../lib/custom-widget.mjs'
import { DIY, diyElement, placeWidget, quietStart, widgetByHash, writeDiy } from '../lib/widgets.mjs'

export const meta = {
  title: 'DIY widget shows an HTML/CSS/JS change after Apply',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * Add a Do It Yourself widget, write HTML, JS and CSS in its editors and Apply: it shows the result.
 */
export default async function run({ page }) {
  await page.caption('Edit interface: add a Do It Yourself widget')
  const widget = await placeWidget(page, 'Do It Yourself', { configure: true })
  const before = await page.eval(`document.querySelector('[data-e2e-widget="${widget.hash}"]')?.innerText.trim() ?? ''`)
  await page.caption('Write the HTML, JS and CSS, then Apply')
  await writeDiy(page, DIY)
  await exitEditMode(page)
  const shown = await diyElement(page, widget.hash, 'r')
  await page.check('The widget shows "Release test OK" in red (was the placeholder)', () => ({
    ok:
      before.includes('Create your own widget!') &&
      shown?.text === 'Release test OK' &&
      shown.color === 'rgb(255, 0, 0)',
    detail: `before "${before}"; now ${JSON.stringify(shown)}`,
  }))
  await page.check('Its options hold the new code', async () => {
    const { options } = await widgetByHash(page, widget.hash)
    const ok =
      options.html.trim() === '<div id="r">Release test</div>' &&
      options.js.includes(DIY.js) &&
      options.css.includes('#r { color: red')
    return { ok, detail: JSON.stringify({ html: options.html, js: options.js, css: options.css }) }
  })
}
