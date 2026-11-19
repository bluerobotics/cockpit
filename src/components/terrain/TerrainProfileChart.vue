<template>
  <div class="relative w-full select-none">
    <div ref="scrollEl" :class="{ 'overflow-x-auto overflow-y-hidden': widthScale > 1 }" @wheel="onWheel">
      <div
        ref="chartEl"
        class="relative transition-[height] duration-300 ease-out"
        :style="{ width: `${widthScale * 100}%`, height: `${heightPx}px` }"
        @pointerdown="onMove"
        @pointermove="onMove"
        @pointerup="onTap"
        @pointerleave="onLeave"
      >
        <svg
          :viewBox="`0 0 ${PROFILE_CHART_WIDTH} ${PROFILE_CHART_HEIGHT}`"
          preserveAspectRatio="none"
          class="absolute inset-0 w-full h-full"
          role="img"
          :aria-label="ariaSummary"
        >
          <rect
            v-for="(band, index) in bandRects"
            :key="index"
            :x="band.x"
            :width="band.width"
            y="0"
            :height="PROFILE_CHART_HEIGHT"
            :fill="band.color"
            :fill-opacity="band.opacity"
            class="transition-[fill-opacity] duration-150"
          />
          <path :d="geometry.tideBand" fill="#81D4FA" fill-opacity="0.1" />
          <path :d="geometry.waterArea" fill="#1E88E5" fill-opacity="0.35" />
          <path :d="geometry.uncertaintyBand" fill="#FFFFFF" fill-opacity="0.14" />
          <path :d="geometry.groundArea" fill="#8D6E63" fill-opacity="0.75" />
          <path :d="geometry.raisedSeabedArea" fill="#D7B98E" fill-opacity="0.9" />
          <path :d="geometry.waterBodyArea" fill="#29B6F6" fill-opacity="0.75" />
          <path
            v-if="compareModel"
            :d="geometry.modelLine"
            stroke="#000000"
            stroke-width="2"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <path
            v-else
            :d="geometry.replacedModelLine"
            stroke="#C19A6B"
            stroke-width="1"
            stroke-dasharray="4 3"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <path
            :d="geometry.tideLines"
            stroke="#81D4FA"
            stroke-width="1"
            stroke-dasharray="6 4"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <path
            :d="geometry.waterLine"
            stroke="#81D4FA"
            stroke-width="1.5"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <path
            :d="geometry.vehicleLine"
            stroke="#4FC3F7"
            stroke-width="2"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <path
            :d="geometry.uploadLine"
            stroke="#FFFFFF"
            stroke-width="1.5"
            stroke-dasharray="5 3"
            fill="none"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-for="x in markerXs"
            :key="x"
            :x1="x"
            :x2="x"
            y1="0"
            :y2="PROFILE_CHART_HEIGHT"
            stroke="#FFFFFF"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-for="x in coastlineXs"
            :key="`coastline-${x}`"
            :x1="x"
            :x2="x"
            y1="0"
            :y2="PROFILE_CHART_HEIGHT"
            stroke="#FF8800"
            stroke-width="2"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <span
          v-for="dot in uploadDots"
          :key="dot.key"
          class="absolute w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#0B1A24] pointer-events-none"
          :style="{ left: `${dot.percent}%`, top: `${dot.topPercent}%` }"
        />
        <button
          v-for="marker in labelMarkers"
          :key="marker.waypointIndex"
          type="button"
          class="absolute top-[2px] rounded-sm bg-[#FFFFFF22] hover:bg-[#FFFFFF44] hover:z-10 focus:z-10"
          :class="[
            LABEL_SHIFT[edgeOf(marker.percent)],
            compact
              ? 'px-[2px] text-[8px] leading-3 hover:px-1 hover:text-[10px] hover:leading-4 focus:px-1 focus:text-[10px] focus:leading-4'
              : 'px-1 text-[10px] leading-4',
          ]"
          :style="{ left: `${marker.percent}%` }"
          :aria-label="selectWaypointLabel(marker.waypointIndex)"
          @click="emit('select-waypoint', marker.waypointIndex)"
        >
          {{ marker.waypointIndex + 1 }}
        </button>
        <template v-if="heightsEditable">
          <button
            v-for="marker in heightHandles"
            :key="`height-${marker.waypointIndex}`"
            type="button"
            class="absolute w-5 h-5 -translate-y-1/2 flex items-center cursor-ns-resize touch-none group hover:z-10 focus:z-10"
            :class="HANDLE_SHIFT[edgeOf(marker.percent)]"
            :style="{ left: `${marker.percent}%`, top: `${marker.topPercent}%` }"
            :aria-label="heightHandleLabel(marker.waypointIndex)"
            @pointerdown="onHandleDown($event, marker)"
            @pointermove="onHandleMove"
            @pointerup="onHandleUp"
            @pointercancel="drag = null"
            @keydown.up.prevent="nudge(marker, $event.shiftKey ? 10 : 1)"
            @keydown.down.prevent="nudge(marker, $event.shiftKey ? -10 : -1)"
          >
            <span
              class="w-[10px] h-[10px] rounded-full border-2 border-[#4FC3F7] bg-[#0B1A24] transition-transform"
              :class="
                compact && drag?.waypointIndex !== marker.waypointIndex
                  ? 'scale-[0.55] group-hover:scale-100 group-focus:scale-100'
                  : 'group-hover:scale-125 group-focus-visible:scale-125'
              "
            />
          </button>
          <span
            v-if="dragLabel"
            class="absolute px-1 rounded-sm text-[10px] leading-4 bg-[#000000AA] whitespace-nowrap pointer-events-none"
            :class="[
              dragLabel.topPercent < 20 ? 'mt-2' : '-translate-y-1/2',
              dragLabel.percent > 60 ? '-translate-x-full -ml-3' : 'ml-3',
            ]"
            :style="{ left: `${dragLabel.percent}%`, top: `${dragLabel.topPercent}%` }"
          >
            {{ dragLabel.text }}
          </span>
        </template>
        <div
          v-for="marker in shallowsMarkers"
          :key="marker.key"
          class="absolute bottom-4 -translate-x-1/2"
          :style="{ left: `${marker.percent}%` }"
        >
          <TerrainShallowsMarker :bbox="marker.bbox" :description="marker.description" />
        </div>
        <div
          v-for="marker in warningMarkers"
          :key="marker.key"
          class="absolute bottom-4 -translate-x-1/2"
          :style="{ left: `${marker.percent}%` }"
        >
          <v-tooltip location="top" max-width="320" open-on-click @update:model-value="onToggleWarning">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon
                variant="text"
                size="x-small"
                class="!w-[22px] !h-[22px]"
                :aria-label="marker.sections.map(({ title }) => title).join(', ')"
              >
                <TerrainWarningTriangle :size="18" />
              </v-btn>
            </template>
            <div class="flex flex-col gap-y-1 text-xs">
              <template v-for="section in marker.sections" :key="section.title">
                <p class="font-semibold">{{ section.title }}</p>
                <p v-for="message in section.messages" :key="message">{{ message }}</p>
              </template>
            </div>
          </v-tooltip>
        </div>
        <div
          v-if="hovered && !drag?.active"
          class="absolute top-6 px-2 py-1 rounded-md text-[10px] leading-4 pointer-events-none bg-[#000000AA] whitespace-nowrap"
          :class="hoverOnRight ? '-translate-x-full -ml-2' : 'ml-2'"
          :style="{ left: `${hoverFraction * 100}%` }"
        >
          <p>{{ alongLabel(hovered.distanceM) }}</p>
          <p v-if="hoveredOverWater">{{ t`Over water` }}</p>
          <p v-if="hoveredOnShoal">{{ t`Possible shallow water, depth unknown` }}</p>
          <p v-else-if="hovered.groundM !== null">{{ heightLabel }} {{ hovered.groundM.toFixed(1) }} m</p>
          <p v-if="hovered.pathAmslM !== null && vehicleClass !== 'surface'">
            {{ t`Vehicle` }} {{ hovered.pathAmslM.toFixed(1) }} m
          </p>
          <p v-if="hovered.clearanceM !== null && !hoveredOnShoal">
            {{ clearanceLabel }} {{ hovered.clearanceM.toFixed(1) }} m
          </p>
        </div>
      </div>
    </div>
    <div
      class="absolute inset-x-0 top-0 pointer-events-none transition-[height] duration-300 ease-out"
      :style="{ height: `${heightPx}px` }"
    >
      <span class="absolute left-1 top-5 text-[10px] opacity-60">{{ Math.round(geometry.maxM) }} m</span>
      <span class="absolute left-1 bottom-1 text-[10px] opacity-60">{{ Math.round(geometry.minM) }} m</span>
      <span
        v-if="tideLabel"
        class="absolute right-1 px-1 rounded-sm text-[10px] leading-4 text-[#B3E5FC] bg-[#000000AA] whitespace-nowrap"
        :style="{ top: `${tideLabel.topPercent}%` }"
      >
        {{ tideLabel.text }}
      </span>
      <span
        v-if="uploadPath.length > 0"
        class="absolute right-1 bottom-1 flex items-center gap-x-1.5 px-1.5 rounded-sm text-[10px] leading-4 bg-[#FFFFFF11] whitespace-nowrap"
      >
        <span class="flex items-center" aria-hidden="true">
          <span class="w-[7px] h-[7px] rounded-full border border-white bg-[#0B1A24]" />
          <svg width="19" height="4" viewBox="0 0 19 4">
            <line x1="0" y1="2" x2="19" y2="2" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="5 3" />
          </svg>
          <span class="w-[7px] h-[7px] rounded-full border border-white bg-[#0B1A24]" />
        </span>
        {{ t`Path sent on upload, with the waypoints it adds` }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { t } from 'ttag'
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'

import TerrainShallowsMarker from '@/components/terrain/TerrainShallowsMarker.vue'
import TerrainWarningTriangle from '@/components/terrain/TerrainWarningTriangle.vue'
import { paddedBbox } from '@/libs/hazards/hazard-areas'
import type { ProfilePoint, TerrainProfileSample, TerrainVehicleClass } from '@/libs/terrain/mission-profile'
import type { UploadPathPoint } from '@/libs/terrain/mission-terrain'
import {
  type ProfileChartBand,
  type ProfileChartOptions,
  type ProfileChartShallows,
  type ProfileChartWarning,
  PROFILE_CHART_HEIGHT,
  PROFILE_CHART_WIDTH,
  profileChartGeometry,
  sampleAtFraction,
  spacedLabels,
  withPointShifted,
} from '@/libs/terrain/profile-chart'

const props = defineProps<{
  /**
   * Profile stations, in order.
   */
  samples: TerrainProfileSample[]
  /**
   * Path points the profile runs through.
   */
  points: ProfilePoint[]
  /**
   * How the vehicle meets the terrain.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Model uncertainty, drawn as a band around the ground.
   */
  uncertaintyM: number
  /**
   * Water surface height.
   */
  waterLevelM: number
  /**
   * Hull depth below the waterline.
   */
  draftM: number
  /**
   * Expected difference between low and high tide to outline around the water level, 0 for none.
   */
  tideRangeM: number
  /**
   * Stretches of possibly shallow water to label.
   */
  shallows: ProfileChartShallows[]
  /**
   * Stretches to mark with a warning triangle, such as where the vehicle goes into the terrain.
   */
  warnings: ProfileChartWarning[]
  /**
   * Stretches to shade.
   */
  bands: ProfileChartBand[]
  /**
   * Distances to mark with a vertical line, such as the ghost run's vehicle.
   */
  markersM: number[]
  /**
   * Distances where the path reaches the coastline, onto land.
   */
  coastlineM: number[]
  /**
   * Model ground at each station, without recorded measurements.
   */
  modelGroundM: (number | null)[]
  /**
   * Whether the model's ground is outlined along the whole path, rather than only where measurements replace it.
   */
  compareModel: boolean
  /**
   * Whether each station is over water, null where unknown; empty for none marked.
   */
  overWater: (boolean | null)[]
  /**
   * Height the chart is drawn at, in pixels.
   */
  heightPx: number
  /**
   * The path an upload sends, drawn over the planned one when it differs; empty for none.
   */
  uploadPath: UploadPathPoint[]
}>()

const emit = defineEmits<{
  (event: 'hover', sample: TerrainProfileSample | null): void
  (event: 'select-waypoint', waypointIndex: number): void
  (event: 'set-waypoint-height', waypointIndex: number, changeM: number): void
  (event: 'tap', sample: TerrainProfileSample): void
}>()

// From this many waypoints the chart scrolls sideways, showing this many at a time, rather than crowding them.
const SCROLL_FROM_WAYPOINTS = 60
const VISIBLE_WAYPOINTS = 50

const scrollEl = ref<HTMLElement | null>(null)
const chartEl = ref<HTMLElement | null>(null)
const hovered = ref<TerrainProfileSample | null>(null)
const hoverFraction = ref(0)
const hoverOnRight = ref(false)

const widthScale = computed(() => {
  const waypoints = props.points.filter(({ waypointIndex }) => waypointIndex !== null).length
  return waypoints < SCROLL_FROM_WAYPOINTS ? 1 : waypoints / VISIBLE_WAYPOINTS
})

// Each frame covers this share of the way left, so the chart eases into place rather than jumping per wheel step.
const WHEEL_EASING = 0.2
let wheelTargetLeft = 0
let wheelFrame = 0

const easeTowardsWheelTarget = (): void => {
  const scroller = scrollEl.value
  const before = scroller?.scrollLeft
  if (!scroller || before === undefined) return
  const remaining = wheelTargetLeft - before
  const step = Math.sign(remaining) * Math.max(1, Math.abs(remaining) * WHEEL_EASING)
  scroller.scrollLeft = Math.abs(remaining) < 1 ? wheelTargetLeft : before + step
  // A target the chart can no longer reach, as after it narrows, would otherwise keep the loop running.
  wheelFrame = scroller.scrollLeft === before ? 0 : requestAnimationFrame(easeTowardsWheelTarget)
}

const onWheel = (event: WheelEvent): void => {
  const scroller = scrollEl.value
  if (!scroller || widthScale.value === 1 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  event.preventDefault()
  const from = wheelFrame ? wheelTargetLeft : scroller.scrollLeft
  const maxLeft = scroller.scrollWidth - scroller.clientWidth
  wheelTargetLeft = Math.min(maxLeft, Math.max(0, from + event.deltaY))
  if (!wheelFrame) wheelFrame = requestAnimationFrame(easeTowardsWheelTarget)
}

onBeforeUnmount(() => cancelAnimationFrame(wheelFrame))

const lengthM = computed(() => props.samples.at(-1)?.distanceM || 1)
const toX = (distanceM: number): number => (distanceM / lengthM.value) * PROFILE_CHART_WIDTH

// Marks still loading for the previous profile would land on the wrong stations.
const stationsOverWater = computed(() => (props.overWater.length === props.samples.length ? props.overWater : []))

const hoveredOverWater = computed(
  () => !!hovered.value && stationsOverWater.value[props.samples.indexOf(toRaw(hovered.value))] === true
)

const chartOptions = computed<ProfileChartOptions>(() => ({
  vehicleClass: props.vehicleClass,
  uncertaintyM: props.uncertaintyM,
  waterLevelM: props.waterLevelM,
  draftM: props.draftM,
  tideRangeM: props.tideRangeM,
  shallows: props.shallows,
  modelGroundM: props.modelGroundM,
  overWater: stationsOverWater.value,
  uploadPath: props.uploadPath,
}))

const baseGeometry = computed(() => profileChartGeometry(props.samples, chartOptions.value))

// A height change being made redraws within the profile's own range, so the chart does not rescale under the pointer.
const geometry = computed(() => {
  const change = drag.value
  if (!change?.changeM) return baseGeometry.value
  const { minM, maxM } = baseGeometry.value
  return profileChartGeometry(withPointShifted(props.samples, change.pointIndex, change.changeM), {
    ...chartOptions.value,
    range: [minM, maxM],
  })
})

const bandRects = computed(() =>
  props.bands.map(({ fromM, toM, color, highlighted }) => ({
    x: toX(fromM),
    width: Math.max(3, toX(toM) - toX(fromM)),
    color,
    opacity: highlighted ? 0.3 : 0.11,
  }))
)

const coastlineXs = computed(() => props.coastlineM.map(toX))

const markerXs = computed(() => [
  ...props.markersM.map(toX),
  ...(hovered.value ? [hoverFraction.value * PROFILE_CHART_WIDTH] : []),
])

// Densified legs end on a station at exactly fraction 1, which is where the next waypoint sits.
const waypointMarkers = computed(() => {
  const stations = [props.samples[0], ...props.samples.filter((sample) => sample.legFraction === 1)]
  return props.points.flatMap(({ waypointIndex }, index) => {
    const station = stations[index]
    if (waypointIndex === null || !station) return []
    const percent = (station.distanceM / lengthM.value) * 100
    return [{ waypointIndex, pointIndex: index, percent, heightM: station.pathAmslM }]
  })
})

// Past this many waypoints in view at once, numbers and nodes shrink until pointed at, so fewer have to be hidden.
const COMPACT_FROM_VISIBLE_WAYPOINTS = 20
const compact = computed(() => waypointMarkers.value.length / widthScale.value > COMPACT_FROM_VISIBLE_WAYPOINTS)

const { width: chartWidthPx } = useElementSize(chartEl)

// Where numbers would overlap only some are shown; every waypoint keeps its node.
const labelMarkers = computed(() => {
  const markers = waypointMarkers.value
  const digits = String((markers.at(-1)?.waypointIndex ?? 0) + 1).length
  const labelWidthPx = compact.value ? digits * 5 + 4 : digits * 6 + 8
  const positionsPx = markers.map(({ percent }) => (percent / 100) * chartWidthPx.value)
  const shown = spacedLabels(positionsPx, labelWidthPx + 2)
  return markers.filter((_, index) => shown[index])
})

// The panel's edges leave no room for a marker to overhang the chart's ends.
const edgeOf = (percent: number): 'start' | 'middle' | 'end' => {
  if (percent <= 0) return 'start'
  return percent >= 100 ? 'end' : 'middle'
}
const LABEL_SHIFT = { start: '', middle: '-translate-x-1/2', end: '-translate-x-full' }
const HANDLE_SHIFT = {
  start: 'justify-start',
  middle: '-translate-x-1/2 justify-center',
  end: '-translate-x-full justify-end',
}

const selectWaypointLabel = (waypointIndex: number): string => {
  const waypointNumber = waypointIndex + 1
  return t`Select waypoint ${waypointNumber}`
}

const heightHandleLabel = (waypointIndex: number): string => {
  const waypointNumber = waypointIndex + 1
  return t`Waypoint ${waypointNumber} height, drag up or down or use the arrow keys`
}

/**
 * A waypoint height being changed from the chart.
 */
interface HeightDrag {
  /**
   * Waypoint being changed.
   */
  waypointIndex: number
  /**
   * Its place among the profile's path points.
   */
  pointIndex: number
  /**
   * Change so far, in whole meters.
   */
  changeM: number
  /**
   * Whether the pointer still holds it; a released change stays shown until the re-check redraws the chart.
   */
  active: boolean
  /**
   * Pointer height where the drag started.
   */
  startY: number
  /**
   * Meters per screen pixel when the drag started.
   */
  metersPerPx: number
}

const heightsEditable = computed(() => props.vehicleClass === 'air' || props.vehicleClass === 'underwater')
const drag = ref<HeightDrag | null>(null)
watch(
  () => props.samples,
  () => {
    if (!drag.value?.active) drag.value = null
  }
)

const topPercent = (heightM: number): number => {
  const { minM, maxM } = geometry.value
  return Math.min(100, Math.max(0, ((maxM - heightM) / (maxM - minM)) * 100))
}

const uploadDots = computed(() =>
  props.uploadPath
    .filter(({ added }) => added)
    .map(({ distanceM, amslM }) => ({
      key: `${distanceM}-${amslM}`,
      percent: (distanceM / lengthM.value) * 100,
      topPercent: topPercent(amslM),
    }))
)

const heightHandles = computed(() =>
  waypointMarkers.value.flatMap(({ waypointIndex, pointIndex, percent, heightM }) => {
    if (heightM === null) return []
    const changeM = drag.value?.waypointIndex === waypointIndex ? drag.value.changeM : 0
    return [{ waypointIndex, pointIndex, percent, heightM, topPercent: topPercent(heightM + changeM) }]
  })
)

const dragLabel = computed(() => {
  const current = drag.value
  const handle = heightHandles.value.find(({ waypointIndex }) => waypointIndex === current?.waypointIndex)
  if (!current?.active || !handle) return null
  const change = `${current.changeM >= 0 ? '+' : ''}${current.changeM} m`
  return { ...handle, text: `${(handle.heightM + current.changeM).toFixed(1)} m (${change})` }
})

// Below the outline, as the space above the high tide belongs to the waypoint numbers.
const tideLabel = computed(() => {
  if (!geometry.value.tideBand) return null
  const halfM = props.tideRangeM / 2
  const halfRangeM = halfM.toFixed(1)
  return { text: t`High and low tide ±${halfRangeM} m`, topPercent: topPercent(props.waterLevelM - halfM) }
})

// Stretches on consecutive legs are one run of shallows, and closer markers than this would overlap; both are
// shares of the visible width.
const SHALLOWS_RUN_GAP_PERCENT = 2
const SHALLOWS_LABEL_GAP_PERCENT = 5

// Charted shallows just beside the flagged stretch still explain it, as the model's cells are coarse.
const SHALLOWS_SEARCH_MARGIN_M = 50

const markerPercent = (fromM: number, toM: number): number =>
  Math.min(97, Math.max(3, (((fromM + toM) / 2) * 100) / lengthM.value))

const shallowsMarkers = computed(() => {
  const percentOf = (distanceM: number): number => (distanceM / lengthM.value) * 100
  const runs: ProfileChartShallows[] = []
  props.shallows.forEach((stretch) => {
    const last = runs.at(-1)
    if (!last || percentOf(stretch.fromM - last.toM) >= SHALLOWS_RUN_GAP_PERCENT / widthScale.value)
      runs.push({ ...stretch })
    // A merged run reads as its most uncertain stretch, which is the one whose land may be water.
    else if (stretch.raised && !last.raised)
      Object.assign(last, { ...stretch, fromM: last.fromM, toM: Math.max(last.toM, stretch.toM) })
    else last.toM = Math.max(last.toM, stretch.toM)
  })
  let lastPercent = -Infinity
  return runs.flatMap(({ fromM, toM, description }) => {
    const percent = markerPercent(fromM, toM)
    const stations = props.samples.filter(({ distanceM }) => distanceM >= fromM && distanceM <= toM)
    if (percent - lastPercent < SHALLOWS_LABEL_GAP_PERCENT / widthScale.value || stations.length === 0) return []
    lastPercent = percent
    const bbox = paddedBbox(
      stations.map(({ coordinates }) => coordinates),
      SHALLOWS_SEARCH_MARGIN_M
    )
    return [{ key: Object.values(bbox).join(), percent, bbox, description }]
  })
})

/**
 * Warnings of one kind read from a triangle.
 */
interface WarningSection {
  /**
   * Heading of the kind.
   */
  title: string
  /**
   * Descriptions under it.
   */
  messages: string[]
}

/**
 * A warning triangle on the chart for one or more warnings.
 */
interface WarningMarker {
  /**
   * Stable key for the list.
   */
  key: string
  /**
   * Position along the chart width, in percent.
   */
  percent: number
  /**
   * Warnings read from the triangle, grouped by heading.
   */
  sections: WarningSection[]
}

// Warnings too close to share the width are read from one marker.
const warningMarkers = computed(() => {
  const markers: WarningMarker[] = []
  const ordered = props.warnings
    .map((warning) => ({ ...warning, percent: markerPercent(warning.fromM, warning.toM) }))
    .sort((a, b) => a.percent - b.percent)
  ordered.forEach(({ fromM, toM, percent, title, description }) => {
    const last = markers.at(-1)
    if (!last || percent - last.percent >= SHALLOWS_LABEL_GAP_PERCENT / widthScale.value) {
      markers.push({ key: `${fromM}-${toM}`, percent, sections: [{ title, messages: [description] }] })
      return
    }
    const section = last.sections.find((entry) => entry.title === title)
    if (section) section.messages.push(description)
    else last.sections.push({ title, messages: [description] })
  })
  return markers
})

const onToggleWarning = (open: boolean): void => {
  if (open) logUserAction('Opened the terrain warning details on the terrain profile')
}

const hoveredOnShoal = computed(() => {
  const distanceM = hovered.value?.distanceM
  if (distanceM === undefined) return false
  return props.shallows.some(({ fromM, toM, raised }) => raised && distanceM >= fromM && distanceM <= toM)
})

const heightLabel = computed(() => {
  const marine = props.vehicleClass === 'surface' || props.vehicleClass === 'underwater'
  const groundM = hovered.value?.groundM
  return marine && groundM != null && groundM < props.waterLevelM ? t`Bottom` : t`Ground`
})

/**
 * A height handle's waypoint.
 */
interface HandleTarget {
  /**
   * Waypoint the handle moves.
   */
  waypointIndex: number
  /**
   * Its place among the profile's path points.
   */
  pointIndex: number
}

const onHandleDown = (event: PointerEvent, { waypointIndex, pointIndex }: HandleTarget): void => {
  const heightPx = chartEl.value?.clientHeight
  if (!heightPx) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const metersPerPx = (geometry.value.maxM - geometry.value.minM) / heightPx
  drag.value = { waypointIndex, pointIndex, changeM: 0, active: true, startY: event.clientY, metersPerPx }
}

const onHandleMove = (event: PointerEvent): void => {
  if (!drag.value?.active) return
  drag.value.changeM = Math.round((drag.value.startY - event.clientY) * drag.value.metersPerPx)
}

const onHandleUp = (): void => {
  const current = drag.value
  if (!current?.active) return
  if (current.changeM === 0) {
    drag.value = null
    emit('select-waypoint', current.waypointIndex)
    return
  }
  current.active = false
  emit('set-waypoint-height', current.waypointIndex, current.changeM)
}

const nudge = ({ waypointIndex, pointIndex }: HandleTarget, stepM: number): void => {
  const pendingM = drag.value?.waypointIndex === waypointIndex ? drag.value.changeM : 0
  drag.value = { waypointIndex, pointIndex, changeM: pendingM + stepM, active: false, startY: 0, metersPerPx: 0 }
  emit('set-waypoint-height', waypointIndex, stepM)
}

const clearanceLabel = computed(() => (props.vehicleClass === 'surface' ? t`Under keel` : t`Clearance`))

const ariaSummary = computed(() => {
  const clearances = props.samples.map((sample) => sample.clearanceM).filter((value): value is number => value !== null)
  if (clearances.length === 0) return t`Terrain profile of the mission`
  const clearanceName = clearanceLabel.value.toLowerCase()
  const smallestClearanceM = Math.min(...clearances).toFixed(1)
  return t`Terrain profile of the mission, smallest ${clearanceName} ${smallestClearanceM} m`
})

const formatDistance = (meters: number): string =>
  meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`

const alongLabel = (meters: number): string => {
  const distance = formatDistance(meters)
  return t`${distance} along`
}

const onMove = (event: MouseEvent): void => {
  const rect = chartEl.value?.getBoundingClientRect()
  if (!rect || rect.width === 0) return
  hoverFraction.value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const view = scrollEl.value?.getBoundingClientRect() ?? rect
  hoverOnRight.value = (event.clientX - view.left) / view.width > 0.6
  hovered.value = sampleAtFraction(props.samples, hoverFraction.value) ?? null
  emit('hover', hovered.value)
}

const onLeave = (): void => {
  hovered.value = null
  emit('hover', null)
}

// A touch has no hover to point at a station with, so a tap picks it instead.
const onTap = (event: PointerEvent): void => {
  if (event.pointerType !== 'touch' || (event.target as Element).closest('button')) return
  onMove(event)
  if (hovered.value) emit('tap', toRaw(hovered.value))
}
</script>
