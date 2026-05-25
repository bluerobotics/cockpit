<template>
  <v-dialog v-model="showDialog" fullscreen :scrim="false" transition="dialog-bottom-transition">
    <v-card class="dump-viewer-card">
      <div class="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <v-icon icon="mdi-chart-line" size="22" />
          <div class="min-w-0">
            <div class="text-base font-semibold">MAVLink dump viewer</div>
            <div class="text-xs text-white/60 truncate">{{ fileName }}</div>
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="closeViewer" />
      </div>

      <div class="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm text-white/80 border-b border-white/10 shrink-0">
        <span>
          <span class="text-white/50">Messages: </span>
          <span class="font-mono">{{ displayedMessageCount.toLocaleString() }}</span>
        </span>
        <span>
          <span class="text-white/50">Series: </span>
          <span class="font-mono">{{ parsed.seriesList.length.toLocaleString() }}</span>
        </span>
        <span v-if="durationMs > 0">
          <span class="text-white/50">Duration: </span>
          <span class="font-mono">{{ formatDurationMs(durationMs) }}</span>
        </span>
        <span v-if="plotBaseTimeMs !== null">
          <span class="text-white/50">Started: </span>
          <span class="font-mono">{{ formatStartTime(plotBaseTimeMs) }}</span>
        </span>
        <span v-if="parsed.invalidLineCount > 0" class="text-amber-300">
          <span class="text-amber-300/70">Invalid lines: </span>
          <span class="font-mono">{{ parsed.invalidLineCount.toLocaleString() }}</span>
        </span>
      </div>

      <div class="flex-1 flex min-h-0">
        <div class="dump-viewer-sidebar flex flex-col border-r border-white/10 shrink-0">
          <div class="p-2 shrink-0 flex flex-col gap-2">
            <div class="flex items-center gap-1 text-xs">
              <span class="text-white/50 mr-1">Show:</span>
              <button
                type="button"
                class="direction-filter"
                :class="{ active: showIncomingSeries }"
                @click="showIncomingSeries = !showIncomingSeries"
              >
                ← Incoming
              </button>
              <button
                type="button"
                class="direction-filter"
                :class="{ active: showOutgoingSeries }"
                @click="showOutgoingSeries = !showOutgoingSeries"
              >
                → Outgoing
              </button>
            </div>
            <v-autocomplete
              v-model="selectedSeriesIds"
              :items="filteredSeriesList"
              item-title="label"
              item-value="id"
              label="Variables to plot"
              multiple
              chips
              closable-chips
              clearable
              variant="outlined"
              density="compact"
              hide-details
              theme="dark"
              prepend-inner-icon="mdi-magnify"
              :menu-props="{ maxHeight: 400 }"
            />
            <div class="flex items-start gap-1">
              <v-text-field
                v-model="draftMaxPointsPerSeries"
                label="Max points per series"
                type="number"
                suffix="pts"
                theme="dark"
                variant="outlined"
                density="compact"
                hide-details
                class="flex-1 min-w-0"
                @keyup.enter="applyMaxPointsPerSeries"
              />
              <v-btn
                size="small"
                variant="text"
                class="mt-1 shrink-0"
                :disabled="!isDraftMaxPointsDirty"
                @click="applyMaxPointsPerSeries"
              >
                Apply
              </v-btn>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto px-2 pb-3">
            <div v-if="selectedEntries.length === 0" class="text-center text-white/40 text-sm py-6 px-2">
              Search and select variables above to plot them.
            </div>
            <div
              v-for="entry in selectedEntries"
              :key="entry.series.id"
              class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/5 group"
            >
              <span class="w-3 h-3 rounded-sm mt-1 shrink-0" :style="{ backgroundColor: entry.color }" />
              <div class="flex-1 min-w-0">
                <div class="text-sm break-all flex items-center gap-1.5 flex-wrap">
                  <span>{{ entry.series.label }}</span>
                  <span
                    v-if="entry.series.min === entry.series.max"
                    class="text-[10px] px-1.5 py-px rounded bg-amber-500/20 text-amber-300 font-mono"
                    title="All samples have the same value"
                  >
                    constant {{ formatValue(entry.series.min) }}
                  </span>
                </div>
                <div class="text-xs text-white/50 font-mono">
                  min: {{ formatValue(entry.series.min) }} · max: {{ formatValue(entry.series.max) }} ·
                  {{ entry.series.times.length.toLocaleString() }} pts
                </div>
                <div v-if="hoverSeriesValues[entry.series.id] !== undefined" class="text-xs text-cyan-300 font-mono">
                  @ cursor: {{ formatValue(hoverSeriesValues[entry.series.id]) }}
                </div>
              </div>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                class="opacity-0 group-hover:opacity-100"
                @click="removeSeries(entry.series.id)"
              />
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-white/10 shrink-0">
            <v-btn
              size="small"
              variant="outlined"
              prepend-icon="mdi-restore"
              :disabled="isAtFullExtent"
              @click="resetZoom"
            >
              Reset zoom
            </v-btn>
            <v-checkbox
              v-model="normalizePerSeries"
              label="Normalize per series"
              hide-details
              density="compact"
              class="-my-2"
              color="white"
            />
            <div class="flex-1" />
            <div v-if="hoverTimeMs !== null" class="text-sm font-mono text-cyan-300">
              t = {{ formatRelTime(hoverTimeMs) }}
            </div>
            <div class="text-sm font-mono text-white/60">
              window: {{ formatRelTime(viewStartMs) }} → {{ formatRelTime(viewEndMs) }}
            </div>
          </div>

          <div ref="plotContainer" class="flex-1 relative min-h-0 select-none">
            <canvas
              ref="canvasRef"
              class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              @wheel.prevent="onWheel"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @pointerleave="onPointerLeave"
              @dblclick="resetZoom"
            />
            <div
              v-if="selectedEntries.length === 0"
              class="absolute inset-0 flex items-center justify-center text-white/40 text-sm pointer-events-none"
            >
              Select one or more variables on the left to start plotting.
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showLivePlotResourceWarning"
        class="mx-4 mb-3 mt-1 shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
      >
        Large buffer ({{ displayedMessageCount.toLocaleString() }} messages). Selected series keep growing in memory as
        new messages arrive — leaving this open for a long time can use significant CPU and memory.
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementSize, useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, triggerRef, watch } from 'vue'

