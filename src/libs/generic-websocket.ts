import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { machinizeString } from '@/libs/utils'
import { guessedTypeFromString, replaceDataLakeInputsInString } from '@/libs/utils-data-lake'

import { settingsManager } from './settings-management'

// Logger helper with module prefix
const logPrefix = '[GenericWebSocket]'
const logInfo = (...args: unknown[]): void => console.log(logPrefix, ...args)
const logWarn = (...args: unknown[]): void => console.warn(logPrefix, ...args)
const logError = (...args: unknown[]): void => console.error(logPrefix, ...args)

/**
 * Connection status for a generic WebSocket
 */
export type GenericWebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * A generic WebSocket connection configuration and state
 */
export interface GenericWebSocketConnection {
  /**
   * The URL template (may contain data-lake variables like {{ vehicle-address }})
   */
  url: string
  /**
   * Current connection status
   */
  status: GenericWebSocketConnectionStatus
}

const persistentConnectionsKey = 'cockpit-generic-websocket-connections'

// In-memory state
const connections: Record<string, GenericWebSocketConnection> = {}
const sockets: Record<string, WebSocket | null> = {}
const connectionListeners: Record<string, (connections: Record<string, GenericWebSocketConnection>) => void> = {}

let listenerIdCounter = 0

/**
 * Get the resolved URL for a template, checking against existing connections
 * @param {string} templateUrl The URL template to resolve
 * @returns {string} The resolved URL
 */
const getResolvedUrl = (templateUrl: string): string => {
  return replaceDataLakeInputsInString(templateUrl)
}

/**
 * Check if a resolved URL already exists among current connections
 * @param {string} resolvedUrl The resolved URL to check
 * @param {string} excludeTemplate Optional template to exclude from the check
 * @returns {string | null} The template that resolves to the same URL, or null if none
 */
const findExistingConnectionWithResolvedUrl = (resolvedUrl: string, excludeTemplate?: string): string | null => {
  for (const existingTemplate of Object.keys(connections)) {
    if (existingTemplate === excludeTemplate) continue
    if (getResolvedUrl(existingTemplate) === resolvedUrl) {
      return existingTemplate
    }
  }
  return null
}

/**
 * Load persisted connections from localStorage and initialize them
 */
const loadPersistedConnections = (): void => {
  const savedUrls = settingsManager.getKeyValue(persistentConnectionsKey) as string[] | undefined
  if (savedUrls && Array.isArray(savedUrls)) {
    savedUrls.forEach((url) => {
      if (connections[url]) return

      // Check if another template already resolves to the same URL
      const resolvedUrl = getResolvedUrl(url)
      const existingTemplate = findExistingConnectionWithResolvedUrl(resolvedUrl)
      if (existingTemplate) {
        logWarn(`Skipping '${url}' - resolves to same URL as '${existingTemplate}'`)
        return
      }

      connectToWebSocket(url)
    })
  }
}

/**
 * Save current connection URLs to localStorage
 */
const saveConnections = (): void => {
  const urls = Object.keys(connections)
  settingsManager.setKeyValue(persistentConnectionsKey, urls)
}

/**
 * Notify all listeners of connection changes
 */
const notifyListeners = (): void => {
  const connectionsCopy = { ...connections }
  Object.values(connectionListeners).forEach((callback) => {
    callback(connectionsCopy)
  })
}

/**
 * Parse an incoming WebSocket message and inject it into the data-lake
 * Expected format: "variableName=value"
 * @param {string} message The raw message string
 */
const parseAndInjectMessage = (message: string): void => {
  const trimmed = message.trim()
  const equalsIndex = trimmed.indexOf('=')

  if (equalsIndex === -1) {
    logWarn(`Invalid message format (no '=' found): ${trimmed}`)
    return
  }

  const variableName = trimmed.substring(0, equalsIndex).trim()
  let valueStr = trimmed.substring(equalsIndex + 1)

  if (!variableName) {
    logWarn(`Invalid message format (empty variable name): ${trimmed}`)
    return
  }

  // Check if value is quoted (force string type)
  const isQuoted =
    (valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))
  if (isQuoted) {
    // Strip quotes - this value is explicitly a string
    valueStr = valueStr.slice(1, -1)
  }

  // Create prefixed ID using machinized name for consistency
  const variableId = 'external/' + machinizeString(variableName)

  // Get existing variable info or create new one
  let variableInfo = getDataLakeVariableInfo(variableId)

  if (!variableInfo) {
    // Determine type from first value received
    // If quoted, force string type. Otherwise, guess from value.
    // Note: Type is locked on creation. If a string variable sometimes looks like a number,
    // the supplier should surround the value with quotes to force string type.
    const type = isQuoted ? 'string' : guessedTypeFromString(valueStr)
    createDataLakeVariable({
      id: variableId,
      name: variableName,
      type,
      description: 'Variable received from generic WebSocket connection',
    })
    variableInfo = getDataLakeVariableInfo(variableId)
  }

  // Parse value according to the registered type (keeps type consistent)
  const type = variableInfo?.type ?? 'string'
  let parsedValue: string | number | boolean

  if (type === 'number') {
    parsedValue = Number(valueStr)
  } else if (type === 'boolean') {
    parsedValue = valueStr.toLowerCase() === 'true'
  } else {
    parsedValue = valueStr
  }

  setDataLakeVariableData(variableId, parsedValue)
}

