import { dumpSummary, openMenuPage, recordDump } from '../lib/mavlink-tools.mjs'

export const meta = { title: 'Dump messages and download the file', route: '/', needs: ['vehicle'] }

const SECONDS = 30

/**
 * Record 30 s with the message dumper, download it, and check what the file holds. The dump is kept
 * next to the video.
 */
export default async function run({ page, outDir }) {
  await page.caption('Main menu → Tools → MAVLink, start the messages dumper')
  await openMenuPage(page, 'Tools', 'MAVLink')
  const file = await recordDump(page, outDir, SECONDS)
  const types = dumpSummary(file)
  for (const type of ['HEARTBEAT', 'ATTITUDE', 'GLOBAL_POSITION_INT']) {
    await page.check(`The dump holds ${type} across the ${SECONDS} s`, () => {
      const t = types[type]
      const span = t ? (t.last - t.first) / 1000 : 0
      return {
        ok: t?.count > 10 && span >= SECONDS - 5,
        detail: t ? `${t.count} messages over ${span.toFixed(0)} s` : 'none',
      }
    })
  }
  await page.wait(1500)
}
