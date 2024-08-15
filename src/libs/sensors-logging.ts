import { differenceInMilliseconds, differenceInSeconds, format, intervalToDuration } from 'date-fns'
import localforage from 'localforage'

import { defaultSensorDataloggerProfile } from '@/assets/defaults'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import { unitAbbreviation } from './units'
import { degrees } from './utils'

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
}

const logDateFormat = 'LLL dd, yyyy'
const { showDialog } = useInteractionDialog()

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
  /**
   * Current view of the variable
   */
  hideLabel?: boolean
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
    hideLabel?: boolean
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
   * Seconds passed since the beggining of the logging
   */
  seconds: number
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
class DataLogger {
  shouldBeLogging = false
  currentCockpitLog: CockpitStandardLog = []
  variablesBeingUsed: DatalogVariable[] = []
  veryGenericIndicators: VeryGenericData[] = []
  telemetryDisplayData = useBlueOsStorage<OverlayGrid>(
    'cockpit-datalogger-overlay-grid',
    defaultSensorDataloggerProfile
  )
  telemetryDisplayOptions = useBlueOsStorage<OverlayOptions>('cockpit-datalogger-overlay-options', {
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
  })
  logInterval = useBlueOsStorage<number>('cockpit-datalogger-log-interval', 1000)
  cockpitLogsDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Sensor Logs',
    storeName: 'cockpit-sensor-logs-db',
    version: 1.0,
    description: 'Local backups of Cockpit sensor logs, to be retrieved in case of failure.',
  })

  /**
   * Start an intervaled logging
   */
  startLogging(): void {
    if (this.logging()) {
      console.warn('Tried to start logging but there was already a log being generated.')
      return
    }

    this.shouldBeLogging = true

    const vehicleStore = useMainVehicleStore()
    const missionStore = useMissionStore()
    const interfaceStore = useAppInterfaceStore()

    const initialTime = new Date()
    const fileName = `Cockpit (${format(initialTime, `${logDateFormat} - HH꞉mm꞉ss O`)}).clog`
    this.currentCockpitLog = []

    const logRoutine = async (): Promise<void> => {
      const timeNow = new Date()
      const secondsNow = differenceInSeconds(timeNow, initialTime)

      const timeNowObj = { lastChanged: timeNow.getTime() }

      const unitPrefs = interfaceStore.displayUnitPreferences

      const depthValue = (-vehicleStore.altitude.msl?.to(unitPrefs.distance).toJSON().value).toPrecision(4)
      const depthUnit = unitAbbreviation[unitPrefs.distance]

      /* eslint-disable vue/max-len, prettier/prettier, max-len */
      let variablesData: ExtendedVariablesData = {
        [DatalogVariable.roll]: { value: `${degrees(vehicleStore.attitude.roll)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.pitch]: { value: `${degrees(vehicleStore.attitude.pitch)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.heading]: { value: `${degrees(vehicleStore.attitude.yaw)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.depth]: { value: `${depthValue} ${depthUnit}`, ...timeNowObj },
        [DatalogVariable.mode]: { value: vehicleStore.mode || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryVoltage]: { value: `${vehicleStore.powerSupply.voltage?.toFixed(2)} V` || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryCurrent]: { value: `${vehicleStore.powerSupply.current?.toFixed(2)} A` || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsVisibleSatellites]: { value: vehicleStore.statusGPS.visibleSatellites?.toFixed(0) || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsFixType]: { value: vehicleStore.statusGPS.fixType, ...timeNowObj },
        [DatalogVariable.latitude]: { value: `${vehicleStore.coordinates.latitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
        [DatalogVariable.longitude]: { value: `${vehicleStore.coordinates.longitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
        [DatalogVariable.missionName]: { value: missionStore.missionName || 'Cockpit', hideLabel: true, ...timeNowObj },
        [DatalogVariable.time]: { value: format(timeNow, 'HH:mm:ss O'), hideLabel: true, ...timeNowObj },
        [DatalogVariable.date]: { value: format(timeNow, 'LLL dd, yyyy'), hideLabel: true, ...timeNowObj },
      }

      /* eslint-enable vue/max-len, prettier/prettier, max-len */
      const veryGenericData = this.collectVeryGenericData(timeNowObj)
      variablesData = { ...variablesData, ...veryGenericData }

      const logPoint: CockpitStandardLogPoint = {
        epoch: timeNow.getTime(),
        seconds: secondsNow,
        data: structuredClone(variablesData),
      }

      /* eslint-enable vue/max-len, prettier/prettier, max-len */
      this.currentCockpitLog.push(logPoint)

      await this.cockpitLogsDB.setItem(fileName, this.currentCockpitLog)

      if (this.shouldBeLogging) {
        setTimeout(logRoutine, this.logInterval.value)
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
        lastChanged: data.lastChanged,
      }
    })
    return result
  }

  /**
   * Stop the current logging operation
   */
  stopLogging(): void {
    if (!this.logging()) {
      console.warn('Tried to stop logging but no log was being generated.')
      return
    }

    this.shouldBeLogging = false
  }

  /**
   * Wether the logger is currently logging or not
   * @returns {boolean}
   */
  logging(): boolean {
    return this.shouldBeLogging
  }

  /**
   * Set the interval between log points
   * @param {number} interval The interval in milliseconds. Default is 1000 and minimum is 1
   */
  setInterval(interval: number): void {
    if (interval < 1) {
      showDialog({ message: 'Minimum log interval is 1 millisecond (1000 Hz).', variant: 'error' })
      return
    }

    this.logInterval.value = interval
  }

  /**
   * Set the frequency of log points
   * @param {number} frequency The frequency in hertz. Default is 1 Hz, minimum is 0.1 Hz and maximum is 1000 Hz
   */
  setFrequency(frequency: number): void {
    if (frequency > 1000 || frequency < 0.1) {
      showDialog({ message: 'Log frequency should stay between 0.1 Hz and 1000 Hz.', variant: 'error' })
      return
    }

    this.setInterval(1000 / frequency)
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
   * Returns a log that encompasses the given time
   * @param { Date } datetime - A timestamp that is between the initial and final time of the log
   * @returns { CockpitStandardLog | null }
   */
  async findLogByInitialTime(datetime: Date): Promise<CockpitStandardLog | null> {
    const availableLogsKeys = await this.cockpitLogsDB.keys()
    const logKeysFromLastDay = availableLogsKeys.filter((key) => {
      const yesterday = new Date().setDate(new Date().getDate() - 1)
      return key.includes(format(datetime, logDateFormat)) || key.includes(format(yesterday, logDateFormat))
    })

    for (const key of [...logKeysFromLastDay, ...availableLogsKeys]) {
      const log = await this.cockpitLogsDB.getItem(key)

      // Only consider logs that are actually logs (arrays with at least two elements with an epoch property)
      if (!Array.isArray(log) || log.length < 2) continue
      if (log[0].epoch === undefined || log[log.length - 1].epoch === undefined) continue

      const logInitialTime = new Date(log[0].epoch)
      const logFinalTime = new Date(log[log.length - 1].epoch)

      if (datetime >= logInitialTime && datetime <= logFinalTime) {
        return log
      }
    }

    return null
  }

  /**
   * Get desired part of a log based on timestamp
   * @param {CockpitStandardLog} completeLog The log from which the slice should be taken from
   * @param {Date} initialTime The timestamp from which the log should be started from
   * @param {Date} finalTime The timestamp in which the log should be terminated
   * @returns {CockpitStandardLog} The actual log
   */
  getSlice(completeLog: CockpitStandardLog, initialTime: Date, finalTime: Date): CockpitStandardLog {
    return completeLog
      .filter((logPoint) => logPoint.epoch > initialTime.getTime() && logPoint.epoch < finalTime.getTime())
      .map((logPoint) => ({ ...logPoint, ...{ seconds: differenceInSeconds(new Date(logPoint.epoch), initialTime) } }))
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
Style: LeftBottom,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},1,10,10,10,1
Style: CenterBotom,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},2,10,10,10,1
Style: RightBottom,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},3,10,10,10,1
Style: LeftMid,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},4,10,10,10,1
Style: CenterMid,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},5,10,10,10,1
Style: RightMid,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},6,10,10,10,1
Style: LeftTop,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},7,10,10,10,1
Style: CenterTop,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},8,10,10,10,1
Style: RightTop,Arial,${this.telemetryDisplayOptions.value.fontSize.toString()},${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontColor)},&H000000FF,${convertRGBToBGRColor(this.telemetryDisplayOptions.value.fontOutlineColor)},&H00000000,${this.telemetryDisplayOptions.value.fontBold ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontItalic ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontUnderline ? '-1' : '0'},${this.telemetryDisplayOptions.value.fontStrikeout ? '-1' : '0'},100,100,0,0,1,2,${this.telemetryDisplayOptions.value.fontShadowSize.toString()},9,10,10,10,1

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
     const data = Object.keys(this.telemetryDisplayData.value).reduce<Record<string, string>>((acc, gridPosition) => {
      acc[gridPosition] = this.telemetryDisplayData.value[gridPosition]
        .map((variable) => {
          const variableData = logPoint.data[variable]
          if (variableData) {
            return `${variableData.hideLabel ? '' : `${variable}:`} ${variableData.value}`
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
      const remainingCentisThisPoint = Math.floor(remainingMillisThisPoint / 10).toString().padStart(2, '0')

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
}

export const datalogger = new DataLogger()
