// Timer management for cockpit
/**
 * Information about a timer
 */
export interface TimerInfo {
  /**
   * The ID of the timer
   */
  id: number
  /**
   * The type of the timer
   */
  type: 'interval' | 'timeout'
}

/**
 * Manager for Cockpit timers
 * Handles the creation and clearing of timers for a specific owner, making sure that only one timer is running at a time for a given owner.
 */
export class CockpitTimerManager {
  private currentOwnerId: string | null = null
  private ownerTimers: Map<string, TimerInfo[]> = new Map()

  /**
   * Set the current owner ID
   * @param {string} ownerId - The ID of the owner
   */
  setCurrentOwnerId(ownerId: string): void {
    this.currentOwnerId = ownerId
  }

  /**
   * Clear the current owner ID
   */
  clearCurrentOwnerId(): void {
    this.currentOwnerId = null
  }

  /**
   * Add a timer to an owner
   * @param {string} ownerId - The ID of the owner
   * @param {number} timerId - The ID of the timer
   * @param {'interval' | 'timeout'} type - The type of the timer
   */
  addTimer(ownerId: string, timerId: number, type: 'interval' | 'timeout'): void {
    if (!this.ownerTimers.has(ownerId)) {
      this.ownerTimers.set(ownerId, [])
    }
    this.ownerTimers.get(ownerId)!.push({ id: timerId, type })
  }

  /**
   * Clear all timers for an owner
   * @param {string} ownerId - The ID of the owner
   */
  clearAllTimersForOwner(ownerId: string): void {
    console.log(`Clearing ${this.ownerTimers.get(ownerId)?.length ?? 0} timers for ${ownerId}.`)
    const timers = this.ownerTimers.get(ownerId)
    if (!timers) return

    timers.forEach((timer) => {
      if (timer.type === 'interval') {
        clearInterval(timer.id)
      } else {
        clearTimeout(timer.id)
      }
    })

    this.ownerTimers.delete(ownerId)
  }

  /**
   * Create a managed interval
   * @param {Function} callback - The callback to execute
   * @param {number} delay - The delay in milliseconds
   * @param {string} ownerId - The ID of the owner
   * @returns {number} The interval ID
   */
  createManagedSetInterval(callback: () => void, delay?: number, ownerId?: string): number {
    console.log(`Creating managed interval with ${delay}ms delay.`)
    if (!ownerId && !this.currentOwnerId) {
      throw new Error('No owner ID provided and no current owner ID set.')
    }
    const intervalId = window.setInterval(callback, delay)
    this.addTimer((ownerId || this.currentOwnerId)!, intervalId, 'interval')
    return intervalId
  }

  /**
   * Create a managed timeout
   * @param {Function} callback - The callback to execute
   * @param {number} delay - The delay in milliseconds
   * @param {string} ownerId - The ID of the owner
   * @returns {number} The timeout ID
   */
  createManagedSetTimeout(callback: () => void, delay?: number, ownerId?: string): number {
    console.log(`Creating managed timeout with ${delay}ms delay.`)
    if (!ownerId && !this.currentOwnerId) {
      throw new Error('No owner ID provided and no current owner ID set.')
    }
    const timeoutId = window.setTimeout(callback, delay)
    this.addTimer((ownerId || this.currentOwnerId)!, timeoutId, 'timeout')
    return timeoutId
  }
}

const cockpitTimerManager = new CockpitTimerManager()

// Export the timer manager for use in action execution
export { cockpitTimerManager }
