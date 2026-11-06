import { existsSync, readdirSync } from 'node:fs'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  chunkGroups,
  hashOf,
  libraryTab,
  openLibrary,
  processedCards,
  standaloneOnly,
  videosFolder,
  watchSnackbars,
} from '../lib/library.mjs'
import { keepRecordingsInRun } from '../lib/subtitles.mjs'
import { recordStreams, setUpRecording, STREAM } from '../lib/video.mjs'

const STREAMS = [STREAM, 'PRTest Ball']

export const meta = {
  title: "Standalone's library lists the processed video and the raw chunks of every camera",
  route: '/',
  needs: ['vehicle', 'camera', 'standalone'],
}

export const setup = async (ctx) => {
  const { page } = ctx
  await standaloneOnly(page)
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await keepRecordingsInRun(ctx)
  await setUpRecording(page, STREAMS)
}

/**
 * Record both cameras at once; once processed, the library's Processed tab has a video per camera
 * and its Raw tab a chunk group per camera, each one processable and downloadable.
 */
export default async function run(ctx) {
  const { page } = ctx
  await watchSnackbars(page)
  await page.caption(`Record ${STREAMS.join(' and ')} together for about 8 s`)
  await recordStreams(page, STREAMS, 8)

  await page.caption('Cockpit finishes both videos')
  const folder = videosFolder(ctx)
  const mp4s = () => (existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.mp4')) : [])
  await page
    .waitFor(() => mp4s().length >= STREAMS.length, { timeout: 120000, label: 'both videos' })
    .catch(() => undefined)
  const hashes = mp4s().map(hashOf)
  await page.check('A processed video per camera in the Cockpit folder', () => ({
    ok: hashes.length === STREAMS.length,
    detail: mp4s().join(', ') || 'none',
  }))

  await page.caption('Video library → PROCESSED')
  await openLibrary(page)
  await libraryTab(page, 'Processed')
  const cards = await processedCards(page)
  await page.check('PROCESSED lists both videos as processed', () => {
    const listed = hashes.filter((h) => cards.some((c) => c.name.includes(`#${h}`) && /Processed$/.test(c.text)))
    return {
      ok: hashes.length === STREAMS.length && listed.length === hashes.length,
      detail: cards.map((c) => c.text).join(' | ') || 'none',
    }
  })

  await page.caption('RAW')
  await libraryTab(page, 'Raw')
  const groups = await chunkGroups(page)
  await page.check('RAW lists a chunk group per camera, each with process and download buttons', () => {
    const ready = hashes.filter((h) => {
      const g = groups.find((group) => group.title === h)
      return g?.icons.includes('mdi-file-cog') && g.icons.includes('mdi-download')
    })
    return {
      ok: hashes.length === STREAMS.length && ready.length === hashes.length,
      detail: groups.map((g) => `${g.title}: ${g.line} [${g.icons.join(' ')}]`).join(' | ') || 'none',
    }
  })
  await page.wait(1500)
}
