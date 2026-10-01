<template>
  <div class="-mx-2">
    <ExpansiblePanel compact invert-chevron hover-effect elevation-effect no-top-divider darken-content>
      <template #title>
        <div class="flex w-[90%] justify-between items-center text-[14px] -mb-3 font-normal ml-2">
          <div class="flex items-center">Hazard advisories</div>
          <div class="flex items-center">
            <v-menu :close-on-content-click="false" location="bottom end" offset="4" theme="dark">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon
                  variant="text"
                  size="x-small"
                  aria-label="Hazard advisory settings"
                  class="-my-2 translate-x-[14px]"
                  @click.stop="onOpenMenu('hazard advisory settings')"
                >
                  <v-icon icon="mdi-cog" class="text-[13px] opacity-70" />
                </v-btn>
              </template>
              <div
                class="flex flex-col gap-y-2 p-3 rounded-lg w-[250px] text-white"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs">Clearance margin (m)</span>
                  <input
                    :value="hazardStore.settings.proximityMarginMeters"
                    type="number"
                    min="0"
                    :max="MAX_HAZARD_CLEARANCE_M"
                    class="p-1 bg-[#FFFFFF11] w-[70px] text-xs text-right rounded-sm"
                    @change="commitClearanceMargin"
                  />
                </div>
                <p class="text-[10px] opacity-60 leading-snug">
                  How close a waypoint may come to an area before it is reported.
                </p>
                <div class="flex items-center justify-between">
                  <span class="text-xs">Exclusion vertex budget</span>
                  <input
                    :value="hazardStore.settings.exclusionVertexBudget"
                    type="number"
                    :min="MIN_EXCLUSION_VERTEX_BUDGET"
                    :max="MAX_EXCLUSION_VERTEX_BUDGET"
                    class="p-1 bg-[#FFFFFF11] w-[70px] text-xs text-right rounded-sm"
                    @change="commitExclusionVertexBudget"
                  />
                </div>
                <p class="text-[10px] opacity-60 leading-snug">
                  Largest number of vertices an area may keep when it is turned into a fence exclusion polygon, so the
                  simplified shape still fits the autopilot's fence storage.
                </p>
                <div class="flex items-center justify-between">
                  <span class="text-xs">Alert near hazards</span>
                  <v-switch
                    :model-value="hazardStore.settings.liveAlerts"
                    color="#3B78A8"
                    density="compact"
                    hide-details
                    inset
                    class="origin-right scale-50 -mr-2 grow-0"
                    @update:model-value="onToggleLiveAlerts($event === true)"
                  />
                </div>
                <p class="text-[10px] opacity-60 leading-snug">
                  Raises an alert when the vehicle comes within the clearance margin of a loaded area.
                </p>
              </div>
            </v-menu>
          </div>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col w-full px-1 py-1 gap-y-2">
          <div class="flex flex-col">
            <div
              v-for="sourceId in HAZARD_SOURCE_IDS"
              :key="sourceId"
              class="flex items-center justify-between w-full pl-1 pr-2"
            >
              <div class="flex items-center min-w-0">
                <v-icon :icon="HAZARD_SOURCES[sourceId].icon" class="mr-2 opacity-70 text-[16px]" />
                <span class="text-xs truncate">{{ HAZARD_SOURCES[sourceId].label }}</span>
                <v-tooltip location="top" max-width="280">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon
                      v-bind="tooltipProps"
                      icon="mdi-information-outline"
                      class="ml-1 opacity-50 text-[13px]"
                      tabindex="0"
                    />
                  </template>
                  <p>{{ HAZARD_SOURCES[sourceId].caveat }}</p>
                  <p v-if="sourceDataNote(sourceId)" class="mt-1 opacity-70">{{ sourceDataNote(sourceId) }}</p>
                </v-tooltip>
              </div>
              <div class="flex items-center shrink-0">
                <span class="w-[10px] h-[2px] ml-[6px] mr-2" :style="lineSampleStyle(sourceId)" />
                <v-menu
                  v-if="sourceId === 'airspace'"
                  v-model="isOpenAipMenuOpen"
                  :close-on-content-click="false"
                  location="bottom end"
                  offset="4"
                  theme="dark"
                >
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      v-bind="menuProps"
                      icon
                      variant="text"
                      size="x-small"
                      aria-label="openAIP API key"
                      @click="onOpenMenu('openAIP API key input')"
                    >
                      <v-icon icon="mdi-cog" class="text-[12px] opacity-70" />
                    </v-btn>
                  </template>
                  <div
                    class="flex flex-col gap-y-2 p-3 rounded-lg w-[260px] text-white"
                    :style="interfaceStore.globalGlassMenuStyles"
                  >
                    <span class="text-xs">openAIP API key</span>
                    <div class="relative flex items-center">
                      <input
                        v-model="hazardStore.openAipApiKey"
                        type="password"
                        autocomplete="off"
                        placeholder="Required for airspace"
                        class="w-full p-1 pr-9 bg-[#FFFFFF11] text-xs rounded-sm"
                        @change="logOpenAipKeyChange"
                      />
                      <button
                        type="button"
                        class="absolute right-2 text-xs opacity-80 hover:opacity-100"
                        @click="onConfirmOpenAipKey"
                      >
                        Ok
                      </button>
                    </div>
                    <p class="text-[10px] opacity-60 leading-snug">
                      Stored on this computer only, never synced to the vehicle. Get a free key at
                      <a href="https://www.openaip.net" target="_blank" rel="noopener" class="underline">openaip.net</a
                      >, whose data is licensed for non-commercial use.
                    </p>
                  </div>
                </v-menu>
                <v-menu
                  v-if="sourceId === 'terrain'"
                  :close-on-content-click="false"
                  location="bottom end"
                  offset="4"
                  theme="dark"
                >
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      v-bind="menuProps"
                      icon
                      variant="text"
                      size="x-small"
                      aria-label="Terrain clearance setting"
                      @click="onOpenMenu('terrain clearance setting')"
                    >
                      <v-icon icon="mdi-cog" class="text-[12px] opacity-70" />
                    </v-btn>
                  </template>
                  <div
                    class="flex flex-col gap-y-2 p-3 rounded-lg w-[240px] text-white"
                    :style="interfaceStore.globalGlassMenuStyles"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs">Mark ground above (m)</span>
                      <input
                        :value="hazardStore.settings.terrainClearanceMeters"
                        type="number"
                        min="0"
                        :max="MAX_HAZARD_CLEARANCE_M"
                        class="p-1 bg-[#FFFFFF11] w-[70px] text-xs text-right rounded-sm"
                        @change="commitTerrainClearance"
                      />
                    </div>
                    <p class="text-[10px] opacity-60 leading-snug">
                      Ground higher than this above sea level is marked, and waypoints over it are reported.
                    </p>
                  </div>
                </v-menu>
                <v-menu
                  v-if="sourceId === 'shallow-water'"
                  :close-on-content-click="false"
                  location="bottom end"
                  offset="4"
                  theme="dark"
                >
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      v-bind="menuProps"
                      icon
                      variant="text"
                      size="x-small"
                      aria-label="Shallow water setting"
                      @click="onOpenMenu('shallow water setting')"
                    >
                      <v-icon icon="mdi-cog" class="text-[12px] opacity-70" />
                    </v-btn>
                  </template>
                  <div
                    class="flex flex-col gap-y-2 p-3 rounded-lg w-[240px] text-white"
                    :style="interfaceStore.globalGlassMenuStyles"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs">Mark water down to (m)</span>
                      <input
                        :value="hazardStore.settings.shallowWaterDepthMeters"
                        type="number"
                        min="1"
                        :max="MAX_SHALLOW_WATER_DEPTH_M"
                        class="p-1 bg-[#FFFFFF11] w-[70px] text-xs text-right rounded-sm"
                        @change="commitShallowWaterDepth"
                      />
                    </div>
                    <p class="text-[10px] opacity-60 leading-snug">
                      Water this deep or less is marked, and waypoints and legs over it are reported.
                    </p>
                  </div>
                </v-menu>
                <span v-if="!SOURCES_WITH_SETTINGS.includes(sourceId)" class="w-8" />
                <v-switch
                  :model-value="hazardStore.isSourceEnabled(sourceId)"
                  color="#3B78A8"
                  density="compact"
                  hide-details
                  inset
                  class="origin-right scale-50 -mr-2 -ml-[20px]"
                  @update:model-value="onToggleSource(sourceId, $event === true)"
                />
              </div>
            </div>
          </div>

          <div class="flex gap-x-2">
            <v-btn
              variant="flat"
              size="small"
              class="grow bg-[#FFFFFF22] rounded-md text-xs elevation-1 disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50"
              :loading="loadingTarget === 'view'"
              :disabled="hazardStore.settings.enabledSources.length === 0 || loadingTarget === 'mission'"
              prepend-icon="mdi-map-search-outline"
              @click="onRefresh"
            >
              Load for view
            </v-btn>
            <v-btn
              variant="flat"
              size="small"
              class="grow bg-[#FFFFFF22] rounded-md text-xs elevation-1 disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50"
              :loading="loadingTarget === 'mission'"
              :disabled="
                hazardStore.settings.enabledSources.length === 0 ||
                !missionStore.currentPlanningWaypoints.length ||
                loadingTarget === 'view'
              "
              prepend-icon="mdi-map-marker-path"
              @click="onLoadForMission"
            >
              Load for mission
            </v-btn>
          </div>
          <p v-if="hazardStore.settings.enabledSources.length === 0" class="text-[10px] opacity-60 text-center">
            Turn a source on to load data for it.
          </p>

          <p v-if="hazardStore.isSamplingTerrain" class="text-[10px] opacity-70 text-center">
            Sampling the ground elevation...
          </p>
          <p
            v-else-if="hazardStore.visibleAreas.length === 0 && !hazardStore.terrainGrid"
            class="text-[10px] opacity-70 mt-[-2px] text-center"
          >
            No hazard data loaded yet.
          </p>
          <div
            v-if="advisoryGroups.length > 0"
            class="flex flex-col w-full border-[1px] border-[#FF880026] rounded-md my-[2px] px-2 bg-[#FF88001A]"
          >
            <div
              v-for="group in advisoryGroups"
              :key="group.key"
              class="flex items-center w-full py-[2px] border-b-[1px] border-[#FF880026] last:border-b-0"
            >
              <v-icon
                :icon="group.sourceId ? HAZARD_SOURCES[group.sourceId].icon : 'mdi-map-marker-question-outline'"
                class="mr-2 text-[14px]"
                :style="{ color: group.sourceId ? HAZARD_SOURCES[group.sourceId].color : ADVISORY_COLOR }"
              />
              <div class="grow min-w-0">
                <p v-for="message in group.messages" :key="message" class="text-[10px] leading-tight">
                  {{ message }}
                </p>
              </div>
              <v-tooltip location="top" text="Show on the map">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="tooltipProps"
                    icon
                    variant="text"
                    size="x-small"
                    class="ml-1 -mr-1 !w-[22px] !h-[22px]"
                    aria-label="Show on the map"
                    @click="onFocusGroup(group)"
                  >
                    <v-icon icon="mdi-crosshairs-gps" class="text-[14px]" />
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip v-if="group.areaId" location="top" max-width="260" :text="exclusionTooltip(group.areaId)">
                <template #activator="{ props: tooltipProps }">
                  <div v-bind="tooltipProps">
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      class="ml-1 -mr-1 !w-[22px] !h-[22px]"
                      :disabled="hazardStore.isAreaExcluded(group.areaId)"
                      :aria-label="exclusionTooltip(group.areaId)"
                      @click="onAddAsExclusion(group.areaId)"
                    >
                      <v-icon
                        :icon="
                          hazardStore.isAreaExcluded(group.areaId) ? 'mdi-shield-check' : 'mdi-shield-plus-outline'
                        "
                        class="text-[14px]"
                      />
                    </v-btn>
                  </div>
                </template>
              </v-tooltip>
            </div>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useHazardAdvisoryFocus } from '@/composables/map/useHazardAdvisoryFocus'
