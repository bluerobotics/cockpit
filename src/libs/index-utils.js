/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/**
 * Cockpit Index Utilities
 * Handles backup, import, logs download, and reset functionality
 */

// Global captured logs array
let capturedLogs = []
let isCapturing = true

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
}

// Initialize console capture immediately when module loads
;['log', 'warn', 'error', 'info', 'debug'].forEach((method) => {
  console[method] = function (...args) {
    // Only capture if capturing is enabled
    if (isCapturing) {
      // Store the log entry
      capturedLogs.push({
        timestamp: new Date().toISOString(),
        level: method.toUpperCase(),
        message: args
          .map((arg) => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2)
              } catch (e) {
                return String(arg)
              }
            }
            return String(arg)
          })
          .join(' '),
      })
    } else {
      // Restore original console methods
      console.log = originalConsole.log
      console.warn = originalConsole.warn
      console.error = originalConsole.error
      console.info = originalConsole.info
      console.debug = originalConsole.debug
    }

    // Always call original console method to display in console
    originalConsole[method](...args)
  }
})

// Capture uncaught errors
window.addEventListener('error', function (event) {
  if (isCapturing) {
    capturedLogs.push({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
    })
  }
})

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  if (isCapturing) {
    capturedLogs.push({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: `Unhandled Promise Rejection: ${event.reason}`,
    })
  }
})

window.addEventListener('cockpit-app-loaded', function () {
  isCapturing = false
  console.log('Console capture stopped - app loaded successfully')
})

// Test that console capture is working
console.log('Cockpit index-utils loaded - console capture active')

/**
 * Check if console capture is currently active
 * @returns {boolean} Whether console capture is active
 */
export function isConsoleCaptureActive() {
  return isCapturing
}

/**
 * Initialize console capture system (deprecated - now auto-initialized)
 * @returns {void}
 */
export function initializeConsoleCapture() {
  // Console capture is now auto-initialized when module loads
  // This function is kept for backward compatibility
  console.log('Console capture system is already initialized')
}

/**
 * Get captured logs
 * @returns {Array} Array of captured console logs
 */
export function getCapturedLogs() {
  return capturedLogs
}

/**
 * Builds a DOM-based modal used by the pre-Vue fallback screen.
 * Native alert/confirm dialogs don't respond to mouse clicks in our Electron/webview shell,
 * so we render real buttons that handle clicks (plus Enter/Esc) ourselves.
 * @param {string} message - The message to display
 * @param {boolean} withCancel - Whether to render a Cancel button alongside OK
 * @returns {Promise<boolean>} Resolves true when confirmed, false when cancelled
 */
function showFallbackModal(message, withCancel) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.6);'

    const card = document.createElement('div')
    card.style.cssText =
      'display:flex;flex-direction:column;align-items:center;background:#333;color:#fff;' +
      'border:#fff solid 1px;border-radius:5px;padding:2rem;margin:1.5rem;max-width:65%;text-align:center;font-size:16px;'

    const text = document.createElement('p')
    text.style.cssText = 'white-space:pre-line;margin:0 0 0.5rem 0;'
    text.textContent = message
    card.appendChild(text)

    const buttonsRow = document.createElement('div')
    buttonsRow.style.cssText = 'display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;'

    const baseButtonStyle =
      'border:none;color:white;padding:15px 32px;font-size:16px;margin-top:1.5rem;cursor:pointer;border-radius:5px;'

    const finish = (result) => {
      document.removeEventListener('keydown', onKeyDown)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      resolve(result)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape' && withCancel) finish(false)
    }

    if (withCancel) {
      const cancelButton = document.createElement('button')
      cancelButton.textContent = 'Cancel'
      cancelButton.style.cssText = baseButtonStyle + 'background-color:#a12626;'
      cancelButton.addEventListener('click', () => finish(false))
      buttonsRow.appendChild(cancelButton)
    }

    const okButton = document.createElement('button')
    okButton.textContent = 'OK'
    okButton.style.cssText = baseButtonStyle + 'background-color:#0486aa;'
    okButton.addEventListener('click', () => finish(true))
    buttonsRow.appendChild(okButton)

    card.appendChild(buttonsRow)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
    document.addEventListener('keydown', onKeyDown)
    okButton.focus()
  })
}

/**
 * Shows a fallback alert dialog with a single OK button.
 * @param {string} message - The message to display
 * @returns {Promise<void>} Resolves when the user dismisses the dialog
 */
export async function showFallbackAlert(message) {
  await showFallbackModal(message, false)
}

/**
 * Shows a fallback confirmation dialog with Cancel and OK buttons.
 * @param {string} message - The message to display
 * @returns {Promise<boolean>} Resolves true when confirmed, false when cancelled
 */
export function showFallbackConfirm(message) {
  return showFallbackModal(message, true)
}

/**
 * Backup localStorage settings to JSON file
 * @returns {Promise<{success: boolean, message: string}>} Result of backup operation
 */
