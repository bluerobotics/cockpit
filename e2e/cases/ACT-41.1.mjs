import { httpAction, NAME, runAndCatch, setUpActions, showRequest } from '../lib/act-case.mjs'
import { fillHttpAction, listedActions, newAction, NO_ACTIONS } from '../lib/actions.mjs'

export const meta = {
  title: 'Create an HTTP action and check every field reaches the server',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, false)

/**
 * Create an HTTP action with a placeholder in the path, fixed and data-lake URL parameters, a
 * data-lake header and a JSON body, run it, and compare what the server got with the data lake.
 */
export default async function run({ page, echo, vehicleHost }) {
  await page.caption('Settings → Actions → New action → HTTP Request Action')
  await newAction(page, 'HTTP Request Action')
  await page.caption('PUT, a placeholder in the path, a fixed and a data-lake URL parameter')
  const { params, headers, body, ...basics } = httpAction(echo.url)
  await fillHttpAction(page, { ...basics, params })
  await page.caption('A header and a JSON body filled from the data lake')
  await fillHttpAction(page, { headers, body })
  await page.click('text=Create', { settle: 1500 })
  await page.check('The action is listed', async () => {
    const names = await listedActions(page)
    return { ok: names.includes(NAME), detail: names.join(', ') }
  })

  await page.caption('Run it with its play button')
  const lake = (id) => page.eval(`window.cockpit.getDataLakeVariableData(${JSON.stringify(id)})`)
  const mode = await lake('/mavlink/1/1/HEARTBEAT/custom_mode')
  const sysid = await lake('autopilotSystemId')
  const request = await runAndCatch(page, echo)
  const speed = await lake('/mavlink/1/1/VFR_HUD/groundspeed')
  await page.check('The server got one PUT', () => ({
    ok: request?.method === 'PUT',
    detail: request?.method ?? 'nothing',
  }))
  if (!request) return
  await showRequest(page, request)
  await page.check('The path carries the vehicle address', () => ({
    ok: request.path === `/release/${vehicleHost}`,
    detail: request.path,
  }))
  await page.check("URL parameters: the URL's own, the fixed one and the system ID", () => ({
    ok: request.query.source === 'cockpit' && request.query.fixed === 'yes' && request.query.sysid === String(sysid),
    detail: JSON.stringify(request.query),
  }))
  await page.check('The header carries the flight mode number, and the JSON content type', () => ({
    ok: request.headers['x-release-mode'] === String(mode) && request.headers['content-type'] === 'application/json',
    detail: `X-Release-Mode ${request.headers['x-release-mode']} (data lake ${mode}), ${request.headers['content-type']}`,
  }))
  await page.check('The body is JSON with the live groundspeed as a number', () => {
    const json = JSON.parse(request.body)
    const ok =
      typeof json.groundspeed === 'number' &&
      Math.abs(json.groundspeed - speed) < 0.5 &&
      json.vehicle === vehicleHost &&
      json.note === 'release test'
    return { ok, detail: request.body }
  })
}
