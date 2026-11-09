import { type ComputedRef, computed, onBeforeUnmount } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { bearingBetween } from '@/libs/mission/general-estimates'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { type TerrainVehicleClass, surfaceHeight, terrainVehicleClass } from '@/libs/terrain/mission-profile'
import {
  contourBearing,
  coverageSurveyLines,
  respacedSurvey,
  sensorHeightAboveBottom,
} from '@/libs/terrain/survey-analysis'
import { type ResolvedSurveySensor, resolveEchoSounder, resolveImagingSensor } from '@/libs/terrain/survey-sensors'
import type { GroundSampler } from '@/libs/terrain/terrain-following'
import { toPlain } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { Survey, Waypoint } from '@/types/mission'

import type { ReplaceMission, TerrainMissionEdit } from './useTerrainDock'

/**
 * How a survey's sensor reads what is under it.
 */
export interface SurveyBottomReading {
  /**
   * Reads the bottom, or for an aircraft the ground or water surface it looks at.
   */
  sampleBottom: GroundSampler
  /**
   * Sensor height over a bottom at a given height above sea level.
   */
  heightAboveBottom: (bottomM: number) => number
}

/**
 * How a survey's sensor reads what is under it, from the survey waypoints and the terrain settings.
 * @param {Waypoint} template A survey waypoint.
 * @param {TerrainVehicleClass} vehicleClass Vehicle the mission is planned for.
 * @returns {Promise<SurveyBottomReading>} The sampler and the sensor height over the bottom.
 */
export const surveyBottomReading = async (
  template: Waypoint,
  vehicleClass: TerrainVehicleClass
): Promise<SurveyBottomReading> => {
  const terrainStore = useTerrainStore()
  const missionStore = useMissionStore()
  const waterLevelM = terrainStore.waterLevelNowM()
  const air = vehicleClass === 'air'
  const sampleBottom: GroundSampler = async (coordinates) => {
    const heights = await sampleTerrain(coordinates, { mode: 'highest' })
    return air ? heights.map((height) => (height === null ? null : surfaceHeight(height, waterLevelM))) : heights
  }
  const home = missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
  const homeM = air && home ? (await sampleBottom([home]))[0] : null
  const { vesselDraftM } = terrainStore.settings
  return {
    sampleBottom,
    heightAboveBottom: sensorHeightAboveBottom(template, vehicleClass, waterLevelM, vesselDraftM, homeM),
  }
}

// The narrowest spacing a vessel can hold lines apart at.
const MIN_SONAR_SPACING_M = 2
// Lets a run of survey edits settle before the bottom under it is sampled again.
const COMPENSATION_DELAY_MS = 600

/**
 * A mission with one survey re-spaced for a sensor.
 */
export interface SurveyRespacing {
  /**
   * The mission with the re-spaced survey.
   */
  mission: TerrainMissionEdit
  /**
   * Number of survey lines after the re-spacing.
   */
  lines: number
  /**
   * Whether the lines were turned to follow the slope's contours.
   */
  turned: boolean
}

/**
 * Re-spacing surveys for the configured survey sensors.
 */
export interface UseSurveyCompensationReturn {
  /**
   * Echo sounder and camera a boat or submarine survey can be spaced for, the camera alone for an aircraft, empty
   * for other vehicles.
   */
  sensors: ComputedRef<ResolvedSurveySensor[]>
  /**
   * Sensor sensor compensation spaces surveys for, null when none is picked, undefined for ground vehicles.
   */
  compensationLabel: ComputedRef<string | null | undefined>
  /**
   * Re-spaces a survey so the sensor's strips leave no gap on the bottom, first turning its lines along the slope's
   * contours when asked to, and turns its sensor compensation on; throws when it cannot.
   */
  respacedMission: (survey: Survey, sensor: ResolvedSurveySensor, followContours?: boolean) => Promise<SurveyRespacing>
  /**
   * Compensates a survey with sensor compensation on, once the edits to it settle; asked to follow the contours, the
   * pass also turns its lines along the slope.
   */
  scheduleCompensation: (surveyId: string, followContours?: boolean) => void
}

const sameWaypoints = (a: Survey, b: Survey): boolean =>
  a.waypoints.length === b.waypoints.length &&
  a.waypoints.every((waypoint, index) => waypoint.id === b.waypoints[index].id)

/**
 * Re-spaces surveys for the echo sounder or camera set in the survey sensor settings.
 * @param {ReplaceMission} replaceMission Replaces the mission through the planning view.
 * @returns {UseSurveyCompensationReturn} The sensors and the re-spacing.
 */
