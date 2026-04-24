import { ipcMain, session } from 'electron'

let originalUserAgent: string | null = null

/**
 * Set a custom User-Agent for HTTP requests on the default Electron session.
 * @param {string} userAgent The custom User-Agent string
 * @returns {void}
 */
const setUserAgent = (userAgent: string): void => {
  if (!originalUserAgent) {
    originalUserAgent = session.defaultSession.getUserAgent()
  }
  session.defaultSession.setUserAgent(userAgent)
}

/**
 * Restore the original User-Agent recorded at the time of the first override.
 * @returns {void}
 */
const restoreUserAgent = (): void => {
  if (originalUserAgent) {
    session.defaultSession.setUserAgent(originalUserAgent)
  }
}

/**
 * Get the current User-Agent applied to the default session.
 * @returns {string} The current User-Agent string
 */
const getCurrentUserAgent = (): string => {
  return session.defaultSession.getUserAgent()
}

/**
 * Setup the User-Agent service.
 *
 * Uses `session.setUserAgent` (instead of a webRequest interceptor) so the single
 * `onBeforeSendHeaders` listener slot stays free for other header manipulations
 * (e.g. Referer injection for OSM tile requests).
 * @returns {void}
 */
export const setupUserAgentService = (): void => {
  ipcMain.handle('set-user-agent', (_event, userAgent: string) => {
    setUserAgent(userAgent)
  })

  ipcMain.handle('restore-user-agent', () => {
    restoreUserAgent()
  })

  ipcMain.handle('get-current-user-agent', () => {
    return getCurrentUserAgent()
  })
}
