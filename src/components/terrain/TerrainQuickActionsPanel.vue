<template>
  <div class="flex flex-col gap-y-2 text-xs">
    <p v-if="!hasWaypoints" class="opacity-70">{{ t`Add waypoints to the mission to reshape it from here.` }}</p>
    <div
      v-if="dock.terrain.vehicleClass.value === 'air'"
      class="flex items-center gap-x-1 rounded-md px-2.5 py-1 min-h-[30px] bg-[#FFFFFF11]"
    >
      <span class="font-medium">{{ t`Always keep a safe height` }}</span>
      <InfoTooltip :label="t`Always keep a safe height information`">
        {{
          t`While on, every change to the mission (moving, adding or removing waypoints, reshaping or rotating a survey)
          re-checks it against the terrain. Each waypoint goes back to the height you planned it at and is raised only as
          far as needed for the path and the returns home to keep the safety margin plus the terrain model error, so
          waypoints the terrain no longer needs high come back down. Lasts until you leave mission planning.`
        }}
      </InfoTooltip>
      <span class="grow" />
      <v-switch
        :model-value="dock.safeAltitude.keepSafe.value"
        color="white"
        base-color="#FFFFFF33"
        density="compact"
        hide-details
        inset
        class="origin-right scale-50 -my-3 grow-0"
        :aria-label="t`Always keep a safe height`"
        @update:model-value="onToggleKeepSafe($event === true)"
      />
    </div>
    <div v-for="action in actions" :key="action.id" class="flex flex-col gap-y-1 rounded-md px-2.5 py-1 bg-[#FFFFFF11]">
      <div class="flex items-center gap-x-1 min-h-[22px]">
        <span class="font-medium">{{ action.title }}</span>
        <InfoTooltip :label="t`${action.title} information`">{{ action.info }}</InfoTooltip>
        <span class="grow" />
        <LoadingText v-if="applyingId === action.id">{{ t`Applying` }}</LoadingText>
        <v-btn
          v-else-if="action.apply"
          variant="text"
          size="x-small"
          class="rounded-md"
          :disabled="applyingId !== null || !hasWaypoints"
          @click="onApply(action)"
        >
          {{ t`Apply` }}
        </v-btn>
        <v-switch
          v-if="action.stretches"
          :model-value="pointing.has(action.id)"
          color="white"
          base-color="#FFFFFF33"
          density="compact"
          hide-details
          inset
          class="origin-right scale-50 -my-3 grow-0"
          :aria-label="action.title"
          @update:model-value="onTogglePointing(action, $event === true)"
        />
      </div>
      <div
        v-if="!action.stretches || pointing.has(action.id)"
        class="flex flex-col gap-y-1 px-7 mt-[5px] mb-[3px] empty:hidden"
      >
        <NumberInputField
          v-for="param in action.params"
          :key="param.key"
          v-model="values[action.id][param.key]"
          :label="param.label"
          :unit="param.unit"
          :min="param.min"
          :max="param.max"
          :step="param.step"
          :info="param.info"
          size="extra-compact"
          @update:model-value="onSetParam(action.id, param.key, $event)"
        />
        <template v-if="listed[action.id]">
          <p v-if="samples.length === 0" class="opacity-70">{{ t`Waiting for the terrain check of the mission.` }}</p>
          <div v-for="stretch in listed[action.id]" :key="stretch.fromM" class="flex items-center gap-x-2">
            <span class="grow opacity-70">{{ action.describe?.(stretch, legOf(stretch)) }}</span>
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="!w-[22px] !h-[22px]"
              :aria-label="t`Show on the map`"
              @click="onFocus(action, stretch)"
            >
              <v-icon icon="mdi-crosshairs-gps" size="14" />
              <v-tooltip activator="parent" location="top" :text="t`Show on the map`" />
            </v-btn>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { msgid, ngettext, t } from 'ttag'