import {
  type MavlinkDumpEntry,
  type MavlinkDumpParseResult,
  type MavlinkDumpSeries,
  appendMavlinkDumpEntry,
  appendMavlinkDumpLines,
  applyMaxPointsLimit,
  discoverMavlinkDumpSeries,
  finalizeAndRefreshSeriesList,
  parseMavlinkDump,
} from '@/libs/mavlink-dump-parser'
import {
  addMavlinkDumperEntryListener,
  getMavlinkDumperLines,
  mavlinkDumperLargeBufferMessageThreshold,
  mavlinkDumperMessageCount,
  mavlinkDumperRevision,
} from '@/libs/mavlink-message-dumper'

const mavlinkDumpViewerMaxPointsKey = 'cockpit-mavlink-dump-viewer-max-points'
const defaultMavlinkDumpViewerMaxPoints = 100
const minMavlinkDumpViewerMaxPoints = 100
const maxMavlinkDumpViewerMaxPoints = 500_000

const mavlinkDumpViewerMaxPoints = useStorage(mavlinkDumpViewerMaxPointsKey, defaultMavlinkDumpViewerMaxPoints)

const draftMaxPointsPerSeries = ref('')

const syncPlotSettingDrafts = (): void => {
  draftMaxPointsPerSeries.value = String(mavlinkDumpViewerMaxPoints.value)
}

const isDraftMaxPointsDirty = computed(() => draftMaxPointsPerSeries.value !== String(mavlinkDumpViewerMaxPoints.value))

const clampMaxPointsPerSeries = (value: number): number => {
  if (!Number.isFinite(value)) return defaultMavlinkDumpViewerMaxPoints
  return Math.min(maxMavlinkDumpViewerMaxPoints, Math.max(minMavlinkDumpViewerMaxPoints, Math.round(value)))
}

const props = defineProps<{
  /**
   * Whether the viewer dialog is visible.
   */
  modelValue: boolean
  /**
   * Raw JSONL content of the dump to be visualized.
   */
  dumpContent: string
  /**
   * Name of the source file, displayed in the dialog header.
   */
  fileName: string
}>()

const emit = defineEmits<{
  /**
   * Two-way binding for the dialog visibility.
   */
  (e: 'update:modelValue', value: boolean): void
}>()

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const closeViewer = (): void => {
  showDialog.value = false
}

const createEmptyParsed = (): MavlinkDumpParseResult => ({
  series: new Map(),
  seriesList: [],
  messageCount: 0,
  invalidLineCount: 0,
  startTimeMs: null,
  endTimeMs: null,
  pathSources: new Map(),
})

// `shallowRef` keeps per-message `bucket.times.push(...)` mutations out of Vue's reactivity. The
// `triggerRef(parsed)` inside `scheduleRenderPlot` batches one notification per frame.
const parsed = shallowRef<MavlinkDumpParseResult>(createEmptyParsed())
const knownMessageTypes = new Set<string>()
let liveEntryUnsubscribe: (() => void) | null = null
let seriesDiscoveryIdleHandle: ReturnType<typeof requestIdleCallback> | null = null
let seriesBackfillIdleHandle: ReturnType<typeof requestIdleCallback> | null = null
let seriesDiscoveryLineIndex = 0
let seriesDiscoveryEndIndex = 0
let seriesBackfillActiveCount = 0
let renderPlotFrameHandle: number | null = null
let pendingSeriesListRefresh = false
let pendingTrimSelected = false
let trackedDurationMs = 0
// High-water mark of dump-buffer entries the live listener has already processed.
// When the viewer closes, the listener detaches but the dumper keeps capturing - on reopen we
// use this to back-fill the gap so the plot never shows missing points or fake straight lines.
let liveLastSeenMessageCount = 0

const SERIES_DISCOVERY_CHUNK_SIZE = 500
const SERIES_BACKFILL_CHUNK_SIZE = 500

const isLivePlotSource = computed(() => props.fileName.startsWith('In-memory buffer (live)'))

const displayedMessageCount = computed(() =>
  isLivePlotSource.value ? mavlinkDumperMessageCount.value : parsed.value.messageCount
)

const showLivePlotResourceWarning = computed(
  () => isLivePlotSource.value && mavlinkDumperMessageCount.value >= mavlinkDumperLargeBufferMessageThreshold
)

