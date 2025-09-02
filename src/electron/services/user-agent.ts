import { ipcMain, session } from 'electron'

let originalUserAgent: string | null = null
let currentCustomUserAgent: string | null = null
let webRequestListener: ((details: any, callback: any) => void) | null = null

/**
 * Set a custom User-Agent for HTTP requests
 * @param {string} userAgent The custom User-Agent string
 */
const setUserAgent = (userAgent: string): void => {
  if (!originalUserAgent) {
    originalUserAgent = session.defaultSession.getUserAgent()
  }

  currentCustomUserAgent = userAgent

  // Remove any existing listener
  if (webRequestListener) {
    session.defaultSession.webRequest.onBeforeSendHeaders(null)
  }

  // Create a new listener that modifies the User-Agent header
  webRequestListener = (details, callback) => {
    if (currentCustomUserAgent) {
      details.requestHeaders['User-Agent'] = currentCustomUserAgent
    }
    callback({ requestHeaders: details.requestHeaders })
  }

  // Add the listener for all URLs
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, webRequestListener)
}

/**
 * Restore the original User-Agent
 */
const restoreUserAgent = (): void => {
  currentCustomUserAgent = null

  // Remove the web request listener
  if (webRequestListener) {
    session.defaultSession.webRequest.onBeforeSendHeaders(null)
    webRequestListener = null
  }
}

/**
 * Get the current User-Agent
 * @returns {string} The current User-Agent string
 */
const getCurrentUserAgent = (): string => {
  return currentCustomUserAgent || originalUserAgent || session.defaultSession.getUserAgent()
}

/**
 * Setup the User-Agent service
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