export const useSurveyCompensation = (replaceMission: ReplaceMission): UseSurveyCompensationReturn => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  // Surveys whose pending pass was asked to follow the contours, kept apart so a later edit does not drop the turn.
  const contourTurns = new Set<string>()
  let disposed = false

  const vehicleClass = computed(() => terrainVehicleClass(missionStore.effectiveVehicleType))
  const surveysBottom = computed(() => vehicleClass.value === 'surface' || vehicleClass.value === 'underwater')
  const sensors = computed(() => {
    if (vehicleClass.value === 'air') {
      const camera = resolveImagingSensor(terrainStore.settings.camera, vehicleClass.value)
      return camera ? [camera] : []
    }
    if (!surveysBottom.value) return []
    return [
      resolveEchoSounder(terrainStore.settings.surveySensor, vehicleClass.value),
      resolveImagingSensor(terrainStore.settings.camera, vehicleClass.value),
    ].filter((sensor): sensor is ResolvedSurveySensor => sensor !== null)
  })
  const compensationSensor = computed(() => sensors.value.find(({ geometry }) => geometry))
  const compensationLabel = computed(() =>
    vehicleClass.value === 'ground' ? undefined : compensationSensor.value?.label ?? null
  )
  const respacedMission = async (
    survey: Survey,
    sensor: ResolvedSurveySensor,
    followContours = false
  ): Promise<SurveyRespacing> => {
    const [first, second] = survey.waypoints
    const { geometry, rangeM, overlapPercent, label } = sensor
    if (survey.crosshatch) throw new Error('crosshatch surveys cannot be re-spaced for a sensor')
    if (!first || !second || !geometry) throw new Error('the survey has no lines to re-space')
    const { sampleBottom, heightAboveBottom } = await surveyBottomReading(first, vehicleClass.value)
    const bearing = bearingBetween(first.coordinates, second.coordinates)
    const lineBearing = followContours
      ? await contourBearing(survey.polygonCoordinates, bearing, sampleBottom, heightAboveBottom)
      : bearing
    const { ends, complete } = await coverageSurveyLines(survey.polygonCoordinates, lineBearing, sampleBottom, {
      sensor: geometry,
      rangeM,
      overlapPercent,
      heightAboveBottom,
      minSpacingM: MIN_SONAR_SPACING_M,
    })
    if (!complete) {
      const advice = 'split the area into smaller surveys or pick a sensor with a wider view'
      throw new Error(`covering it with the ${label} from this height takes too many lines; ${advice}`)
    }
    if (ends.length < 2) throw new Error('no line fits inside the survey area')
    // The bottom was being sampled, so the survey may have been edited or removed in the meantime.
    const current = missionStore.currentPlanningSurveys.find(({ id }) => id === survey.id)
    if (!current || !sameWaypoints(current, survey)) throw new Error('the survey changed while it was being re-spaced')
    const before: TerrainMissionEdit = toPlain({
      waypoints: missionStore.currentPlanningWaypoints,
      surveys: missionStore.currentPlanningSurveys,
    })
    const start = before.waypoints.findIndex((waypoint) => waypoint.id === first.id)
    if (start < 0) throw new Error('the survey is no longer in the mission')
    const turned = lineBearing !== bearing
    const respaced = {
      ...respacedSurvey(toPlain(current), ends, before.waypoints[start], turned),
      sensorCompensation: true,
    }
    const waypoints = [
      ...before.waypoints.slice(0, start),
      ...respaced.waypoints,
      ...before.waypoints.slice(start + current.waypoints.length),
    ]
    const surveys = before.surveys.map((entry) => (entry.id === survey.id ? respaced : entry))
    return { mission: { waypoints, surveys }, lines: ends.length / 2, turned }
  }

  const compensate = async (surveyId: string): Promise<void> => {
    timers.delete(surveyId)
    const followContours = contourTurns.delete(surveyId)
    const survey = missionStore.currentPlanningSurveys.find(({ id }) => id === surveyId)
    const sensor = compensationSensor.value
    if (!survey?.sensorCompensation || survey.crosshatch || !sensor) return
    try {
      const { mission, lines, turned } = await respacedMission(toPlain(survey), sensor, followContours)
      if (disposed) return
      const along = turned ? ', turned along the slope' : ''
      replaceMission(mission, `Survey compensated for the ${sensor.label}, ${lines} lines covering the area${along}.`)
    } catch (error) {
      // An edit during the re-spacing has scheduled its own pass, which supersedes this one.
      if (disposed || timers.has(surveyId)) return
      const message = `Could not compensate the survey for the ${sensor.label}: ${error}`
      openSnackbar({ variant: 'error', message, duration: 5000 })
    }
  }

  const scheduleCompensation = (surveyId: string, followContours = false): void => {
    if (followContours) contourTurns.add(surveyId)
    clearTimeout(timers.get(surveyId))
    timers.set(
      surveyId,
      setTimeout(() => void compensate(surveyId), COMPENSATION_DELAY_MS)
    )
  }

  onBeforeUnmount(() => {
    disposed = true
    timers.forEach((timer) => clearTimeout(timer))
    contourTurns.clear()
  })

  return { sensors, compensationLabel, respacedMission, scheduleCompensation }
}
