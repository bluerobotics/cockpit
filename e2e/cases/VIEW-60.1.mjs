import { createView, profileViews, quietStart } from '../lib/widgets.mjs'

const NAME = 'Release test view'

export const meta = {
  title: 'Create a view and rename it',
  route: '/',
  needs: ['vehicle'],
}

export const setup = quietStart

/**
 * Edit mode → Views → +, name the new view in the dialog: it is first, selected and empty.
 */
export default async function run({ page }) {
  const before = await profileViews(page)
  await page.caption('Main menu → Edit interface → Views: +, then name it')
  await createView(page, NAME)
  await page.check(`"${NAME}" heads the Views list, selected`, async () => {
    const rows =
      await page.eval(`[...document.querySelectorAll('p.text-sm')].filter((p) => p.checkVisibility({ visibilityProperty: true })
      && p.parentElement.querySelector('.view-drag-handle')).map((p) => p.textContent.trim())`)
    const selected = await page.store('widget-manager', 's.currentView.name')
    return {
      ok: rows[0] === NAME && selected === NAME,
      detail: `list starts ${rows.slice(0, 3).join(', ')}; selected ${selected}`,
    }
  })
  await page.check('The profile has it first: no widgets, the three bottom containers', async () => {
    const views = await profileViews(page)
    const v = views[0]
    const containers = v.miniWidgetContainers.map((c) => `${c.name} (${c.widgets.length})`)
    return {
      ok:
        views.length === before.length + 1 &&
        v.name === NAME &&
        v.widgets.length === 0 &&
        v.miniWidgetContainers.length === 3 &&
        v.miniWidgetContainers.every((c) => c.name.startsWith('Bottom') && c.widgets.length === 0),
      detail: `${views.length} views (was ${before.length}); first "${v.name}", ${
        v.widgets.length
      } widgets, ${containers.join(', ')}`,
    }
  })
}