import { useMapContext } from '@/composables/map/useMapContext'
import { openSnackbar } from '@/composables/snackbar'
import { leafletBoundsToCoverageBbox } from '@/libs/baseStation/coverageBbox'
import { MAX_POLYGON_VERTICES } from '@/libs/geo-fence'
import { bboxMaxSpanDegrees, MAX_HAZARD_BBOX_DEG, paddedBbox } from '@/libs/hazards/hazard-areas'
import { HAZARD_AREA_SOURCE_IDS, HAZARD_SOURCE_IDS, HAZARD_SOURCES } from '@/libs/hazards/sources'
import { terrainSampleSpacingM } from '@/libs/hazards/terrain-areas'
import { constrain } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useHazardStore } from '@/stores/hazards'
import { useMissionStore } from '@/stores/mission'
import type { GeoBbox } from '@/types/general'
import type { HazardSourceId } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

// A margin past this stops describing a clearance and starts flagging the whole chart.
const MAX_HAZARD_CLEARANCE_M = 5000
// Deeper than this the elevation model's seabed is too coarse to single out anything worth avoiding.
const MAX_SHALLOW_WATER_DEPTH_M = 100
const MIN_EXCLUSION_VERTEX_BUDGET = 3
// A single area becomes one fence polygon, so it cannot be allowed more vertices than a polygon holds.
const MAX_EXCLUSION_VERTEX_BUDGET = MAX_POLYGON_VERTICES
// Keeps a single-waypoint mission from asking for a box too small to hold anything around it.
const MIN_MISSION_LOAD_PADDING_M = 100
const SOURCES_WITH_SETTINGS: HazardSourceId[] = ['airspace', 'terrain', 'shallow-water']
// The map draws exclusion fences in this orange.
const ADVISORY_COLOR = '#FF8800'