import { computed, reactive, ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import NumberInputField from '@/components/NumberInputField.vue'
import { openSnackbar } from '@/composables/snackbar'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { shippedCruiseSpeed } from '@/libs/mission/cruise-speed'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { type TerrainProfileSample, type TerrainVehicleClass, legLabel } from '@/libs/terrain/mission-profile'
import { profileStretch } from '@/libs/terrain/mission-terrain'
import {
  type ProfileStretch,
  type QuickActionResult,
  capHeightOverGround,
  climbOverHome,
  contourWaypoints,
  highStretches,
  holdAtWaypoints,
  keepWithinDepths,
  levelWaypoints,
  profileWaterColumn,
  relinkSurveys,
  shallowStretches,
  shiftWaypoints,
  steepStretches,
  surfaceAlongPath,
} from '@/libs/terrain/quick-actions'
import type { GroundSampler } from '@/libs/terrain/terrain-following'
import { toPlain } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

type Values = Record<string, number>

/**
 * A number a quick action takes.
 */
interface QuickActionParam {
  /**
   * Key in the action's values.
   */
  key: string
  /**
   * Field label.
   */
  label: string
  /**
   * Unit shown after the field.
   */
  unit: string
  /**
   * Value the field starts at.
   */
  initial: number
  /**
   * Lowest accepted value.
   */
  min: number
  /**
   * Highest accepted value.
   */
  max: number
  /**
   * Input step.
   */
  step: number
  /**
   * Explanation shown beside the label.
   */
  info?: string
}

/**
 * What a quick action did, with the sentence the snackbar reports it with.
 */
interface ReportedResult extends QuickActionResult {
  /**
   * Sentence shown once the action is applied.
   */
  message: string
}

/**
 * A mission-wide edit or check the panel offers.
 */
interface QuickAction {
  /**
   * Stable identifier.
   */
  id: string
  /**
   * Row title.
   */
  title: string
  /**
   * What the action does, shown from the information icon.
   */
  info: string
  /**
   * Vehicles it is offered to.
   */
  classes: TerrainVehicleClass[]
  /**
   * Numbers it takes.
   */
  params: QuickActionParam[]
  /**
   * Rewrites the waypoints, with the sentence the snackbar shows.
   */
  apply?: (values: Values, waypoints: Waypoint[], home: WaypointCoordinates) => Promise<ReportedResult>
  /**
   * Stretches of the mission it points out.
   */
  stretches?: (values: Values, samples: TerrainProfileSample[]) => ProfileStretch[]
  /**
   * Sentence for one of those stretches.
   */
  describe?: (stretch: ProfileStretch, leg: string) => string
}

const terrainStore = useTerrainStore()
const missionStore = useMissionStore()
const dock = useTerrainDock()
const applyingId = ref<string | null>(null)

const sampleHighest: GroundSampler = (coordinates) => sampleTerrain(coordinates, { mode: 'highest' })
const sampleGround: GroundSampler = (coordinates) => sampleTerrain(coordinates, { mode: 'bilinear' })
const surveyWaypointIds = (): Set<string> =>
  new Set(missionStore.currentPlanningSurveys.flatMap((survey) => survey.waypoints.map(({ id }) => id)))
const everyWaypoint = (waypoints: Waypoint[], message: string): ReportedResult => ({
  waypoints,
  changed: waypoints.length,
  message,
})

const contour = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  height: number,
  precision: number,
  over: 'ground' | 'seabed'
): Promise<ReportedResult> => {
  const result = await contourWaypoints(waypoints, home, height, precision, sampleHighest, dock.terrain.context())
  const unread = result.unresolvedWaypoints
  const unknown =
    unread > 0
      ? ` ${ngettext(
          msgid`The terrain under ${unread} waypoint could not be read, so it kept its height.`,
          `The terrain under ${unread} waypoints could not be read, so they kept their height.`,
          unread
        )}`
      : ''
  const addedCount = result.addedWaypoints
  const holding =
    over === 'ground'
      ? ngettext(
          msgid`Holding ${height} m over the ground, with ${addedCount} waypoint added.`,
          `Holding ${height} m over the ground, with ${addedCount} waypoints added.`,
          addedCount
        )
      : ngettext(
          msgid`Holding ${height} m over the seabed, with ${addedCount} waypoint added.`,
          `Holding ${height} m over the seabed, with ${addedCount} waypoints added.`,
          addedCount
        )
  return {
    waypoints: result.waypoints,
    changed: result.waypoints.length,
    message: `${holding}${unknown}`,
  }
}

