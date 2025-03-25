import { listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'

/**
 * Interface representing a link between an action and data-lake variables
 */
interface ActionLink {
  /** The ID of the action */
  actionId: string
  /** The type of the action */
  actionType: string
  /** Array of data-lake variable IDs to watch */
  variables: string[]
  /** Minimum time (in ms) between consecutive action executions */
  minInterval: number
  /** Timestamp of the last execution */
  lastExecutionTime: number
}

const actionLinks: Record<string, ActionLink> = {}
const listenerIds: Record<string, string[]> = {}
const pendingExecutions: Record<string, ReturnType<typeof setTimeout>> = {}

/**
 * Save a new action link configuration and set up the watchers
 * @param {string} actionId The ID of the action to link
 * @param {string} actionType The type of the action
 * @param {string[]} variables Array of data-lake variable IDs to watch
 * @param {number} minInterval Minimum time (in ms) between consecutive action executions
 */
export const saveActionLink = (
  actionId: string,
  actionType: string,
  variables: string[],
  minInterval: number
): void => {
  // Remove any existing link for this action
  removeActionLink(actionId)

  // Save the new link configuration
  actionLinks[actionId] = {
    actionId,
    actionType,
    variables,
    minInterval,
    lastExecutionTime: 0,
  }

  // Set up listeners for each variable
  listenerIds[actionId] = variables.map((variableId) =>
    listenDataLakeVariable(variableId, () => {
      executeLinkedAction(actionId)
    })
  )

  saveLinksToPersistentStorage()
}

/**
 * Remove an action link and clean up its watchers
 * @param {string} actionId The ID of the action to unlink
 */
export const removeActionLink = (actionId: string): void => {
  const link = actionLinks[actionId]
  if (!link) return

  // Remove all listeners
  if (listenerIds[actionId]) {
    link.variables.forEach((variableId, index) => {
      unlistenDataLakeVariable(variableId, listenerIds[actionId][index])
    })
    delete listenerIds[actionId]
  }

  delete actionLinks[actionId]

  saveLinksToPersistentStorage()
}

/**
 * Get the link configuration for an action
 * @param {string} actionId The ID of the action
 * @returns {ActionLink | null} The link configuration if it exists, null otherwise
 */
export const getActionLink = (actionId: string): ActionLink | null => {
  return actionLinks[actionId] || null
}

/**
 * Execute a linked action, respecting the minimum interval between executions
 * @param {string} actionId The ID of the action to execute
 */
const executeLinkedAction = (actionId: string): void => {
  const link = actionLinks[actionId]
  if (!link) return

  const now = Date.now()
  const timeSinceLastExecution = now - link.lastExecutionTime
  if (timeSinceLastExecution >= link.minInterval) {
    link.lastExecutionTime = now
    clearTimeout(pendingExecutions[actionId])
    executeActionCallback(actionId)
  } else {
    if (pendingExecutions[actionId]) {
      clearTimeout(pendingExecutions[actionId])
    }
    pendingExecutions[actionId] = setTimeout(() => {
      executeActionCallback(actionId)
    }, link.minInterval - timeSinceLastExecution)
  }
}

/**
 * Get all action links
 * @returns {Record<string, ActionLink>} Record of all action links
 */
export const getAllActionLinks = (): Record<string, ActionLink> => {
  return { ...actionLinks }
}

// Load saved links from localStorage on startup
const loadSavedLinks = (): void => {
  try {
    const savedLinks = localStorage.getItem('cockpit-action-links')
    if (savedLinks) {
      const links = JSON.parse(savedLinks) as Record<string, Omit<ActionLink, 'lastExecutionTime'>>
      Object.entries(links).forEach(([actionId, link]) => {
        saveActionLink(actionId, link.actionType, link.variables, link.minInterval)
      })
    }
  } catch (error) {
    console.error('Failed to load saved action links:', error)
  }
}

// Save links to localStorage when they change
const saveLinksToPersistentStorage = (): void => {
  try {
    // Don't save the lastExecutionTime
    const linksToSave = Object.entries(actionLinks).reduce(
      (acc, [id, link]) => ({
        ...acc,
        [id]: {
          actionId: link.actionId,
          actionType: link.actionType,
          variables: link.variables,
          minInterval: Number(link.minInterval),
        },
      }),
      {}
    )
    localStorage.setItem('cockpit-action-links', JSON.stringify(linksToSave))
  } catch (error) {
    console.error('Failed to save action links:', error)
  }
}

// Initialize
loadSavedLinks()