const selectedSeriesIds = ref<string[]>([])
const showIncomingSeries = ref(true)
const showOutgoingSeries = ref(true)

// Autocomplete items respect the direction toggles, but currently selected series are always
// included so their chips can still resolve a proper label (and stay removable) after the user
// toggles their direction off.
const filteredSeriesList = computed<MavlinkDumpSeries[]>(() => {
  const inOn = showIncomingSeries.value
  const outOn = showOutgoingSeries.value
  if (inOn && outOn) return parsed.value.seriesList

  const selectedSet = new Set(selectedSeriesIds.value)
  const result: MavlinkDumpSeries[] = []
  for (const series of parsed.value.seriesList) {
    const directionVisible = series.direction === 'in' ? inOn : outOn
    if (directionVisible || selectedSet.has(series.id)) result.push(series)
  }
  return result
})

// Series id format is `<dir>:<sysId>:<compId>:<path>`; the path is everything past the third colon
// and the message-type prefix ends at the first `/`.
const getMessageTypeFromSeriesId = (id: string): string | null => {
  let colonsSeen = 0
  let pathStart = -1
  for (let i = 0; i < id.length; i++) {
    if (id.charCodeAt(i) !== 58) continue
    colonsSeen += 1
    if (colonsSeen === 3) {
      pathStart = i + 1
      break
    }
  }
  if (pathStart < 0) return null
  const slashIdx = id.indexOf('/', pathStart)
  return slashIdx < 0 ? id.slice(pathStart) : id.slice(pathStart, slashIdx)
}

const selectedSeriesByMessageType = computed((): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>()
  for (const id of selectedSeriesIds.value) {
    const messageType = getMessageTypeFromSeriesId(id)
    if (!messageType) continue
    let bucket = map.get(messageType)
    if (!bucket) {
      bucket = new Set<string>()
      map.set(messageType, bucket)
    }
    bucket.add(id)
  }
  return map
})

const normalizePerSeries = ref(false)

const viewStartMs = ref(0)
const viewEndMs = ref(0)
const hoverTimeMs = ref<number | null>(null)
const hoverSeriesValues = ref<Record<string, number>>({})
const isLivePlotFollowingEnd = ref(true)

const FULL_EXTENT_TOLERANCE_MS = 2

const SERIES_COLORS = [
  '#4FC3F7',
  '#FF8A65',
  '#81C784',
  '#FFD54F',
  '#BA68C8',
  '#F06292',
  '#A1887F',
  '#90A4AE',
  '#E57373',
  '#7986CB',
  '#AED581',
  '#4DD0E1',
] as const

const colorForIndex = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length]

/* eslint-disable jsdoc/require-jsdoc */
interface SelectedEntry {
  series: MavlinkDumpSeries
  color: string
}
/* eslint-enable jsdoc/require-jsdoc */

const selectedEntries = computed<SelectedEntry[]>(() => {
  const entries: SelectedEntry[] = []
  let colorIndex = 0
  for (const id of selectedSeriesIds.value) {
    const series = parsed.value.series.get(id)
    if (!series) continue
    entries.push({ series, color: colorForIndex(colorIndex) })
    colorIndex += 1
  }
  return entries
})

const plotTimeExtent = computed(() => {
  const seriesList = selectedEntries.value.length > 0 ? selectedEntries.value.map((entry) => entry.series) : []

  if (seriesList.length === 0) {
    const start = parsed.value.startTimeMs
    const end = parsed.value.endTimeMs
    return {
      start,
      end,
      duration: start !== null && end !== null ? Math.max(0, end - start) : 0,
    }
  }

  let start: number | null = null
  let end: number | null = null
  for (const series of seriesList) {
    if (series.times.length === 0) continue
    const first = series.times[0]
    const last = series.times[series.times.length - 1]
    if (start === null || first < start) start = first
    if (end === null || last > end) end = last
  }

  return {
    start,
    end,
    duration: start !== null && end !== null ? Math.max(0, end - start) : 0,
  }
})

const plotBaseTimeMs = computed(() => plotTimeExtent.value.start)

const durationMs = computed(() => plotTimeExtent.value.duration)

const isViewAtFullPlotExtent = (): boolean => {
  const duration = durationMs.value
  if (duration <= 0) return true
  return (
    viewStartMs.value <= FULL_EXTENT_TOLERANCE_MS && Math.abs(viewEndMs.value - duration) <= FULL_EXTENT_TOLERANCE_MS
  )
}

const isAtFullExtent = computed(() => isViewAtFullPlotExtent())

const disableLivePlotFollow = (): void => {
  if (isLivePlotSource.value) isLivePlotFollowingEnd.value = false
}

const followIfTrackingEnd = (): void => {
  if (!isLivePlotSource.value || !isLivePlotFollowingEnd.value) return
  const duration = plotTimeExtent.value.duration
  if (duration === trackedDurationMs) return
  trackedDurationMs = duration
  viewStartMs.value = 0
  viewEndMs.value = duration
}

