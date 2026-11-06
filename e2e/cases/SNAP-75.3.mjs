import process from 'node:process'

import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  centreOf,
  ensureSnapshotTool,
  fileSafe,
  INPUT_KEYS,
  INPUT_SYNCED,
  openSnapshotSettings,
  quietStart,
  snapshotSetting,
  snapshotToolButtons,
  standaloneSnapshots,
} from '../lib/inputs.mjs'
import { standaloneOnly } from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

// The vehicle's RTSP stream; the checklist vehicle has one, CI has none.
const RTSP_STREAM = process.env.COCKPIT_E2E_RTSP_STREAM ?? 'RTSP Stream'

export const meta = {
  title: 'Snapshot an RTSP stream in Standalone',
  route: '/',
  needs: ['vehicle', 'camera', 'standalone'],
  synced: INPUT_SYNCED,
  restore: INPUT_KEYS,
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await keepRecordingsInRun(ctx)
  await setUpRecording(ctx.page, [RTSP_STREAM])
  await ensureSnapshotTool(ctx.page)
}

/**
 * Choose only the RTSP stream under "Streams to capture" and take one capture.
 */
export default async function run(ctx) {
  const { page } = ctx
  await standaloneOnly(page)
  await page.caption(`Snapshot tool settings: capture "${RTSP_STREAM}" only`)
  await enterEditMode(page)
  await openSnapshotSettings(page)
  for (const label of ['Snapshot all available sources', 'Capture Cockpit work area']) {
    const box = await snapshotSetting(page, label)
    if (box?.checked) await page.click(box, { settle: 800 })
  }
  await page.click(
    await centreOf(
      page,
      `[...document.querySelectorAll('.v-overlay--active .v-field')].find((f) => f.innerText.includes('Streams to capture'))`
    ),
    { settle: 900 }
  )
  await page.click(
    await centreOf(
      page,
      `[...[...document.querySelectorAll('.v-overlay--active')].at(-1).querySelectorAll('.v-list-item')].find((i) => i.innerText.includes(${JSON.stringify(
        RTSP_STREAM
      )}))`
    ),
    { settle: 900 }
  )
  await page.check('The chosen stream is marked RTSP', () =>
    page.eval(
      `[...document.querySelectorAll('.v-overlay--active .v-chip')].some((c) => c.innerText.includes(${JSON.stringify(
        RTSP_STREAM
      )}) && c.innerText.includes('RTSP'))`
    )
  )
  await page.key('Escape')
  await page.click('text=Close', { settle: 800 })
  await exitEditMode(page)

  const before = standaloneSnapshots(ctx).map((f) => f.name)
  await page.caption('Single capture: camera icon')
  await page.click((await snapshotToolButtons(page)).camera, { settle: 1000 })
  await page.waitFor(() => standaloneSnapshots(ctx).length > before.length, { timeout: 20000 }).catch(() => undefined)
  const added = standaloneSnapshots(ctx).filter((f) => !before.includes(f.name))
  await page.check(`One real JPEG of "${RTSP_STREAM}"`, () => ({
    ok: added.length === 1 && added[0].name.endsWith(`#${fileSafe(RTSP_STREAM)}.jpeg`) && added[0].magic === 'ffd8ff',
    detail: added.map((f) => `${f.name} (${f.magic})`).join(' | ') || 'none',
  }))
}
