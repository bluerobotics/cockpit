import { fieldByLabel } from '../lib/cockpit.mjs'
import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  ensureSnapshotTool,
  fileSafe,
  INPUT_SYNCED,
  openSnapshotSettings,
  quietStart,
  snapshotMenu,
  snapshotToolButtons,
  storedSnapshots,
} from '../lib/inputs.mjs'
import { setUpRecording, STREAM, STREAM_720P } from '../lib/video.mjs'

export const meta = {
  title: 'Timed multi-capture every 2 s',
  route: '/',
  needs: ['vehicle', 'camera'],
  synced: INPUT_SYNCED,
}

const STREAMS = [STREAM, STREAM_720P]

export const setup = async (ctx) => {
  await quietStart(ctx)
  await setUpRecording(ctx.page, STREAMS)
  await ensureSnapshotTool(ctx.page)
}

/**
 * Timed capture at 2 s for about 7 s: 3 or 4 snapshots per stream, and none once stopped.
 */
export default async function run({ page }) {
  await page.caption('Snapshot tool settings: Timed snapshot interval 2 s')
  await enterEditMode(page)
  await openSnapshotSettings(page)
  await page.fill(await fieldByLabel(page, 'Timed snapshot interval'), '2')
  await page.click('text=Close', { settle: 800 })
  await exitEditMode(page)
  await page.caption('Arrow → Timed multi-capture')
  await snapshotMenu(page, 'Timed multi-capture')

  const before = (await storedSnapshots(page)).map((s) => s.name)
  const count = async () => {
    const added = (await storedSnapshots(page)).filter((s) => !before.includes(s.name))
    return Object.fromEntries(
      STREAMS.map((st) => [st, added.filter((s) => s.name.endsWith(`#${fileSafe(st)}.jpeg`)).length])
    )
  }
  await page.caption('Play, wait about 7 s, stop')
  await page.click((await snapshotToolButtons(page)).play, { settle: 0 })
  await page.wait(6500)
  await page.click((await snapshotToolButtons(page)).play, { settle: 1500 })
  // Encoding and storing each capture lags on a loaded machine, so the count settles a few seconds after the stop.
  let atStop = await count()
  for (let stable = 0, deadline = Date.now() + 20000; stable < 3 && Date.now() < deadline; ) {
    await page.wait(1000)
    const now = await count()
    stable = JSON.stringify(now) === JSON.stringify(atStop) ? stable + 1 : 0
    atStop = now
  }
  await page.check('3 or 4 captures per stream', () => ({
    ok: STREAMS.every((s) => atStop[s] === 3 || atStop[s] === 4),
    detail: JSON.stringify(atStop),
  }))
  await page.caption('Wait 5 s more: nothing new')
  await page.wait(5000)
  const later = await count()
  await page.check('No capture after stop', () => ({
    ok: STREAMS.every((s) => later[s] === atStop[s]),
    detail: JSON.stringify(later),
  }))
}
