import {
  ACTION_ID,
  ACTION_NAME,
  ACTION_URL_PART,
  dialogOpensWithin,
  restartCockpit,
  UNDECIDED,
  watchRequests,
} from '../lib/extensions.mjs'
import { openMenuPage } from '../lib/mavlink-tools.mjs'

export const meta = {
  title: "An extension's action can be accepted, and it works",
  route: '/',
  needs: ['vehicle'],
  synced: UNDECIDED,
}

const actionRow = (name) =>
  `[...document.querySelectorAll('tr')].find((tr) => tr.getClientRects().length && tr.querySelector('td')?.textContent.trim() === ${JSON.stringify(
    name
  )})`

/**
 * Accept the test extension's action from the BlueOS Extension Features dialog, find it under Settings →
 * Actions, run it with its play button and check the extension got the request.
 */
export default async function run({ page }) {
  await page.caption('Start Cockpit: the extension offers an action')
  await restartCockpit(page)
  await page.check('The BlueOS Extension Features dialog offers the action', async () => {
    const open = await dialogOpensWithin(page)
    return { ok: open && (await page.exists(`text=${ACTION_NAME}`)), detail: open ? ACTION_NAME : 'no dialog' }
  })
  await page.wait(1200)

  await page.caption('Add Action')
  await page.click('text=Add Action', { settle: 1500 })
  await page.check('It leaves the new actions, with nothing pending', async () => ({
    ok: await page.exists('text=No new actions — all extension actions have been reviewed.'),
  }))
  await page.click('.features-modal > .fixed button', { settle: 800 })
  if (await page.exists('text=Close anyway')) await page.click('text=Close anyway', { settle: 800 })

  await page.caption('Settings → Actions: it is there')
  await openMenuPage(page, 'settings-actions')
  await page.waitFor(() => page.eval(`!!${actionRow(ACTION_NAME)}`), { label: 'the action row' })
  await page.check('The action is listed as an HTTP request', async () => {
    const text = await page.eval(`${actionRow(ACTION_NAME)}.innerText.replace(/\\s+/g, ' ')`)
    return { ok: /HTTP Request/i.test(text), detail: text }
  })

  await page.caption('Run it with its play button')
  const requests = await watchRequests(page, ACTION_URL_PART)
  const play = await page.eval(`(() => { const r = ${actionRow(
    ACTION_NAME
  )}.querySelector('.mdi-play').closest('button').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await page.click(play, { settle: 2500 })
  await page.check('The extension received the request and answered it', () => {
    const post = requests.find((r) => r.method === 'POST')
    const ok = post?.status === 200 && (post.body ?? '').includes(ACTION_ID)
    return { ok, detail: post ? `POST ${post.status ?? post.error} ${post.body}` : 'no request' }
  })
  await page.wait(1500)
}
