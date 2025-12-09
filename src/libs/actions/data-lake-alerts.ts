import { v4 as uuid } from 'uuid'

import { pushAlert } from '@/libs/alert-manager'
import { Alert, AlertLevel } from '@/types/alert'

import {
  DataLakeVariableType,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from './data-lake'

const dataLakeAlertsKey = 'cockpit-data-lake-alerts'

/**
 * Comparison operators for alerts
 */
export type ComparisonOperator =
  | 'equals' // for all types
  | 'notEquals' // for all types
  | 'greaterThan' // for numbers
  | 'greaterThanOrEqual' // for numbers
  | 'lessThan' // for numbers
  | 'lessThanOrEqual' // for numbers

/**
 * Get available comparison operators for a given variable type
 * @param {DataLakeVariableType} type - The type of the variable
 * @returns {Array<{value: ComparisonOperator, label: string}>} Available operators
 */
export const getComparisonOperatorsForType = (
  type: DataLakeVariableType
): Array<{
  /**
   * The value of the operator
   */
  value: ComparisonOperator
  /**
   * The label of the operator
   */
  label: string
}> => {
  switch (type) {
    case 'boolean':
      return [{ value: 'equals', label: 'equals' }]
    case 'number':
      return [
        { value: 'greaterThan', label: '>' },
        { value: 'greaterThanOrEqual', label: '>=' },
        { value: 'lessThan', label: '<' },
        { value: 'lessThanOrEqual', label: '<=' },
        { value: 'equals', label: '=' },
        { value: 'notEquals', label: '≠' },
      ]
    case 'string':
      return [
        { value: 'equals', label: 'equals' },
        { value: 'notEquals', label: 'not equals' },
      ]
    default:
      return [
        { value: 'equals', label: 'equals' },
        { value: 'notEquals', label: 'not equals' },
      ]
  }
}

/**
 * Interface for a single alert condition
 */
export interface AlertCondition {
  /** The ID of the data lake variable to monitor for this condition */
  variableId: string
  /** The comparison operator to use */
  operator: ComparisonOperator
  /** The value to compare against */
  compareValue: string | number | boolean
}

/**
 * Interface for a Data Lake alert configuration
 */
export interface DataLakeAlert {
  /** Unique identifier for the alert */
  id: string
  /** User-friendly name for the alert */
  name: string
  /** Whether the alert is enabled */
  enabled: boolean
  /** Array of conditions (all must be true - AND logic), each with its own variable */
  conditions: AlertCondition[]
  /** The alert level when triggered */
  level: AlertLevel
  /** Minimum time (in ms) between consecutive alerts */
  minInterval: number
  /** Minimum duration (in ms) that conditions must be met before triggering (0 = disabled) */
  minDuration: number
  /** Optional custom message */
  customMessage?: string
}

/** Internal tracking for alert state */
interface AlertState {
  /**
   * Map of variable IDs to their listener IDs
   */
  listenerIds: Record<string, string>
  /**
   * The time the alert was last triggered
   */
  lastTriggeredTime: number
  /**
   * The time when conditions first became true (null if conditions are not met)
   */
  conditionMetSince: number | null
}

let globalAlerts: DataLakeAlert[] = []
const alertStates: Record<string, AlertState> = {}

/**
 * Evaluate if a single condition is met
 * @param {AlertCondition} condition - The condition to evaluate
 * @returns {boolean} Whether the condition is met
 */
const evaluateSingleCondition = (condition: AlertCondition): boolean => {
  const currentValue = getDataLakeVariableData(condition.variableId)
  if (currentValue === undefined) return false

  const { operator, compareValue } = condition

  switch (operator) {
    case 'equals':
      return currentValue === compareValue
    case 'notEquals':
      return currentValue !== compareValue
    case 'greaterThan':
      return Number(currentValue) > Number(compareValue)
    case 'greaterThanOrEqual':
      return Number(currentValue) >= Number(compareValue)
    case 'lessThan':
      return Number(currentValue) < Number(compareValue)
    case 'lessThanOrEqual':
      return Number(currentValue) <= Number(compareValue)
    default:
      return false
  }
}

/**
 * Evaluate if all alert conditions are met (AND logic)
 * @param {DataLakeAlert} alert - The alert configuration
 * @returns {boolean} Whether all conditions are met
 */
const evaluateAllConditions = (alert: DataLakeAlert): boolean => {
  if (alert.conditions.length === 0) return false
  return alert.conditions.every((condition) => evaluateSingleCondition(condition))
}

/**
 * Get a human-readable description of the operator
 * @param {ComparisonOperator} operator - The operator
 * @returns {string} Human-readable description
 */
const getOperatorDescription = (operator: ComparisonOperator): string => {
  switch (operator) {
    case 'equals':
      return 'equals'
    case 'notEquals':
      return 'does not equal'
    case 'greaterThan':
      return 'is greater than'
    case 'greaterThanOrEqual':
      return 'is greater than or equal to'
    case 'lessThan':
      return 'is less than'
    case 'lessThanOrEqual':
      return 'is less than or equal to'
    default:
      return operator
  }
}

/**
 * Format a single condition for display (with variable name and current value)
 * @param {AlertCondition} condition - The condition
 * @returns {string} Formatted condition string
 */
const formatConditionForMessage = (condition: AlertCondition): string => {
  const variableInfo = getDataLakeVariableInfo(condition.variableId)
  const variableName = variableInfo?.name || condition.variableId
  const currentValue = getDataLakeVariableData(condition.variableId)
  return `${variableName} (${currentValue}) ${getOperatorDescription(condition.operator)} ${condition.compareValue}`
}

/**
 * Replace variable name placeholders in a custom message with their current values
 * Supports {{variableName}} syntax where variableName is the display name of a variable
 * @param {string} message - The custom message with placeholders
 * @param {DataLakeAlert} alert - The alert configuration (used to find variable IDs)
 * @returns {string} The message with placeholders replaced
 */
const replaceMessagePlaceholders = (message: string, alert: DataLakeAlert): string => {
  // Find all {{variableName}} placeholders
  const placeholderRegex = /\{\{([^}]+)\}\}/g
  return message.replace(placeholderRegex, (match, variableName) => {
    // Find a condition with a variable that matches this name
    for (const condition of alert.conditions) {
      const variableInfo = getDataLakeVariableInfo(condition.variableId)
      if (variableInfo?.name === variableName) {
        const value = getDataLakeVariableData(condition.variableId)
        return value !== undefined ? String(value) : match
      }
    }
    // If no matching variable found, leave the placeholder as-is
    return match
  })
}

