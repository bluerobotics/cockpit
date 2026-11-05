import {
  ensureSnapshotTool,
  fileSafe,
  INPUT_KEYS,
  INPUT_SYNCED,
  libraryPictures,
  quietStart,
  snapshotMenu,
  snapshotToolButtons,
  storedSnapshots,
} from '../lib/inputs.mjs'
import { RENAMED_MISSION, renameMission } from '../lib/library.mjs'
import { setUpRecording, STREAM } from '../lib/video.mjs'

export const meta = {
  title: 'A renamed mission names the next snapshot',
  route: '/',
  needs: ['vehicle', 'camera'],
  synced: INPUT_SYNCED,
  restore: INPUT_KEYS,
}

export const setup = async (ctx) => {
  await quietStart(ctx)
  await setUpRecording(ctx.page, [STREAM])
  await ensureSnapshotTool(ctx.page)
}

/**
 * Rename the mission from the top bar, take a snapshot, and find it in the library under the new name.
 */
export default async function run({ page }) {
  await page.caption(`Click the mission name, rename it to "${RENAMED_MISSION}"`)
  await renameMission(page, RENAMED_MISSION)
  await page.check('The mission is renamed', async () => {
    const name = await page.store('mission', 's.missionName')
    return { ok: name === RENAMED_MISSION, detail: name }
  })

  const before = (await storedSnapshots(page)).map((s) => s.name)
  await page.caption('Snapshot tool: camera icon')
  await page.click((await snapshotToolButtons(page)).camera, { settle: 1000 })
  await page
    .waitFor(async () => (await storedSnapshots(page)).length > before.length, {
      timeout: 15000,
      label: 'the snapshot',
    })
    .catch(() => undefined)
  const added = (await storedSnapshots(page)).filter((s) => !before.includes(s.name))
  const mine = added.find((s) => s.name.endsWith(`#${fileSafe(STREAM)}.jpeg`))
  await page.check(`Named "${RENAMED_MISSION} (…) #${fileSafe(STREAM)}.jpeg"`, () => ({
    ok: !!mine?.name.startsWith(`${RENAMED_MISSION} (`),
    detail: added.map((s) => s.name).join(' | ') || 'no new snapshot',
  }))

  await page.caption('Arrow → Open snapshot library')
  await snapshotMenu(page, 'Open snapshot library')
  await page.wait(1500)
  await page.check('The library lists it', async () => {
    const listed = await libraryPictures(page)
    return { ok: !!mine && listed.includes(mine.name), detail: `${listed.length} listed` }
  })
}
