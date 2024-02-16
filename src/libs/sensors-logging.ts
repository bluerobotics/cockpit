import { useStorage } from '@vueuse/core'
import { differenceInSeconds, format } from 'date-fns'
import localforage from 'localforage'
import Swal from 'sweetalert2'

import { useMainVehicleStore } from '@/stores/mainVehicle'

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
  data: VariablesData
}

/**
 * Format for a standalone cockpit log
 */
export type CockpitStandardLog = CockpitStandardLogPoint[]

/**
 * Manager logging vehicle data and others
 */
class DataLogger {
  currentLoggerInterval: ReturnType<typeof setInterval> | undefined = undefined
  currentCockpitLog: CockpitStandardLog = []
  variablesBeingUsed: DatalogVariable[] = []
  selectedVariablesToShow = useStorage<DatalogVariable[]>('cockpit-datalogger-overlay-variables', [])

  /**
   * Start an intervaled logging
   * @param {number} interval - The time to wait between two logs
   */
  startLogging(interval = 1000): void {
    if (this.logging()) {
      Swal.fire({ title: 'Error', text: 'A log is already being generated.', icon: 'error', timer: 3000 })
      return
    }

    const vehicleStore = useMainVehicleStore()
    const cockpitLogsDB = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: 'Cockpit - Sensor Logs',
      storeName: 'cockpit-sensor-logs-db',
      version: 1.0,
      description: 'Local backups of Cockpit sensor logs, to be retrieved in case of failure.',
    })

    const initialTime = new Date()
    const fileName = `Cockpit (${format(initialTime, 'LLL dd, yyyy - HH꞉mm꞉ss O')}).clog`
    this.currentCockpitLog = []

    this.currentLoggerInterval = setInterval(async () => {
      const timeNow = new Date()
      const secondsNow = differenceInSeconds(timeNow, initialTime)

      const timeNowObj = { lastChanged: timeNow.getTime() }

      /* eslint-disable vue/max-len, prettier/prettier, max-len */
      const variablesData = {
        [DatalogVariable.roll]: { value: `${degrees(vehicleStore.attitude.roll)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.pitch]: { value: `${degrees(vehicleStore.attitude.pitch)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.heading]: { value: `${degrees(vehicleStore.attitude.yaw)?.toFixed(1)} °`, ...timeNowObj },
        [DatalogVariable.depth]: { value: `${vehicleStore.altitude.msl?.toPrecision(4)} m`, ...timeNowObj },
        [DatalogVariable.mode]: { value: vehicleStore.mode || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryVoltage]: { value: `${vehicleStore.powerSupply.voltage?.toFixed(2)} V` || 'Unknown', ...timeNowObj },
        [DatalogVariable.batteryCurrent]: { value: `${vehicleStore.powerSupply.current?.toFixed(2)} A` || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsVisibleSatellites]: { value: vehicleStore.statusGPS.visibleSatellites?.toFixed(0) || 'Unknown', ...timeNowObj },
        [DatalogVariable.gpsFixType]: { value: vehicleStore.statusGPS.fixType, ...timeNowObj },
        [DatalogVariable.latitude]: { value: `${vehicleStore.coordinates.latitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
        [DatalogVariable.longitude]: { value: `${vehicleStore.coordinates.longitude?.toFixed(6)} °` || 'Unknown', ...timeNowObj },
      }
      /* eslint-enable vue/max-len, prettier/prettier, max-len */

      this.currentCockpitLog.push({
        epoch: timeNow.getTime(),
        seconds: secondsNow,
        data: structuredClone(variablesData),
      })

      await cockpitLogsDB.setItem(fileName, this.currentCockpitLog)
    }, interval)
  }

  /**
   * Stop the current logging operation
   */
  stopLogging(): void {
    if (!this.logging()) {
      Swal.fire({ title: 'Error', text: 'No log is being generated.', icon: 'error', timer: 3000 })
      return
    }

    clearInterval(this.currentLoggerInterval)
  }

  /**
   * Wether the logger is currently logging or not
   * @returns {boolean}
   */
  logging(): boolean {
    return this.currentLoggerInterval !== undefined
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
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,1,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

    // Try to show, in order, variables the user has decided to show, or variables being used in the application, or all variables.
    const hasUserSelected = !this.selectedVariablesToShow.value.isEmpty()
    const areThereVariablesBeingUsed = !this.variablesBeingUsed.isEmpty()
    const allAvailableVariables = Object.values(DatalogVariable)
    const variablesToShow = hasUserSelected ? this.selectedVariablesToShow.value : areThereVariablesBeingUsed ? this.variablesBeingUsed : allAvailableVariables

    const formatDuration = (date: Date): string => {
      return date.toLocaleTimeString([], {
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
      })
    }

    const formatCentiseconds = (date: Date): string => {
      const millis = date.getMilliseconds()
      return String(Math.floor(millis / 10)).padStart(2, '0')
    }

    log.forEach((logPoint, index) => {
      // Don't deal with the last log point, as it has no next point to compare to
      if (index === log.length - 1) return

      const data = Object.entries(logPoint.data)
        .filter((vData) => variablesToShow.includes(vData[0] as DatalogVariable))
        .map((v) => ({ name: v[0], value: v[1].value }))

      const durationThisPoint = formatDuration(new Date(logPoint.epoch - videoStartEpoch))
      const durationNextPoint = formatDuration(new Date(log[index + 1].epoch - videoStartEpoch))
      const remainingCentisThisPoint = formatCentiseconds(new Date(logPoint.epoch))
      const remainingCentisNextPoint = formatCentiseconds(new Date(log[index + 1].epoch))
      const timeThis = `${durationThisPoint}.${remainingCentisThisPoint}`
      const timeNext = `${durationNextPoint}.${remainingCentisNextPoint}`

      let subtitleDataString1 = ''
      let subtitleDataString2 = ''
      let subtitleDataString3 = ''
      let binToUse = 1
      data.forEach((d) => {
        if (binToUse === 1) {
          subtitleDataString1 = subtitleDataString1.concat(`${d.name}: ${d.value} \\N`)
        } else if (binToUse === 2) {
          subtitleDataString2 = subtitleDataString2.concat(`${d.name}: ${d.value} \\N`)
        } else if (binToUse === 3) {
          subtitleDataString3 = subtitleDataString3.concat(`${d.name}: ${d.value} \\N`)
        }
        binToUse +=1
        if (binToUse > 3) {
          binToUse = 1
        }
      })

      console.log(new Date(videoStartEpoch), new Date(logPoint.epoch), new Date(logPoint.epoch - videoStartEpoch), timeThis, timeNext)

      const generateSubtitleLine = (offset: number, content: string): string => {
        return `\nDialogue: 0,${timeThis},${timeNext},Default,,${videoWidth * offset},0,${videoHeight * 0.05},,${content}`
      }

      assFile = assFile.concat(generateSubtitleLine(0.1, subtitleDataString1))
      assFile = assFile.concat(generateSubtitleLine(0.4, subtitleDataString2))
      assFile = assFile.concat(generateSubtitleLine(0.7, subtitleDataString3))
    })
    /* eslint-enable vue/max-len, prettier/prettier, max-len */
    assFile = assFile.concat('\n')

    return assFile
  }
}

export const datalogger = new DataLogger()