/** Every advisory raised about one area, collapsed into a single row. */
type AdvisoryGroup = {
  /**
   * Key for the rendered row, the area id when the advisories are tied to one.
   */
  key: string
  /**
   * Area the row is about, absent for findings not tied to one.
   */
  areaId?: string
  /**
   * Source that raised the advisories, absent for findings about the loaded data as a whole.
   */
  sourceId?: HazardSourceId
  /**
   * The advisory messages themselves, in the order they were raised.
   */
  messages: string[]
  /**
   * Every waypoint the advisories name, in mission order.
   */
  waypointIndices: number[]
}

const hazardStore = useHazardStore()
const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { map, mapReady } = useMapContext()
const { focusAdvisory } = useHazardAdvisoryFocus(map)

const viewBbox = ref<GeoBbox | null>(null)
const isOpenAipMenuOpen = ref(false)

const readViewBbox = (): void => {
  const bounds = map.value?.getBounds()
  if (bounds) viewBbox.value = leafletBoundsToCoverageBbox(bounds)
}

// Dragging a waypoint fires at pointer frequency, so the re-check is coalesced to the end of the
// gesture rather than run per event.
let isRecheckPending = false
const runRecheck = useDebounceFn(() => {
  isRecheckPending = false
  void hazardStore.checkMission(missionStore.currentPlanningWaypoints, missionHome.value)
}, 400)
const recheckMission = (): void => {
  isRecheckPending = true
  void runRecheck()
}
// The check blocks the thread for a moment, so while the pointer moves, as when the live leg and its angles follow it
// to the next waypoint, a pending check keeps waiting for it to settle.
const postponePendingRecheck = (): void => {
  if (isRecheckPending) void runRecheck()
}

