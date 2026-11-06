import { centreOf, createView, profileViews, quietStart, viewRow } from '../lib/widgets.mjs'

const NAME = 'Release hide test'
const COPY = `${NAME}+`

export const meta = {
  title: 'Hide, duplicate and delete a view',
  route: '/',
  needs: ['vehicle'],
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await createView(ctx.page, NAME)
}

const rowIcon = async (page, name, icon) => {
  const at = await centreOf(page, `${viewRow(name)}?.querySelector('.mdi-${icon}')`)
  if (!at) throw new Error(`no ${icon} icon on the view "${name}"`)
  return at
}
const selectorViews = (page) =>
  page.store('widget-manager', 's.currentProfile.views.filter((v) => v.visible).map((v) => v.name)')

/**
 * Hide the new view with its eye (from another view, since the current one cannot be hidden), duplicate
 * it with its copy icon, and delete the copy with its trash icon.
 */
export default async function run({ page }) {
  const count = (await profileViews(page)).length
  const other = (await profileViews(page)).find((v) => v.name !== NAME)
  await page.caption(`Select "${other.name}": the view being shown cannot be hidden`)
  await page.click(await centreOf(page, viewRow(other.name)), { settle: 1200 })
  await page.caption(`Click the eye of "${NAME}"`)
  await page.click(await rowIcon(page, NAME, 'eye'), { settle: 1200 })
  await page.check('Its eye closes and the View selector no longer offers it', async () => {
    const closed = await page.eval(`!!${viewRow(NAME)}?.querySelector('.mdi-eye-closed')`)
    const offered = await selectorViews(page)
    const stored = (await profileViews(page)).find((v) => v.name === NAME)?.visible
    return {
      ok: closed && !offered.includes(NAME) && stored === false,
      detail: `eye closed ${closed}, visible ${stored}, selector: ${offered.join(', ')}`,
    }
  })

  await page.caption(`Click the copy icon of "${NAME}"`)
  await page.click(await rowIcon(page, NAME, 'content-copy'), { settle: 1500 })
  await page.check(`A copy "${COPY}" appears`, async () => {
    const names = (await profileViews(page)).map((v) => v.name)
    return { ok: names.includes(COPY) && names.length === count + 1, detail: names.join(', ') }
  })

  await page.caption(`Delete "${COPY}" with its trash icon`)
  await page.click(await rowIcon(page, COPY, 'trash-can'), { settle: 1500 })
  if (await page.exists('text=Delete')) await page.click('text=Delete', { settle: 1200 })
  await page.check('The copy is gone, the original stays hidden', async () => {
    const views = await profileViews(page)
    const original = views.find((v) => v.name === NAME)
    return {
      ok: views.length === count && !views.some((v) => v.name === COPY) && original?.visible === false,
      detail: `${views.length} views (was ${count}): ${views.map((v) => v.name).join(', ')}; original visible ${
        original?.visible
      }`,
    }
  })
}
