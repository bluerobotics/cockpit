import {
  ensureSnapshotTool,
  fileSafe,
  INPUT_KEYS,
  INPUT_SYNCED,
  quietStart,
  snapshotToolButtons,
  storedSnapshots,
} from '../lib/inputs.mjs'
import { setUpRecording, STREAM } from '../lib/video.mjs'

export const meta = {
  title: 'Without a mission name, snapshots take the default prefix',
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
 * With the mission name left automatic, a snapshot starts with that name, or "Cockpit" when there is none.
 */
export default async function run({ page }) {
  const mission = await page.store('mission', '({ name: s.missionName, automatic: s.missionNameIsAutomatic })')
  const prefix = fileSafe(mission.name || 'Cockpit')
  await page.check('The mission name is the automatic one', () => ({
    ok: mission.automatic !== false,
    detail: `"${mission.name}", automatic ${mission.automatic}`,
  }))
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
  await page.check(`The snapshot starts with "${prefix} ("`, () => ({
    ok: added.length > 0 && added.every((s) => s.name.startsWith(`${prefix} (`)),
    detail: added.map((s) => s.name).join(' | ') || 'no new snapshot',
  }))
}
