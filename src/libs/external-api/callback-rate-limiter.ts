/**
 * A simple rate limiter for callbacks that ensures a minimum time interval between calls
 */
export class CallbackRateLimiter {
  private lastCallTime: number

  /**
   * Creates a new CallbackRateLimiter
   * @param {number} minIntervalMs - The minimum time (in milliseconds) that must pass between calls
   */
  constructor(private minIntervalMs: number) {}

  /**
   * Checks if enough time has passed to allow another call
   * @returns {boolean} true if enough time has passed since the last call, false otherwise
   */
  public canCall(): boolean {
    const now = Date.now()
    const lastCall = this.lastCallTime || 0
    const timeSinceLastCall = now - lastCall

    if (timeSinceLastCall >= this.minIntervalMs) {
      this.lastCallTime = now
      return true
    }

    return false
  }
}
