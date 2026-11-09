<template>
  <DrawerPanel
    :open="dock.open.value"
    :label="t`terrain panel`"
    :title="t`Terrain and mission profile`"
    icon="mdi-image-filter-hdr"
    width="max(320px, min(920px, calc(100vw - 374px)))"
    @update:open="onToggleOpen"
  >
    <div class="relative h-full">
      <div
        v-if="!firstCheck && !dock.terrain.awaitingHome.value && !noMission"
        class="flex flex-col h-full gap-y-2 pl-3 pr-3 pt-2.5 pb-2 select-none transition-[filter] duration-200"
        :class="{ 'blur-[3px]': dock.safeAltitude.recalculating.value }"
      >
        <div v-if="analysis && analysis.profile.samples.length > 1" class="relative">
          <TerrainProfileChart
            class="transition-[filter] duration-200"
            :class="{ 'blur-[3px]': rechecking }"
            :samples="analysis.profile.samples"
            :points="analysis.points"
            :vehicle-class="dock.terrain.vehicleClass.value"
            :uncertainty-m="terrainStore.effectiveSource.verticalUncertaintyM"
            :water-level-m="terrainStore.waterLevelNowM()"
            :draft-m="terrainStore.settings.vesselDraftM"
            :tide-range-m="tideOutlineM"
            :shallows="chartShallows"
            :collisions="chartCollisions"
            :bands="chartBands"
            :markers-m="dock.ghostDistanceM.value === null ? [] : [dock.ghostDistanceM.value]"
            :coastline-m="coastlineM"
            :height-px="chartHeightPx"
            @hover="dock.hover.value = $event"
            @select-waypoint="onSelectWaypoint"
            @set-waypoint-height="dock.setWaypointHeight"
            @tap="onChartTap"
          />
          <Transition
            enter-active-class="transition-opacity duration-200"
            leave-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <div
              v-if="rechecking"
              class="absolute inset-0 flex flex-col items-center justify-center gap-y-3 bg-[#00000055] pointer-events-none"
              role="status"
            >
              <img :src="propellerLogo" alt="" class="terrain-propeller w-[44px] h-[44px]" />
              <span class="text-sm">{{ t`Checking the terrain...` }}</span>
            </div>
          </Transition>
        </div>
        <p v-else class="text-xs opacity-70 text-center py-6">{{ emptyMessage }}</p>

        <div class="flex items-center gap-x-1">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            type="button"
            class="px-2 py-[2px] rounded-md text-xs transition-colors"
            :class="currentTab === tab.id ? 'bg-[#3B78A8]' : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF22]'"
            @click="onSelectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
          <v-tooltip location="top" max-width="320" :text="`${sourceTagHelp} ${sourceCredit()}`">
            <template #activator="{ props: tooltipProps }">
              <span
                v-bind="tooltipProps"
                tabindex="0"
                class="ml-auto min-w-0 flex items-center gap-x-1.5 px-2 py-[2px] rounded-md text-[11px] bg-[#3B78A866] border border-[#3B78A8]"
              >
                <span class="min-w-0 truncate">{{ sourceTagText }}</span>
              </span>
            </template>
          </v-tooltip>
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="!w-[22px] !h-[22px] shrink-0"
            :aria-label="t`Open the mission settings`"
            @click="onOpenMissionSettings"
          >
            <v-icon icon="mdi-cog" size="14" />
            <v-tooltip activator="parent" location="top" :text="t`Open the mission settings`" />
          </v-btn>
        </div>

        <div
          class="flex flex-col grow -mr-[9px] pr-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-[5px] transition-[min-height,max-height] duration-300 ease-out"
          :style="listHeightStyle"
        >
          <div
            v-if="currentTab === 'findings'"
            class="flex flex-col gap-y-[2px]"
            :class="{ 'grow justify-center': dock.findings.value.length === 0 }"
          >
            <TerrainSafeAltitude />
            <div
              v-if="dock.coastlineMissing.value"
              class="flex items-center gap-x-2 text-xs rounded-md px-2.5 py-[2px] bg-[#FFFFFF11]"
            >
              <v-icon icon="mdi-waves" size="14" color="#81D4FA" />
              <span class="grow">
                {{
                  t`Part of the mission is outside the loaded coastline map, so shallow water cannot be told from land there.`
                }}
              </span>
              <LoadingText v-if="dock.loadingCoastline.value">{{ t`Loading data` }}</LoadingText>
              <v-btn v-else variant="flat" size="x-small" class="bg-[#FFFFFF22]" @click="dock.loadMissionCoastline">
                {{ t`Load coastline` }}
              </v-btn>
            </div>
            <p v-if="dock.findings.value.length === 0 && analysis" class="text-xs opacity-70">
              {{ t`Nothing along the mission comes closer to the terrain than the minimums in the terrain settings.` }}
            </p>
            <div
              v-for="finding in dock.findings.value"
              :key="finding.key"
              class="flex items-center gap-x-2 text-xs rounded-md px-2.5 py-[2px] bg-[#FFFFFF11] transition-[filter,box-shadow] duration-150"
              :class="{ 'brightness-[1.08] shadow-[0_1px_6px_#00000040]': isHighlighted(finding) }"
              @pointerenter="onCardPointer($event, finding.key)"
              @pointerleave="onCardPointer($event, null)"
              @pointerup="onCardTap($event, finding)"
            >
              <TerrainWarningTriangle v-if="finding.icon === TERRAIN_WARNING_ICON" :size="14" />
              <v-icon v-else :icon="finding.icon" size="14" :style="{ color: finding.color }" />
              <span class="grow">{{ finding.message }}</span>
              <v-btn
                icon
                variant="text"
                size="x-small"
                class="!w-[22px] !h-[22px]"
                :aria-label="t`Show on the map`"
                @click="onFocusFinding(finding)"
              >
                <v-icon icon="mdi-crosshairs-gps" size="14" />
                <v-tooltip activator="parent" location="top" :text="t`Show on the map`" />
              </v-btn>
            </div>
          </div>
          <TerrainQuickActionsPanel v-else-if="currentTab === 'actions'" />
          <TerrainSightPanel v-else-if="currentTab === 'sight'" />
          <TerrainVehiclePanel v-else-if="currentTab === 'vehicle'" />
        </div>

        <div class="flex items-center gap-x-2 text-xs border-t border-[#FFFFFF11] pt-[7px]">
          <LoadingText v-if="status.busy" :style="{ color: status.color }">{{ status.text }}</LoadingText>
          <span v-else class="flex items-center gap-x-1" :style="{ color: status.color }">
            <v-icon :icon="status.icon" size="14" />
            {{ status.text }}
          </span>
          <v-tooltip
            v-if="terrainStore.sourceFallbackReason"
            location="top"
            max-width="280"
            :text="terrainStore.sourceFallbackReason"
          >
            <template #activator="{ props: tooltipProps }">
              <v-icon v-bind="tooltipProps" icon="mdi-information-outline" size="14" class="opacity-70" tabindex="0" />
            </template>
          </v-tooltip>
          <span class="grow" />
          <v-btn
            icon
            variant="text"
            size="x-small"
            :aria-label="t`Rebuild the terrain model`"
            :disabled="dock.terrain.analyzing.value"
            @click="onRebuildTerrain"
          >
            <v-icon icon="mdi-refresh" size="16" />
            <v-tooltip activator="parent" location="top" :text="t`Rebuild the terrain model`" />
          </v-btn>
          <span v-if="terrainStore.downloadProgress" class="flex items-center gap-x-1 opacity-80">
            {{ t`Storing terrain ${terrainStore.downloadProgress.done} / ${terrainStore.downloadProgress.total}` }}
            <v-btn icon variant="text" size="x-small" :aria-label="t`Stop storing terrain`" @click="onCancelOffline">
              <v-icon icon="mdi-close" size="14" />
              <v-tooltip activator="parent" location="top" :text="t`Stop storing terrain`" />
            </v-btn>
          </span>
          <v-btn
            v-else
            icon
            variant="text"
            size="x-small"
            :aria-label="t`Keep the terrain of the visible map for offline use`"
            @click="onStoreOffline"
          >
            <v-icon icon="mdi-cloud-download-outline" size="16" />
            <v-tooltip activator="parent" location="top" max-width="280">
              {{
                t`Keep the terrain of the visible map for offline use. What the mission crosses is already kept as it is checked; this adds the area around it, so
                  waypoints can still be moved with no internet connection.`
              }}
            </v-tooltip>
          </v-btn>
        </div>
      </div>
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="dock.terrain.awaitingHome.value"
          class="absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-[#00000055]"
          role="status"
        >
          <span class="relative opacity-80">
            <v-icon icon="mdi-home-circle-outline" size="40" />
            <v-icon icon="mdi-plus-circle" size="18" class="absolute -right-1 -bottom-1 rounded-full bg-[#1E1E1E]" />
          </span>
          <span class="text-sm">{{ t`Add mission home` }}</span>
          <span class="text-xs opacity-70">
            {{ t`The terrain under the mission is checked once the mission has a home.` }}
          </span>
        </div>
        <div
          v-else-if="noMission"
          class="absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-[#00000055]"
          role="status"
        >
          <span class="relative opacity-80">
            <v-icon icon="mdi-map-marker-path" size="40" />
            <v-icon icon="mdi-plus-circle" size="18" class="absolute -right-1 -bottom-1 rounded-full bg-[#1E1E1E]" />
          </span>
          <span class="text-sm">{{ t`Create mission path` }}</span>
          <span class="text-xs opacity-70">
            {{ t`The terrain under the mission is checked once the mission has waypoints.` }}
          </span>
        </div>
        <div
          v-else-if="loadingText"
          class="absolute inset-0 flex flex-col items-center justify-center gap-y-3 bg-[#00000055]"
          role="status"
        >
          <img :src="propellerLogo" alt="" class="terrain-propeller w-[44px] h-[44px]" />
          <span class="text-sm">{{ loadingText }}</span>
        </div>
      </Transition>
    </div>
  </DrawerPanel>
