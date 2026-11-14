import { mkdirSync } from 'node:fs'
import { basename } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { downloadsOf } from '../lib/data-logs.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  chunkGroups,
  groupButton,
  hashOf,
  libraryTab,
  openLibrary,
  seenSnackbar,
  tabDisabled,
  watchSnackbars,
  zipEntries,
} from '../lib/library.mjs'
import { assFiles } from '../lib/subtitles.mjs'
import { recordStreams, setUpRecording, STREAM, STREAM_720P } from '../lib/video.mjs'

const STREAMS = [STREAM, STREAM_720P]

export const meta = {
  title: 'The web library lists a downloadable chunk group for every camera',
  route: '/',
  needs: ['vehicle', 'camera'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await setUpRecording(page, STREAMS)
}

/**
 * Record both cameras at once; the library's Raw tab lists a chunk group per camera with a download
 * button, the Standalone-only tabs are off, and the second camera's group downloads.
 */
export default async function run({ page, outDir, meta: { id } }) {
  await watchSnackbars(page)
  const before = new Set(await assFiles(page))
  await page.caption(`Record ${STREAMS.join(' and ')} together for about 8 s`)
  await recordStreams(page, STREAMS, 8)
  await page
    .waitFor(async () => (await assFiles(page)).filter((f) => !before.has(f)).length >= STREAMS.length, {
      timeout: 30000,
      label: 'both recordings',
    })
    .catch(() => undefined)
  const hashes = (await assFiles(page)).filter((f) => !before.has(f)).map(hashOf)
  await page.check('Both cameras recorded', () => ({
    ok: hashes.length === STREAMS.length,
    detail: hashes.join(', ') || 'none',
  }))

  await page.caption('Video library')
  await openLibrary(page)
  await page.check('PROCESSED and PROCESSING are off on the web', async () => {
    const off = [
      (await tabDisabled(page, 'Processed')) && 'Processed',
      (await tabDisabled(page, 'Processing')) && 'Processing',
    ]
    return { ok: off.every(Boolean), detail: `disabled: ${off.filter(Boolean).join(', ') || 'none'}` }
  })
  await libraryTab(page, 'Raw')
  const groups = await chunkGroups(page)
  await page.check('RAW lists a chunk group per camera, each with a download button', () => {
    const ready = hashes.filter((h) => groups.find((g) => g.title === h)?.icons.includes('mdi-download'))
    return {
      ok: hashes.length === STREAMS.length && ready.length === hashes.length,
      detail: groups.map((g) => `${g.title}: ${g.line}`).join(' | ') || 'none',
    }
  })

  const second = groups.find((g) => g.title === hashes[1])
  if (!second) return
  await page.caption(`Download the second camera's group (${second.title})`)
  const dir = downloadsOf(outDir, id)
  mkdirSync(dir, { recursive: true })
  const zip = await page
    .download(
      dir,
      async () => page.click(await groupButton(page, second.title, 'mdi-download'), { settle: 500 }),
      60000
    )
    .catch(() => undefined)
  const notice = await seenSnackbar(page, 'Downloaded')
  const chunks = zip ? zipEntries(zip).filter((e) => new RegExp(`^${second.title}_\\d+$`).test(e)).length : 0
  await page.check('Its zip downloads with every chunk listed', () => ({
    ok: Boolean(zip) && chunks === second.chunks,
    detail: zip
      ? `${basename(zip)}: ${chunks} of ${second.chunks} chunks; ${notice ?? 'no snackbar'}`
      : 'nothing downloaded',
  }))
  await page.wait(1500)
}
