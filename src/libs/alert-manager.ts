import { v4 as uuid } from 'uuid'

import { Alert, AlertLevel } from '@/types/alert'

/**
 * Callback type for alert listeners
 */
type AlertListener = (alert: Alert, index: number) => void

/**
 * Internal state for the alert manager
 */
const alerts: Alert[] = []
const alertListeners: Record<string, AlertListener> = {}

/**
 * Get all alerts
 * @returns {Alert[]} All alerts
 */
export const getAllAlerts = (): Alert[] => {
  return [...alerts]
}

/**
 * Get a sorted copy of all alerts by time created
 * @returns {Alert[]} Sorted alerts
 */
export const getSortedAlerts = (): Alert[] => {
  return [...alerts].sort((a, b) => a.time_created.getTime() - b.time_created.getTime())
}

/**
 * Push a new alert
 * @param {Alert} alert - The alert to push
 */
export const pushAlert = (alert: Alert): void => {
  alerts.push(alert)

  // Log to console based on level
  switch (alert.level) {
    case AlertLevel.Success:
      console.log(alert.message)
      break
    case AlertLevel.Error:
      console.error(alert.message)
      break
    case AlertLevel.Info:
      console.info(alert.message)
      break
    case AlertLevel.Warning:
      console.warn(alert.message)
      break
    case AlertLevel.Critical:
      console.error(alert.message)
      break
    default:
      console.warn(`Unknown alert level. Message: ${alert.message}`)
      break
  }

  // Notify listeners
  const alertIndex = alerts.length - 1
  Object.values(alertListeners).forEach((listener) => {
    try {
      listener(alert, alertIndex)
    } catch (error) {
      console.error('Error in alert listener:', error)
    }
  })
}

/**
 * Push a success alert
 * @param {string} message - The alert message
 * @param {Date} timeCreated - Optional time created
 */
export const pushSuccessAlert = (message: string, timeCreated: Date = new Date()): void => {
  pushAlert(new Alert(AlertLevel.Success, message, timeCreated))
}

/**
 * Push an error alert
 * @param {string} message - The alert message
 * @param {Date} timeCreated - Optional time created
 */
export const pushErrorAlert = (message: string, timeCreated: Date = new Date()): void => {
  pushAlert(new Alert(AlertLevel.Error, message, timeCreated))
}

/**
 * Push an info alert
 * @param {string} message - The alert message
 * @param {Date} timeCreated - Optional time created
 */
export const pushInfoAlert = (message: string, timeCreated: Date = new Date()): void => {
  pushAlert(new Alert(AlertLevel.Info, message, timeCreated))
}

/**
 * Push a warning alert
 * @param {string} message - The alert message
 * @param {Date} timeCreated - Optional time created
 */
export const pushWarningAlert = (message: string, timeCreated: Date = new Date()): void => {
  pushAlert(new Alert(AlertLevel.Warning, message, timeCreated))
}

/**
 * Push a critical alert
 * @param {string} message - The alert message
 * @param {Date} timeCreated - Optional time created
 */
export const pushCriticalAlert = (message: string, timeCreated: Date = new Date()): void => {
  pushAlert(new Alert(AlertLevel.Critical, message, timeCreated))
}

/**
 * Subscribe to alert events
 * @param {AlertListener} listener - The listener function
 * @returns {string} The listener ID (used for unsubscribing)
 */
export const subscribeToAlerts = (listener: AlertListener): string => {
  const listenerId = uuid()
  alertListeners[listenerId] = listener
  return listenerId
}

/**
 * Unsubscribe from alert events
 * @param {string} listenerId - The listener ID to unsubscribe
 */
export const unsubscribeFromAlerts = (listenerId: string): void => {
  delete alertListeners[listenerId]
}

/**
 * Get the current number of alerts
 * @returns {number} The number of alerts
 */
export const getAlertsCount = (): number => {
  return alerts.length
}

/**
 * Get an alert by index
 * @param {number} index - The alert index
 * @returns {Alert | undefined} The alert if found
 */
export const getAlertByIndex = (index: number): Alert | undefined => {
  return alerts[index]
}

// Push initial alert
pushAlert(new Alert(AlertLevel.Success, 'Cockpit started'))
