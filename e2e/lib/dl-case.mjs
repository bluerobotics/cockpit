// The shared opening of the DL cases: quiet Cockpit, pick the export options, record variables, wait.

import { dismissTutorial } from './cockpit.mjs'
import { openDataLogs, recordVariables, setExportOptions } from './data-logs.mjs'
import { dismissFeaturesDialog } from './extensions.mjs'

export const setup = async ({ page }) => {
  await dismissFeaturesDialog(page)
  await dismissTutorial(page, 3000)
}

/**
 * Set the export options, record `ids` for `ms`, and come back to Data Logs.
 * @param {object} page - Driver page
 * @param {object} options - Export options for setExportOptions, plus what to record
 * @param {string[]} options.ids - Variables to record
 * @param {number} options.ms - How long to record
 * @param {string} options.what - Caption naming the options
 */
export async function recordWith(page, { ids, ms, what, ...options }) {
  await page.caption(`Tools → Data Logs → export settings: ${what}`)
  await openDataLogs(page)
  await setExportOptions(page, options)
  await page.caption(`Tools → Data-lake: record ${ids.map((id) => id.split('/').slice(-2).join('/')).join(' and ')}`)
  await recordVariables(page, ids)
  await page.caption('Let it record for a while')
  await page.wait(ms)
  await openDataLogs(page)
}
