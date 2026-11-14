import { existsSync, readdirSync } from 'node:fs'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  groupButton,
  libraryTab,
  openLibrary,
  RENAMED_MISSION,
  renameMission,
  seenSnackbar,
  videosFolder,
  watchSnackbars,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { recordStreams, setUpRecording, STREAM } from '../lib/video.mjs'

const LIVE_PROCESSING = 'cockpit-enable-live-processing'

export const meta = {
  title: 'Processing a raw chunk group keeps the mission name of its recording',
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
  synced: { [LIVE_PROCESSING]: false },
}

export const setup = async (ctx) => {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page)
}

/**
 * With live processing off, rename the mission and record; the recording stays as raw chunks. Process
 * its chunk group from the library's Raw tab: the video is named after the mission.
 */
export default async function run(ctx) {
  const { page } = ctx
  const folder = videosFolder(ctx)
  const mp4s = () => (existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.mp4')) : [])
  await page.caption(`Rename the mission to "${RENAMED_MISSION}"`)
  await renameMission(page, RENAMED_MISSION)
  const before = new Set(Object.keys(await page.store('video', 's.unprocessedVideos')))
  await page.caption('Record about 6 s, with live processing off')
  await recordStreams(page, [STREAM], 6)
  const hash = Object.keys(await page.store('video', 's.unprocessedVideos')).find((h) => !before.has(h))
  await page.wait(3000)
  await page.check('The recording stays as raw chunks', () => ({
    ok: Boolean(hash) && mp4s().length === 0,
    detail: `${hash ?? 'no recording'}; ${mp4s().length} videos`,
  }))
  if (!hash) return

  await watchSnackbars(page)
  await page.caption('Video library → RAW → process the chunk group')
  await openLibrary(page)
  await libraryTab(page, 'Raw')
  await page.click(await groupButton(page, hash, 'mdi-file-cog'), { settle: 1000 })
  const notice = await seenSnackbar(page, 'processed successfully', 120000)
  await page.check('Cockpit reports the group processed', () => ({
    ok: Boolean(notice),
    detail: notice ?? 'no snackbar',
  }))
  const mp4 = mp4s().find((f) => f.endsWith(`#${hash}.mp4`))
  await page.check('The video is named after the mission', () => ({
    ok: Boolean(mp4?.startsWith(`${RENAMED_MISSION} (`)),
    detail: mp4 ?? 'no video',
  }))
  await page.wait(1500)
}
