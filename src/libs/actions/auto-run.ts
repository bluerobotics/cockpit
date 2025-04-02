import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'

const STORAGE_KEY = 'cockpit-actions-auto-run-options'

/**
 * Configuration for running an action once after application startup
 */
type AutoRunConfigOnce = {
  /** Type identifier for once-only execution */
  type: 'once'
  /** Delay in milliseconds after startup before executing the action */
  delay: number
}

/**
 * Configuration for running an action at regular intervals
 */
type AutoRunConfigInterval = {
  /** Type identifier for interval-based execution */
  type: 'interval'
  /** Frequency in milliseconds between action executions */
  frequency: number
}

/**
 * Union type representing all possible auto-run configurations
 */
export type AutoRunConfig = AutoRunConfigOnce | AutoRunConfigInterval

/**
 * Storage structure for auto-run configurations
 */
interface AutoRunStorage {
  [actionId: string]: AutoRunConfig
}

// Timers for interval actions
const intervalTimers: Record<string, number> = {}

/**
 * Retrieves all auto-run configurations from local storage
 * @returns {AutoRunStorage} Object containing all action auto-run configurations
 */
export function getAllAutoRunConfigs(): AutoRunStorage {
  const storedConfig = localStorage.getItem(STORAGE_KEY)
  if (!storedConfig) return {}
  return JSON.parse(storedConfig)
}

/**
 * Gets auto-run configuration for a specific action
 * @param {string} actionId The ID of the action
 * @returns {AutoRunConfig | null} The auto-run configuration or null if not configured
 */
export function getAutoRunConfig(actionId: string): AutoRunConfig | null {
  const allConfigs = getAllAutoRunConfigs()
  return allConfigs[actionId] || null
}

/**
 * Saves auto-run configuration for an action
 * @param {string} actionId The ID of the action
 * @param {AutoRunConfig} config The auto-run configuration to save
 */
export function saveAutoRunConfig(actionId: string, config: AutoRunConfig): void {
  const allConfigs = getAllAutoRunConfigs()
  allConfigs[actionId] = config
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allConfigs))

  // For interval-based configurations, start the interval immediately
  if (config.type === 'interval') {
    // Clear any existing interval first
    if (intervalTimers[actionId]) {
      clearInterval(intervalTimers[actionId])
    }

    // Set up the new interval
    intervalTimers[actionId] = window.setInterval(() => {
      executeActionCallback(actionId)
    }, config.frequency)

    // Execute once immediately
    executeActionCallback(actionId)
  }
}

/**
 * Removes auto-run configuration for an action
 * @param {string} actionId The ID of the action
 */
export function removeAutoRunConfig(actionId: string): void {
  const allConfigs = getAllAutoRunConfigs()
  if (allConfigs[actionId]) {
    delete allConfigs[actionId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allConfigs))
  }

  // Clear any existing interval timer
  if (intervalTimers[actionId]) {
    clearInterval(intervalTimers[actionId])
    delete intervalTimers[actionId]
  }
}

/**
 * Initializes all auto-run actions on application startup
 * Sets up timers for all configured actions
 */
export function initializeActionAutoRun(): void {
  const allConfigs = getAllAutoRunConfigs()

  // Process each configured action
  Object.entries(allConfigs).forEach(([actionId, config]) => {
    if (config.type === 'once') {
      // Set timeout for one-time execution
      setTimeout(() => {
        executeActionCallback(actionId)
      }, config.delay)
    } else if (config.type === 'interval') {
      // Set interval for repeated execution
      intervalTimers[actionId] = window.setInterval(() => {
        executeActionCallback(actionId)
      }, config.frequency)
    }
  })
}

/**
 * Cleans up all interval timers to prevent memory leaks
 * Should be called when the application is shutting down
 */
export function cleanupAutoRun(): void {
  Object.values(intervalTimers).forEach((timerId) => {
    clearInterval(timerId)
  })
}