const scheduleRenderPlot = (): void => {
  if (renderPlotFrameHandle !== null) return
  renderPlotFrameHandle = requestAnimationFrame(() => {
    renderPlotFrameHandle = null
    if (pendingSeriesListRefresh) {
      finalizeAndRefreshSeriesList(parsed.value)
      pendingSeriesListRefresh = false
    }
    if (pendingTrimSelected && isLivePlotSource.value && selectedSeriesIds.value.length > 0) {
      const ids = new Set(selectedSeriesIds.value)
      applyMaxPointsLimit(parsed.value, mavlinkDumpViewerMaxPoints.value, ids)
      pendingTrimSelected = false
    }
    triggerRef(parsed)
    followIfTrackingEnd()
    renderPlot()
  })
}

const cancelBackgroundLivePlotWork = (): void => {
  if (seriesDiscoveryIdleHandle !== null) {
    cancelIdleCallback(seriesDiscoveryIdleHandle)
    seriesDiscoveryIdleHandle = null
  }
  if (seriesBackfillIdleHandle !== null) {
    cancelIdleCallback(seriesBackfillIdleHandle)
    seriesBackfillIdleHandle = null
  }
  seriesBackfillActiveCount = 0
}

const runSeriesDiscoveryChunk = (): void => {
  seriesDiscoveryIdleHandle = null
  if (!showDialog.value || !isLivePlotSource.value) return

  if (seriesDiscoveryLineIndex >= seriesDiscoveryEndIndex) return

  const endIndex = Math.min(seriesDiscoveryLineIndex + SERIES_DISCOVERY_CHUNK_SIZE, seriesDiscoveryEndIndex)
  discoverMavlinkDumpSeries(parsed.value, getMavlinkDumperLines(seriesDiscoveryLineIndex, endIndex))
  seriesDiscoveryLineIndex = endIndex
  pendingSeriesListRefresh = true
  scheduleRenderPlot()

  if (seriesDiscoveryLineIndex < seriesDiscoveryEndIndex) {
    seriesDiscoveryIdleHandle = requestIdleCallback(runSeriesDiscoveryChunk, { timeout: 1500 })
  }
}

const startSeriesDiscovery = (fromIndex = 0, toIndex?: number): void => {
  if (seriesDiscoveryIdleHandle !== null) {
    cancelIdleCallback(seriesDiscoveryIdleHandle)
    seriesDiscoveryIdleHandle = null
  }
  seriesDiscoveryLineIndex = Math.max(0, fromIndex)
  seriesDiscoveryEndIndex = toIndex ?? mavlinkDumperMessageCount.value
  if (seriesDiscoveryEndIndex <= seriesDiscoveryLineIndex) return
  seriesDiscoveryIdleHandle = requestIdleCallback(runSeriesDiscoveryChunk, { timeout: 1500 })
}

const backfillSeriesFromBuffer = (seriesId: string, fromIndex = 0, toIndex?: number): void => {
  if (!isLivePlotSource.value) return

  const filter = new Set([seriesId])
  let lineIndex = Math.max(0, fromIndex)
  const backfillEndIndex = toIndex ?? mavlinkDumperMessageCount.value
  if (backfillEndIndex <= lineIndex) return
  seriesBackfillActiveCount += 1

  const finishBackfill = (): void => {
    seriesBackfillActiveCount = Math.max(0, seriesBackfillActiveCount - 1)
  }

  const runChunk = (): void => {
    seriesBackfillIdleHandle = null
    if (!showDialog.value || !isLivePlotSource.value) {
      finishBackfill()
      return
    }

    const endIndex = Math.min(lineIndex + SERIES_BACKFILL_CHUNK_SIZE, backfillEndIndex)
    if (lineIndex >= endIndex) {
      finishBackfill()
      return
    }

    appendMavlinkDumpLines(parsed.value, getMavlinkDumperLines(lineIndex, endIndex), filter)
    lineIndex = endIndex
    pendingTrimSelected = true
    scheduleRenderPlot()

    if (lineIndex < backfillEndIndex) {
      seriesBackfillIdleHandle = requestIdleCallback(runChunk, { timeout: 1500 })
    } else {
      finishBackfill()
    }
  }

  if (seriesBackfillIdleHandle !== null) cancelIdleCallback(seriesBackfillIdleHandle)
  seriesBackfillIdleHandle = requestIdleCallback(runChunk, { timeout: 1500 })
}

const applyPlotLimits = (): void => {
  if (isLivePlotSource.value) {
    if (selectedSeriesIds.value.length === 0) return
    applyMaxPointsLimit(parsed.value, mavlinkDumpViewerMaxPoints.value, new Set(selectedSeriesIds.value))
  } else {
    applyMaxPointsLimit(parsed.value, mavlinkDumpViewerMaxPoints.value)
  }
}

/**
 * Minimal shape we look at on the live entry hot path. We only need the MAVLink message `type` to
 * route the entry to the right series-id bucket; everything else stays as `unknown`.
 */
interface LiveEntryShape {
  /** Inner MAVLink2REST `msg.message` object. */
  message?: {
    /** MAVLink message type (e.g. `ATTITUDE`, `NAMED_VALUE_FLOAT`). */
    type?: string
  }
}

