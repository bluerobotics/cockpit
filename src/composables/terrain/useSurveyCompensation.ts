import { t } from 'ttag'
import { type ComputedRef, computed, onBeforeUnmount, watch } from 'vue'

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
// Sensor settings each re-spacing was made with, by the id of its first waypoint, so an undo or redo that brings back
// lines spaced for older settings is told apart from one that brings back current ones.
const spacedWith = new Map<string, string>()

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
   * Sensor a survey is compensated for, or would be when turned on: null when none is picked, undefined for ground
   * vehicles.
   */
  compensationLabel: (survey?: Survey) => string | null | undefined
  /**
   * Re-spaces a survey so the sensor's strips leave no gap on the bottom, first turning its lines along the slope's
   * contours when asked to, and turns its sensor compensation on for that sensor; throws when it cannot.
   */
  respacedMission: (survey: Survey, sensor: ResolvedSurveySensor, followContours?: boolean) => Promise<SurveyRespacing>
  /**
   * Compensates a survey with sensor compensation on, once the edits to it settle. Asked to turn it on, the pass
   * spaces the survey for the default sensor, turns its lines along the slope, and is a step of its own to undo.
   */
  scheduleCompensation: (surveyId: string, turnOn?: boolean) => void
}

const sameWaypoints = (a: Survey, b: Survey): boolean =>
  a.waypoints.length === b.waypoints.length &&
  a.waypoints.every((waypoint, index) => waypoint.id === b.waypoints[index].id)

/**
 * Re-spaces surveys for the echo sounder or camera set in the survey sensor settings.
 * @param {ReplaceMission} replaceMission Replaces the mission through the planning view.
 * @param {boolean} followSettings Re-spaces the compensated surveys whenever their sensor settings change, or an undo
 *   brings back lines spaced for older ones; only the planning view's instance does, so a change is not compensated
 *   twice.
 * @returns {UseSurveyCompensationReturn} The sensors and the re-spacing.
 */
