<template>
  <v-speed-dial
    :model-value="dialOpen"
    location="top center"
    transition="slide-y-reverse-transition"
    content-class="speed-dial-glow"
    @update:model-value="onDialToggle"
  >
    <template #activator="{ props: activatorProps }">
      <v-tooltip location="top" :text="t`Measurements`" :disabled="dialOpen">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-show="showActivator"
            v-bind="{ ...activatorProps, ...tooltipProps }"
            :class="[anyActive ? 'text-white' : 'bg-slate-50', 'absolute m-3 rounded-sm shadow-sm text-[14px]']"
            :style="[interfaceStore.globalGlassMenuStyles, anyActive ? activeStyle : {}, activatorStyle ?? {}]"
            elevation="2"
            size="x-small"
            icon="mdi-ruler"
            :aria-label="t`Measurements`"
          />
        </template>
      </v-tooltip>
    </template>

    <v-tooltip v-for="item in items" :key="item.id" location="left" :text="item.tooltip">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps">
          <v-btn
            :class="[
              item.active ? 'text-white' : 'bg-slate-50',
              'rounded-sm shadow-sm text-[14px]',
              'disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50',
            ]"
            :style="[interfaceStore.globalGlassMenuStyles, item.active ? activeStyle : {}]"
            elevation="2"
            size="x-small"
            :icon="item.icon"
            :disabled="item.disabled"
            :aria-label="item.tooltip"
            @click.stop="item.onClick"
          />
        </div>
      </template>
    </v-tooltip>
    <v-menu
      key="colors"
      :model-value="colorsOpen"
      location="start"
      :offset="18"
      :close-on-content-click="false"
      transition="slide-x-reverse-transition"
      content-class="speed-dial-glow"
      @update:model-value="onColorsToggle"
    >
      <template #activator="{ props: menuProps }">
        <v-tooltip location="left" :text="colorsTooltip" :disabled="colorsOpen">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="{ ...menuProps, ...tooltipProps }"
              class="rounded-sm shadow-sm"
              :style="interfaceStore.globalGlassMenuStyles"
              elevation="2"
              size="x-small"
              icon
              :aria-label="colorsTooltip"
            >
              <span class="absolute inset-[2px] rounded-sm" :style="{ backgroundColor: currentScheme.color }" />
            </v-btn>
          </template>
        </v-tooltip>
      </template>
      <div class="flex flex-row-reverse gap-2">
        <v-tooltip v-for="scheme in otherSchemes" :key="scheme.id" location="top" :text="scheme.label">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              class="rounded-sm shadow-sm"
              :style="interfaceStore.globalGlassMenuStyles"
              elevation="2"
              size="x-small"
              icon
              :aria-label="scheme.label"
              @click.stop="selectColorScheme(scheme.id)"
            >
              <span class="absolute inset-[2px] rounded-sm" :style="{ backgroundColor: scheme.color }" />
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </v-menu>
  </v-speed-dial>
  <MeasureProfilePanel
    v-if="showProfile"
    class="absolute left-1/2 -translate-x-1/2"
    :style="profileStyle"
    :profile="profile"
    :loading="profileLoading"
    :ruler-number="measure.profiled.value?.number ?? 0"
    @close="measure.closeProfile"
  />
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { t } from 'ttag'
import { type CSSProperties, computed, defineModel, ref, watch } from 'vue'

import MeasureProfilePanel from '@/components/MeasureProfilePanel.vue'
import { useMapContext } from '@/composables/map/useMapContext'
import { useMapCursorTerrain } from '@/composables/map/useMapCursorTerrain'
import {
  type MeasureColorScheme,
  type MeasureTool,
  MEASURE_SCHEME_COLORS,
  useMapMeasure,
} from '@/composables/map/useMapMeasure'
import { useMapTetherReach } from '@/composables/map/useMapTetherReach'
import { useMapVehicleRange } from '@/composables/map/useMapVehicleRange'
import { useMeasureProfile } from '@/composables/map/useMeasureProfile'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

