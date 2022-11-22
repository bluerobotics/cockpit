/* eslint-disable max-classes-per-file */

/** Levels of alerts available to be raised */
export enum AlertLevel {
  Success = 'success',
  Error = 'error',
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

/** Base Alert interface to be used for system-user communication */
export interface AlertInterface {
  /**
   * Indicates the nature of the alert. Similar to logging systems.
   */
  level: AlertLevel
  /**
   * What is being communicated
   */
  message: string
  /**
   * Date object indicating the time of creation
   */
  time_created: Date
}

/**
 *
 */
export class Alert implements AlertInterface {
  /**
   *
   * @param { AlertLevel } level - Indicates the nature of the alert. Similar to logging systems.
   * @param { string } message - What is being communicated
   * @param { Date } time_created - Date object indicating the time of creation
   */
  constructor(
    public readonly level: AlertLevel,
    public readonly message: string,
    public readonly time_created = new Date()
  ) {}
}