const onLiveEntry = (entry: MavlinkDumpEntry): void => {
  liveLastSeenMessageCount = mavlinkDumperMessageCount.value

  const msg = entry?.msg as LiveEntryShape | undefined
  const messageType = msg?.message?.type
  if (!messageType) return

  let touched = false

  if (!knownMessageTypes.has(messageType)) {
    knownMessageTypes.add(messageType)
    if (appendMavlinkDumpEntry(parsed.value, entry, 'discover-only')) {
      pendingSeriesListRefresh = true
      touched = true
    }
  }

  const selections = selectedSeriesByMessageType.value.get(messageType)
  if (selections && selections.size > 0) {
    if (appendMavlinkDumpEntry(parsed.value, entry, selections)) {
      pendingSeriesListRefresh = true
    }
    pendingTrimSelected = true
    touched = true
  }

  if (touched) scheduleRenderPlot()
}

const subscribeToLiveEntries = (): void => {
  if (liveEntryUnsubscribe !== null) return
  liveEntryUnsubscribe = addMavlinkDumperEntryListener(onLiveEntry)
}

const unsubscribeFromLiveEntries = (): void => {
  if (liveEntryUnsubscribe !== null) {
    liveEntryUnsubscribe()
    liveEntryUnsubscribe = null
  }
}

const stopLivePlotActivity = (): void => {
  unsubscribeFromLiveEntries()
  cancelBackgroundLivePlotWork()
  if (renderPlotFrameHandle !== null) {
    cancelAnimationFrame(renderPlotFrameHandle)
    renderPlotFrameHandle = null
  }
  pendingSeriesListRefresh = false
  pendingTrimSelected = false
}

const resetLivePlotData = (): void => {
  stopLivePlotActivity()
  parsed.value = createEmptyParsed()
  knownMessageTypes.clear()
  seriesDiscoveryLineIndex = 0
  seriesDiscoveryEndIndex = 0
  seriesBackfillActiveCount = 0
  liveLastSeenMessageCount = 0
  hoverTimeMs.value = null
  hoverSeriesValues.value = {}
  isLivePlotFollowingEnd.value = true
  viewStartMs.value = 0
  viewEndMs.value = 0
  trackedDurationMs = 0
}

const syncLivePlotSession = (): void => {
  if (!showDialog.value || !isLivePlotSource.value) return

  const prevSeenCount = liveLastSeenMessageCount
  const currentCount = mavlinkDumperMessageCount.value

  subscribeToLiveEntries()
  // Mark anything already in the buffer as "seen" so the listener bumps from this point forward.
  // The catch-up below replays the gap into the same series buckets without overlapping with the
  // live push path.
  liveLastSeenMessageCount = currentCount

  startSeriesDiscovery(prevSeenCount, currentCount)

  if (currentCount > prevSeenCount) {
    for (const id of selectedSeriesIds.value) {
      backfillSeriesFromBuffer(id, prevSeenCount, currentCount)
    }
  }

  scheduleRenderPlot()
}

const restartLivePlotAfterBufferReset = (): void => {
  resetLivePlotData()
  syncLivePlotSession()
}

const applyMaxPointsPerSeries = (): void => {
  const clamped = clampMaxPointsPerSeries(Number(draftMaxPointsPerSeries.value))
  mavlinkDumpViewerMaxPoints.value = clamped
  draftMaxPointsPerSeries.value = String(clamped)
  applyPlotLimits()
  scheduleRenderPlot()
}

syncPlotSettingDrafts()

watch(
  () => [props.fileName, props.dumpContent] as const,
  ([fileName, content], previousPair) => {
    const sourceChanged = previousPair === undefined || fileName !== previousPair[0]

    if (isLivePlotSource.value) {
      // Keep selectedSeriesIds across the switch: syncLivePlotSession iterates them and
      // back-fills each bucket from the dumper buffer, so the user doesn't have to re-pick.
      if (sourceChanged) restartLivePlotAfterBufferReset()
    } else {
      stopLivePlotActivity()
      parsed.value = content ? parseMavlinkDump(content) : createEmptyParsed()
      applyPlotLimits()
      // Drop only selections that the new parse no longer contains; everything else carries
      // over (e.g. "Live plot" → "Plot last recording" keeps the same variable).
      selectedSeriesIds.value = selectedSeriesIds.value.filter((id) => parsed.value.series.has(id))
      if (sourceChanged) {
        hoverTimeMs.value = null
        hoverSeriesValues.value = {}
        isLivePlotFollowingEnd.value = false
        viewStartMs.value = 0
        viewEndMs.value = durationMs.value
        trackedDurationMs = durationMs.value
      }
    }

    scheduleRenderPlot()
  },
  { immediate: true }
)

watch(mavlinkDumperRevision, () => {
  if (isLivePlotSource.value) restartLivePlotAfterBufferReset()
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      syncPlotSettingDrafts()
      if (isLivePlotSource.value) {
        syncLivePlotSession()
      } else {
        nextTick(() => scheduleRenderPlot())
      }
      return
    }
    stopLivePlotActivity()
  }
)

watch(normalizePerSeries, () => {
  refreshHoverValues()
  scheduleRenderPlot()
})

watch(selectedSeriesIds, (ids, previousIds) => {
  refreshHoverValues()
  scheduleRenderPlot()
  if (!isLivePlotSource.value) return

  const previous = new Set(previousIds ?? [])
  for (const id of ids) {
    if (previous.has(id)) continue
    const series = parsed.value.series.get(id)
    if (!series || series.times.length === 0) {
      backfillSeriesFromBuffer(id)
    }
  }
})