const props = withDefaults(
  defineProps<{
    /** Vehicle coordinates, when available */
    vehiclePosition?: WaypointCoordinates
    /** Home coordinates, when available */
    home?: WaypointCoordinates
    /** Waypoints the map draws, which measurements snap to */
    waypoints: Waypoint[]
    /** Whether another drawing mode owns the map's clicks */
    blocked?: boolean
    /** Speed distances are timed at, in m/s, null for the default */
    cruiseSpeed: number | null
    /** Inline style positioning the activator button; the profile panel sits above its bottom offset */
    activatorStyle?: CSSProperties
    /** Whether the activator is shown; the readouts stay on the map while it is hidden */
    showActivator?: boolean
  }>(),
  { vehiclePosition: undefined, home: undefined, blocked: false, activatorStyle: undefined, showActivator: true }
)

type DialItem = {
  /** Stable key */
  id: string
  /** Icon of the button */
  icon: string
  /** What the button does, or why it cannot */
  tooltip: string
  /** Whether what it toggles is on */
  active: boolean
  /** Whether it cannot be used right now */
  disabled: boolean
  /** Click handler */
  onClick: () => void
}

const DEFAULT_TRAVEL_SPEED_MPS = 3
const DEFAULT_COLOR_SCHEME: MeasureColorScheme = 'axolotl-pink'

const interfaceStore = useAppInterfaceStore()
const { map, mapReady } = useMapContext()

const dialOpen = defineModel<boolean>('open', { default: false })
const showCursorTerrain = ref(false)
const showVehicleRange = ref(false)
const showTetherReach = ref(false)
const colorsOpen = ref(false)
const storedColorScheme = useStorage<string>('cockpit-map-measure-color-scheme', DEFAULT_COLOR_SCHEME)
// The stored value can predate a scheme being removed, or be edited by hand.
const colorScheme = computed<MeasureColorScheme>(() =>
  Object.keys(MEASURE_SCHEME_COLORS).includes(storedColorScheme.value)
    ? (storedColorScheme.value as MeasureColorScheme)
    : DEFAULT_COLOR_SCHEME
)

const measure = useMapMeasure(map, mapReady, {
  vehiclePosition: () => props.vehiclePosition,
  home: () => props.home,
  waypoints: () => props.waypoints,
  cruiseSpeedMps: () => props.cruiseSpeed ?? DEFAULT_TRAVEL_SPEED_MPS,
  isBlocked: () => props.blocked,
  colorScheme: () => colorScheme.value,
})
const cursorTerrain = useMapCursorTerrain(map, mapReady, {
  enabled: () => showCursorTerrain.value,
  vehiclePosition: () => props.vehiclePosition,
  home: () => props.home,
  waypoints: () => props.waypoints,
  isBlocked: () => props.blocked,
})
useMapVehicleRange(map, mapReady, {
  enabled: () => showVehicleRange.value,
  vehiclePosition: () => props.vehiclePosition,
  home: () => props.home,
  colorScheme: () => colorScheme.value,
})
const tether = useMapTetherReach(map, mapReady, {
  enabled: () => showTetherReach.value,
  vehiclePosition: () => props.vehiclePosition,
  waypoints: () => props.waypoints,
  colorScheme: () => colorScheme.value,
})

const rulerVertices = computed(() => measure.profiled.value?.vertices ?? [])
const showProfile = computed(() => measure.profiled.value !== null)
const { profile, loading: profileLoading } = useMeasureProfile(rulerVertices, () => showProfile.value)
const hasAnything = computed(() => measure.hasMeasurement.value || cursorTerrain.hasFlags.value)

const profileStyle = computed<CSSProperties>(() => ({
  bottom: `calc(${props.activatorStyle?.bottom ?? '0px'} + 3.5rem)`,
  zIndex: props.activatorStyle?.zIndex,
}))

const activeStyle = { backgroundColor: '#2563eb', color: '#FFFFFF' }

const anyActive = computed(
  () => measure.tool.value !== null || showCursorTerrain.value || showVehicleRange.value || showTetherReach.value
)

const onDialToggle = (open: boolean): void => {
  dialOpen.value = open
  logUserAction(open ? 'Opened the map measurements menu' : 'Closed the map measurements menu')
}

