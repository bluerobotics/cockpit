import { differenceInMilliseconds, differenceInSeconds, format, intervalToDuration } from 'date-fns'
import localforage from 'localforage'

import { defaultSensorDataloggerProfile } from '@/assets/defaults'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import { getDataLakeVariableData, getDataLakeVariableInfo } from './actions/data-lake'
import { settingsManager } from './settings-management'
import { unitAbbreviation } from './units'
import { degrees } from './utils'
import { findDataLakeInputsInString, replaceDataLakeInputsInString } from './utils-data-lake'

/**
 * Variables data can be datalogged
 */
export enum DatalogVariable {
  roll = 'Roll',
  pitch = 'Pitch',
  heading = 'Heading',
  depth = 'Depth',
  mode = 'Mode',
  batteryVoltage = 'Battery voltage',
  batteryCurrent = 'Battery current',
  gpsVisibleSatellites = 'GPS satellites',
  gpsFixType = 'GPS status',
  latitude = 'Latitude',
  longitude = 'Longitude',
  missionName = 'Mission name',
  time = 'Time',
  date = 'Date',
  instantaneousPower = 'Instantaneous power',
}

const logDateFormat = 'LLL dd, yyyy'
const { showDialog } = useInteractionDialog()

const telemetryDisplayDataKey = 'cockpit-datalogger-overlay-grid'
const telemetryDisplayOptionsKey = 'cockpit-datalogger-overlay-options'
const logIntervalKey = 'cockpit-datalogger-log-interval'

const defaultTelemetryDisplayData = defaultSensorDataloggerProfile as OverlayGrid
const defaultTelemetryDisplayOptions = {
  fontSize: 30,
  fontColor: '#FFFFFFFF',
  backgroundColor: '#000000FF',
  fontOutlineColor: '#000000FF',
  fontOutlineSize: 2,
  fontShadowColor: '#000000FF',
  fontShadowSize: 1,
  fontBold: false,
  fontItalic: false,
  fontUnderline: false,
  fontStrikeout: false,
} as OverlayOptions
const defaultLogInterval = 1000

/**
 * Data for VeryGenericIndicator variables
 */
type VeryGenericData = {
  /**
   * Display name of the variable
   */
  displayName: string
  /**
   * Value of the variable
   */
  variableValue: string
  /**
   * Linux epoch stating when this value was last changed
   */
  lastChanged?: number
}

/**
 * Extended data to also accept VeryGenericIndicator variables
 */
/* eslint-disable jsdoc/require-jsdoc  */
export type ExtendedVariablesData = {
  /**
   * Display name of the VeryGenericVariable
   */
  [key: string]: {
    value: string
    lastChanged: number
    displayName: string
  }
}

/**
 * State of a variable that can be displayed
 */
export type VariablesData = {
  /**
   * Name of the variable
   */
  [key in DatalogVariable]: {
    /**
     * Value that should be displayed for that variable, with the right amount of digits and including units (if desired)
     */
    value: string
    /**
     * Linux epoch stating when this value was last changed
     */
    lastChanged: number
  }
}

/**
 * Format for a standalone cockpit log
 */
export interface CockpitStandardLogPoint {
  /**
   * Universal Linux epoch time (milliseconds since January 1st, 1970, UTC)
   */
  epoch: number
  /**
   * The actual vehicle data
   */
  data: ExtendedVariablesData
}

/**
 * Format for a standalone cockpit log
 */
export type CockpitStandardLog = CockpitStandardLogPoint[]

/**
 * Information about a data session (detected from raw log entries)
 */
export interface DataSessionInfo {
  /**
   * Unique identifier for the session
   */
  id: string
  /**
   * Start time of the session (epoch ms)
   */
  startTime: number
  /**
   * End time of the session (epoch ms)
   */
  endTime: number
  /**
   * Formatted date/time string
   */
  dateTimeFormatted: string
  /**
   * Number of data points in the session
   */
  dataPointCount: number
  /**
   * Duration of the session in seconds
   */
  durationSeconds: number
  /**
   * Whether this is the current active session
   */
  isCurrentSession: boolean
}

/**
 * Position for telemetry data on the video overlay
 */
