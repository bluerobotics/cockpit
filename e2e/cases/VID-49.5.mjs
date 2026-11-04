import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  groupButton,
  hashOf,
  libraryTab,
  mediaSeconds,
  openLibrary,
  seenSnackbar,
  standaloneOnly,
  videosFolder,
  watchSnackbars,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { recordStreams, setUpRecording, STREAM } from '../lib/video.mjs'

export const meta = {
  title: "Processing a recording's chunks again keeps the video it already has",
  route: '/',
  needs: ['vehicle', 'camera', 'standalone'],
}

export const setup = async (ctx) => {
  const { page } = ctx
  await standaloneOnly(page)
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page)
}

/**
 * Record with the defaults: live processing makes the video and the raw chunks stay as a backup.
 * Process that chunk group again from the Raw tab: a numbered second video appears and the first
 * one is left as it was.
 */
export default async function run(ctx) {
  const { page } = ctx
  const folder = videosFolder(ctx)
  const mp4s = () => (existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.mp4')) : [])
  await page.caption('Record about 6 s with the defaults')
  await recordStreams(page, [STREAM], 6)
  await page.waitFor(() => mp4s().length > 0, { timeout: 120000, label: 'the processed video' }).catch(() => undefined)
  await page.wait(3000)
  const [original] = mp4s()
  const hash = hashOf(original)
  const before = original && statSync(join(folder, original))
  await page.check('The recording was processed into a video', () => ({
    ok: Boolean(hash),
    detail: original ?? 'no video',
  }))
  if (!hash) return

  await watchSnackbars(page)
  await page.caption('Video library → RAW → process the same recording again')
  await openLibrary(page)
  await libraryTab(page, 'Raw')
  await page.click(await groupButton(page, hash, 'mdi-file-cog'), { settle: 1000 })
  const notice = await seenSnackbar(page, 'processed successfully', 120000)
  await page.check('Cockpit reports the group processed', () => ({
    ok: Boolean(notice),
    detail: notice ?? 'no snackbar',
  }))
  const copy = mp4s().find((f) => f !== original && f.endsWith(`#${hash}.mp4`))
  await page.check('The new video gets a numbered name', () => ({
    ok: Boolean(copy?.endsWith(` (2) #${hash}.mp4`)),
    detail: copy ?? `videos: ${mp4s().join(', ')}`,
  }))
  await page.check('The original video is left as it was', () => {
    const after = statSync(join(folder, original))
    const seconds = mediaSeconds(join(folder, original))
    return {
      ok: after.size === before.size && after.mtimeMs === before.mtimeMs && seconds > 3,
      detail: `${before.size} → ${after.size} bytes, ${
        Number.isNaN(seconds) ? 'unreadable' : `${seconds.toFixed(1)} s`
      }`,
    }
  })
  await page.wait(1500)
}
