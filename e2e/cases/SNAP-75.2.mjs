import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  ensureSnapshotTool,
  fileSafe,
  INPUT_SYNCED,
  openSnapshotSettings,
  quietStart,
  snapshotSetting,
  snapshotToolButtons,
  standaloneSnapshots,
} from '../lib/inputs.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { setUpRecording, STREAM, STREAM_720P } from '../lib/video.mjs'

export const meta = {
  title: 'Snapshot all streams plus the work area in Standalone',
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
  synced: INPUT_SYNCED,
}

const STREAMS = [STREAM, STREAM_720P]

export const setup = async (ctx) => {
  await quietStart(ctx)
  await keepRecordingsInRun(ctx)
  await setUpRecording(ctx.page, STREAMS)
  await ensureSnapshotTool(ctx.page)
}

/**
 * Tick all sources and the work area, take one capture: one JPEG per stream plus the work area.
 */
export default async function run(ctx) {
  const { page } = ctx
  await page.caption('Snapshot tool settings: all sources and the Cockpit work area')
  await enterEditMode(page)
  await openSnapshotSettings(page)
  for (const label of ['Snapshot all available sources', 'Capture Cockpit work area']) {
    const box = await snapshotSetting(page, label)
    if (box && !box.checked) await page.click(box, { settle: 800 })
  }
  await page.click('text=Close', { settle: 800 })
  await exitEditMode(page)

  const before = standaloneSnapshots(ctx).map((f) => f.name)
  await page.caption('Single capture: camera icon')
  await page.click((await snapshotToolButtons(page)).camera, { settle: 1000 })
  await page
    .waitFor(() => standaloneSnapshots(ctx).length >= before.length + STREAMS.length + 1, { timeout: 20000 })
    .catch(() => undefined)
  const added = standaloneSnapshots(ctx).filter((f) => !before.includes(f.name))
  for (const source of [...STREAMS, 'workspace']) {
    await page.check(`"${source}": one real JPEG in the Cockpit folder`, () => {
      const files = added.filter((f) => f.name.endsWith(`#${fileSafe(source)}.jpeg`))
      return {
        ok: files.length === 1 && files[0].magic === 'ffd8ff',
        detail: files.map((f) => `${f.name} (${f.magic})`).join(' | ') || 'none',
      }
    })
  }
}