const ACTIONS: QuickAction[] = [
  {
    id: 'level',
    title: t`Level flight at`,
    info: t`Puts every waypoint, surveys included, at the same height above home, so the vehicle flies level. Ground
      that rises above home comes closer, so check the findings afterwards.`,
    classes: ['air'],
    params: [{ key: 'altitude', label: t`Height above home`, unit: 'm', initial: 30, min: 1, max: 1000, step: 1 }],
    apply: async ({ altitude }, waypoints) =>
      everyWaypoint(levelWaypoints(waypoints, altitude), t`Every waypoint set to ${altitude} m above home.`),
  },
  {
    id: 'contour',
    title: t`Follow the terrain contour over`,
    info: t`Holds one height over the ground for the whole mission. Every waypoint is set to that height over the
      ground under it, and waypoints are added in between wherever the ground rises or falls enough for a straight line
      to drift from it. Heights end up fixed above sea level, so the vehicle needs no terrain data of its own.`,
    classes: ['air'],
    params: [
      { key: 'height', label: t`Height over the ground`, unit: 'm', initial: 30, min: 1, max: 1000, step: 1 },
      {
        key: 'precision',
        label: t`Precision`,
        unit: 'm',
        initial: terrainStore.settings.terrainFollowToleranceM,
        min: 0.5,
        max: 50,
        step: 0.5,
        info: t`How far above that height the line between two waypoints may pass. A smaller value adds more waypoints,
          so the vehicle follows the ground more closely.`,
      },
    ],
    apply: ({ height, precision }, waypoints, home) => contour(waypoints, home, height, precision, 'ground'),
  },
  {
    id: 'cruise-depth',
    title: t`Cruise at a depth of`,
    info: t`Puts every waypoint, surveys included, at the same depth below the surface at home. Where the seabed rises
      above that depth, check the findings afterwards.`,
    classes: ['underwater'],
    params: [{ key: 'depth', label: t`Depth`, unit: 'm', initial: 5, min: 0, max: 1000, step: 0.5 }],
    apply: async ({ depth }, waypoints) =>
      everyWaypoint(levelWaypoints(waypoints, -depth), t`Every waypoint set to ${depth} m deep.`),
  },
  {
    id: 'glide',
    title: t`Glide over the seabed at`,
    info: t`Holds one height over the seabed for the whole mission, never coming above the surface. Waypoints are added
      wherever the seabed rises or falls enough for a straight line to drift from it, so the vehicle needs no
      altimeter reading to follow it.`,
    classes: ['underwater'],
    params: [
      { key: 'height', label: t`Height over the seabed`, unit: 'm', initial: 3, min: 0.5, max: 500, step: 0.5 },
      {
        key: 'precision',
        label: t`Precision`,
        unit: 'm',
        initial: 1,
        min: 0.2,
        max: 20,
        step: 0.1,
        info: t`How far above that height the line between two waypoints may pass. A smaller value adds more waypoints,
          so the vehicle follows the seabed more closely.`,
      },
    ],
    apply: ({ height, precision }, waypoints, home) => contour(waypoints, home, height, precision, 'seabed'),
  },
  {
    id: 'shift',
    title: t`Shift every height by`,
    info: t`Moves every waypoint up or down by the same amount, keeping the shape of the mission and the altitude
      reference of each waypoint.`,
    classes: ['air', 'underwater'],
    params: [{ key: 'change', label: t`Up, negative for down`, unit: 'm', initial: 5, min: -500, max: 500, step: 0.5 }],
    apply: async ({ change }, waypoints) => {
      const distanceM = Math.abs(change)
      const message =
        change > 0 ? t`Every waypoint moved up ${distanceM} m.` : t`Every waypoint moved down ${distanceM} m.`
      return everyWaypoint(shiftWaypoints(waypoints, change), message)
    },
  },
  {
    id: 'climb-over-home',
    title: t`Climb over home to`,
    info: t`Starts the mission with a waypoint straight above home, so the vehicle climbs before heading out over
      rising ground or obstacles. Applying it again changes the height of that same waypoint.`,
    classes: ['air'],
    params: [{ key: 'altitude', label: t`Height above home`, unit: 'm', initial: 20, min: 1, max: 1000, step: 1 }],
    apply: async ({ altitude }, waypoints, home) => ({
      waypoints: climbOverHome(waypoints, home, altitude),
      changed: 1,
      message: t`The mission starts with a climb to ${altitude} m over home.`,
    }),
  },
  {
    id: 'cap',
    title: t`Cap the height above the ground at`,
    info: t`Lowers the waypoints that sit higher over the ground than this, such as the 120 m many countries allow.
      Between waypoints, the path can still pass higher over valleys; those stretches are listed below.`,
    classes: ['air'],
    params: [
      { key: 'ceiling', label: t`Highest over the ground`, unit: 'm', initial: 120, min: 1, max: 2000, step: 1 },
    ],
    apply: async ({ ceiling }, waypoints, home) => {
      const result = await capHeightOverGround(waypoints, home, ceiling, sampleGround, dock.terrain.context())
      const message = ngettext(
        msgid`${result.changed} waypoint lowered to ${ceiling} m over the ground.`,
        `${result.changed} waypoints lowered to ${ceiling} m over the ground.`,
        result.changed
      )
      return { ...result, message }
    },
    stretches: ({ ceiling }, samples) => highStretches(samples, ceiling),
    describe: (stretch, leg) => {
      const heightM = Math.round(stretch.worst)
      return t`Up to ${heightM} m over the ground from ${leg}.`
    },
  },
  {
    id: 'depth-limits',
    title: t`Keep inside safe depths`,
    info: t`Moves the waypoints that go deeper than the limit, or closer to the seabed than the clearance, back inside
      both. Where the seabed is too shallow for both, the clearance wins.`,
    classes: ['underwater'],
    params: [
      { key: 'deepest', label: t`No deeper than`, unit: 'm', initial: 50, min: 0, max: 1000, step: 1 },
      {
        key: 'clearance',
        label: t`Above the seabed by at least`,
        unit: 'm',
        initial: terrainStore.settings.minimumClearanceM,
        min: 0,
        max: 500,
        step: 0.5,
      },
    ],
    apply: async ({ deepest, clearance }, waypoints, home) => {
      const result = await keepWithinDepths(waypoints, home, deepest, clearance, sampleHighest, dock.terrain.context())
      const message = ngettext(
        msgid`${result.changed} waypoint moved inside the safe depths.`,
        `${result.changed} waypoints moved inside the safe depths.`,
        result.changed
      )
      return { ...result, message }
    },
  },
  {
    id: 'water-column',
    title: t`Profile the water column between`,
    info: t`Adds waypoints along each leg that go alternately deep and shallow, a saw-tooth that samples the water from
      near the surface to near the seabed. Deep turns stop the minimum clearance of the terrain settings above the
      seabed. Survey lines are left as they are.`,
    classes: ['underwater'],
    params: [
      { key: 'shallowest', label: t`Shallowest`, unit: 'm', initial: 2, min: 0, max: 1000, step: 0.5 },
      { key: 'deepest', label: t`Deepest`, unit: 'm', initial: 20, min: 0, max: 1000, step: 0.5 },
      {
        key: 'spacing',
        label: t`Distance between turns`,
        unit: 'm',
        initial: 50,
        min: 5,
        max: 5000,
        step: 5,
        info: t`Horizontal distance between a deep turn and the next shallow one.`,
      },
    ],
    apply: async ({ shallowest, deepest, spacing }, waypoints, home) => {
      const result = await profileWaterColumn(
        waypoints,
        home,
        Math.min(shallowest, deepest),
        Math.max(shallowest, deepest),
        spacing,
        terrainStore.settings.minimumClearanceM,
        surveyWaypointIds(),
        sampleHighest,
        dock.terrain.context()
      )
      const message = ngettext(
        msgid`${result.changed} turn added between ${shallowest} and ${deepest} m.`,
        `${result.changed} turns added between ${shallowest} and ${deepest} m.`,
        result.changed
      )
      return { ...result, message }
    },
  },
  {
    id: 'position-fix',
    title: t`Come up for a position fix every`,
    info: t`Underwater the vehicle has no GPS, so the position it navigates by slowly drifts. This adds stops at the
      surface along the path, where it can take a new fix. The distance between them comes from the time and the
      mission's cruise speed.`,
    classes: ['underwater'],
    params: [
      { key: 'minutes', label: t`Time between surfacings`, unit: 'min', initial: 10, min: 1, max: 240, step: 1 },
      {
        key: 'hold',
        label: t`Time at the surface`,
        unit: 's',
        initial: 30,
        min: 0,
        max: 600,
        step: 5,
        info: t`Long enough for the GPS to get a fix; a cold start can take a minute or more.`,
      },
    ],
    apply: async ({ minutes, hold }, waypoints, home) => {
      const speed = Number(missionStore.plannedCruiseSpeed ?? shippedCruiseSpeed)
      const result = surfaceAlongPath(waypoints, home, minutes * 60 * speed, hold)
      const message = ngettext(
        msgid`${result.changed} surfacing added, every ${minutes} min.`,
        `${result.changed} surfacings added, every ${minutes} min.`,
        result.changed
      )
      return { ...result, message }
    },
  },
  {
    id: 'pause',
    title: t`Pause at every waypoint for`,
    info: t`Makes the vehicle wait at each waypoint before going on, for a sample, a photo or a look around. Survey
      lines are left as they are. Set 0 to stop pausing.`,
    classes: ['surface', 'ground'],
    params: [{ key: 'hold', label: t`Wait`, unit: 's', initial: 10, min: 0, max: 3600, step: 1 }],
    apply: async ({ hold }, waypoints) => {
      const result = holdAtWaypoints(waypoints, hold, surveyWaypointIds())
      const message =
        hold > 0
          ? ngettext(
              msgid`The vehicle waits ${hold} s at ${result.changed} waypoint.`,
              `The vehicle waits ${hold} s at ${result.changed} waypoints.`,
              result.changed
            )
          : ngettext(
              msgid`The vehicle no longer waits at ${result.changed} waypoint.`,
              `The vehicle no longer waits at ${result.changed} waypoints.`,
              result.changed
            )
      return { ...result, message }
    },
  },
  {
    id: 'backwards',
    title: t`Run the mission backwards`,
    info: t`Reverses the order of the waypoints, so the vehicle runs the same path from its far end.`,
    classes: ['air', 'surface', 'underwater', 'ground'],
    params: [],
    apply: async (_, waypoints) => everyWaypoint([...waypoints].reverse(), t`The mission now runs backwards.`),
  },
  {
    id: 'under-keel',
    title: t`Point out water shallower than`,
    info: t`Lists the stretches with less water under the keel than this, after the vessel's draft. The possible shallow
      water warnings in Findings do not follow this value: they flag water under the minimum in the terrain settings.
      Both read the same terrain profile, so a stretch can show up in both.`,
    classes: ['surface'],
    params: [{ key: 'depth', label: t`Water under the keel`, unit: 'm', initial: 2, min: 0, max: 100, step: 0.5 }],
    stretches: ({ depth }, samples) => shallowStretches(samples, depth),
    describe: (stretch, leg) => {
      const depthM = Math.max(0, stretch.worst).toFixed(1)
      return t`${depthM} m under the keel from ${leg}.`
    },
  },
  {
    id: 'slopes',
    title: t`Point out slopes steeper than`,
    info: t`Lists the stretches where the ground along the path rises or falls more steeply than this grade.`,
    classes: ['ground'],
    params: [{ key: 'grade', label: t`Grade`, unit: '%', initial: 15, min: 1, max: 200, step: 1 }],
    stretches: ({ grade }, samples) => steepStretches(samples, grade),
    describe: (stretch, leg) => {
      const gradePercent = Math.round(stretch.worst)
      return t`${gradePercent}% grade from ${leg}.`
    },
  },
]