/**
 * Generate the alert message
 * @param {DataLakeAlert} alert - The alert configuration
 * @returns {string} The alert message
 */
const generateAlertMessage = (alert: DataLakeAlert): string => {
  if (alert.customMessage) {
    return replaceMessagePlaceholders(alert.customMessage, alert)
  }

  const conditionsStr = alert.conditions.map(formatConditionForMessage).join(' AND ')
  return `${alert.name}: ${conditionsStr}`
}

/**
 * Get unique variable IDs from an alert's conditions
 * @param {DataLakeAlert} alert - The alert
 * @returns {string[]} Array of unique variable IDs
 */
const getUniqueVariableIds = (alert: DataLakeAlert): string[] => {
  return [...new Set(alert.conditions.map((c) => c.variableId))]
}

/**
 * Handler for when any monitored variable changes
 * @param {DataLakeAlert} alert - The alert to evaluate
 */
const handleVariableChange = (alert: DataLakeAlert): void => {
  if (!alert.enabled) return

  const state = alertStates[alert.id]
  if (!state) return

  const now = Date.now()
  const conditionsMet = evaluateAllConditions(alert)

  if (conditionsMet) {
    // Track when conditions first became true
    if (state.conditionMetSince === null) {
      state.conditionMetSince = now
    }

    const durationMet = alert.minDuration === 0 || now - state.conditionMetSince >= alert.minDuration
    const intervalMet = now - state.lastTriggeredTime >= alert.minInterval

    if (durationMet && intervalMet) {
      const message = generateAlertMessage(alert)

      pushAlert(new Alert(alert.level, message))
      state.lastTriggeredTime = now
      // Reset the condition met time after triggering
      state.conditionMetSince = null
    }
  } else {
    // Conditions no longer met, reset the timer
    state.conditionMetSince = null
  }
}

/**
 * Set up listeners for an alert (one per unique variable in conditions)
 * @param {DataLakeAlert} alert - The alert to set up
 */
const setupAlertListener = (alert: DataLakeAlert): void => {
  // Clean up existing listeners if any
  cleanupAlertListener(alert.id)

  const variableIds = getUniqueVariableIds(alert)
  const listenerIds: Record<string, string> = {}

  // Set up a listener for each unique variable
  for (const variableId of variableIds) {
    const listenerId = listenDataLakeVariable(variableId, () => {
      // Re-fetch the alert from globalAlerts to get the latest state
      const currentAlert = globalAlerts.find((a) => a.id === alert.id)
      if (currentAlert) {
        handleVariableChange(currentAlert)
      }
    })
    listenerIds[variableId] = listenerId
  }

  alertStates[alert.id] = {
    listenerIds,
    lastTriggeredTime: 0,
    conditionMetSince: null,
  }
}

/**
 * Clean up listeners for an alert
 * @param {string} alertId - The ID of the alert
 */
