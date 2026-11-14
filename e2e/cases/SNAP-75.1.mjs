import { enterEditMode, exitEditMode } from '../lib/custom-widget.mjs'
import {
  ensureSnapshotTool,
  fileSafe,
  INPUT_SYNCED,
  libraryPictures,
  openSnapshotSettings,
  quietStart,
  snapshotMenu,
  snapshotSetting,
  snapshotToolButtons,
  storedSnapshots,
} from '../lib/inputs.mjs'
import { setUpRecording, STREAM, STREAM_720P } from '../lib/video.mjs'

export const meta = {
  title: 'Snapshot all WebRTC streams in the web build',
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
 * Tick "Snapshot all available sources", take one capture: one valid, non-black JPEG per stream; the work area
 * option stays greyed out on the web.
 */
export default async function run({ page }) {
  await page.caption('Edit interface → Bottom Bar → snapshot tool settings')
  await enterEditMode(page)
  await openSnapshotSettings(page)
  const all = await snapshotSetting(page, 'Snapshot all available sources')
  if (all && !all.checked) await page.click(all, { settle: 800 })
  await page.caption('"Snapshot all available sources" ticked; the work area capture is greyed out on the web')
  await page.hover(await snapshotSetting(page, 'Capture Cockpit work area'), 1200)
  await page.check('All sources ticked, work area capture disabled', async () => {
    const a = await snapshotSetting(page, 'Snapshot all available sources')
    const w = await snapshotSetting(page, 'Capture Cockpit work area')
    return {
      ok: a?.checked && w?.disabled && !w.checked,
      detail: `all ${a?.checked}, work area disabled ${w?.disabled}`,
    }
  })
  await page.click('text=Close', { settle: 800 })
  await exitEditMode(page)

  const before = (await storedSnapshots(page)).map((s) => s.name)
  await page.caption('Single capture: camera icon')
  await page.click((await snapshotToolButtons(page)).camera, { settle: 1000 })
  await page
    .waitFor(async () => (await storedSnapshots(page)).length >= before.length + STREAMS.length, {
      timeout: 20000,
      label: 'one snapshot per stream',
    })
    .catch(() => undefined)
  const added = (await storedSnapshots(page)).filter((s) => !before.includes(s.name))
  for (const stream of STREAMS) {
    await page.check(`"${stream}": one JPEG, decodable and not black`, () => {
      const files = added.filter((s) => s.name.endsWith(`#${fileSafe(stream)}.jpeg`))
      const f = files[0]
      return {
        ok: files.length === 1 && f.magic === 'ffd8ff' && f.width > 0 && f.luma > 10,
        detail: f ? `${f.name} · ${f.width}×${f.height} · luma ${f.luma} · ${f.magic}` : 'none',
      }
    })
  }
  await page.caption('Arrow → Open snapshot library')
  await snapshotMenu(page, 'Open snapshot library')
  await page.wait(1500)
  await page.check('The library lists both', async () => {
    const listed = await libraryPictures(page)
    return { ok: added.length > 0 && added.every((s) => listed.includes(s.name)), detail: `${listed.length} listed` }
  })
}
