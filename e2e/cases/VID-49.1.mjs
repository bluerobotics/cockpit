import { dismissTutorial } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'
import { hashOf, RENAMED_MISSION, renameMission } from '../lib/library.mjs'
import { recordAndReadAss } from '../lib/subtitles.mjs'
import { setUpRecording } from '../lib/video.mjs'

const MISSION = RENAMED_MISSION

export const meta = {
  title: 'A renamed mission names the next recording (web)',
  route: '/',
  needs: ['vehicle', 'camera'],
}

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await setUpRecording(page)
}

/**
 * Rename the mission from the top bar and record: the recording and its subtitle file are named
 * after the new mission.
 */
export default async function run({ page }) {
  await page.caption(`Rename the mission to "${MISSION}"`)
  await renameMission(page, MISSION)
  await page.check('The top bar shows the new name', async () => {
    const shown = await page.exists(`text=${MISSION}`)
    return {
      ok: shown && (await page.store('mission', 's.missionName')) === MISSION,
      detail: await page.store('mission', 's.missionName'),
    }
  })

  await page.caption('Record about 5 s')
  const recording = await recordAndReadAss(page, 5)
  const hash = hashOf(recording?.name)
  await page.check('The subtitle file is named after the mission', () => ({
    ok: Boolean(recording?.name.startsWith(`${MISSION} (`)),
    detail: recording?.name ?? 'no recording',
  }))
  await page.check('So is the recording itself', async () => {
    const name = hash ? await page.store('video', `s.unprocessedVideos[${JSON.stringify(hash)}]?.fileName`) : undefined
    return { ok: Boolean(name?.startsWith(`${MISSION} (`)), detail: name ?? 'not found' }
  })
}
