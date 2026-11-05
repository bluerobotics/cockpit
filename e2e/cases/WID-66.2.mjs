import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  closeDialog,
  dialogButton,
  DIY,
  diyEditorText,
  diyElement,
  openWidgetConfig,
  placeWidget,
  quietStart,
  typeDiyCode,
  widgetByHash,
  writeDiy,
} from '../lib/widgets.mjs'

export const meta = {
  title: 'DIY changes persist and reload',
  route: '/',
  needs: ['vehicle'],
}

/**
 * The DIY widget of DIY-66.1, built through the UI.
 */
export const setup = async (ctx) => {
  await quietStart(ctx)
  ctx.widget = await placeWidget(ctx.page, 'Do It Yourself', { configure: true })
  await writeDiy(ctx.page, DIY)
  await exitEditMode(ctx.page)
  ctx.saved = (await widgetByHash(ctx.page, ctx.widget.hash)).options
}

/**
 * Reload Cockpit: the DIY widget still shows its code's result and keeps its options. Change the HTML in
 * its editor and press Reset: the editor goes back to the saved code.
 */
export default async function run({ page, widget, saved }) {
  await page.caption('A DIY widget showing "Release test OK": reload Cockpit')
  await page.reload()
  await page.waitFor(async () => Boolean(await widgetByHash(page, widget.hash).catch(() => null)), {
    timeout: 60000,
    label: 'the DIY widget to come back',
  })
  await page.waitFor(() => page.eval(`!!document.querySelector('#r')`), { label: 'its #r element' })
  await page.eval(
    `document.querySelector('#r').closest('.outerWidget').dataset.e2eWidget = ${JSON.stringify(widget.hash)}`
  )
  await page.wait(2000)
  const shown = await diyElement(page, widget.hash, 'r')
  await page.check('After the reload it still shows "Release test OK" in red', () => ({
    ok: shown?.text === 'Release test OK' && shown.color === 'rgb(255, 0, 0)',
    detail: JSON.stringify(shown),
  }))
  await page.check('Its stored html/css/js are unchanged', async () => {
    const { options } = await widgetByHash(page, widget.hash)
    const same = ['html', 'css', 'js'].filter((k) => options[k] === saved[k])
    return { ok: same.length === 3, detail: `unchanged: ${same.join(', ') || 'none'}` }
  })

  await page.caption('Open its configuration, change the text, then Reset')
  await enterEditMode(page)
  await openWidgetConfig(page, widget.name)
  await typeDiyCode(page, 'html', '<div id="r">Changed</div>')
  const edited = await diyEditorText(page, 'html')
  await dialogButton(page, 'Reset', 1500)
  const reset = await diyEditorText(page, 'html')
  await page.check('Reset brings back the last saved code', () => ({
    ok: edited.includes('Changed') && reset.trim() === saved.html.trim(),
    detail: `edited "${edited}", after Reset "${reset}"`,
  }))
  await closeDialog(page)
}
