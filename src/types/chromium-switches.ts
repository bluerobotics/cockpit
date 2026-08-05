/** Persisted state of the custom Chromium switches, as seen by the renderer. */
export interface ChromiumSwitchesState {
  /**
   * Switches that are currently applied on every launch
   */
  entries: string[]
  /**
   * Switches that were set aside because Cockpit failed to start with them
   */
  disabledAfterFailedStartup: string[]
}
