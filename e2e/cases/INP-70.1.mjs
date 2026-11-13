import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  addInputContainer,
  closeElementPanel,
  createElementVariable,
  dropCard,
  elementAt,
  INPUT_SYNCED,
  lakeValue,
  openElementPanel,
  placed,
  quietStart,
  showInDataLake,
} from '../lib/inputs.mjs'

export const meta = {
  title: 'A Switch writes its boolean variable',
  route: '/',
  synced: INPUT_SYNCED,
}

export const setup = quietStart

/**
 * Add a Switch to a new container, create its variable from the element panel, and toggle it: the variable follows.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Input → Add new container; drag a Switch into it')
  await enterEditMode(page)
  const rows = await addInputContainer(page)
  await dropCard(page, 'Switch', rows[0])
  const { hash } = await placed(page, 'Switch')
  await page.caption('Click it → Actions → Data-lake variable → create "release-test/switch"')
  await openElementPanel(page, hash)
  await createElementVariable(page, 'release-test/switch')
  const id = (await placed(page, 'Switch'))?.options.dataLakeVariable?.id
  await page.check('The switch is bound to a new variable', () => ({ ok: !!id, detail: id ?? 'none' }))
  await closeElementPanel(page)
  await exitEditMode(page)

  const checked = () => page.eval(`!!document.querySelector('[data-widget-hash="${hash}"] input')?.checked`)
  const states = []
  for (const turn of ['first', 'second']) {
    await page.caption(`Toggle the switch (${turn} time)`)
    await page.click(await elementAt(page, hash, 'input'), { settle: 1000 })
    states.push({ shown: await checked(), stored: await lakeValue(page, id) })
  }
  await page.check('The variable flips with the switch, matching it each time', () => ({
    ok: states.every((s) => s.stored === s.shown) && states[0].stored !== states[1].stored,
    detail: states.map((s) => `switch ${s.shown}, variable ${s.stored}`).join(' → '),
  }))
  await page.caption('Tools → Data-lake shows the variable')
  const shown = await showInDataLake(page, 'release-test')
  await page.check('Tools → Data-lake shows the last value', () => ({
    ok: shown === String(states[1].stored),
    detail: shown ?? 'not listed',
  }))
}
