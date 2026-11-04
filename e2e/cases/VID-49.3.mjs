import { existsSync, readdirSync } from 'node:fs'
import { basename } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  INSPECT_PORT,
  openLibrary,
  processZip,
  standaloneOnly,
  videosFolder,
  watchSnackbars,
  webZipForRun,
  zipEntries,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

export const meta = {
  title: 'A chunks zip processed in Standalone keeps the mission name of its recording',
  route: '/',
  needs: ['vehicle', 'camera', 'standalone'],
  browserArgs: [`--inspect=${INSPECT_PORT}`],
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
 * Process the web build's chunks zip from VID-46.1: the video it makes should carry the mission name
 * the recording had, which the zip's subtitle file still holds.
 */
export default async function run(ctx) {
  const { page, outDir } = ctx
  const web = webZipForRun(outDir)
  const ass = web && zipEntries(web.zip).find((e) => e.endsWith('.ass'))
  const mission = ass?.match(/^(.*) \(/)?.[1]
  await page.check('A web chunks zip whose recording had a mission name (VID-46.1)', () => ({
    ok: Boolean(mission),
    detail: web ? `${basename(web.zip)}: "${mission ?? 'no name'}"` : 'run VID-46.1 on the web build first',
  }))
  if (!mission) return

  await watchSnackbars(page)
  await openLibrary(page)
  await processZip(page, INSPECT_PORT, web.zip)
  const folder = videosFolder(ctx)
  const mp4 = (existsSync(folder) ? readdirSync(folder) : []).find((f) => f.endsWith(`#${web.hash}.mp4`))
  await page.check(`The processed video is named after "${mission}"`, () => ({
    ok: Boolean(mp4?.startsWith(`${mission} (`)),
    detail: mp4 ?? 'no video',
  }))
  await page.wait(1500)
}
