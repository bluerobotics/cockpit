import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { isolatedUserDataPath, shouldIsolateChromiumProfile } from './chromium-profile'

let isolationLogMessage: string | undefined

/**
 * Emit the isolation decision after `setupElectronLogService` has hooked `console`.
 * @returns {void}
 */
export const logChromiumProfileIsolation = (): void => {
  if (isolationLogMessage === undefined) return
  console.info(isolationLogMessage)
}

/**
 * Point Electron at a sibling userData folder when the default profile was written by a newer
 * Chrome. Must run before any other main-process code touches userData or `session`.
 * @returns {void}
 */
const isolateNewerChromiumUserData = (): void => {
  try {
    const userData = app.getPath('userData')
    const lastVersionFile = join(userData, 'Last Version')
    const lastVersionText = existsSync(lastVersionFile) ? readFileSync(lastVersionFile, 'utf8') : undefined
    const hasNetworkCookies = existsSync(join(userData, 'Network', 'Cookies'))
    const ourChrome = process.versions.chrome ?? ''

    if (!shouldIsolateChromiumProfile(lastVersionText, ourChrome, hasNetworkCookies)) return

    const isolated = isolatedUserDataPath(userData, ourChrome)
    mkdirSync(isolated, { recursive: true })

    const configSrc = join(userData, 'config.json')
    const configDst = join(isolated, 'config.json')
    if (existsSync(configSrc) && !existsSync(configDst)) {
      copyFileSync(configSrc, configDst)
    }

    app.setPath('userData', isolated)
    isolationLogMessage = `Chromium profile at ${userData} was written by a newer Chrome. Using ${isolated}.`
  } catch (error) {
    isolationLogMessage = `Failed to isolate Chromium profile: ${error}`
  }
}

isolateNewerChromiumUserData()