</template>

<script setup lang="ts">
import { msgid, ngettext, t } from 'ttag'
import { computed, ref, watch } from 'vue'

import propellerLogo from '@/assets/blue-robotics-logo-white.svg'
import DrawerPanel from '@/components/DrawerPanel.vue'
import LoadingText from '@/components/LoadingText.vue'
import TerrainProfileChart from '@/components/terrain/TerrainProfileChart.vue'
import TerrainQuickActionsPanel from '@/components/terrain/TerrainQuickActionsPanel.vue'
import TerrainSafeAltitude from '@/components/terrain/TerrainSafeAltitude.vue'
import TerrainSightPanel from '@/components/terrain/TerrainSightPanel.vue'
import TerrainVehiclePanel from '@/components/terrain/TerrainVehiclePanel.vue'
import TerrainWarningTriangle from '@/components/terrain/TerrainWarningTriangle.vue'
import { goToMenuPage } from '@/composables/menuRouting'
import { openSnackbar } from '@/composables/snackbar'
import {
  type TerrainDockFinding,
  type TerrainMissionEdit,
  provideTerrainDock,
  TERRAIN_WARNING_ICON,
} from '@/composables/terrain/useTerrainDock'
import { automaticBathymetrySource, BATHYMETRY_SOURCES } from '@/libs/terrain/bathymetry'
import { terrainAttribution } from '@/libs/terrain/elevation-service'
import type { TerrainFindingKind, TerrainProfileSample } from '@/libs/terrain/mission-profile'
import { profileStretch } from '@/libs/terrain/mission-terrain'
import type { ProfileChartBand, ProfileChartShallows } from '@/libs/terrain/profile-chart'
import { type PathSightStretch, PATH_SIGHT_COLORS } from '@/libs/terrain/sight-analysis'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import { SubMenuComponentName } from '@/types/general'
import type { BathymetrySourceId } from '@/types/terrain'