export async function backupSettings() {
  try {
    // Collect all localStorage data
    const backupData = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const value = localStorage.getItem(key)
      backupData[key] = value
    }

    // Create JSON string with proper formatting
    const jsonString = JSON.stringify(backupData, null, 2)

    // Create blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    // Create temporary download link
    const downloadLink = document.createElement('a')
    downloadLink.href = url

    // Generate filename with current date
    const now = new Date()
    const dateString = now.toISOString().split('T')[0]
    const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    downloadLink.download = `cockpit-settings-backup-${dateString}-${timeString}.json`

    // Trigger download
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)

    // Clean up URL object
    URL.revokeObjectURL(url)

    return { success: true, message: 'Settings backed up successfully!' }
  } catch (error) {
    return { success: false, message: `Error backing up settings: ${error.message}` }
  }
}

/**
 * Import settings from JSON file
 * @returns {Promise<{success: boolean, message: string}>} Result of import operation
 */
export async function importSettings() {
  return new Promise((resolve) => {
    // Create a hidden file input element
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'
    fileInput.style.display = 'none'

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0]
      if (!file) {
        resolve({ success: false, message: 'No file selected' })
        return
      }

      try {
        // Read the file content
        const fileContent = await file.text()

        // Parse JSON
        const backupData = JSON.parse(fileContent)

        // Validate that it's an object
        if (typeof backupData !== 'object' || backupData === null || Array.isArray(backupData)) {
          throw new Error('Invalid backup file format. Expected a JSON object.')
        }

        // Confirm before importing
        const confirmMessage = `Are you sure you want to import these settings?

This will:
- Replace all current localStorage data
- Reload the page

Found ${Object.keys(backupData).length} setting(s) to import.`

        if (!(await showFallbackConfirm(confirmMessage))) {
          resolve({ success: false, message: 'Import cancelled by user' })
          return
        }

        // Clear existing localStorage
        localStorage.clear()

        // Import all settings
        for (const [key, value] of Object.entries(backupData)) {
          if (typeof key === 'string' && typeof value === 'string') {
            localStorage.setItem(key, value)
          }
        }

        // Clear cache and reload page
        if (caches) {
          const keys = await caches.keys()
          await Promise.allSettled(keys.map((key) => caches.delete(key)))
        }

        await showFallbackAlert('Settings imported successfully! The page will now reload.')
        location.reload()
      } catch (error) {
        resolve({
          success: false,
          message: `Error importing settings: ${error.message}

Please make sure you selected a valid Cockpit settings backup file.`,
        })
      } finally {
        // Clean up the file input
        document.body.removeChild(fileInput)
      }
    })

    // Trigger file selection
    document.body.appendChild(fileInput)
    fileInput.click()
  })
}

/**
 * Download debug logs
 * @returns {Promise<{success: boolean, message: string}>} Result of download operation
 */
export async function downloadLogs() {
  try {
    // Create debug data in key-value format (same structure as backup button)
    const debugData = {}

    // Add export information
    debugData['cockpit-logs-export-info'] = JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: capturedLogs.length,
    })

    // Add system information
    debugData['cockpit-system-info'] = JSON.stringify({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      url: window.location.href,
    })

    // Add logs as individual entries
    capturedLogs.forEach((log, index) => {
      debugData[`cockpit-log-${index.toString().padStart(4, '0')}`] = JSON.stringify(log)
    })

    // Create JSON string with proper formatting
    const jsonString = JSON.stringify(debugData, null, 2)

    // Create blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    // Create temporary download link
    const downloadLink = document.createElement('a')
    downloadLink.href = url

    // Generate filename with current date
    const now = new Date()
    const dateString = now.toISOString().split('T')[0]
    const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    downloadLink.download = `cockpit-debug-logs-${dateString}-${timeString}.json`

    // Trigger download with multiple attempts (needed for browser compatibility)
    document.body.appendChild(downloadLink)
    downloadLink.click()

    // Try alternative method after short delay
    setTimeout(() => {
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: false,
      })
      downloadLink.dispatchEvent(clickEvent)

      // Cleanup after allowing time for download to start
      setTimeout(() => {
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(url)
      }, 500)
    }, 100)

    const message = `Debug logs downloaded successfully!

Captured ${capturedLogs.length} log entries.

Please send this file to the support team along with a description of the issue.`

    return { success: true, message }
  } catch (error) {
    return {
      success: false,
      message: `Error downloading logs: ${error.message}

Please try again or contact support.`,
    }
  }
}

/**
 * Reset settings (clear localStorage and cache)
 * @returns {Promise<{success: boolean, message: string}>} Result of reset operation
 */
export async function resetSettings() {
  try {
    if (!(await showFallbackConfirm('Are you sure you want to reset Cockpit settings?'))) {
      return { success: false, message: 'Reset cancelled by user' }
    }

    localStorage.clear()

    // Clear cache to ensure a fresh access to all files
    if (caches) {
      const keys = await caches.keys()
      await Promise.allSettled(keys.map((key) => caches.delete(key)))
    }

    location.reload()

    return { success: true, message: 'Settings reset successfully' }
  } catch (error) {
    return { success: false, message: `Error resetting settings: ${error.message}` }
  }
}