const removeSeries = (id: string): void => {
  selectedSeriesIds.value = selectedSeriesIds.value.filter((sid) => sid !== id)
}

const resetZoom = (): void => {
  isLivePlotFollowingEnd.value = true
  viewStartMs.value = 0
  viewEndMs.value = durationMs.value
  trackedDurationMs = durationMs.value
  refreshHoverValues()
  scheduleRenderPlot()
}

const formatValue = (value: number): string => {
  if (!Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) return value.toExponential(3)
  return Number(value.toFixed(4)).toString()
}

const formatStartTime = (ts: number): string => format(new Date(ts), 'yyyy-MM-dd HH:mm:ss')

const formatDurationMs = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)} s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  if (minutes < 60) return `${minutes}m ${seconds.toFixed(1)}s`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes - hours * 60
  return `${hours}h ${remMinutes}m ${Math.floor(seconds)}s`
}

const formatRelTime = (ms: number): string => {
  if (!Number.isFinite(ms)) return ''
  if (Math.abs(ms) < 1000) return `${ms.toFixed(0)} ms`
  const seconds = ms / 1000
  if (Math.abs(seconds) < 60) return `${seconds.toFixed(3)} s`
  const minutes = Math.floor(Math.abs(seconds) / 60) * Math.sign(seconds)
  const remSeconds = seconds - minutes * 60
  return `${minutes}m ${remSeconds.toFixed(2)}s`
}

const findFirstIdxAtOrAfter = (times: number[], t: number): number => {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid] < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