const values = reactive<Record<string, Values>>(
  Object.fromEntries(
    ACTIONS.map((action) => [action.id, Object.fromEntries(action.params.map(({ key, initial }) => [key, initial]))])
  )
)

const onSetParam = (actionId: string, key: string, value: number): void => {
  logUserAction(`Set ${key} of the "${actionId}" terrain quick action to ${value}`)
}

const actions = computed(() => ACTIONS.filter((action) => action.classes.includes(dock.terrain.vehicleClass.value)))
const hasWaypoints = computed(() => missionStore.currentPlanningWaypoints.length > 0)
const samples = computed(() => dock.terrain.analysis.value?.profile.samples ?? [])

// Pointing out stretches starts off every time the panel opens, so a long list never greets the operator.
const pointing = reactive(new Set<string>())

const listed = computed(() =>
  Object.fromEntries(
    actions.value.flatMap((action) =>
      action.stretches && pointing.has(action.id)
        ? [[action.id, action.stretches(values[action.id], samples.value)]]
        : []
    )
  )
)

const legOf = (stretch: ProfileStretch): string => legLabel(dock.terrain.analysis.value?.points ?? [], stretch.legIndex)

const onApply = async (action: QuickAction): Promise<void> => {
  const home = dock.terrain.home.value
  if (!action.apply) return
  logUserAction(`Applied the "${action.id}" terrain quick action`)
  if (!home) {
    openSnackbar({
      variant: 'warning',
      message: t`Place home on the map before reshaping the mission.`,
      duration: 4000,
    })
    return
  }
  applyingId.value = action.id
  try {
    const result = await action.apply(values[action.id], toPlain(missionStore.currentPlanningWaypoints), home)
    if (result.changed === 0) {
      openSnackbar({ variant: 'info', message: t`Nothing in the mission needed to change.`, duration: 3000 })
      return
    }
    const surveys = relinkSurveys(toPlain(missionStore.currentPlanningSurveys), result.waypoints)
    dock.replaceMission({ waypoints: result.waypoints, surveys }, result.message)
  } catch (error) {
    openSnackbar({ variant: 'error', message: t`Could not apply "${action.title}": ${error}`, duration: 5000 })
  } finally {
    applyingId.value = null
  }
}

const onToggleKeepSafe = (keepSafe: boolean): void => {
  logUserAction(`${keepSafe ? 'Enabled' : 'Disabled'} always keeping the waypoints at a safe height`)
  dock.safeAltitude.keepSafe.value = keepSafe
}

const onTogglePointing = (action: QuickAction, enabled: boolean): void => {
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} the "${action.id}" terrain quick action`)
  if (enabled) pointing.add(action.id)
  else pointing.delete(action.id)
}

const onFocus = (action: QuickAction, stretch: ProfileStretch): void => {
  logUserAction(`Showed a "${action.id}" stretch on the map`)
  dock.focus(profileStretch(samples.value, stretch.fromM, stretch.toM))
}
</script>