export const useSurveyCompensation = (
  replaceMission: ReplaceMission,
  followSettings = false
): UseSurveyCompensationReturn => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  // Surveys whose pending pass turns compensation on, kept apart so a later edit does not drop the request.
  const turnOnRequests = new Set<string>()
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
  const sensorFor = (kind: Survey['sensorCompensation']): ResolvedSurveySensor | undefined =>
    sensors.value.find(({ geometry }) => geometry && geometry.kind === kind)
  const compensationLabel = (survey?: Survey): string | null | undefined => {
    if (vehicleClass.value === 'ground') return undefined
    const kind = survey?.sensorCompensation
    return ((kind && sensorFor(kind)) || compensationSensor.value)?.label ?? null
  }
  const respacedMission = async (
    survey: Survey,
    sensor: ResolvedSurveySensor,
    followContours = false
  ): Promise<SurveyRespacing> => {
    const [first, second] = survey.waypoints
    const { geometry, rangeM, overlapPercent, label } = sensor
    if (survey.crosshatch) throw new Error(t`Crosshatch surveys cannot be re-spaced for a sensor.`)
    if (!first || !second || !geometry) throw new Error(t`The survey has no lines to re-space.`)
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
      const advice = t`Split the area into smaller surveys or pick a sensor with a wider view.`
      throw new Error(t`Covering it with the ${label} from this height takes too many lines. ${advice}`)
    }
    if (ends.length < 2) throw new Error(t`No line fits inside the survey area.`)
    // The bottom was being sampled, so the survey may have been edited or removed in the meantime.
    const current = missionStore.currentPlanningSurveys.find(({ id }) => id === survey.id)
    if (!current || !sameWaypoints(current, survey))
      throw new Error(t`The survey changed while it was being re-spaced.`)
    const before: TerrainMissionEdit = toPlain({
      waypoints: missionStore.currentPlanningWaypoints,
      surveys: missionStore.currentPlanningSurveys,
    })
    const start = before.waypoints.findIndex((waypoint) => waypoint.id === first.id)
    if (start < 0) throw new Error(t`The survey is no longer in the mission.`)
    const turned = lineBearing !== bearing
    const respaced = {
      ...respacedSurvey(toPlain(current), ends, before.waypoints[start], turned),
      sensorCompensation: geometry.kind,
    }
    const waypoints = [
      ...before.waypoints.slice(0, start),
      ...respaced.waypoints,
      ...before.waypoints.slice(start + current.waypoints.length),
    ]
    const surveys = before.surveys.map((entry) => (entry.id === survey.id ? respaced : entry))
    spacedWith.set(respaced.waypoints[0].id, JSON.stringify(sensor))
    return { mission: { waypoints, surveys }, lines: ends.length / 2, turned }
  }

  const surveyById = (surveyId: string): Survey | undefined =>
    missionStore.currentPlanningSurveys.find(({ id }) => id === surveyId)

  const compensate = async (surveyId: string): Promise<void> => {
    timers.delete(surveyId)
    const turningOn = turnOnRequests.delete(surveyId)
    const survey = surveyById(surveyId)
    const kind = turningOn ? compensationSensor.value?.geometry?.kind : survey?.sensorCompensation
    if (!survey || survey.crosshatch || !kind || (!surveysBottom.value && vehicleClass.value !== 'air')) return
    const sensor = sensorFor(kind)
    try {
      if (!sensor) throw new Error(t`Its sensor is no longer set in the survey sensor settings.`)
      const { mission, lines, turned } = await respacedMission(toPlain(survey), sensor, turningOn)
      if (disposed) return
      const { label } = sensor
      const message = turned
        ? t`Survey compensated for the ${label}, ${lines} lines covering the area, turned along the slope.`
        : t`Survey compensated for the ${label}, ${lines} lines covering the area.`
      replaceMission(mission, message, turningOn)
    } catch (error) {
      // An edit during the re-spacing has scheduled its own pass, which supersedes this one.
      if (disposed || timers.has(surveyId)) return
      // The lines no longer match the sensor, so the survey stops claiming to be spaced for it.
      const current = surveyById(surveyId)
      if (current) delete current.sensorCompensation
      const reason = (error as Error).message
      const message = t`Could not compensate the survey, so its sensor compensation is off. ${reason}`
      openSnackbar({ variant: 'error', message, duration: 5000 })
    }
  }

  const scheduleCompensation = (surveyId: string, turnOn = false): void => {
    if (turnOn) turnOnRequests.add(surveyId)
    clearTimeout(timers.get(surveyId))
    timers.set(
      surveyId,
      setTimeout(() => void compensate(surveyId), COMPENSATION_DELAY_MS)
    )
  }

  const stopFollowingSettings = followSettings
    ? watch(
        () => JSON.stringify(sensors.value),
        () =>
          missionStore.currentPlanningSurveys.forEach(({ id, sensorCompensation }) => {
            if (sensorCompensation) scheduleCompensation(id)
          })
      )
    : undefined

  const stopFollowingUndo = followSettings
    ? watch(
        () =>
          missionStore.currentPlanningSurveys
            .map(({ sensorCompensation, waypoints }) => sensorCompensation && waypoints[0]?.id)
            .join(),
        () =>
          missionStore.currentPlanningSurveys.forEach(({ id, sensorCompensation, waypoints }) => {
            const spaced = spacedWith.get(waypoints[0]?.id ?? '')
            if (!sensorCompensation || spaced === undefined) return
            if (spaced !== JSON.stringify(sensorFor(sensorCompensation))) scheduleCompensation(id)
          })
      )
    : undefined

  onBeforeUnmount(() => {
    disposed = true
    stopFollowingSettings?.()
    stopFollowingUndo?.()
    timers.forEach((timer) => clearTimeout(timer))
    turnOnRequests.clear()
  })

  return { sensors, compensationLabel, respacedMission, scheduleCompensation }
}
