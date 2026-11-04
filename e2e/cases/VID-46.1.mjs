import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import { dismissTutorial } from '../lib/cockpit.mjs'
import { downloadsOf } from '../lib/data-logs.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import {
  chunkGroups,
  groupButton,
  hashOf,
  joinedChunksSeconds,
  libraryTab,
  openLibrary,
  seenSnackbar,
  watchSnackbars,
  zipEntries,
} from '../lib/library.mjs'
import { recordAndReadAss } from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

const SECONDS = 8

export const meta = {
  title: "A recording's chunks download as a zip from the video library",
  route: '/',
  needs: ['vehicle', 'camera'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await setUpRecording(page)
}

const escape = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

/**
 * Record a few seconds, open the library's Raw tab and download the recording's chunk group: the
 * zip holds every chunk and the subtitle file, and the chunks play back for the recorded time.
 */
export default async function run({ page, outDir, meta: { id } }) {
  await watchSnackbars(page)
  await page.caption(`Record about ${SECONDS} s`)
  const recording = await recordAndReadAss(page, SECONDS)
  const hash = hashOf(recording?.name)
  await page.check('The recording finished', () => ({ ok: Boolean(hash), detail: recording?.name ?? 'no recording' }))
  if (!hash) return

  await page.caption('Video library → RAW')
  await openLibrary(page)
  await libraryTab(page, 'Raw')
  const group = (await chunkGroups(page)).find((g) => g.title === hash)
  await page.check('The recording is listed as a chunk group with a download button', () => ({
    ok: Boolean(group?.icons.includes('mdi-download')),
    detail: group ? `${group.title}: ${group.line}` : `no group ${hash}`,
  }))
  if (!group) return

  await page.caption('Download the chunk group')
  const dir = downloadsOf(outDir, id)
  mkdirSync(dir, { recursive: true })
  const zip = await page
    .download(dir, async () => page.click(await groupButton(page, hash, 'mdi-download'), { settle: 500 }), 60000)
    .catch(() => undefined)
  const notice = await seenSnackbar(page, 'Downloaded')
  await page.check('Cockpit confirms the download', () => ({
    ok: /Downloaded \d+ chunks in 1 archive/.test(notice ?? ''),
    detail: notice ?? 'no snackbar',
  }))
  await page.check(`A zip named chunks_${hash}.zip is saved`, () => ({
    ok: zip && basename(zip) === `chunks_${hash}.zip`,
    detail: zip ? basename(zip) : 'nothing downloaded',
  }))
  if (!zip) return

  const entries = zipEntries(zip)
  const chunks = entries.filter((e) => new RegExp(`^${hash}_\\d+$`).test(e))
  await page.card(
    `<div style="font-family:Menlo,monospace;color:#e2e8f0;font-size:18px;white-space:pre-wrap;text-align:left">
      <div style="font-family:-apple-system,sans-serif;font-size:24px;opacity:.7;margin-bottom:16px">${escape(
        basename(zip)
      )}</div>${entries.map(escape).join('\n')}</div>`,
    4000
  )
  await page.check('It holds every chunk the library listed', () => ({
    ok: chunks.length === group.chunks,
    detail: `${chunks.length} chunks in the zip, ${group.chunks} listed`,
  }))
  await page.check("It holds the recording's subtitle file", () => {
    const ass = entries.find((e) => e.endsWith('.ass') && e.includes(hash))
    return { ok: Boolean(ass), detail: ass ?? 'no .ass' }
  })
  const seconds = joinedChunksSeconds(zip, hash, join(dir, 'unzipped'))
  await page.check(`The chunks play back for about the ${SECONDS} s recorded`, () => ({
    ok: Math.abs(seconds - SECONDS) <= 3,
    detail: Number.isNaN(seconds) ? 'unreadable' : `${seconds.toFixed(1)} s`,
  }))
}