/**
 * Schedule a reconnection attempt for a WebSocket URL
 * @param {string} url The URL template to reconnect
 */
const scheduleReconnect = (url: string): void => {
  setTimeout(() => {
    if (connections[url]) {
      connectToWebSocket(url)
    }
  }, 2000)
}

/**
 * Create a WebSocket connection with auto-reconnect
 * @param {string} url The URL template (may contain data-lake variables)
 */
const connectToWebSocket = (url: string): void => {
  // Initialize connection state
  connections[url] = {
    url,
    status: 'connecting',
  }
  notifyListeners()

  // Resolve data-lake variables in URL
  const resolvedUrl = replaceDataLakeInputsInString(url)

  try {
    const socket = new WebSocket(resolvedUrl)

    socket.onopen = () => {
      logInfo(`Connected to ${resolvedUrl}`)
      connections[url].status = 'connected'
      notifyListeners()
    }

    socket.onmessage = (event: MessageEvent) => {
      try {
        const message = typeof event.data === 'string' ? event.data : event.data.toString()
        parseAndInjectMessage(message)
      } catch (error) {
        logError('Error processing message:', error)
      }
    }

    socket.onerror = (error) => {
      logError(`Error on ${resolvedUrl}:`, error)
    }

    socket.onclose = () => {
      logInfo(`Disconnected from ${resolvedUrl}`)

      // Only reconnect if the connection still exists (wasn't removed by user)
      if (connections[url]) {
        connections[url].status = 'disconnected'
        notifyListeners()
        scheduleReconnect(url)
      }
    }

    sockets[url] = socket
  } catch (error) {
    logError(`Failed to create WebSocket for ${resolvedUrl}:`, error)
    connections[url].status = 'disconnected'
    notifyListeners()
    scheduleReconnect(url)
  }
}

/**
 * Add a new generic WebSocket connection
 * @param {string} url The WebSocket URL (may contain data-lake variables like {{ vehicle-address }})
 */
export const addGenericWebSocketConnection = (url: string): void => {
  if (connections[url]) {
    logWarn(`Connection to ${url} already exists`)
    return
  }

  // Check if another template already resolves to the same URL
  const resolvedUrl = getResolvedUrl(url)
  const existingTemplate = findExistingConnectionWithResolvedUrl(resolvedUrl)
  if (existingTemplate) {
    logWarn(`Connection to ${url} resolves to same URL as existing connection '${existingTemplate}'`)
    return
  }

  connectToWebSocket(url)
  saveConnections()
}

/**
 * Remove a generic WebSocket connection
 * @param {string} url The WebSocket URL to remove
 */
export const removeGenericWebSocketConnection = (url: string): void => {
  const socket = sockets[url]
  if (socket) {
    socket.close()
    delete sockets[url]
  }

  delete connections[url]
  saveConnections()
  notifyListeners()
}

/**
 * Get all generic WebSocket connections
 * @returns {Record<string, GenericWebSocketConnection>} A copy of the connections record
 */
export const getGenericWebSocketConnections = (): Record<string, GenericWebSocketConnection> => {
  return { ...connections }
}

/**
 * Subscribe to connection status changes
 * @param {(connections: Record<string, GenericWebSocketConnection>) => void} callback Function to call when connections change
 * @returns {() => void} A function to unsubscribe
 */
export const listenToGenericWebSocketConnections = (
  callback: (connections: Record<string, GenericWebSocketConnection>) => void
): (() => void) => {
  const listenerId = `listener-${listenerIdCounter++}`
  connectionListeners[listenerId] = callback

  // Immediately call with current state
  callback({ ...connections })

  // Return unsubscribe function
  return () => {
    delete connectionListeners[listenerId]
  }
}

// Initialize: load persisted connections on module load
loadPersistedConnections()