export interface OverlayGrid {
  [gridPosition: string]: string[]
}

/**
 * Telemetry overlay options
 */
/* eslint-disable jsdoc/require-jsdoc  */
export interface OverlayOptions {
  fontSize: number
  fontColor: string
  backgroundColor: string
  fontOutlineColor: string
  fontOutlineSize: number
  fontShadowColor: string
  fontShadowSize: number
  fontBold: boolean
  fontItalic: boolean
  fontUnderline: boolean
  fontStrikeout: boolean
}

/**
 * Class to manage the variables that are currently being logged
 */
export class CurrentlyLoggedVariables {
  private static variables: Set<{ name: string; instances: number }> = new Set()
  private static readonly defaultVariables = new Set<string>(Object.values(DatalogVariable))

  static {
    this.defaultVariables.forEach((variable) => this.variables.add({ name: variable, instances: 1 }))
  }

  /**
   * Adds a new variable to the set if it's not already included, or increments its VGI instances count if it is.
   * @param {string} name The name of the variable to add or update.
   */
  public static addVariable(name: string): void {
    const existingVariable = Array.from(this.variables).find((variable) => variable.name === name)

    if (existingVariable) {
      this.variables.delete(existingVariable)
      this.variables.add({ name: existingVariable.name, instances: existingVariable.instances + 1 })
    } else {
      this.variables.add({ name, instances: 1 })
    }
  }

  /**
   * Removes a variable from the set or decrements its VGI instances count if it has more than one.
   * @param {string} name The name of the variable to remove.
   */
  public static removeVariable(name: string): void {
    if (name) name = name.trim()
    if (!this.defaultVariables.has(name)) {
      const existingVariable = Array.from(this.variables).find((variable) => variable.name === name)

      if (existingVariable) {
        if (existingVariable.instances > 1) {
          this.variables.delete(existingVariable) // Remove the old entry from the Set.
          this.variables.add({ name: existingVariable.name, instances: existingVariable.instances - 1 })
        } else {
          this.variables.delete(existingVariable)
        }
      }
    } else {
      console.log(`Attempted to remove default variable: ${name}. Operation not allowed.`)
    }
  }

  /**
   * Retrieves all currently logged variables.
   * @returns {Set<string>} A set of all variables.
   */
  public static getAllVariables(): string[] {
    return Array.from(this.variables).map((variable) => variable.name)
  }
}

/**
 * Manager logging vehicle data and others
 */
export class DataLogger {
  logRequesters: string[] = []
  datetimeLastLogPoint: Date | null = null
  variablesBeingUsed: DatalogVariable[] = []
  veryGenericIndicators: VeryGenericData[] = []
  private _telemetryDisplayData?: OverlayGrid
  private _telemetryDisplayOptions?: OverlayOptions
  private _logInterval?: number

  get telemetryDisplayData(): OverlayGrid {
    if (this._telemetryDisplayData === undefined) {
      const savedValue = settingsManager.getKeyValue(telemetryDisplayDataKey) as OverlayGrid
      this._telemetryDisplayData = savedValue ?? defaultTelemetryDisplayData
    }
    return this._telemetryDisplayData
  }

  set telemetryDisplayData(value: OverlayGrid) {
    this._telemetryDisplayData = value
    settingsManager.setKeyValue(telemetryDisplayDataKey, value)
  }

  get telemetryDisplayOptions(): OverlayOptions {
    if (this._telemetryDisplayOptions === undefined) {
      const savedValue = settingsManager.getKeyValue(telemetryDisplayOptionsKey) as OverlayOptions
      this._telemetryDisplayOptions = savedValue ?? defaultTelemetryDisplayOptions
    }
    return this._telemetryDisplayOptions
  }

  set telemetryDisplayOptions(value: OverlayOptions) {
    this._telemetryDisplayOptions = value
    settingsManager.setKeyValue(telemetryDisplayOptionsKey, value)
  }

  get logInterval(): number {
    if (this._logInterval === undefined) {
      const savedValue = settingsManager.getKeyValue(logIntervalKey) as number
      this._logInterval = savedValue ?? defaultLogInterval
    }
    return this._logInterval
  }

