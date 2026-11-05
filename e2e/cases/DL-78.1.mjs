import { lake, openDataLake } from '../lib/act-dl.mjs'
import { setup } from '../lib/dl-case.mjs'

export { setup }

export const meta = {
  title: 'MAVLink values in the data lake match the vehicle',
  route: '/',
  needs: ['vehicle'],
}

const FIELDS = ['pitch', 'roll', 'yaw']
const id = (field) => `/mavlink/1/1/AHRS2/${field}`

// How many times each variable was written in `ms`, sampled from the data lake's own timestamps.
const UPDATES = (ms) => `new Promise((resolve) => { const seen = {}; const t0 = Date.now()
  const tick = setInterval(() => {
    for (const f of ${JSON.stringify(
      FIELDS
    )}) (seen[f] ??= new Set()).add(window.cockpit.getDataLakeVariableLastUpdateTimestamp('/mavlink/1/1/AHRS2/' + f))
    if (Date.now() - t0 > ${ms}) { clearInterval(tick); resolve(Object.fromEntries(Object.entries(seen).map(([f, s]) => [f, s.size]))) }
  }, 50) })`

/**
 * Tools → Data-lake, search AHRS2 and watch pitch, roll and yaw for 10 s: they are written live,
 * shown in the table, and match the AHRS2 the vehicle sends as mavlink2rest reads it.
 */
export default async function run({ page, vehicle }) {
  await page.caption('Tools → Data-lake, search "AHRS2"')
  await openDataLake(page, 'AHRS2')
  await page.caption('Watch pitch, roll and yaw for 10 s')
  const updates = await page.eval(UPDATES(10000))
  await page.check('Each is written several times a second', () => ({
    ok: FIELDS.every((f) => updates[f] >= 20),
    detail: FIELDS.map((f) => `${f} ${updates[f]} writes in 10 s`).join(', '),
  }))
  await page.check('The table lists each with a value', async () => {
    const rows = []
    for (const f of FIELDS) {
      await openDataLake(page, `AHRS2/${f}`)
      rows.push([
        f,
        await page.eval(`[...document.querySelectorAll('tbody tr')]
        .find((r) => r.children[0]?.innerText.trim().startsWith('AHRS2/${f} ('))?.children[3]?.innerText.trim()`),
      ])
    }
    return {
      ok: rows.every(([, v]) => v && Number.isFinite(Number(v))),
      detail: rows.map((r) => r.join(' = ')).join(', '),
    }
  })
  const [message, values] = await Promise.all([
    vehicle.read('AHRS2'),
    Promise.all(FIELDS.map((f) => lake(page, id(f)))),
  ])
  await page.check('They match AHRS2 read from the vehicle (within 0.05 rad)', () => {
    const ok =
      message && FIELDS.every((f, i) => typeof values[i] === 'number' && Math.abs(values[i] - message[f]) <= 0.05)
    return {
      ok,
      detail: message
        ? FIELDS.map((f, i) => `${f} ${values[i]?.toFixed?.(4)} / ${message[f]?.toFixed?.(4)}`).join(', ')
        : 'vehicle sent no AHRS2',
    }
  })
}