let detachMoveListener: (() => void) | null = null

watch(
  [map, mapReady],
  () => {
    detachMoveListener?.()
    const instance = map.value
    if (!instance || !mapReady.value) return
    readViewBbox()
    instance.on('moveend', readViewBbox)
    instance.on('mousemove', postponePendingRecheck)
    detachMoveListener = () => {
      instance.off('moveend', readViewBbox)
      instance.off('mousemove', postponePendingRecheck)
      detachMoveListener = null
    }
  },
  { immediate: true }
)

// Half the map outline's `6 4` dash, so two dashes fit the 10px sample.
const lineSampleStyle = (sourceId: HazardSourceId): Record<string, string> => {
  const color = HAZARD_SOURCES[sourceId].color
  return { background: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` }
}

const sourceDataNote = (sourceId: HazardSourceId): string | undefined => {
  const grid = hazardStore.terrainGrid
  const isGrid = sourceId === 'terrain' || sourceId === 'shallow-water'
  const fetchedAtMs = isGrid ? grid?.fetchedAtMs : hazardStore.results[sourceId]?.fetchedAtMs
  if (!fetchedAtMs) return undefined
  const spacing = isGrid && grid ? `, from samples about ${terrainSampleSpacingM(grid)} m apart` : ''
  return `Loaded ${formatDistanceToNow(fetchedAtMs)} ago${spacing}.`
}

// One entry per area, since every contact with the same area is fixed by the same exclusion zone.
const advisoryGroups = computed<AdvisoryGroup[]>(() => {
  const groups = new Map<string, AdvisoryGroup>()
  hazardStore.advisories.forEach((advisory) => {
    const key = advisory.areaId ?? advisory.id
    const group = groups.get(key)
    if (group) {
      group.messages.push(advisory.message)
      group.waypointIndices = [...new Set([...group.waypointIndices, ...advisory.waypointIndices])].sort(
        (a, b) => a - b
      )
      return
    }
    groups.set(key, {
      key,
      areaId: advisory.areaId,
      sourceId: advisory.sourceId,
      messages: [advisory.message],
      waypointIndices: advisory.waypointIndices,
    })
  })
  return [...groups.values()]
})

const onFocusGroup = (group: AdvisoryGroup): void => {
  logUserAction(`Showed the "${group.messages[0]}" hazard advisory on the map`)
  const waypoints = group.waypointIndices
    .map((index) => missionStore.currentPlanningWaypoints[index]?.coordinates)
    .filter((coordinates): coordinates is WaypointCoordinates => coordinates !== undefined)
  focusAdvisory(group.areaId ? hazardStore.findArea(group.areaId) : undefined, waypoints)
}

const exclusionTooltip = (areaId: string): string =>
  hazardStore.isAreaExcluded(areaId)
    ? 'Already added to the geofence as an exclusion zone'
    : `Add to the geofence as an exclusion zone, ${hazardStore.settings.proximityMarginMeters} m clear of it`

const onAddAsExclusion = (areaId: string): void => {
  hazardStore.addAreaAsFenceExclusion(areaId)
}

const missionHome = computed<WaypointCoordinates | undefined>(
  () => missionStore.plannedHomePosition ?? missionStore.homeMarkerPosition
)

// Signatures rather than deep watches: a loaded coastline holds tens of thousands of vertices, and
// walking them on every mission edit would cost far more than the check itself.
const missionSignature = computed(
  () =>
    missionStore.currentPlanningWaypoints
      .map(({ coordinates, altitude, altitudeReferenceType }) => `${coordinates},${altitude},${altitudeReferenceType}`)
      .join('|') + `|${missionHome.value ?? ''}`
)
// Per source rather than per fetch: a single source reloaded, or restored from another topside
// computer, leaves the oldest fetch and the area count exactly where they were.
const areasSignature = computed(() => {
  const { enabledSources, proximityMarginMeters, terrainClearanceMeters, shallowWaterDepthMeters } =
    hazardStore.settings
  const thresholds = `${proximityMarginMeters}:${terrainClearanceMeters}:${shallowWaterDepthMeters}`
  const grid = hazardStore.terrainGrid
  const loadedAt = [...HAZARD_AREA_SOURCE_IDS.map((sourceId) => hazardStore.results[sourceId]), grid].map(
    (data) => `${data?.fetchedAtMs ?? 0}`
  )
  return `${loadedAt.join('|')}:${enabledSources.join()}:${thresholds}`
})

watch([missionSignature, areasSignature], () => recheckMission(), { immediate: true })

const onToggleSource = (sourceId: HazardSourceId, enabled: boolean): void => {
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} the "${HAZARD_SOURCES[sourceId].label}" hazard source`)
  hazardStore.setSourceEnabled(sourceId, enabled)
}