const toggleTool = (tool: MeasureTool): void => {
  measure.setTool(measure.tool.value === tool ? null : tool)
  if (measure.tool.value) dialOpen.value = false
}

const toggle = (shown: typeof showCursorTerrain, name: string): void => {
  shown.value = !shown.value
  logUserAction(`${shown.value ? 'Showed' : 'Hid'} the ${name} on the map`)
}

const colorSchemeLabels: Record<MeasureColorScheme, string> = {
  'blue': t`Blue`,
  'garibaldi-orange': t`Garibaldi orange`,
  'axolotl-pink': t`Axolotl pink`,
  'moray-green': t`Moray green`,
}
const colorSchemes = (Object.keys(colorSchemeLabels) as MeasureColorScheme[]).map((id) => ({
  id,
  label: colorSchemeLabels[id],
  color: MEASURE_SCHEME_COLORS[id],
}))

const currentScheme = computed(() => colorSchemes.find(({ id }) => id === colorScheme.value) ?? colorSchemes[0])
const otherSchemes = computed(() => colorSchemes.filter(({ id }) => id !== colorScheme.value))
const colorsTooltip = computed(() => {
  const current = currentScheme.value.label
  return t`Measurement colors: ${current}`
})

const onColorsToggle = (open: boolean): void => {
  colorsOpen.value = open
  logUserAction(open ? 'Opened the map measurement colors' : 'Closed the map measurement colors')
}

const selectColorScheme = (scheme: MeasureColorScheme): void => {
  storedColorScheme.value = scheme
  colorsOpen.value = false
  logUserAction(`Switched the map measurement colors to ${scheme}`)
}

watch(dialOpen, (open) => {
  if (!open) colorsOpen.value = false
})

const clearMeasurements = (): void => {
  measure.clear()
  cursorTerrain.clearFlags()
  logUserAction('Cleared the measurements and terrain flags on the map')
}

const blockedReason = t`Finish the path, survey or fence being drawn first`

const items = computed<DialItem[]>(() => {
  const list: DialItem[] = [
    {
      id: 'distance',
      icon: 'mdi-tape-measure',
      tooltip: props.blocked ? blockedReason : t`Distance and bearing: click points, then the check mark to keep it`,
      active: measure.tool.value === 'distance',
      disabled: props.blocked,
      onClick: () => toggleTool('distance'),
    },
    {
      id: 'area',
      icon: 'mdi-vector-polygon-variant',
      tooltip: props.blocked ? blockedReason : t`Area and perimeter: click corners, then the check mark to keep it`,
      active: measure.tool.value === 'area',
      disabled: props.blocked,
      onClick: () => toggleTool('area'),
    },
    {
      id: 'terrain',
      icon: 'mdi-image-filter-hdr',
      tooltip: t`Terrain under the cursor, click the map to flag its height`,
      active: showCursorTerrain.value,
      disabled: false,
      onClick: () => toggle(showCursorTerrain, 'terrain readout under the cursor'),
    },
    {
      id: 'vehicle-range',
      icon: 'mdi-navigation-variant',
      tooltip: props.vehiclePosition
        ? t`Range and bearing from the vehicle to home and the next waypoint`
        : t`Vehicle position unknown`,
      active: showVehicleRange.value,
      disabled: !props.vehiclePosition && !showVehicleRange.value,
      onClick: () => toggle(showVehicleRange, 'vehicle range and bearing'),
    },
  ]
  if (tether.available.value) {
    list.push({
      id: 'tether',
      icon: 'mdi-cable-data',
      tooltip: t`Tether reach from the base station, counting depth`,
      active: showTetherReach.value,
      disabled: false,
      onClick: () => toggle(showTetherReach, 'tether reach'),
    })
  }
  list.push({
    id: 'clear',
    icon: 'mdi-eraser',
    tooltip: hasAnything.value ? t`Clear the measurements and flags` : t`Nothing measured to clear`,
    active: false,
    disabled: !hasAnything.value,
    onClick: clearMeasurements,
  })
  return list
})
</script>
