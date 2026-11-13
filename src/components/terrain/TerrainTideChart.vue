<template>
  <div class="flex flex-col gap-y-1 select-none">
    <div class="flex items-center justify-between gap-x-2 min-h-[16px]">
      <span class="opacity-70">{{ heading }}</span>
      <span class="truncate" :class="{ 'opacity-70': !readout.hovered }">{{ readout.text }}</span>
    </div>
    <div
      ref="plotEl"
      class="relative"
      role="img"
      :aria-label="summary"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="hoverMs = null"
    >
      <div class="relative h-[52px] rounded-sm bg-[#FFFFFF08] overflow-hidden">
        <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" class="absolute inset-0 w-full h-full">
          <path :d="geometry.area" fill="#3B78A855" />
          <path :d="geometry.line" fill="none" stroke="#81D4FA" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
        <div
          v-if="pastFraction > 0"
          class="absolute inset-y-0 left-0 bg-[#00000040]"
          :style="{ width: percent(pastFraction) }"
        />
        <div
          v-if="bestMs !== null"
          class="absolute inset-y-0 w-0 border-l border-[#66BB6A]"
          :style="{ left: percent(fraction(bestMs)) }"
        />
        <div
          v-if="hoverMs !== null"
          class="absolute inset-y-0 w-0 border-l border-white/70"
          :style="{ left: percent(fraction(hoverMs)) }"
        />
        <span
          v-for="extreme in extremes"
          :key="extreme.timeMs"
          class="absolute px-1 rounded-sm text-[10px] leading-tight bg-[#00000066] whitespace-nowrap"
          :style="extremeStyle(extreme)"
        >
          {{ extreme.high ? t`High` : t`Low` }} {{ formatLevel(extreme.levelM) }} {{ formatTime(extreme.timeMs) }}
        </span>
        <span class="absolute left-1 top-0.5 text-[10px] opacity-60">{{ formatLevel(geometry.highM) }}</span>
        <span class="absolute left-1 bottom-0.5 text-[10px] opacity-60">{{ formatLevel(geometry.lowM) }}</span>
      </div>
      <div class="flex h-2 mt-[2px] rounded-sm overflow-hidden">
        <div v-for="start in starts" :key="start.timeMs" class="grow" :style="{ background: start.color }" />
      </div>
      <div class="relative h-3 text-[10px] leading-3 opacity-60">
        <span
          v-for="hour in HOUR_TICKS"
          :key="hour"
          class="absolute"
          :style="{ left: percent(hour / 24), transform: `translateX(-${(hour / 24) * 100}%)` }"
        >
          {{ String(hour).padStart(2, '0') }}:00
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { t } from 'ttag'
import { computed, ref } from 'vue'

import {
  type TideChartStart,
  type TideExtreme,
  type WaterLevelPoint,
  tideExtremes,
  waterLevelAt,
} from '@/libs/terrain/water-level'

const props = defineProps<{
  /**
   * Tide predictions covering the day.
   */
  predictions: WaterLevelPoint[]
  /**
   * Start of the day shown, in milliseconds since the epoch.
   */
  dayStartMs: number
  /**
   * Mission start times across the day, evenly spaced.
   */
  starts: TideChartStart[]
  /**
   * Best start time, null when none is known.
   */
  bestMs: number | null
  /**
   * Title over the chart.
   */
  heading: string
}>()

const WIDTH = 1000
const HEIGHT = 100
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

const plotEl = ref<HTMLElement>()
const hoverMs = ref<number | null>(null)

const dayEndMs = computed(() => props.dayStartMs + DAY_MS)
const fraction = (timeMs: number): number => Math.min(1, Math.max(0, (timeMs - props.dayStartMs) / DAY_MS))
const percent = (value: number): string => `${value * 100}%`

const geometry = computed(() => {
  const points = props.predictions.filter(({ timeMs }) => timeMs >= props.dayStartMs && timeMs <= dayEndMs.value)
  const levels = points.map(({ levelM }) => levelM)
  const minM = Math.min(...levels)
  const maxM = Math.max(...levels)
  // Room above and below for the high and low labels.
  const padM = Math.max(0.1, (maxM - minM) * 0.6)
  const lowM = minM - padM
  const highM = maxM + padM
  const y = (levelM: number): number => HEIGHT - ((levelM - lowM) / (highM - lowM)) * HEIGHT
  const line = points
    .map(
      ({ timeMs, levelM }, index) =>
        `${index ? 'L' : 'M'}${(fraction(timeMs) * WIDTH).toFixed(1)},${y(levelM).toFixed(1)}`
    )
    .join('')
  const first = points[0] ? fraction(points[0].timeMs) * WIDTH : 0
  const last = points.at(-1) ? fraction(points.at(-1)!.timeMs) * WIDTH : 0
  return { line, area: line ? `${line}L${last},${HEIGHT}L${first},${HEIGHT}Z` : '', lowM, highM, y }
})

const extremes = computed(() => tideExtremes(props.predictions, props.dayStartMs, dayEndMs.value))

const extremeStyle = (extreme: TideExtreme): Record<string, string> => {
  const at = fraction(extreme.timeMs)
  const topPercent = (geometry.value.y(extreme.levelM) / HEIGHT) * 100
  return {
    left: percent(at),
    top: `${topPercent}%`,
    transform: `translate(-${at * 100}%, ${extreme.high ? '-110%' : '10%'})`,
  }
}

const pastFraction = computed(() => fraction(Date.now()))

const formatTime = (timeMs: number): string => format(timeMs, 'HH:mm')
const formatLevel = (levelM: number): string => `${levelM >= 0 ? '+' : ''}${levelM.toFixed(1)} m`

const startAt = (timeMs: number): TideChartStart | undefined => {
  const index = Math.floor(fraction(timeMs) * props.starts.length)
  return props.starts[Math.min(index, props.starts.length - 1)]
}

const readout = computed(() => {
  const timeMs = hoverMs.value ?? props.bestMs
  if (timeMs === null) return { text: t`Point at the chart to read a start time`, hovered: false }
  const level = waterLevelAt(props.predictions, timeMs)
  const tideLevel = level === null ? '' : formatLevel(level)
  const start = startAt(timeMs)
  const time = formatTime(timeMs)
  const outcome = start?.text ?? t`unknown`
  const best = hoverMs.value === null
  const withTide = best
    ? t`Best start ${time}, tide ${tideLevel}: ${outcome}`
    : t`Start ${time}, tide ${tideLevel}: ${outcome}`
  const withoutTide = best ? t`Best start ${time}: ${outcome}` : t`Start ${time}: ${outcome}`
  return {
    text: tideLevel ? withTide : withoutTide,
    hovered: hoverMs.value !== null,
  }
})

const summary = computed(() => {
  const tides = extremes.value
    .map(({ high, levelM, timeMs }) => {
      const level = formatLevel(levelM)
      const time = formatTime(timeMs)
      return high ? t`high tide of ${level} at ${time}` : t`low tide of ${level} at ${time}`
    })
    .join(', ')
  const turningPoints = tides || t`no turning point`
  const reading = readout.value.text
  return t`Tide over the day: ${turningPoints}. ${reading}.`
})

const onPointer = (event: PointerEvent): void => {
  const box = plotEl.value?.getBoundingClientRect()
  if (!box || box.width === 0) return
  const at = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  hoverMs.value = props.dayStartMs + at * DAY_MS
}
</script>