const onOpenMenu = (menu: string): void => logUserAction(`Opened the ${menu}`)

type NumericSettingKey =
  | 'proximityMarginMeters'
  | 'terrainClearanceMeters'
  | 'shallowWaterDepthMeters'
  | 'exclusionVertexBudget'

// The settings sync to the vehicle and re-trace the terrain, so only the committed, clamped value is written.
const commitNumberSetting = (event: Event, key: NumericSettingKey, min: number, max: number): number => {
  const input = event.target as HTMLInputElement
  const value = Number.isFinite(input.valueAsNumber) ? constrain(Math.round(input.valueAsNumber), min, max) : min
  input.value = String(value)
  hazardStore.settings[key] = value
  return value
}

const commitClearanceMargin = (event: Event): void => {
  const value = commitNumberSetting(event, 'proximityMarginMeters', 0, MAX_HAZARD_CLEARANCE_M)
  logUserAction(`Set hazard clearance margin to ${value} m`)
}

const commitTerrainClearance = (event: Event): void => {
  const value = commitNumberSetting(event, 'terrainClearanceMeters', 0, MAX_HAZARD_CLEARANCE_M)
  logUserAction(`Set the terrain marking threshold to ${value} m`)
}

const commitShallowWaterDepth = (event: Event): void => {
  const value = commitNumberSetting(event, 'shallowWaterDepthMeters', 1, MAX_SHALLOW_WATER_DEPTH_M)
  logUserAction(`Set the shallow water marking depth to ${value} m`)
}

