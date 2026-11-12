import { type AlertInterface, AlertLevel } from '@/types/alert'

const alertPriority: Record<AlertLevel, number> = {
  [AlertLevel.Critical]: 3,
  [AlertLevel.Error]: 2,
  [AlertLevel.Warning]: 1,
  [AlertLevel.Info]: 0,
  [AlertLevel.Success]: 0,
}

/**
 * Select the most severe pending alert, keeping arrival order for ties.
 * @param {ReadonlyArray<AlertInterface>} alerts - Pending alerts in arrival order.
 * @returns {number} Index of the next alert, or -1 when none are pending.
 */
export const nextAlertIndex = (alerts: readonly AlertInterface[]): number => {
  // ponytail: Strict priority can delay low-severity alerts during sustained warnings.
  // Age-based promotion or pending-message expiry could bound the delay without deleting history.
  let nextIndex = -1
  for (let index = 0; index < alerts.length; index++) {
    if (nextIndex === -1 || alertPriority[alerts[index].level] > alertPriority[alerts[nextIndex].level]) {
      nextIndex = index
    }
  }
  return nextIndex
}