const findLastIdxAtOrBefore = (times: number[], t: number): number => {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

const refreshHoverValues = (): void => {
  const baseTime = plotBaseTimeMs.value
  if (hoverTimeMs.value === null || baseTime === null || baseTime === undefined) {
    hoverSeriesValues.value = {}
    return
  }
  const absoluteTs = baseTime + hoverTimeMs.value
  const next: Record<string, number> = {}
  for (const entry of selectedEntries.value) {
    const idx = findLastIdxAtOrBefore(entry.series.times, absoluteTs)
    if (idx >= 0) next[entry.series.id] = entry.series.values[idx]
  }
  hoverSeriesValues.value = next
}

const plotContainer = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const { width: containerWidth, height: containerHeight } = useElementSize(plotContainer)

watch([containerWidth, containerHeight], () => scheduleRenderPlot())

const PLOT_MARGIN_LEFT = 64
const PLOT_MARGIN_RIGHT = 16
const PLOT_MARGIN_TOP = 12
const PLOT_MARGIN_BOTTOM = 28

const niceStep = (rawStep: number): number => {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1
  const exp = Math.floor(Math.log10(rawStep))
  const base = Math.pow(10, exp)
  const norm = rawStep / base
  let nice: number
  if (norm < 1.5) nice = 1
  else if (norm < 3) nice = 2
  else if (norm < 7) nice = 5
  else nice = 10
  return nice * base
}

// Format a tick label using a precision derived from the tick step. Snaps near-zero values
// (within 1e-6 of a step) to exactly 0 so we never show floating-point artifacts like "1.388e-16".
const formatTickValue = (value: number, step: number): string => {
  if (!Number.isFinite(value)) return ''
  if (Math.abs(value) < step * 1e-6) return '0'
  const stepExp = Math.floor(Math.log10(Math.abs(step)))
  const magnitude = Math.max(Math.abs(value), Math.abs(step))
  if (magnitude >= 1e6 || magnitude < 1e-3) return value.toExponential(2)
  const decimals = stepExp >= 0 ? 0 : Math.min(6, -stepExp)
  return value.toFixed(decimals)
}

const renderPlot = (): void => {
  const canvas = canvasRef.value
  const container = plotContainer.value
  if (!canvas || !container) return

  const cssWidth = container.clientWidth
  const cssHeight = container.clientHeight
  if (cssWidth === 0 || cssHeight === 0) return

  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const plotLeft = PLOT_MARGIN_LEFT
  const plotTop = PLOT_MARGIN_TOP
  const plotWidth = Math.max(1, cssWidth - PLOT_MARGIN_LEFT - PLOT_MARGIN_RIGHT)
  const plotHeight = Math.max(1, cssHeight - PLOT_MARGIN_TOP - PLOT_MARGIN_BOTTOM)
  const plotRight = plotLeft + plotWidth
  const plotBottom = plotTop + plotHeight

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight)

  const startRel = viewStartMs.value
  const endRel = viewEndMs.value
  const visibleSpanMs = Math.max(1e-3, endRel - startRel)
  const dumpStartAbs = plotBaseTimeMs.value ?? 0
  const startAbs = dumpStartAbs + startRel
  const endAbs = dumpStartAbs + endRel

  let yMin = 0
  let yMax = 1
  if (!normalizePerSeries.value && selectedEntries.value.length > 0) {
    let foundAny = false
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const entry of selectedEntries.value) {
      const series = entry.series
      const startIdx = findFirstIdxAtOrAfter(series.times, startAbs)
      const endIdx = findLastIdxAtOrBefore(series.times, endAbs)
      if (endIdx < startIdx) continue
      for (let i = startIdx; i <= endIdx; i++) {
        const v = series.values[i]
        if (v < lo) lo = v
        if (v > hi) hi = v
        foundAny = true
      }
    }
    if (foundAny) {
      if (lo === hi) {
        const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.05 : 1
        lo -= pad
        hi += pad
      } else {
        const pad = (hi - lo) * 0.05
        lo -= pad
        hi += pad
      }
      yMin = lo
      yMax = hi
    }
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.font = '11px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'

  const yTickCount = Math.max(2, Math.floor(plotHeight / 50))
  if (normalizePerSeries.value) {
    for (let i = 0; i <= yTickCount; i++) {
      const v = i / yTickCount
      const y = plotBottom - v * plotHeight
      ctx.beginPath()
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotRight, y)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(v.toFixed(2), plotLeft - 6, y)
    }
  } else {
    const yStep = niceStep((yMax - yMin) / yTickCount)
    const startStep = Math.ceil(yMin / yStep)
    const endStep = Math.floor(yMax / yStep)
    for (let i = startStep; i <= endStep; i++) {
      const v = i * yStep
      const y = plotBottom - ((v - yMin) / (yMax - yMin)) * plotHeight
      if (y < plotTop - 1 || y > plotBottom + 1) continue
      ctx.beginPath()
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotRight, y)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(formatTickValue(v, yStep), plotLeft - 6, y)
    }
    if (yMin <= 0 && yMax >= 0) {
      const zeroY = plotBottom - ((0 - yMin) / (yMax - yMin)) * plotHeight
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.setLineDash([4, 4])
      ctx.moveTo(plotLeft, zeroY)
      ctx.lineTo(plotRight, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    }
  }

  const xTickCount = Math.max(2, Math.floor(plotWidth / 110))
  const xStep = niceStep(visibleSpanMs / xTickCount)
  const startXStep = Math.ceil(startRel / xStep)
  const endXStep = Math.floor(endRel / xStep)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = startXStep; i <= endXStep; i++) {
    const t = i * xStep
    const x = plotLeft + ((t - startRel) / visibleSpanMs) * plotWidth
    if (x < plotLeft - 1 || x > plotRight + 1) continue
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.moveTo(x, plotTop)
    ctx.lineTo(x, plotBottom)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillText(formatRelTime(t), x, plotBottom + 4)
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(plotLeft + 0.5, plotTop + 0.5, plotWidth, plotHeight)

  ctx.save()
  ctx.beginPath()
  ctx.rect(plotLeft, plotTop, plotWidth, plotHeight)
  ctx.clip()

  for (const entry of selectedEntries.value) {
    const series = entry.series
    const startIdx = findFirstIdxAtOrAfter(series.times, startAbs)
    const endIdx = findLastIdxAtOrBefore(series.times, endAbs)
    if (endIdx < startIdx) continue

    let seriesMin = yMin
    let seriesMax = yMax
    if (normalizePerSeries.value) {
      seriesMin = Number.POSITIVE_INFINITY
      seriesMax = Number.NEGATIVE_INFINITY
      for (let i = startIdx; i <= endIdx; i++) {
        const v = series.values[i]
        if (v < seriesMin) seriesMin = v
        if (v > seriesMax) seriesMax = v
      }
      if (seriesMin === seriesMax) {
        const pad = Math.abs(seriesMin) > 0 ? Math.abs(seriesMin) * 0.05 : 1
        seriesMin -= pad
        seriesMax += pad
      }
    }
    const range = seriesMax - seriesMin

    ctx.strokeStyle = entry.color
    ctx.lineWidth = 1.4
    ctx.beginPath()

    const pointCount = endIdx - startIdx + 1
    const xScale = plotWidth / visibleSpanMs

    if (pointCount > plotWidth * 2) {
      let currentColumn = -1
      let columnMin = Number.POSITIVE_INFINITY
      let columnMax = Number.NEGATIVE_INFINITY
      let started = false
      for (let i = startIdx; i <= endIdx; i++) {
        const tRel = series.times[i] - (dumpStartAbs ?? 0)
        const px = plotLeft + (tRel - startRel) * xScale
        const column = Math.floor(px)
        const v = series.values[i]
        if (column !== currentColumn) {
          if (currentColumn >= 0) {
            const yMinPx = normalizePerSeries.value
              ? plotBottom - ((columnMin - seriesMin) / range) * plotHeight
              : plotBottom - ((columnMin - yMin) / (yMax - yMin)) * plotHeight
            const yMaxPx = normalizePerSeries.value
              ? plotBottom - ((columnMax - seriesMin) / range) * plotHeight
              : plotBottom - ((columnMax - yMin) / (yMax - yMin)) * plotHeight
            if (!started) {
              ctx.moveTo(currentColumn + 0.5, yMaxPx)
              started = true
            } else {
              ctx.lineTo(currentColumn + 0.5, yMaxPx)
            }
            ctx.lineTo(currentColumn + 0.5, yMinPx)
          }
          currentColumn = column
          columnMin = v
          columnMax = v
        } else {
          if (v < columnMin) columnMin = v
          if (v > columnMax) columnMax = v
        }
      }
      if (currentColumn >= 0) {
        const yMinPx = normalizePerSeries.value
          ? plotBottom - ((columnMin - seriesMin) / range) * plotHeight
          : plotBottom - ((columnMin - yMin) / (yMax - yMin)) * plotHeight
        const yMaxPx = normalizePerSeries.value
          ? plotBottom - ((columnMax - seriesMin) / range) * plotHeight
          : plotBottom - ((columnMax - yMin) / (yMax - yMin)) * plotHeight
        if (!started) ctx.moveTo(currentColumn + 0.5, yMaxPx)
        else ctx.lineTo(currentColumn + 0.5, yMaxPx)
        ctx.lineTo(currentColumn + 0.5, yMinPx)
      }
    } else {
      for (let i = startIdx; i <= endIdx; i++) {
        const tRel = series.times[i] - (dumpStartAbs ?? 0)
        const x = plotLeft + (tRel - startRel) * xScale
        const v = series.values[i]
        const y = normalizePerSeries.value
          ? plotBottom - ((v - seriesMin) / range) * plotHeight
          : plotBottom - ((v - yMin) / (yMax - yMin)) * plotHeight
        if (i === startIdx) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
  }

  if (hoverTimeMs.value !== null && hoverTimeMs.value >= startRel && hoverTimeMs.value <= endRel) {
    const x = plotLeft + ((hoverTimeMs.value - startRel) / visibleSpanMs) * plotWidth
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(x, plotTop)
    ctx.lineTo(x, plotBottom)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()
}

const onWheel = (event: WheelEvent): void => {
  if (durationMs.value <= 0) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const xInPlot = event.clientX - rect.left - PLOT_MARGIN_LEFT
  const plotWidth = Math.max(1, rect.width - PLOT_MARGIN_LEFT - PLOT_MARGIN_RIGHT)
  const ratio = Math.min(1, Math.max(0, xInPlot / plotWidth))

  const span = viewEndMs.value - viewStartMs.value
  const cursorTime = viewStartMs.value + span * ratio
  const zoomFactor = Math.pow(1.0015, event.deltaY)
  let newSpan = span * zoomFactor
  newSpan = Math.max(1, Math.min(newSpan, durationMs.value))

  let newStart = cursorTime - ratio * newSpan
  let newEnd = newStart + newSpan
  if (newStart < 0) {
    newStart = 0
    newEnd = newSpan
  }
  if (newEnd > durationMs.value) {
    newEnd = durationMs.value
    newStart = newEnd - newSpan
  }
  viewStartMs.value = newStart
  viewEndMs.value = newEnd
  if (isLivePlotSource.value && isViewAtFullPlotExtent()) {
    isLivePlotFollowingEnd.value = true
    trackedDurationMs = durationMs.value
  } else if (isLivePlotSource.value) {
    isLivePlotFollowingEnd.value = false
  }
  refreshHoverValues()
  scheduleRenderPlot()
}

let isPanning = false
let panStartClientX = 0
let panStartViewStart = 0
let panStartViewEnd = 0

const onPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0) return
  if (durationMs.value <= 0) return
  isPanning = true
  panStartClientX = event.clientX
  panStartViewStart = viewStartMs.value
  panStartViewEnd = viewEndMs.value
  ;(event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId)
}

const onPointerMove = (event: PointerEvent): void => {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const plotWidth = Math.max(1, rect.width - PLOT_MARGIN_LEFT - PLOT_MARGIN_RIGHT)

  if (isPanning) {
    const dx = event.clientX - panStartClientX
    const span = panStartViewEnd - panStartViewStart
    const dt = -(dx / plotWidth) * span
    let newStart = panStartViewStart + dt
    let newEnd = panStartViewEnd + dt
    if (newStart < 0) {
      newEnd -= newStart
      newStart = 0
    }
    if (newEnd > durationMs.value) {
      newStart -= newEnd - durationMs.value
      newEnd = durationMs.value
    }
    if (newStart < 0) newStart = 0
    viewStartMs.value = newStart
    viewEndMs.value = newEnd
    if (Math.abs(dx) > 2) disableLivePlotFollow()
  }

  const xInPlot = event.clientX - rect.left - PLOT_MARGIN_LEFT
  if (xInPlot < 0 || xInPlot > plotWidth) {
    hoverTimeMs.value = null
    hoverSeriesValues.value = {}
    scheduleRenderPlot()
    return
  }
  const ratio = xInPlot / plotWidth
  hoverTimeMs.value = viewStartMs.value + ratio * (viewEndMs.value - viewStartMs.value)
  refreshHoverValues()
  scheduleRenderPlot()
}

const onPointerUp = (event: PointerEvent): void => {
  isPanning = false
  ;(event.currentTarget as HTMLCanvasElement).releasePointerCapture?.(event.pointerId)
}

const onPointerLeave = (): void => {
  isPanning = false
  hoverTimeMs.value = null
  hoverSeriesValues.value = {}
  scheduleRenderPlot()
}

onBeforeUnmount(() => {
  isPanning = false
  stopLivePlotActivity()
})
</script>

<style scoped>
.dump-viewer-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  border-radius: 0;
  background-color: #181a20;
  color: rgba(255, 255, 255, 0.92);
}

.dump-viewer-sidebar {
  width: 320px;
}

.direction-filter {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.4);
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  line-height: 1.1;
}

.direction-filter:hover {
  border-color: rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.7);
}

.direction-filter.active {
  background-color: rgba(79, 195, 247, 0.18);
  border-color: rgba(79, 195, 247, 0.5);
  color: #4fc3f7;
}

@media (max-width: 1280px) {
  .dump-viewer-sidebar {
    width: 260px;
  }
}
</style>