  set logInterval(value: number) {
    if (value < 1) {
      showDialog({ message: 'Minimum log interval is 1 millisecond (1000 Hz).', variant: 'error' })
      return
    }

    this._logInterval = value
    settingsManager.setKeyValue(logIntervalKey, value)
  }

  get frequency(): number {
    return 1000 / this.logInterval
  }

  set frequency(value: number) {
    if (value > 1000 || value < 0.1) {
      showDialog({ message: 'Log frequency should stay between 0.1 Hz and 1000 Hz.', variant: 'error' })
      return
    }

    this.logInterval = 1000 / value
  }

  cockpitLogsDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Sensor Logs',
    storeName: 'cockpit-sensor-logs-db',
    version: 1.0,
    description: 'Local backups of Cockpit sensor logs, to be retrieved in case of failure.',
  })

  static cockpitTemporaryLogsDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Temporary Sensor Log points',
    storeName: 'cockpit-temporary-sensor-logs-db',
    version: 1.0,
    description: 'Temporary storage of Cockpit sensor log points.',
  })

  /**
   * Start an intervaled logging
   * @param {string} requesterId The ID of the requester. Can be any string, but should be unique. It will be used to
   * stop the logging individually, so one log requester does not interfere with another.
   */
  startLogging(requesterId: string): void {
    this.logRequesters.push(requesterId)
    if (this.logRequesters.filter((id) => id !== requesterId).length > 0) {
      console.info('Tried to start logging but there was already a log being generated.')
      return
    }

    const vehicleStore = useMainVehicleStore()
    const missionStore = useMissionStore()
    const interfaceStore = useAppInterfaceStore()

    const logRoutine = async (): Promise<void> => {
      const timeNow = new Date()
      const timeNowObj = { lastChanged: timeNow.getTime() }

      const unitPrefs = interfaceStore.displayUnitPreferences

      const depthValue = (-vehicleStore.altitude.msl?.to(unitPrefs.distance).toJSON().value).toPrecision(4)
      const depthUnit = unitAbbreviation[unitPrefs.distance]

      /* eslint-disable vue/max-len, prettier/prettier, max-len */
      let variablesData: ExtendedVariablesData = {
        [DatalogVariable.roll]: { displayName: DatalogVariable.roll, value: `${degrees(vehicleStore.attitude.roll)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.pitch]: { displayName: DatalogVariable.pitch, value: `${degrees(vehicleStore.attitude.pitch)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.heading]: { displayName: DatalogVariable.heading, value: `${degrees(vehicleStore.attitude.yaw)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.depth]: { displayName: DatalogVariable.depth, value: `${depthValue} ${depthUnit}`, ...timeNowObj },
        [DatalogVariable.mode]: { displayName: DatalogVariable.mode, value: vehicleStore.mode || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryVoltage]: { displayName: DatalogVariable.batteryVoltage, value: `${vehicleStore.powerSupply.voltage?.toFixed(2)} V` || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryCurrent]: { displayName: DatalogVariable.batteryCurrent, value: `${vehicleStore.powerSupply.current?.toFixed(2)} A` || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsVisibleSatellites]: { displayName: DatalogVariable.gpsVisibleSatellites, value: vehicleStore.statusGPS.visibleSatellites?.toFixed(0) || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsFixType]: { displayName: DatalogVariable.gpsFixType, value: vehicleStore.statusGPS.fixType, ...timeNowObj },
        [DatalogVariable.latitude]: { displayName: DatalogVariable.latitude, value: `${vehicleStore.coordinates.latitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
        [DatalogVariable.longitude]: { displayName: DatalogVariable.longitude, value: `${vehicleStore.coordinates.longitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
        [DatalogVariable.missionName]: { displayName: '', value: missionStore.missionName || 'Cockpit', ...timeNowObj },
        [DatalogVariable.time]: { displayName: '', value: format(timeNow, 'HH:mm:ss O'), ...timeNowObj },
        [DatalogVariable.date]: { displayName: '', value: format(timeNow, 'LLL dd, yyyy'), ...timeNowObj },
        [DatalogVariable.instantaneousPower]: { displayName: DatalogVariable.instantaneousPower, value: `${vehicleStore.instantaneousWatts?.toFixed(1)} W` || 'Unknown', ...timeNowObj },
      }

      /* eslint-enable vue/max-len, prettier/prettier, max-len */
      const veryGenericData = this.collectVeryGenericData(timeNowObj)
      variablesData = { ...variablesData, ...veryGenericData }

      const dataLakeData = this.collectDataLakeData(variablesData, timeNowObj)
      variablesData = { ...variablesData, ...dataLakeData }

      const logPoint: CockpitStandardLogPoint = {
        epoch: timeNow.getTime(),
        data: structuredClone(variablesData),
      }

      await DataLogger.cockpitTemporaryLogsDB.setItem(`epoch=${logPoint.epoch}`, logPoint)
      this.datetimeLastLogPoint = new Date()

      if (this.shouldBeLogging()) {
        setTimeout(logRoutine, this.logInterval)
      }
    }

    logRoutine()
  }

  /**
   * Collects data from VeryGenericIndicator miniWidgets
   * @param {VeryGenericData} data
   * @param {number} data.lastChanged
   * @returns {ExtendedVariablesData}
   */
  collectVeryGenericData(data: { lastChanged: number }): ExtendedVariablesData {
    const result: ExtendedVariablesData = {}
    this.veryGenericIndicators.forEach((indicator) => {
      result[indicator.displayName] = {
        value: indicator.variableValue,
        displayName: indicator.displayName,
        lastChanged: data.lastChanged,
      }
    })
    return result
  }

  /**
   * Collects data from data lake variables in the telemetry display grid that are not already covered
   * by standard variables or VeryGenericIndicator data.
   * Also resolves {{ variableId }} templates in custom messages.
   * @param {ExtendedVariablesData} currentData - Already collected variables data (standard + VGI)
   * @param {{ lastChanged: number }} timeInfo - Timestamp info for the log point
   * @param {number} timeInfo.lastChanged - Linux epoch stating when this value was last changed
   * @returns {ExtendedVariablesData} Resolved data lake variable values
   */
  collectDataLakeData(currentData: ExtendedVariablesData, timeInfo: { lastChanged: number }): ExtendedVariablesData {
    const result: ExtendedVariablesData = {}

    for (const gridEntries of Object.values(this.telemetryDisplayData)) {
      for (const entry of gridEntries) {
        if (currentData[entry]) continue

        if (findDataLakeInputsInString(entry).length > 0) {
          result[entry] = {
            value: replaceDataLakeInputsInString(entry),
            displayName: '',
            ...timeInfo,
          }
          continue
        }

        const variableInfo = getDataLakeVariableInfo(entry)
        if (variableInfo) {
          const value = getDataLakeVariableData(entry)
          let displayName = variableInfo.name ?? entry

          // If the variable is a MAVLink variable, remove the (MAVLink / System: <systemId> / Component: <componentId>) suffix
          if (entry.includes('mavlink/') && displayName.includes('(')) {
            displayName = displayName.substring(0, displayName.lastIndexOf('(')).trim()
          }
          result[entry] = {
            value: value !== undefined ? String(value) : 'N/A',
            displayName,
            ...timeInfo,
          }
        }
      }
    }

    return result
  }

  /**
   * Removes the requester from the log requesters list. If there are no requesters left, logging will stop.
   * @param {string} requesterId The ID of the requester to stop
   */
  stopLogging(requesterId: string): void {
    this.logRequesters = this.logRequesters.filter((id) => id !== requesterId)
    console.info(`Stopped logging for requester: ${requesterId}.`)

    if (this.logRequesters.length !== 0) {
      console.info(`Logging still active for ${this.logRequesters.length} requesters.`)
      return
    }

    console.info('No more log requesters. Logging will stop.')
  }

  /**
   * Force stops logging.
   * This will stop logging for all requesters.
   */
  forceStopLogging(): void {
    this.logRequesters = []
  }

  /**
   * Checks if logging should be active based on the presence of log requesters.
   * @returns {boolean} True if there are any log requesters, indicating logging should be active.
   */
  shouldBeLogging(): boolean {
    return this.logRequesters.length > 0
  }

  /**
   * Wether the logger is currently logging or not, based on the date of the last log point and the log interval.
   * @returns {boolean}
   */
  logging(): boolean {
    return this.datetimeLastLogPoint !== null && this.datetimeLastLogPoint > new Date(Date.now() - this.logInterval * 2)
  }

  /**
   * Update state of a given variable
   * @param {DatalogVariable} variable - Name of the variable being updated
   * @returns {void}
   */
  registerUsage(variable: DatalogVariable): void {
    if (this.variablesBeingUsed.includes(variable)) return
    this.variablesBeingUsed.push(variable)
  }

  /**
   * Register or update a new VeryGenericIndicator
   * @param {VeryGenericVariableData} data - Data from the VeryGenericIndicator
   * @returns {void}
   */
  registerVeryGenericData(data: VeryGenericData): void {
    const existingIndicator = this.veryGenericIndicators.find((ind) => ind.displayName === data.displayName)

    if (existingIndicator) {
      existingIndicator.variableValue = data.variableValue
    } else {
      this.veryGenericIndicators.push(data)
    }
  }

  /**
   * Generate a log between the initial and final time
   * @param {Date} initialTime - The initial time. Only log points after this time will be considered.
   * @param {Date} finalTime - The final time. Only log points before this time will be considered.
   * @returns {Promise<CockpitStandardLog>} The generated log file.
   */
  async generateLog(initialTime: Date, finalTime: Date): Promise<CockpitStandardLog> {
    const logDateTimeFmt = `${logDateFormat} / HH꞉mm꞉ss O`
    const fileName = `Cockpit (${format(initialTime, logDateTimeFmt)} - ${format(finalTime, logDateTimeFmt)}).clog`

    const availableLogsKeys = await DataLogger.cockpitTemporaryLogsDB.keys()

    // The key is in the format epoch=<epoch>. We extract the epoch and compare it to the initial and final times
    // to see if the log point is in the range of the desired log.
    const keysLogPointsInRange = availableLogsKeys.filter((key) => {
      const epochString = Number(key.split('=')[1])
      const logPointDate = new Date(epochString)
      // Consider logs that start a little before the initial time and end a little after the final time, so we don't
      // miss data at the start or end of the recording.
      const aLittleBitBeforeInitialTime = new Date(initialTime.getTime() - 10000)
      const aLittleBitAfterFinalTime = new Date(finalTime.getTime() + 10000)
      return logPointDate >= aLittleBitBeforeInitialTime && logPointDate <= aLittleBitAfterFinalTime
    })

    // Generate an object with the initial and final epoch of each log point
    // The initial epoch is the name of the key, and the final epoch can be determined from the next point.
    const infoLogPointsInRange = keysLogPointsInRange.map((key, index, array) => {
      const epochString = Number(key.split('=')[1])
      const initialDate = new Date(epochString)

      let finalDate: Date | null = null
      if (index !== array.length - 1) {
        const nextEpochString = Number(array[index + 1].split('=')[1])
        finalDate = new Date(nextEpochString)
      }

      return { key, initialDate, finalDate }
    })

    if (keysLogPointsInRange.length === 0) {
      throw new Error('No log points found in the given range.')
    }

    const logPointsInRange: CockpitStandardLogPoint[] = []
    for (const info of infoLogPointsInRange) {
      const log = (await DataLogger.cockpitTemporaryLogsDB.getItem(info.key)) as CockpitStandardLogPoint

      // Only consider real log points(objects with an epoch and data property, and non-empty data)
      if (log.epoch === undefined || log.data === undefined || Object.keys(log.data).length === 0) continue

      // Exclude those log points that end before the initial time or start after the final time
      if ((info.finalDate && info.finalDate < initialTime) || info.initialDate > finalTime) continue

      logPointsInRange.push(log)
    }

    // Sort the log points by epoch, generate a final log file and put in in the local database
    const sortedLogPoints = logPointsInRange.sort((a, b) => a.epoch - b.epoch)
    const finalLog = sortedLogPoints.map((logPoint) => {
      // Calculate the seconds since the initial recording time. If the value is negative, it means the log point starts
      // before the recording started, so we set it to start at 0 seconds in the recording.
      const seconds = Math.max(0, differenceInSeconds(new Date(logPoint.epoch), initialTime))
      return { ...logPoint, ...{ seconds } }
    })

    await this.cockpitLogsDB.setItem(fileName, finalLog)

    return finalLog
  }

  /**
   * Convert Cockpit standard log to JSON format
   * @param {CockpitStandardLog} log - The telemetry log data
   * @returns {string} JSON string representation of the telemetry data
   */
  toJson(log: CockpitStandardLog): string {
    return JSON.stringify(log, null, 2)
  }

  /**
   * Convert Cockpit standard log to CSV format
   * @param {CockpitStandardLog} log - The telemetry log data
   * @returns {string} CSV string representation of the telemetry data
   */
  toCsv(log: CockpitStandardLog): string {
    if (log.length === 0) return ''

    // Helper to escape CSV values (handle quotes and special characters)
    const escapeCSV = (value: string | undefined | null): string => {
      if (value === undefined || value === null) return ''
      const str = String(value).trim()
      // Escape quotes by doubling them and wrap in quotes if contains special chars
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Get all unique variable names from all log points
    const allVariables = new Set<string>()
    log.forEach((logPoint) => {
      if (logPoint.data) {
        Object.keys(logPoint.data).forEach((key) => allVariables.add(key))
      }
    })

    // Create header row with epoch and all variable names
    const sortedVariables = Array.from(allVariables).sort()
    const headers = ['epoch', 'timestamp', ...sortedVariables]

    // Create CSV rows
    const rows = log.map((logPoint) => {
      const timestamp = new Date(logPoint.epoch).toISOString()
      const values = sortedVariables.map((variable) => {
        const data = logPoint.data?.[variable]
        if (data && data.value !== undefined) {
          return escapeCSV(data.value)
        }
        return ''
      })
      return [logPoint.epoch, timestamp, ...values].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }

  /**
   * Convert Cockpit standard log files to Advanced SubStation Alpha subtitle overlays
   * @param {CockpitStandardLog} log
   * @param {number} videoWidth
   * @param {number} videoHeight
   * @param {number} videoStartEpoch
   * @returns {string} ASS file string for video overlaying
   */
  toAssOverlay(log: CockpitStandardLog, videoWidth: number, videoHeight: number, videoStartEpoch: number): string {
    /* eslint-disable vue/max-len, prettier/prettier, max-len */
      let assFile = `[Script Info]
Title: Cockpit Subtitle Telemetry file
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: LeftBottom,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},1,10,10,10,1
Style: CenterBotom,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},2,10,10,10,1
Style: RightBottom,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},3,10,10,10,1
Style: LeftMid,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},4,10,10,10,1
Style: CenterMid,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},5,10,10,10,1
Style: RightMid,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},6,10,10,10,1
Style: LeftTop,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},7,10,10,10,1
Style: CenterTop,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},8,10,10,10,1
Style: RightTop,Arial,${this.telemetryDisplayOptions.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.fontShadowSize.toString()},9,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

    /**
     * Converts a hex color in the format #AARRGGBB to the .ass subtitle format &HAABBGGRR.
     * @param {string} hexColor The hex color string in #AARRGGBB format.
     * @returns {string} The color string in &HAABBGGRR format for .ass files.
     */
   function convertRGBToBGRColor(hexColor: string): string {
    const red = hexColor.substring(1, 3)
    const green = hexColor.substring(3, 5)
    const blue = hexColor.substring(5, 7)
    const alpha = hexColor.substring(7, 9) || 'FF'
    const invertedAlpha = (255 - parseInt(alpha, 16)).toString(16).padStart(2, '0').toUpperCase()

    return `&H${invertedAlpha}${blue}${green}${red}`
  }

    log.forEach((logPoint, index) => {
      // Don't deal with the last log point, as it has no next point to compare to
      if (index === log.length - 1) return

     // Structured data object based on the user's telemetry display configuration
     const data = Object.keys(this.telemetryDisplayData).reduce<Record<string, string>>((acc, gridPosition) => {
      acc[gridPosition] = this.telemetryDisplayData[gridPosition]
        .map((variable) => {
          const variableData = logPoint.data[variable]
          if (variableData) {
            return variableData.displayName ? `${variableData.displayName}: ${variableData.value}` : variableData.value
          } else {
            return `${variable}`
          }
        })
        .join('\\N')
      return acc
     }, {})

      const durationThisPoint = intervalToDuration({
        start: new Date(videoStartEpoch),
        end: new Date(logPoint.epoch),
      })
      const durationHoursThisPoint = (durationThisPoint.hours?.toFixed(0) ?? '0').padStart(2, '0')
      const durationMinutesThisPoint = (durationThisPoint.minutes?.toFixed(0) ?? '0').padStart(2, '0')
      const durationSecondsThisPoint = (durationThisPoint.seconds?.toFixed(0) ?? '0').padStart(2, '0')

      const durationNextPoint = intervalToDuration({
        start: new Date(videoStartEpoch),
        end: new Date(log[index + 1].epoch ?? 0),
      })
      const durationHoursNextPoint = (durationNextPoint.hours?.toFixed(0) ?? '0').padStart(2, '0')
      const durationMinutesNextPoint = (durationNextPoint.minutes?.toFixed(0) ?? '0').padStart(2, '0')
      const durationSecondsNextPoint = (durationNextPoint.seconds?.toFixed(0) ?? '0').padStart(2, '0')

      const roundedMillisThisPoint = differenceInSeconds(new Date(logPoint.epoch), new Date(videoStartEpoch)) * 1000
      const millisThisPoint = differenceInMilliseconds(new Date(logPoint.epoch), new Date(videoStartEpoch))
      const remainingMillisThisPoint = millisThisPoint - roundedMillisThisPoint
      const remainingCentisThisPoint = Math.max(0, Math.floor(remainingMillisThisPoint / 10)).toString().padStart(2, '0')

      const roundedMillisNextPoint = differenceInSeconds(new Date(log[index + 1].epoch), new Date(videoStartEpoch)) * 1000
      const millisNextPoint = differenceInMilliseconds(new Date(log[index + 1].epoch), new Date(videoStartEpoch))
      const remainingMillisNextPoint = millisNextPoint - roundedMillisNextPoint
      const remainingCentisNextPoint = Math.floor(remainingMillisNextPoint / 10).toString().padStart(2, '0')

      const timeThis = `${durationHoursThisPoint}:${durationMinutesThisPoint}:${durationSecondsThisPoint}.${remainingCentisThisPoint}`
      const timeNext = `${durationHoursNextPoint}:${durationMinutesNextPoint}:${durationSecondsNextPoint}.${remainingCentisNextPoint}`

      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},LeftBottom,,0,0,0,,${data.LeftBottom}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},CenterBotom,,0,0,0,,${data.CenterBottom}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},RightBottom,,0,0,0,,${data.RightBottom}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},LeftMid,,0,0,0,,${data.LeftMid}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},CenterMid,,0,0,0,,${data.CenterMid}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},RightMid,,0,0,0,,${data.RightMid}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},LeftTop,,0,0,0,,${data.LeftTop}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},CenterTop,,0,0,0,,${data.CenterTop}`)
      assFile = assFile.concat(`\nDialogue: 0,${timeThis},${timeNext},RightTop,,0,0,0,,${data.RightTop}`)
    })
    /* eslint-enable vue/max-len, prettier/prettier, max-len */
    assFile = assFile.concat('\n')

    return assFile
  }

  // Gap threshold to consider a new session (5 minutes of no data)
  static SESSION_GAP_THRESHOLD_MS = 5 * 60 * 1000

  /**
   * Get all data sessions detected from raw log entries
   * Sessions are determined by gaps in the data (>5 minutes between points = new session)
   * @returns {Promise<DataSessionInfo[]>} Array of session information
   */
  static async getDataSessions(): Promise<DataSessionInfo[]> {
    const allKeys = await DataLogger.cockpitTemporaryLogsDB.keys()

    if (allKeys.length === 0) return []

    // Extract epochs from keys and sort them
    const epochs = allKeys
      .map((key) => {
        const match = key.match(/^epoch=(\d+)$/)
        return match ? parseInt(match[1], 10) : null
      })
      .filter((epoch): epoch is number => epoch !== null)
      .sort((a, b) => a - b)

    if (epochs.length === 0) return []

    // Group epochs into sessions based on gaps
    const sessions: DataSessionInfo[] = []
    let sessionStart = epochs[0]
    let sessionEnd = epochs[0]
    let pointCount = 1

    for (let i = 1; i < epochs.length; i++) {
      const gap = epochs[i] - epochs[i - 1]

      if (gap > DataLogger.SESSION_GAP_THRESHOLD_MS) {
        // End current session and start a new one
        sessions.push({
          id: `session-${sessionStart}`,
          startTime: sessionStart,
          endTime: sessionEnd,
          dateTimeFormatted: format(new Date(sessionStart), 'LLL dd, yyyy - HH:mm:ss'),
          dataPointCount: pointCount,
          durationSeconds: Math.round((sessionEnd - sessionStart) / 1000),
          isCurrentSession: false,
        })
        sessionStart = epochs[i]
        sessionEnd = epochs[i]
        pointCount = 1
      } else {
        sessionEnd = epochs[i]
        pointCount++
      }
    }

    // Add the last session
    const lastSession: DataSessionInfo = {
      id: `session-${sessionStart}`,
      startTime: sessionStart,
      endTime: sessionEnd,
      dateTimeFormatted: format(new Date(sessionStart), 'LLL dd, yyyy - HH:mm:ss'),
      dataPointCount: pointCount,
      durationSeconds: Math.round((sessionEnd - sessionStart) / 1000),
      isCurrentSession: false,
    }

    // Check if this is the current session (last log point within the last minute)
    const now = Date.now()
    if (now - sessionEnd < 60000) {
      lastSession.isCurrentSession = true
    }

    sessions.push(lastSession)

    // Sort by date, newest first
    return sessions.sort((a, b) => b.startTime - a.startTime)
  }

  /**
   * Generate a data log from a session's raw data
   * @param {DataSessionInfo} session - The session to generate log from
   * @returns {Promise<CockpitStandardLog>} The generated log
   */
  static async generateLogFromSession(session: DataSessionInfo): Promise<CockpitStandardLog> {
    const log: CockpitStandardLog = []

    // Get all keys and filter by session time range
    const allKeys = await DataLogger.cockpitTemporaryLogsDB.keys()

    for (const key of allKeys) {
      const match = key.match(/^epoch=(\d+)$/)
      if (!match) continue

      const epoch = parseInt(match[1], 10)
      if (epoch >= session.startTime && epoch <= session.endTime) {
        const logPoint = (await DataLogger.cockpitTemporaryLogsDB.getItem(key)) as CockpitStandardLogPoint | null
        if (logPoint && logPoint.epoch !== undefined && logPoint.data !== undefined) {
          log.push(logPoint)
        }
      }
    }

    // Sort by epoch
    return log.sort((a, b) => a.epoch - b.epoch)
  }

  /**
   * Delete a data session's raw data
   * @param {DataSessionInfo} session - The session to delete
   */
  static async deleteDataSession(session: DataSessionInfo): Promise<void> {
    const allKeys = await DataLogger.cockpitTemporaryLogsDB.keys()

    for (const key of allKeys) {
      const match = key.match(/^epoch=(\d+)$/)
      if (!match) continue

      const epoch = parseInt(match[1], 10)
      if (epoch >= session.startTime && epoch <= session.endTime) {
        await DataLogger.cockpitTemporaryLogsDB.removeItem(key)
      }
    }
  }

  /**
   * Delete all data sessions older than a specified number of days
   * @param {number} daysOld - Number of days (sessions older than this will be deleted)
   * @returns {Promise<number>} Number of deleted sessions
   */
  static async deleteOldDataSessions(daysOld = 1): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    const cutoffMs = cutoffDate.getTime()

    const sessions = await DataLogger.getDataSessions()
    let deletedCount = 0

    for (const session of sessions) {
      if (session.endTime < cutoffMs && !session.isCurrentSession) {
        await DataLogger.deleteDataSession(session)
        deletedCount++
      }
    }

    return deletedCount
  }
}

export const datalogger = new DataLogger()
console.log('[DataLogger]', 'Data logger initialized.')
