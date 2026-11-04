import { existsSync, readdirSync } from 'node:fs'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  libraryTab,
  openLibrary,
  processedCards,
  RENAMED_MISSION,
  renameMission,
  standaloneOnly,
  videosFolder,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { recordStreams, setUpRecording, STREAM } from '../lib/video.mjs'

const MISSION = RENAMED_MISSION

export const meta = {
  title: 'A renamed mission names the next processed video (Standalone)',
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
 * Rename the mission from the top bar and record: the processed mp4 in the Cockpit folder and in the
 * library is named after the new mission.
 */
export default async function run(ctx) {
  const { page } = ctx
  await page.caption(`Rename the mission to "${MISSION}"`)
  await renameMission(page, MISSION)
  await page.caption('Record about 6 s')
  await recordStreams(page, [STREAM], 6)

  const folder = videosFolder(ctx)
  const mp4s = () => (existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.mp4')) : [])
  await page.waitFor(() => mp4s().length > 0, { timeout: 120000, label: 'the processed video' }).catch(() => undefined)
  const [mp4] = mp4s()
  await page.check('The processed video is named after the mission', () => ({
    ok: Boolean(mp4?.startsWith(`${MISSION} (`)),
    detail: mp4 ?? 'no video',
  }))
  await page.caption('Video library → PROCESSED')
  await openLibrary(page)
  await libraryTab(page, 'Processed')
  await page.check('The library lists it under that name', async () => {
    const card = (await processedCards(page)).find((c) => c.name === mp4)
    return { ok: Boolean(card?.name.startsWith(`${MISSION} (`)), detail: card?.text ?? 'not listed' }
  })
  await page.wait(1500)
}