type TerrainTab = 'findings' | 'actions' | 'sight' | 'vehicle'

const emit = defineEmits<{
  (event: 'select-waypoint', waypointIndex: number): void
  (event: 'replace-mission', mission: TerrainMissionEdit, message: string): void
  (event: 'update:open', open: boolean): void
}>()

const terrainStore = useTerrainStore()
const missionStore = useMissionStore()
const dock = provideTerrainDock((mission, message) => emit('replace-mission', mission, message))
const currentTab = ref<TerrainTab>('findings')

const analysis = computed(() => dock.terrain.analysis.value)
const noMission = computed(() => missionStore.currentPlanningWaypoints.length === 0)

// Until the first check of a mission comes back, which waits out the live check's debounce, nothing describes it yet.
const firstCheck = computed(
  () => !analysis.value && !dock.terrain.analysisError.value && dock.terrain.points().length > 1
)

const loadingText = computed(() => {
  if (firstCheck.value) return t`Checking the terrain...`
  return dock.safeAltitude.recalculating.value ? t`Recalculating heights...` : ''
})

// Recalculating heights already covers the whole panel, so only a plain re-check covers the chart alone.
const rechecking = computed(() => dock.terrain.analyzing.value && !dock.safeAltitude.recalculating.value)

const TABS: {
  /**
   * Tab identifier.
   */
  id: TerrainTab
  /**
   * Tab title.
   */
  label: string
}[] = [
  { id: 'findings', label: 'Findings' },
  { id: 'actions', label: 'Quick actions' },
  { id: 'sight', label: 'Link and sight' },
  { id: 'vehicle', label: 'Vehicle' },
]

