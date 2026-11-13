import { NAME, runAndCatch, setUpActions, showRequest } from '../lib/act-case.mjs'
import { clickActionButton, fillHttpAction, NO_ACTIONS, openActions } from '../lib/actions.mjs'
import { dismissTutorial, vehicleOnline } from '../lib/cockpit.mjs'
import { dismissFeaturesDialog } from '../lib/extensions.mjs'

export const meta = {
  title: 'An edited HTTP action calls with its new fields, also after a restart',
  route: '/',
  needs: ['vehicle'],
  synced: NO_ACTIONS,
}

export const setup = (ctx) => setUpActions(ctx, true)

/**
 * Edit the action from ACT-41.1 into a GET on another path, run it, restart Cockpit and run it
 * again: both calls use the edited fields.
 */
export default async function run({ page, echo }) {
  await page.caption(`Edit "${NAME}": GET, on another path`)
  await clickActionButton(page, NAME, 'pencil')
  await fillHttpAction(page, { method: 'GET', url: `${echo.url}/edited?source=cockpit` })
  await page.click('text=Save', { settle: 1500 })

  const expectEdited = (request) => () => ({
    ok:
      request?.method === 'GET' &&
      request.path === '/edited' &&
      request.query.fixed === 'yes' &&
      request.headers['x-release-mode'] !== undefined &&
      request.body === '',
    detail: request
      ? `${request.method} ${request.path} ${JSON.stringify(request.query)} body "${request.body}"`
      : 'nothing',
  })

  await page.caption('Run it')
  const first = await runAndCatch(page, echo)
  if (first) await showRequest(page, first)
  await page.check('GET on the new path, parameters and header kept, no body', expectEdited(first))

  await page.caption('Restart Cockpit and run it again')
  await page.reload()
  await page.waitFor(() => page.eval(`!!document.querySelector('#app')?.__vue_app__`), { label: 'Cockpit to mount' })
  await page.waitFor(() => vehicleOnline(page), { label: 'the vehicle to come online', timeout: 45000 })
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
  await openActions(page)
  // Its header reads the flight mode, and Cockpit refuses to send a header it cannot fill, so the
  // call waits for the vehicle's first heartbeat to reach the data lake.
  const id = JSON.stringify(`http-request-action (${NAME})`)
  const ready = `${id} in window.cockpit.availableCockpitActions
    && window.cockpit.getDataLakeVariableData('/mavlink/1/1/HEARTBEAT/custom_mode') !== undefined`
  await page.waitFor(() => page.eval(ready), { timeout: 30000 }).catch(() => undefined)
  // Standalone can bring the extension features dialog back once the vehicle's settings arrive.
  await dismissFeaturesDialog(page, 5000)
  await openActions(page)
  const second = await runAndCatch(page, echo)
  await page.check('After the restart it still makes the edited call', expectEdited(second))
}
