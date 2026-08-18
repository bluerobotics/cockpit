<template>
  <div class="webrtc-stats-widget">
    <Dialog
      v-model:show="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
      class="flex pa-4 bg-[#ffffff10] text-white backdrop-blur-2xl border-[1px] border-[#FAFAFA12]"
    >
      <div class="flex flex-col gap-4">
        <div class="flex items-center">
          <span class="mr-3 text-slate-100">Stream</span>
          <v-select
            v-model="selectedStream"
            :items="availableStreams"
            density="compact"
            variant="outlined"
            theme="dark"
            hide-details
            class="w-60"
          />
        </div>
        <div class="flex items-center">
          <span class="mr-3 text-slate-100">Limit plot data points</span>
          <v-switch v-model="widget.options.limitPlotPoints" theme="dark" hide-details density="compact" />
        </div>
        <div v-if="widget.options.limitPlotPoints" class="flex items-center">
          <span class="mr-3 text-slate-100">Max plot data points</span>
          <v-text-field
            v-model.number="widget.options.maxDataPoints"
            type="number"
            density="compact"
            variant="outlined"
            theme="dark"
            hide-details
            :min="10"
            :max="100000"
            class="w-40"
          />
        </div>
        <div class="flex items-center">
          <span class="mr-3 text-slate-100">Ignore first (seconds)</span>
          <v-text-field
            v-model.number="widget.options.ignoreFirstSeconds"
            type="number"
            density="compact"
            variant="outlined"
            theme="dark"
            hide-details
            :min="0"
            :max="3600"
            class="w-40"
          />
        </div>
        <div class="flex items-center">
          <span class="mr-3 text-slate-100">Compact mode</span>
          <v-switch v-model="widget.options.compactMode" theme="dark" hide-details density="compact" />
        </div>
        <div class="flex items-center">
          <span class="mr-3 text-slate-100">Card width (px)</span>
          <v-slider
            v-model.number="widget.options.cardWidth"
            :min="120"
            :max="600"
            :step="10"
            theme="dark"
            hide-details
            thumb-label
            class="w-60"
          />
        </div>
        <div class="flex items-center gap-2">
          <v-btn variant="outlined" theme="dark" size="small" :disabled="!hasReceivedData" @click="exportStats">
            <v-icon start>mdi-download</v-icon>
            Export stats
          </v-btn>
          <v-btn variant="outlined" theme="dark" size="small" @click="resetStats">
            <v-icon start>mdi-refresh</v-icon>
            Reset
          </v-btn>
        </div>
      </div>
    </Dialog>
    <div v-if="!selectedStream" class="no-stream">
      <p>Open the widget configuration to select a stream.</p>
    </div>
    <div v-else-if="!hasReceivedData" class="no-stream">
      <p>Waiting for stats from "{{ selectedStream }}"...</p>
    </div>
    <div v-else class="stats-grid">
      <div class="stat-section" :style="cardStyle">
        <h3>Connection</h3>
        <div class="stat-columns">
          <div class="stat-col">
            <span class="stat-col-label">Stream</span>
            <span class="stat-col-value">{{ selectedStream }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Codec</span>
            <span class="stat-col-value">{{ cumulativeStats.mimeType || 'N/A' }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Resolution</span>
            <span class="stat-col-value">{{ resolution }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Clock Rate</span>
            <span class="stat-col-value">{{ formatNumber(cumulativeStats.clockRate / 1000, 0) }} kHz</span>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(255, 165, 0)" />
          Bitrate
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="bitrateCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">Current</span>
              <span class="stat-col-value">{{ formatBitrate(cumulativeStats.bitrate) }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Peak</span>
              <span class="stat-col-value">{{ formatBitrate(peakBitrate) }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Avg</span>
              <span class="stat-col-value">{{ formatBitrate(avgBitrate) }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Total</span>
              <span class="stat-col-value">{{ formatBytes(cumulativeStats.bytesReceived) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(0, 255, 100)" />
          Framerate
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="fpsCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">Current</span>
              <span class="stat-col-value">{{ formatNumber(cumulativeStats.framesPerSecond, 1) }} fps</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Peak</span>
              <span class="stat-col-value">{{ formatNumber(peakFps, 1) }} fps</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Avg</span>
              <span class="stat-col-value">{{ formatNumber(avgFps, 1) }} fps</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(255, 80, 80)" />
          Packet Loss
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="packetLossCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">Delta</span>
              <span class="stat-col-value" :class="{ 'text-red': lastPacketLossDelta > 0 }">
                {{ lastPacketLossDelta }}
              </span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Lost</span>
              <span class="stat-col-value" :class="{ 'text-red': cumulativeStats.packetsLost > 0 }">
                {{ formatLargeNumber(cumulativeStats.packetsLost) }}
              </span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Loss %</span>
              <span class="stat-col-value" :class="{ 'text-red': cumulativeStats.packetsLost > 0 }">
                {{ packetLossPercentage }}%
              </span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Rate</span>
              <span class="stat-col-value">{{ formatNumber(cumulativeStats.packetRate, 0) }}/s</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(100, 200, 255)" />
          Jitter
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="jitterCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">Current</span>
              <span class="stat-col-value">{{ formatNumber(cumulativeStats.jitter * 1000, 2) }} ms</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Peak</span>
              <span class="stat-col-value">{{ formatNumber(peakJitter * 1000, 2) }} ms</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Avg</span>
              <span class="stat-col-value">{{ formatNumber(avgJitter * 1000, 2) }} ms</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Buffer</span>
              <span class="stat-col-value">{{ formatNumber(cumulativeStats.jitterBufferDelay * 1000, 1) }} ms</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>Frames</h3>
        <div class="stat-columns">
          <div class="stat-col">
            <span class="stat-col-label">Received</span>
            <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.framesReceived) }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Decoded</span>
            <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.framesDecoded) }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Dropped</span>
            <span class="stat-col-value" :class="{ 'text-red': cumulativeStats.framesDropped > 0 }">
              {{ formatLargeNumber(cumulativeStats.framesDropped) }}
            </span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Key</span>
            <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.keyFramesDecoded) }}</span>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(200, 100, 255)" />
          Freeze Duration
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="freezeCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">Freezes</span>
              <span class="stat-col-value" :class="{ 'text-red': cumulativeStats.freezeCount > 0 }">
                {{ cumulativeStats.freezeCount }}
              </span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Frozen</span>
              <span class="stat-col-value" :class="{ 'text-red': cumulativeStats.totalFreezesDuration > 0 }">
                {{ formatNumber(cumulativeStats.totalFreezesDuration, 2) }}s
              </span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Pauses</span>
              <span class="stat-col-value">{{ cumulativeStats.pauseCount }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">Paused</span>
              <span class="stat-col-value">{{ formatNumber(cumulativeStats.totalPausesDuration, 2) }}s</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>
          <span class="plot-legend-dot" style="background: rgb(255, 200, 50)" />
          <span class="plot-legend-dot" style="background: rgb(50, 200, 200)" />
          <span class="plot-legend-dot" style="background: rgb(255, 100, 180)" />
          Error Correction
        </h3>
        <div class="plot-row" :class="{ compact: widget.options.compactMode }">
          <canvas ref="errorCorrectionCanvasRef" class="sparkline" />
          <div class="stat-side">
            <div class="stat-col">
              <span class="stat-col-label">
                <span class="plot-legend-dot" style="background: rgb(255, 200, 50)" /> NACK
              </span>
              <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.nackCount) }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">
                <span class="plot-legend-dot" style="background: rgb(50, 200, 200)" /> PLI
              </span>
              <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.pliCount) }}</span>
            </div>
            <div class="stat-col">
              <span class="stat-col-label">
                <span class="plot-legend-dot" style="background: rgb(255, 100, 180)" /> FIR
              </span>
              <span class="stat-col-value">{{ formatLargeNumber(cumulativeStats.firCount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-section" :style="cardStyle">
        <h3>Processing</h3>
        <div class="stat-columns">
          <div class="stat-col">
            <span class="stat-col-label">Processing</span>
            <span class="stat-col-value">{{ avgProcessingDelay }} ms</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Decode</span>
            <span class="stat-col-value">{{ avgDecodeTime }} ms</span>
          </div>
          <div class="stat-col">
            <span class="stat-col-label">Assembly</span>
            <span class="stat-col-value">{{ avgAssemblyTime }} ms</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { saveAs } from 'file-saver'
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import Dialog from '@/components/Dialog.vue'
import { useVideoStore } from '@/stores/video'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { WebRTCVideoStats } from '@/types/video'
import { WebRTCStatsEvent } from '@/types/video'
import type { Widget } from '@/types/widgets'

const videoStore = useVideoStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = computed(() => props.widget)

const defaultOptions = {
  selectedStream: undefined as string | undefined,
  maxDataPoints: 1000,
  limitPlotPoints: false,
  cardWidth: 350,
  compactMode: true,
  ignoreFirstSeconds: 5,
}

onBeforeMount(() => {
  widget.value.options = { ...defaultOptions, ...widget.value.options }
})

const cardStyle = computed(() => {
  const w = Math.max(120, widget.value.options.cardWidth as number)
  return { flex: `1 1 ${w}px`, minWidth: `${w}px` }
})

onMounted(() => {
  if (selectedStream.value) {
    setupStatsMonitor()
  }
})

const selectedStream = computed({
  get: () => widget.value.options.selectedStream as string | undefined,
  set: (val: string | undefined) => {
    widget.value.options.selectedStream = val
  },
})

const availableStreams = computed(() => videoStore.namesAvailableStreams)

const hasReceivedData = ref(false)

const emptyCumulativeStats: Partial<WebRTCVideoStats> = {
  bitrate: 0,
  bytesReceived: 0,
  clockRate: 0,
  firCount: 0,
  frameHeight: 0,
  frameWidth: 0,
  framesDecoded: 0,
  framesDropped: 0,
  framesPerSecond: 0,
  framesReceived: 0,
  freezeCount: 0,
  headerBytesReceived: 0,
  jitter: 0,
  jitterBufferDelay: 0,
  keyFramesDecoded: 0,
  mimeType: '',
  nackCount: 0,
  packetRate: 0,
  packetsLost: 0,
  packetsReceived: 0,
  pauseCount: 0,
  pliCount: 0,
  totalAssemblyTime: 0,
  totalDecodeTime: 0,
  totalFreezesDuration: 0,
  totalPausesDuration: 0,
  totalProcessingDelay: 0,
}

const cumulativeStats = ref<Partial<WebRTCVideoStats>>({ ...emptyCumulativeStats })

let webrtcStats: InstanceType<typeof WebRTCStats> | null = null
const trackedPeerIds = new Set<string>()

// --- Plot history ---
const maxDataPoints = computed(() => Math.max(10, widget.value.options.maxDataPoints as number))
const bitrateHistory = ref<number[]>([])
const fpsHistory = ref<number[]>([])
const packetLossHistory = ref<number[]>([])
const jitterHistory = ref<number[]>([])
const freezeHistory = ref<number[]>([])
const nackHistory = ref<number[]>([])
const pliHistory = ref<number[]>([])
const firHistory = ref<number[]>([])
let previousPacketsLost = 0

type TimestampedSnapshot = {
  /** @type {string} ISO timestamp of when the snapshot was collected */
  collectedAt: string
  /** @type {Partial<WebRTCVideoStats>} Raw WebRTC video stats at the time of collection */
  data: Partial<WebRTCVideoStats>
}
const rawSnapshots: TimestampedSnapshot[] = []

const bitrateCanvasRef = ref<HTMLCanvasElement | null>(null)
const freezeCanvasRef = ref<HTMLCanvasElement | null>(null)
const errorCorrectionCanvasRef = ref<HTMLCanvasElement | null>(null)
const fpsCanvasRef = ref<HTMLCanvasElement | null>(null)
const packetLossCanvasRef = ref<HTMLCanvasElement | null>(null)
const jitterCanvasRef = ref<HTMLCanvasElement | null>(null)

const lastPacketLossDelta = ref(0)

const peakBitrate = ref(0)
const peakFps = ref(0)
const peakJitter = ref(0)
const avgBitrate = computed(() => {
  if (bitrateHistory.value.length === 0) return 0
  return bitrateHistory.value.reduce((a, b) => a + b, 0) / bitrateHistory.value.length
})
const avgFps = computed(() => {
  if (fpsHistory.value.length === 0) return 0
  return fpsHistory.value.reduce((a, b) => a + b, 0) / fpsHistory.value.length
})
const avgJitter = computed(() => {
  if (jitterHistory.value.length === 0) return 0
  return jitterHistory.value.reduce((a, b) => a + b, 0) / jitterHistory.value.length
})

/**
 * Draws a sparkline plot on a canvas element
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {number[]} data - Array of data points
 * @param {string} color - Stroke color
 * @param {string} fillColor - Fill color under the line
 */
const drawSparkline = (canvas: HTMLCanvasElement, data: number[], color: string, fillColor: string): void => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const w = rect.width
  const h = rect.height
  ctx.clearRect(0, 0, w, h)

  if (data.length < 2) return

  const max = Math.max(...data, 1)
  const pad = 2
  const xScale = Math.max(data.length, maxDataPoints.value) - 1

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'

  for (let i = 0; i < data.length; i++) {
    const x = (i / xScale) * w
    const y = h - pad - (data[i] / max) * (h - 2 * pad)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  const lastX = ((data.length - 1) / xScale) * w
  ctx.lineTo(lastX, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
}

/**
 * Draws multiple series on a single canvas with a shared y-axis scale
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {{ data: number[]; color: string }[]} series - Array of series to plot
 */
const drawMultiSparkline = (
  canvas: HTMLCanvasElement,
  series: {
    /** @type {number[]} Array of data points for this series */
    data: number[]
    /** @type {string} CSS color string for the line stroke */
    color: string
  }[]
): void => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const w = rect.width
  const h = rect.height
  ctx.clearRect(0, 0, w, h)

  const longestLen = Math.max(...series.map((s) => s.data.length))
  if (longestLen < 2) return

  const globalMax = Math.max(...series.flatMap((s) => s.data), 1)
  const pad = 2
  const xScale = Math.max(longestLen, maxDataPoints.value) - 1

  for (const { data, color } of series) {
    if (data.length < 2) continue
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    for (let i = 0; i < data.length; i++) {
      const x = (i / xScale) * w
      const y = h - pad - (data[i] / globalMax) * (h - 2 * pad)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

/**
 * Redraws all sparkline plots using current history data
 */
const redrawPlots = (): void => {
  if (bitrateCanvasRef.value) {
    drawSparkline(bitrateCanvasRef.value, bitrateHistory.value, 'rgb(255, 165, 0)', 'rgba(255, 165, 0, 0.1)')
  }
  if (fpsCanvasRef.value) {
    drawSparkline(fpsCanvasRef.value, fpsHistory.value, 'rgb(0, 255, 100)', 'rgba(0, 255, 100, 0.1)')
  }
  if (packetLossCanvasRef.value) {
    drawSparkline(packetLossCanvasRef.value, packetLossHistory.value, 'rgb(255, 80, 80)', 'rgba(255, 80, 80, 0.15)')
  }
  if (jitterCanvasRef.value) {
    drawSparkline(jitterCanvasRef.value, jitterHistory.value, 'rgb(100, 200, 255)', 'rgba(100, 200, 255, 0.1)')
  }
  if (freezeCanvasRef.value) {
    drawSparkline(freezeCanvasRef.value, freezeHistory.value, 'rgb(200, 100, 255)', 'rgba(200, 100, 255, 0.1)')
  }
  if (errorCorrectionCanvasRef.value) {
    drawMultiSparkline(errorCorrectionCanvasRef.value, [
      { data: nackHistory.value, color: 'rgb(255, 200, 50)' },
      { data: pliHistory.value, color: 'rgb(50, 200, 200)' },
      { data: firHistory.value, color: 'rgb(255, 100, 180)' },
    ])
  }
}

/**
 * Appends a value to a history array, optionally discarding the oldest entry if the limit is exceeded
 * @param {number[]} arr - Target history array
 * @param {number} value - Value to append
 */
const pushHistory = (arr: number[], value: number): void => {
  arr.push(value)
  if (widget.value.options.limitPlotPoints && arr.length > maxDataPoints.value) arr.shift()
}

// --- Computed stats ---
const resolution = computed(() => {
  const w = cumulativeStats.value.frameWidth
  const h = cumulativeStats.value.frameHeight
  if (!w || !h) return 'N/A'
  return `${w}x${h}`
})

const packetLossPercentage = computed(() => {
  const lost = cumulativeStats.value.packetsLost ?? 0
  const received = cumulativeStats.value.packetsReceived ?? 0
  const total = lost + received
  if (total === 0) return '0.00'
  return ((lost / total) * 100).toFixed(2)
})

const avgProcessingDelay = computed(() => {
  const total = cumulativeStats.value.totalProcessingDelay ?? 0
  const frames = cumulativeStats.value.framesReceived ?? 0
  if (frames === 0) return '0.00'
  return ((total / frames) * 1000).toFixed(2)
})

const avgDecodeTime = computed(() => {
  const total = cumulativeStats.value.totalDecodeTime ?? 0
  const frames = cumulativeStats.value.framesDecoded ?? 0
  if (frames === 0) return '0.00'
  return ((total / frames) * 1000).toFixed(2)
})

const avgAssemblyTime = computed(() => {
  const total = cumulativeStats.value.totalAssemblyTime ?? 0
  const frames = cumulativeStats.value.framesDecoded ?? 0
  if (frames === 0) return '0.00'
  return ((total / frames) * 1000).toFixed(2)
})

/**
 * Formats a number with fixed decimal places
 * @param {number | undefined} value - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 */
const formatNumber = (value: number | undefined, decimals: number): string => {
  if (value === undefined || isNaN(value)) return '0'
  return value.toFixed(decimals)
}

/**
 * Formats a large number with locale separators
 * @param {number | undefined} value - Number to format
 * @returns {string} Formatted number
 */
const formatLargeNumber = (value: number | undefined): string => {
  if (value === undefined || isNaN(value)) return '0'
  return Math.round(value).toLocaleString()
}

/**
 * Formats a bitrate value to a human-readable string
 * @param {number | undefined} bps - Bitrate in bits per second
 * @returns {string} Formatted bitrate
 */
const formatBitrate = (bps: number | undefined): string => {
  if (bps === undefined || isNaN(bps)) return '0 bps'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} kbps`
  return `${Math.round(bps)} bps`
}

/**
 * Formats a byte count to a human-readable string
 * @param {number | undefined} bytes - Number of bytes
 * @returns {string} Formatted byte string
 */
const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined || isNaN(bytes)) return '0 B'
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${Math.round(bytes)} B`
}

let monitorStartTime = 0

/**
 * Initializes the WebRTC stats monitor for the currently selected stream
 */
const setupStatsMonitor = (): void => {
  cleanupStatsMonitor()

  webrtcStats = new WebRTCStats({ getStatsInterval: 100 })
  trackedPeerIds.clear()
  previousPacketsLost = 0
  monitorStartTime = Date.now()

  webrtcStats.on('stats', (ev: WebRTCStatsEvent) => {
    try {
      const videoData = ev.data.video.inbound[0]
      if (videoData === undefined) return

      const ignoreMs = (widget.value.options.ignoreFirstSeconds as number) * 1000
      if (ignoreMs > 0 && Date.now() - monitorStartTime < ignoreMs) return

      hasReceivedData.value = true
      cumulativeStats.value = { ...videoData }
      rawSnapshots.push({ collectedAt: new Date().toISOString(), data: { ...videoData } })

      const bitrate = videoData.bitrate ?? 0
      const fps = videoData.framesPerSecond ?? 0
      const jitter = videoData.jitter ?? 0
      const pktLost = videoData.packetsLost ?? 0
      const delta = Math.max(0, pktLost - previousPacketsLost)
      previousPacketsLost = pktLost
      lastPacketLossDelta.value = delta

      pushHistory(bitrateHistory.value, bitrate)
      pushHistory(fpsHistory.value, fps)
      pushHistory(packetLossHistory.value, delta)
      pushHistory(jitterHistory.value, jitter)
      pushHistory(freezeHistory.value, videoData.totalFreezesDuration ?? 0)
      pushHistory(nackHistory.value, videoData.nackCount ?? 0)
      pushHistory(pliHistory.value, videoData.pliCount ?? 0)
      pushHistory(firHistory.value, videoData.firCount ?? 0)

      if (bitrate > peakBitrate.value) peakBitrate.value = bitrate
      if (fps > peakFps.value) peakFps.value = fps
      if (jitter > peakJitter.value) peakJitter.value = jitter

      nextTick(redrawPlots)
    } catch (e) {
      console.error('WebRTCStats widget: error processing stats event', e)
    }
  })

  tryAddConnection()
}

/**
 * Attempts to register the selected stream's peer connection with the stats monitor
 */
const tryAddConnection = (): void => {
  if (!webrtcStats || !selectedStream.value) return

  const streamName = selectedStream.value
  const pcInfo = videoStore.getStreamPeerConnection(streamName)
  if (!pcInfo || trackedPeerIds.has(pcInfo.peerId)) return

  trackedPeerIds.add(pcInfo.peerId)
  webrtcStats.addConnection({
    pc: pcInfo.peerConnection,
    peerId: pcInfo.peerId,
    connectionId: pcInfo.sessionId,
    remote: false,
  })
}

/**
 * Destroys the WebRTC stats monitor instance and clears tracked peer IDs
 */
const cleanupStatsMonitor = (): void => {
  if (webrtcStats) {
    webrtcStats.destroy()
    webrtcStats = null
  }
  trackedPeerIds.clear()
}

/**
 * Resets all plot history arrays, raw snapshots, and peak/delta tracking values
 */
const clearHistory = (): void => {
  bitrateHistory.value = []
  fpsHistory.value = []
  packetLossHistory.value = []
  jitterHistory.value = []
  freezeHistory.value = []
  nackHistory.value = []
  pliHistory.value = []
  firHistory.value = []
  rawSnapshots.length = 0
  previousPacketsLost = 0
  lastPacketLossDelta.value = 0
  peakBitrate.value = 0
  peakFps.value = 0
  peakJitter.value = 0
}

/**
 * Exports all collected stats (summary, plot history, and raw snapshots) as a JSON file
 */
const exportStats = (): void => {
  const exportData = {
    stream: selectedStream.value,
    exportedAt: new Date().toISOString(),
    sampleCount: rawSnapshots.length,
    summary: {
      peakBitrate: peakBitrate.value,
      avgBitrate: avgBitrate.value,
      peakFps: peakFps.value,
      avgFps: avgFps.value,
      peakJitter: peakJitter.value,
      avgJitter: avgJitter.value,
      totalPacketsLost: cumulativeStats.value.packetsLost,
      totalPacketsReceived: cumulativeStats.value.packetsReceived,
      packetLossPercentage: packetLossPercentage.value,
      totalBytesReceived: cumulativeStats.value.bytesReceived,
      freezeCount: cumulativeStats.value.freezeCount,
      totalFreezesDuration: cumulativeStats.value.totalFreezesDuration,
      framesDropped: cumulativeStats.value.framesDropped,
      nackCount: cumulativeStats.value.nackCount,
      pliCount: cumulativeStats.value.pliCount,
      firCount: cumulativeStats.value.firCount,
    },
    plotHistory: {
      bitrate: bitrateHistory.value,
      fps: fpsHistory.value,
      packetLossDelta: packetLossHistory.value,
      jitter: jitterHistory.value,
    },
    snapshots: rawSnapshots,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  saveAs(blob, `webrtc-stats-${selectedStream.value ?? 'unknown'}-${timestamp}.json`)
}

/**
 * Resets all stats and restarts the monitor for the currently selected stream
 */
const resetStats = (): void => {
  hasReceivedData.value = false
  cumulativeStats.value = { ...emptyCumulativeStats }
  clearHistory()
  if (selectedStream.value) {
    setupStatsMonitor()
  }
}

watch(selectedStream, (newStream) => {
  hasReceivedData.value = false
  cumulativeStats.value = { ...emptyCumulativeStats }
  clearHistory()
  if (newStream) {
    setupStatsMonitor()
  } else {
    cleanupStatsMonitor()
  }
})

watch(videoStore.activeStreams, () => {
  if (selectedStream.value && webrtcStats) {
    tryAddConnection()
  }
})

onBeforeUnmount(() => {
  cleanupStatsMonitor()
})
</script>

<style scoped>
.webrtc-stats-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  font-family: monospace;
  font-size: 12px;
  overflow: hidden;
}

.no-stream {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.stats-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: center;
}

.stat-section {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 8px;
}

.stat-section h3 {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 3px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.plot-legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.plot-row {
  display: flex;
  flex-direction: column;
}

.plot-row.compact {
  flex-direction: row;
  gap: 8px;
  align-items: stretch;
}

.plot-row.compact .sparkline {
  flex: 1;
  min-width: 0;
  height: 48px;
  margin-bottom: 0;
}

.plot-row.compact .stat-side {
  flex-direction: column;
  gap: 1px;
  min-width: 80px;
  justify-content: center;
}

.plot-row.compact .stat-side .stat-col {
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.plot-row.compact .stat-side .stat-col-label {
  font-size: 9px;
  text-align: left;
}

.plot-row.compact .stat-side .stat-col-value {
  font-size: 10px;
  text-align: right;
}

.sparkline {
  width: 100%;
  height: 48px;
  margin-bottom: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.03);
}

.stat-side {
  display: flex;
  gap: 8px;
  justify-content: space-around;
}

.stat-columns {
  display: flex;
  gap: 8px;
  justify-content: space-around;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
  flex: 1;
}

.stat-col-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.stat-col-value {
  font-weight: bold;
  font-size: 11px;
  white-space: nowrap;
}

.text-red {
  color: #ff5252;
}
</style>