const onToggleLiveAlerts = (enabled: boolean): void => {
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} the hazard proximity alerts`)
  hazardStore.settings.liveAlerts = enabled
}

const commitExclusionVertexBudget = (event: Event): void => {
  const value = commitNumberSetting(
    event,
    'exclusionVertexBudget',
    MIN_EXCLUSION_VERTEX_BUDGET,
    MAX_EXCLUSION_VERTEX_BUDGET
  )
  logUserAction(`Set hazard exclusion vertex budget to ${value}`)
}

const logOpenAipKeyChange = (): void => {
  logUserAction(`${hazardStore.openAipApiKey.trim() ? 'Set' : 'Cleared'} the openAIP API key`)
}

const onConfirmOpenAipKey = (): void => {
  logUserAction('Confirmed the openAIP API key')
  isOpenAipMenuOpen.value = false
}

const loadingTarget = ref<'view' | 'mission'>()

const loadAreas = (bbox: GeoBbox, target: 'view' | 'mission'): void => {
  loadingTarget.value = target
  hazardStore
    .refreshAreas(bbox)
    .catch((error: Error) => {
      openSnackbar({ variant: 'error', message: `Could not load hazard data: ${error.message}`, duration: 5000 })
    })
    .finally(() => {
      if (loadingTarget.value === target) loadingTarget.value = undefined
    })
}

const onRefresh = (): void => {
  logUserAction('Loaded hazard advisory data for the current map view')
  readViewBbox()
  if (viewBbox.value) loadAreas(viewBbox.value, 'view')
}

const onLoadForMission = (): void => {
  logUserAction('Loaded hazard advisory data around the mission')
  const coordinates = missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates)
  if (coordinates.length === 0) return
  const padding = Math.max(hazardStore.settings.proximityMarginMeters, MIN_MISSION_LOAD_PADDING_M)
  const bbox = paddedBbox(coordinates, padding)
  // Zooming is what the refresh tells the operator to do, and it does nothing for a box the mission
  // itself spans, so the mission loader has to say the one thing that does.
  if (bboxMaxSpanDegrees(bbox) > MAX_HAZARD_BBOX_DEG) {
    openSnackbar({
      variant: 'info',
      message: 'The mission spans too large an area to load hazard data for. Load it for the map view instead.',
      duration: 5000,
    })
    return
  }
  loadAreas(bbox, 'mission')
}

onBeforeUnmount(() => detachMoveListener?.())
</script>
