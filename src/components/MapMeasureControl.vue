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
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { t } from 'ttag'
import { type CSSProperties, computed, defineModel, ref, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { type MeasureTool, useMapMeasure } from '@/composables/map/useMapMeasure'
import { type MeasureColorScheme, MEASURE_SCHEME_COLORS } from '@/libs/map/measure-layers'
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
    /** Inline style positioning the activator button */
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

const activeStyle = { backgroundColor: '#2563eb', color: '#FFFFFF' }

const anyActive = computed(() => measure.tool.value !== null)

const onDialToggle = (open: boolean): void => {
  dialOpen.value = open
  logUserAction(open ? 'Opened the map measurements menu' : 'Closed the map measurements menu')
}

const toggleTool = (tool: MeasureTool): void => {
  measure.setTool(measure.tool.value === tool ? null : tool)
  if (measure.tool.value) dialOpen.value = false
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
  logUserAction('Cleared the measurements on the map')
}

const blockedReason = t`Finish the path, survey or fence being drawn first`

const items = computed<DialItem[]>(() => [
  {
    id: 'distance',
    icon: 'mdi-tape-measure',
    tooltip: props.blocked ? blockedReason : t`Distance and bearing: click points, then the check mark to keep it`,
    active: measure.tool.value === 'distance',
    disabled: props.blocked,
    onClick: () => toggleTool('distance'),
  },
  {
    id: 'clear',
    icon: 'mdi-eraser',
    tooltip: measure.hasMeasurement.value ? t`Clear the measurements` : t`Nothing measured to clear`,
    active: false,
    disabled: !measure.hasMeasurement.value,
    onClick: clearMeasurements,
  },
])
</script>
