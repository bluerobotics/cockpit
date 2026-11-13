import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  INSPECT_PORT,
  libraryTab,
  mediaSeconds,
  openLibrary,
  processedCards,
  processZip,
  videosFolder,
  watchSnackbars,
  webZipForRun,
  zipEntries,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

export const meta = {
  title: 'Standalone processes a chunks zip downloaded from the web build',
  route: '/',
  needs: ['vehicle', 'camera'],
  platforms: ['electron'],
  browserArgs: [`--inspect=${INSPECT_PORT}`],
}

export const setup = async (ctx) => {
  const { page } = ctx
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page)
}

/**
 * Take the zip the web build downloaded in VID-46.1, process it from the library's Processing tab,
 * and find the video it makes in the Cockpit folder and on the Processed tab.
 */
export default async function run(ctx) {
  const { page, outDir } = ctx
  const web = webZipForRun(outDir)
  await page.check('A chunks zip from the web build is at hand (VID-46.1)', () => ({
    ok: Boolean(web),
    detail: web ? basename(web.zip) : 'run VID-46.1 on the web build first',
  }))
  if (!web) return
  const { zip, hash } = web
  const chunks = zipEntries(zip).filter((e) => new RegExp(`^${hash}_\\d+$`).test(e)).length

  await watchSnackbars(page)
  await page.caption('Video library → PROCESSING')
  await openLibrary(page)
  const notice = await processZip(page, INSPECT_PORT, zip)
  const seen = await page.eval(`[...(window.__seenTexts ?? [])].join(' | ')`)
  await page.check('Cockpit reports the zip processed', () => ({
    ok: Boolean(notice),
    detail: notice ?? (seen || 'nothing'),
  }))
  await page.check('"Processing Complete!" is shown', () => page.exists('text=Processing Complete!'))

  const folder = videosFolder(ctx)
  const files = existsSync(folder) ? readdirSync(folder) : []
  const mp4 = files.find((f) => f.endsWith(`#${hash}.mp4`))
  await page.check('An mp4 of that recording is written to the Cockpit folder', () => ({
    ok: Boolean(mp4),
    detail: mp4 ?? (files.join(', ') || `nothing in ${folder}`),
  }))
  await page.check('Its subtitle file is written next to it', () => {
    const ass = files.find((f) => f.endsWith(`#${hash}.ass`))
    return { ok: Boolean(ass), detail: ass ?? 'no .ass' }
  })
  if (mp4) {
    const seconds = mediaSeconds(join(folder, mp4))
    await page.check(`The video lasts about as long as its ${chunks} one-second chunks`, () => ({
      ok: Math.abs(seconds - chunks) <= 3,
      detail: Number.isNaN(seconds) ? 'unreadable' : `${seconds.toFixed(1)} s`,
    }))
  }

  await page.caption('View Videos')
  await page.click('text=View Videos', { settle: 2000 }).catch(() => libraryTab(page, 'Processed'))
  await page.check('The Processed tab lists the new video', async () => {
    const card = (await processedCards(page)).find((c) => c.name.includes(`#${hash}`))
    return { ok: Boolean(card), detail: card?.text ?? 'not listed' }
  })
  await page.wait(1500)
}
