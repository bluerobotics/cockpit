import { importDefaultMapping, MAPPING_KEY, openDataLake, plugGamepad, setAxis, setup as quiet } from '../lib/prf.mjs'

export const meta = {
  title: 'The MANUAL_CONTROL output variables follow their joystick inputs',
  route: '/',
  needs: ['vehicle'],
  restore: [MAPPING_KEY],
}

export const setup = async (ctx) => {
  await quiet(ctx)
  await plugGamepad(ctx.page)
}

const INPUT = 'inputs/mavlink/axis-x'
const OUTPUT = 'outputs/mavlink/axis-x'

/**
 * Tools → Data-lake, search "mavlink/axis"; move the stick the default mapping sends to Axis X and let it
 * go: the compound output follows its input at every step, and both come back to 0.
 */
export default async function run({ page }) {
  await page.caption('Settings → Joystick → Import default mapping for this vehicle')
  await importDefaultMapping(page)
  await page.waitFor(() => page.store('controller', 's.enableForwarding'), { label: 'joystick commands back on' })
  const axis = await page.store(
    'controller',
    `Number(Object.entries(s.protocolMapping.axesCorrespondencies).find(([, c]) => c.action?.id === ${JSON.stringify(
      INPUT
    )})?.[0] ?? -1)`
  )
  await page.check('The default mapping sends a stick to Axis X', () => ({ ok: axis >= 0, detail: `axis ${axis}` }))
  await page.caption('Tools → Data-lake, search "mavlink/axis"')
  await openDataLake(page, 'mavlink/axis')
  const samples = []
  for (const position of [0, -0.5, -1, 0.5, 1, 0]) {
    await page.caption(`Stick ${axis} at ${position}`)
    await setAxis(page, axis, position)
    await page.wait(1000)
    samples.push(
      await page.eval(`({ position: ${position}, input: window.cockpit.getDataLakeVariableData(${JSON.stringify(
        INPUT
      )}),
        output: window.cockpit.getDataLakeVariableData(${JSON.stringify(OUTPUT)}) })`)
    )
  }
  await page.check(`${OUTPUT} equals ${INPUT} at every step`, () => ({
    ok: samples.every((s) => typeof s.input === 'number' && s.output === s.input),
    detail: samples.map((s) => `${s.position}: ${s.input}/${s.output}`).join(', '),
  }))
  await page.check('Both moved with the stick and came back to 0', () => {
    const moved = new Set(samples.map((s) => s.input)).size >= 4
    const last = samples.at(-1)
    return { ok: moved && last.input === 0 && last.output === 0, detail: `final ${last.input}/${last.output}` }
  })
}
