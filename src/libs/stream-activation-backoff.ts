const retryDelayMs = 5000

/**
 * Backoff bookkeeping for stream activations that failed.
 *
 * Stream consumers (video player widget, snapshot tool, recorder) re-request their stream about once a second
 * and read a missing stream as "not activated yet", so without this a failed activation is retried, and
 * reported to the user, on every tick. Retries are kept, since the source may still come back, but they are
 * spaced out and only the failure that starts a streak is worth telling the user about.
 */
export class StreamActivationBackoff {
  private lastFailureTime = new Map<string, number>()

  /**
   * Whether a stream failed too recently for another activation attempt to be worth making
   * @param {string} streamName - External stream identifier
   * @returns {boolean} True while the stream is still inside its retry delay
   */
  public isBackingOff(streamName: string): boolean {
    const lastFailure = this.lastFailureTime.get(streamName)
    return lastFailure !== undefined && Date.now() - lastFailure < retryDelayMs
  }

  /**
   * Record a failed activation attempt, and decide whether this one is worth telling the user about
   * @param {string} streamName - External stream identifier
   * @returns {boolean} True when this failure starts a streak, i.e. the user has not been told about it yet
   */
  public registerFailure(streamName: string): boolean {
    const isFirstFailure = !this.lastFailureTime.has(streamName)
    this.lastFailureTime.set(streamName, Date.now())
    return isFirstFailure
  }

  /**
   * Forget a stream's failure streak, so a later failure is retried right away and reported to the user again
   * @param {string} streamName - External stream identifier
   */
  public forget(streamName: string): void {
    this.lastFailureTime.delete(streamName)
  }
}