const cleanupAlertListener = (alertId: string): void => {
  const state = alertStates[alertId]
  if (!state) return

  // Unsubscribe from all variables
  for (const [variableId, listenerId] of Object.entries(state.listenerIds)) {
    unlistenDataLakeVariable(variableId, listenerId)
  }

  delete alertStates[alertId]
}

/**
 * Load alerts from localStorage
 */
const loadAlerts = (): void => {
  try {
    const savedAlerts = localStorage.getItem(dataLakeAlertsKey)
    if (savedAlerts) {
      globalAlerts = JSON.parse(savedAlerts) as DataLakeAlert[]
      // Set up listeners for all alerts
      globalAlerts.forEach((alert) => {
        setupAlertListener(alert)
      })
    }
  } catch (error) {
    console.error('Failed to load data lake alerts:', error)
    globalAlerts = []
  }
}

/**
 * Save alerts to localStorage
 */
const saveAlerts = (): void => {
  try {
    localStorage.setItem(dataLakeAlertsKey, JSON.stringify(globalAlerts))
  } catch (error) {
    console.error('Failed to save data lake alerts:', error)
  }
}

/**
 * Get all data lake alerts
 * @returns {DataLakeAlert[]} All configured alerts
 */
export const getAllDataLakeAlerts = (): DataLakeAlert[] => {
  return [...globalAlerts]
}

/**
 * Get a specific alert by ID
 * @param {string} id - The alert ID
 * @returns {DataLakeAlert | undefined} The alert if found
 */
export const getDataLakeAlert = (id: string): DataLakeAlert | undefined => {
  return globalAlerts.find((a) => a.id === id)
}

/**
 * Create a new data lake alert
 * @param {Omit<DataLakeAlert, 'id'>} alertConfig - The alert configuration (without ID)
 * @returns {DataLakeAlert} The created alert
 */
export const createDataLakeAlert = (alertConfig: Omit<DataLakeAlert, 'id'>): DataLakeAlert => {
  const alert: DataLakeAlert = {
    ...alertConfig,
    id: uuid(),
  }

  globalAlerts.push(alert)
  setupAlertListener(alert)
  saveAlerts()

  return alert
}

/**
 * Update an existing alert
 * @param {DataLakeAlert} updatedAlert - The updated alert configuration
 */
export const updateDataLakeAlert = (updatedAlert: DataLakeAlert): void => {
  const index = globalAlerts.findIndex((a) => a.id === updatedAlert.id)
  if (index === -1) {
    console.error(`Alert with id '${updatedAlert.id}' not found`)
    return
  }

  // Clean up old listeners and set up new ones
  cleanupAlertListener(updatedAlert.id)

  globalAlerts[index] = updatedAlert
  setupAlertListener(updatedAlert)

  saveAlerts()
}

/**
 * Delete an alert
 * @param {string} id - The ID of the alert to delete
 */
export const deleteDataLakeAlert = (id: string): void => {
  const index = globalAlerts.findIndex((a) => a.id === id)
  if (index === -1) return

  cleanupAlertListener(id)
  globalAlerts.splice(index, 1)
  saveAlerts()
}

/**
 * Toggle the enabled state of an alert
 * @param {string} id - The alert ID
 * @param {boolean} enabled - The new enabled state
 */
export const setDataLakeAlertEnabled = (id: string, enabled: boolean): void => {
  const alert = globalAlerts.find((a) => a.id === id)
  if (!alert) return

  alert.enabled = enabled
  saveAlerts()
}

/**
 * Get the default compare value for a given variable type
 * @param {DataLakeVariableType} type - The variable type
 * @returns {string | number | boolean} The default compare value
 */
export const getDefaultCompareValue = (type: DataLakeVariableType): string | number | boolean => {
  switch (type) {
    case 'boolean':
      return true
    case 'number':
      return 0
    case 'string':
      return ''
    default:
      return ''
  }
}

/**
 * Get the default operator for a given variable type
 * @param {DataLakeVariableType} type - The variable type
 * @returns {ComparisonOperator} The default operator
 */
export const getDefaultOperator = (type: DataLakeVariableType): ComparisonOperator => {
  switch (type) {
    case 'boolean':
      return 'equals'
    case 'number':
      return 'greaterThan'
    case 'string':
      return 'equals'
    default:
      return 'equals'
  }
}

/**
 * Create a default condition for a given variable
 * @param {string} variableId - The variable ID
 * @param {DataLakeVariableType} type - The variable type
 * @returns {AlertCondition} A default condition
 */
export const createDefaultCondition = (variableId: string, type: DataLakeVariableType): AlertCondition => {
  return {
    variableId,
    operator: getDefaultOperator(type),
    compareValue: getDefaultCompareValue(type),
  }
}

// Initialize by loading saved alerts
loadAlerts()