const marine = computed(() => ['surface', 'underwater'].includes(dock.terrain.vehicleClass.value))

const sourceTagHelp = computed(() => {
  const { bathymetrySourceId } = terrainStore
  const land = terrainStore.effectiveSource.label
  const depthsByChoice: Partial<Record<BathymetrySourceId, string>> = {
    auto: t`the most detailed bathymetry published for each point`,
    none: t`${land} itself`,
  }
  const depths = depthsByChoice[bathymetrySourceId] ?? BATHYMETRY_SOURCES[bathymetrySourceId].label
  const model = `Heights on the chart come from ${land}, and depths from ${depths}.`
  const water = marine.value ? '' : ' The blue strip along the bottom marks water, from OpenStreetMap.'
  return `${model}${water} The sources are picked in Settings > Mission > Terrain.`
})

const sourceTagText = computed(() => {
  const { bathymetrySourceId } = terrainStore
  const points = analysis.value?.points.map(({ coordinates }) => coordinates) ?? []
  const automaticName = BATHYMETRY_SOURCES[automaticBathymetrySource(points)].name
  const depths =
    bathymetrySourceId === 'auto' ? t`Auto (${automaticName})` : BATHYMETRY_SOURCES[bathymetrySourceId].name
  return t`Land: ${terrainStore.effectiveSource.name} - Bathymetry: ${depths}`
})

// The tooltip is plain text, so the credit's links are reduced to their text.
const sourceCredit = (): string => terrainAttribution().replace(/<[^>]+>/g, '')

// The chart and the list share one band: the findings tab splits it 60/40, the other tabs leave the list to its content.
const PROFILE_BAND_PX = 380
const DEFAULT_CHART_PX = 160
const findingsTab = computed(() => currentTab.value === 'findings')
const chartHeightPx = computed(() => (findingsTab.value ? PROFILE_BAND_PX * 0.6 : DEFAULT_CHART_PX))
const listHeightStyle = computed(() => {
  const findingsPx = `${PROFILE_BAND_PX * 0.4}px`
  return findingsTab.value
    ? { minHeight: findingsPx, maxHeight: findingsPx }
    : { minHeight: '0px', maxHeight: `${PROFILE_BAND_PX - DEFAULT_CHART_PX}px` }
})

const onOpenMissionSettings = (): void => {
  logUserAction('Opened the mission settings from the terrain panel')
  goToMenuPage(SubMenuComponentName.SettingsMission)
}

const hoveredFindingKey = ref<string | null>(null)
// Touch has no hover, so a tap pins the highlight until the next tap on the same card or stretch.
const pinnedFindingKeys = ref<string[]>([])

// A card removed under the pointer never reports the pointer leaving, so a key no finding has is ignored.
const pointedFinding = computed(() => dock.findings.value.find(({ key }) => key === hoveredFindingKey.value))

// Finding keys are positions in the list, so a pin would land on another finding once the list changes.
watch(dock.findings, () => (pinnedFindingKeys.value = []))

