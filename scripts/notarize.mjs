/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */
import 'dotenv/config'

import { notarize } from '@electron/notarize'

/**
 * Notarize the app
 * @param {import('@electron/notarize').NotarizeContext} context
 * @returns {Promise<void>}
 */
export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  // Check if required environment variables are set
  const requiredEnvVars = {
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_ID: process.env.APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  }

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  console.log('Starting notarization process...')
  console.log(`App: ${appName}`)
  console.log(`Team ID: ${process.env.APPLE_TEAM_ID}`)
  console.log(`Apple ID: ${process.env.APPLE_ID}`)

  return await notarize({
    tool: 'notarytool',
    teamId: process.env.APPLE_TEAM_ID,
    appBundleId: 'org.bluerobotics.cockpit',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  })
}