// Pointing at a card highlights its stretch on the chart, and pointing at the chart highlights the cards under it.
const isHighlighted = (finding: TerrainDockFinding): boolean => {
  if (pointedFinding.value) return pointedFinding.value.key === finding.key
  if (pinnedFindingKeys.value.length > 0) return pinnedFindingKeys.value.includes(finding.key)
  const distanceM = dock.hover.value?.distanceM
  return distanceM !== undefined && distanceM >= finding.fromM && distanceM <= finding.toM
}

const isSightHighlighted = (stretch: PathSightStretch): boolean => {
  if (dock.sightLegendKind.value) return dock.sightLegendKind.value === stretch.kind
  const finding = dock.findings.value.find(
    ({ sightKind, fromM }) => sightKind === stretch.kind && fromM === stretch.fromM
  )
  if (finding) return isHighlighted(finding)
  const distanceM = dock.hover.value?.distanceM
  return distanceM !== undefined && distanceM >= stretch.fromM && distanceM <= stretch.toM
}

// Stretches in sight cover most missions, so they are only shaded while pointed at.
const chartBands = computed<ProfileChartBand[]>(() => [
  ...dock.pathSight.value.flatMap((stretch) => {
    const highlighted = isSightHighlighted(stretch)
    if (stretch.kind === 'in-sight' && !highlighted) return []
    return [{ fromM: stretch.fromM, toM: stretch.toM, color: PATH_SIGHT_COLORS[stretch.kind], highlighted }]
  }),
  ...dock.findings.value
    .filter(({ sightKind }) => !sightKind)
    .map((finding) => ({
      fromM: finding.fromM,
      toM: finding.toM,
      color: finding.color,
      highlighted: isHighlighted(finding),
    })),
])

const coastlineM = computed(() =>
  (analysis.value?.profile.findings ?? []).filter(({ kind }) => kind === 'reaches-coastline').map(({ fromM }) => fromM)
)

// Loaded predictions set the water level for the time of day, so the range is only outlined without them.
const tideOutlineM = computed(() => {
  return marine.value ? terrainStore.settings.tideRangeM : 0
})

// Kinds read as possibly shallow water on the chart, with the land the model reads there drawn under the low tide.
const SHALLOW_KINDS: Partial<Record<TerrainFindingKind, Omit<ProfileChartShallows, 'fromM' | 'toM'>>> = {
  'possible-shallows': {
    raised: true,
    description: t`The coastline map shows water here, but the bottom may come close to the surface. Check a nautical chart.`,
  },
  'unmapped-shallows': {
    raised: true,
    description: t`The bottom may come close to the surface here. Check a nautical chart.`,
  },
  'aground': { raised: false, description: t`The bottom may be above the keel here. Check a nautical chart.` },
  'low-under-keel': {
    raised: false,
    description: t`The bottom may come close to the keel here. Check a nautical chart.`,
  },
}

const WITHOUT_COASTLINE = t`Without a coastline map, the terrain data cannot tell whether this region is navigable. Load the coastline, or check a nautical chart.`

const chartShallows = computed<ProfileChartShallows[]>(() => {
  const coastlineLoaded = !!dock.terrain.context().coastlineCoverage
  return (analysis.value?.profile.findings ?? []).flatMap(({ kind, fromM, toM }) => {
    const shallows = SHALLOW_KINDS[kind]
    if (!shallows) return []
    const description = kind === 'unmapped-shallows' && !coastlineLoaded ? WITHOUT_COASTLINE : shallows.description
    return [{ fromM, toM, ...shallows, description }]
  })
})

const chartCollisions = computed(() =>
  dock.findings.value
    .filter(({ icon }) => icon === TERRAIN_WARNING_ICON)
    .map(({ fromM, toM, message }) => ({ fromM, toM, description: message }))
)

const status = computed(() => {
  if (dock.terrain.analyzing.value) return { text: t`Checking`, icon: '', color: '#FFFFFFB3', busy: true }
  if (dock.terrain.analysisError.value)
    return { text: t`Check failed`, icon: 'mdi-alert-circle-outline', color: '#FF5252', busy: false }
  if (!analysis.value)
    return { text: t`Not checked`, icon: 'mdi-minus-circle-outline', color: '#FFFFFFB3', busy: false }
  const count = dock.findings.value.length
  if (count === 0) return { text: t`Clear`, icon: 'mdi-check-circle-outline', color: '#66BB6A', busy: false }
  const text = ngettext(msgid`${count} to review`, `${count} to review`, count)
  return { text, icon: 'mdi-alert-outline', color: '#FF8800', busy: false }
})

const emptyMessage = computed(() => {
  if (dock.terrain.analysisError.value) return t`Could not read the terrain: ${dock.terrain.analysisError.value}`
  return t`Add at least one waypoint to see the terrain under the mission.`
})

const setOpen = (open: boolean): void => {
  dock.open.value = open
  if (!open) dock.ghostDistanceM.value = null
  emit('update:open', open)
}

const onToggleOpen = (open: boolean): void => {
  logUserAction(`${open ? 'Opened' : 'Closed'} the terrain panel`)
  setOpen(open)
}

watch(noMission, (cleared) => cleared && dock.open.value && setOpen(false))

const onSelectTab = (tab: TerrainTab): void => {
  logUserAction(`Switched to the "${tab}" terrain tab`)
  currentTab.value = tab
}

const onSelectWaypoint = (waypointIndex: number): void => {
  logUserAction(`Selected waypoint ${waypointIndex + 1} from the terrain profile`)
  emit('select-waypoint', waypointIndex)
}

const onRebuildTerrain = async (): Promise<void> => {
  logUserAction('Rebuilt the terrain model from the terrain panel')
  await dock.terrain.rebuild()
  const error = dock.terrain.analysisError.value
  openSnackbar(
    error
      ? { variant: 'error', message: t`Could not rebuild the terrain model: ${error}`, duration: 5000 }
      : { variant: 'success', message: t`Rebuilt the terrain model.`, duration: 3000 }
  )
}

const onStoreOffline = (): void => {
  logUserAction('Started storing the terrain of the visible map for offline use')
  const bounds = dock.visibleBounds()
  if (bounds) void terrainStore.downloadArea(bounds)
}

const onCancelOffline = (): void => {
  logUserAction('Stopped storing terrain for offline use')
  terrainStore.cancelDownload()
}

const onCardPointer = (event: PointerEvent, key: string | null): void => {
  if (event.pointerType !== 'touch') hoveredFindingKey.value = key
}

const togglePinnedFindings = (keys: string[]): void => {
  const pinned = pinnedFindingKeys.value
  if (keys.length === 0 && pinned.length === 0) return
  const unpin = keys.length === 0 || (keys.length === pinned.length && keys.every((key) => pinned.includes(key)))
  pinnedFindingKeys.value = unpin ? [] : keys
  if (unpin) return logUserAction('Removed the terrain finding highlight')
  logUserAction(`Highlighted the ${keys.join(', ')} terrain finding${keys.length > 1 ? 's' : ''}`)
}

const onCardTap = (event: PointerEvent, finding: TerrainDockFinding): void => {
  if (event.pointerType !== 'touch' || (event.target as Element).closest('button')) return
  togglePinnedFindings([finding.key])
}

const onChartTap = (sample: TerrainProfileSample): void => {
  const under = dock.findings.value.filter(({ fromM, toM }) => sample.distanceM >= fromM && sample.distanceM <= toM)
  togglePinnedFindings(under.map(({ key }) => key))
}

const onFocusFinding = (finding: TerrainDockFinding): void => {
  logUserAction(`Showed the "${finding.key}" terrain finding on the map`)
  const samples = analysis.value?.profile.samples ?? []
  if (samples.length > 0) dock.focus(profileStretch(samples, finding.fromM, finding.toM))
}
</script>

<style scoped>
.terrain-propeller {
  animation: terrain-propeller 4s infinite;
}

/* A slow creep, then a wind-up into quick spins, ending on whole turns so the loop has no seam. */
@keyframes terrain-propeller {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
  }
  50% {
    transform: rotate(80deg);
    animation-timing-function: cubic-bezier(0.35, 0, 0.45, 1);
  }
  100% {
    transform: rotate(1440deg);
  }
}
</style>
