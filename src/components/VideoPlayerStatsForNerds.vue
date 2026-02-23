<template>
  <div class="canvas-container">
    <canvas ref="canvasRef" :width="width" :height="height"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { useVideoStore } from '@/stores/video'
import type { Go2RTCStreamInfo } from '@/types/video'
import { WebRTCStatsEvent } from '@/types/video'
const videoStore = useVideoStore()

const rtspInfo = ref<Go2RTCStreamInfo | undefined>()
let rtspInfoInterval: ReturnType<typeof setInterval> | null = null
const rtspBitrateData = ref<number[]>([])
const rtspPacketRateData = ref<number[]>([])
const rtspStallData = ref<number[]>([])
let maxRtspBitrate = 1000
let maxRtspPacketRate = 100
let rtspStallCount = 0
let rtspStartTime = 0

const props = defineProps({
  width: {
    type: Number,
    default: 130,
  },
  height: {
    type: Number,
    default: 200,
  },
  updateInterval: {
    type: Number,
    default: 20,
  },
  streamName: {
    type: String,
    default: '',
  },
})

const isRtspStream = (): boolean => {
  if (!props.streamName) return false
  return videoStore.getStreamProtocol(props.streamName) === 'rtsp'
}

const canvasRef = ref(null)
const framerateData = ref([])
const bitrateData = ref([])
const packetLostData = ref([])
let animationFrameId = null
let intervalId = null
let bitrate = 0
// cumulative values
let packetsLost = 0
let packetsReceived = 0
let totalProcessingDelay = 0
let nackCount = 0
let pliCount = 0
let firCount = 0
let framesReceived = 0
let connectionLost = false

let processingDelayDelta = 0
let freezes = 0
let frozenTime = 0
let framedrops = 0

let packetLossPercentage = 0
let framerate = 0
let packetLostDelta = 0
let videoHeight = 0

const maxDataPoints = 100
let maxBitrateReceived = 1000 // max bitrate received, used for scaling the plot
let maxFramerateReceived = 30 // max framerate received, used for scaling the plot
let maxPacketLost = 10 // max packet lost, used for scaling the plot
let absoluteMaxFrameRate = 120 // Absolute maximum framerate, used for dealing with outliers

const plotHeight = 60 // Height of the plot area
/**
 * Normalize the value to fit the plot area
 * @param {number} value - The current value
 * @param {number} max - The maximum value currently in the plot
 * @returns {number} The normalized value
 */
function normalizeValue(value: number, max: number): number {
  return (value / max) * plotHeight
}

/**
 * Draw the line plots and stats
 */
function draw(): void {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const { width, height } = props

  ctx.clearRect(0, 0, width, height)

  /**
   *
   * @param {number[]} data  - The data to plot
   * @param {string} color - The color of the plot
   * @param {number} max - The maximum value of the data, used for scaling the plot
   */
  function drawPlot(data: number[], color: string, max: number): void {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const x = (i / (maxDataPoints - 1)) * width
      const y = height - normalizeValue(data[i], max)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  ctx.font = '10px Arial'

  // Draw stats and plots for both types of streams.
  // The stats and plots are different from one to another since RTSP and WebRTC streams provide different types of information.
  if (isRtspStream()) {
    drawPlot(rtspBitrateData.value, 'rgb(255, 165, 0)', maxRtspBitrate)
    drawPlot(rtspPacketRateData.value, 'rgb(100, 200, 255)', maxRtspPacketRate)
    drawPlot(rtspStallData.value, 'rgb(255, 0, 0)', 1)

    const info = rtspInfo.value
    const isStalled = info?.bitrateKbps === 0
    const statusColor = isStalled ? 'red' : 'white'
    const bitrateStr = info?.bitrateKbps ? `${info.bitrateKbps}kbps` : '...'
    const ppsStr = info?.packetsPerSec ? `${info.packetsPerSec}/s` : '...'
    const stats = [
      { label: 'Stream', value: props.streamName, color: statusColor },
      { label: 'Source', value: 'Direct RTSP', color: statusColor },
      { label: 'Codec', value: info?.codec ?? '...', color: statusColor },
      { label: 'Size', value: info?.width ? `${info.width}x${info.height}` : '...', color: statusColor },
      { label: 'Transport', value: info?.protocol ?? '...', color: statusColor },
      { label: 'FPS', value: info?.fps ?? '...', color: 'rgb(0, 255, 0)' },
      { label: 'Bitrate', value: bitrateStr, color: 'rgb(255, 165, 0)' },
      { label: 'Packets', value: ppsStr, color: 'rgb(100, 200, 255)' },
      { label: 'Stalls', value: rtspStallCount, color: rtspStallCount > 0 ? 'rgb(255, 0, 0)' : 'white' },
    ]

    stats.forEach((stat, index) => {
      ctx.fillStyle = stat.color
      ctx.fillText(`${stat.label}: ${stat.value}`, 5, 12 + index * 12)
    })
  } else {
    drawPlot(bitrateData.value, 'rgb(255, 165, 0)', maxBitrateReceived)
    drawPlot(framerateData.value, 'rgb(0, 255, 0)', maxFramerateReceived)
    drawPlot(packetLostData.value, 'rgb(255, 0, 0)', maxPacketLost)

    const color = connectionLost ? 'red' : 'white'
    const stats = [
      { label: t('components.VideoPlayerStatsForNerds.stream'), value: props.streamName, color: color },
      {
        label: t('components.VideoPlayerStatsForNerds.size'),
        value: videoHeight ? `${videoHeight}p` : 'N/A',
        color: color,
      },
      {
        label: t('components.VideoPlayerStatsForNerds.packetsLost'),
        value: `${packetsLost} (${packetLossPercentage.toFixed(0)}%)`,
        color: color,
      },
      { label: t('components.VideoPlayerStatsForNerds.frameDrops'), value: framedrops, color: color },
      { label: t('components.VideoPlayerStatsForNerds.nack'), value: nackCount, color: color },
      { label: t('components.VideoPlayerStatsForNerds.pli'), value: pliCount, color: color },
      { label: t('components.VideoPlayerStatsForNerds.fir'), value: firCount, color: color },
      {
        label: t('components.VideoPlayerStatsForNerds.processing'),
        value: `${processingDelayDelta.toFixed(0)}ms`,
        color: color,
      },
      {
        label: t('components.VideoPlayerStatsForNerds.freezes'),
        value: `${freezes}(${frozenTime.toFixed(1)}s)`,
        color: color,
      },
      {
        label: t('components.VideoPlayerStatsForNerds.bitrate'),
        value: `${bitrate.toFixed(0)}kbps`,
        color: 'rgb(255, 165, 0)',
      },
      { label: t('components.VideoPlayerStatsForNerds.fps'), value: framerate.toFixed(2), color: 'rgb(0, 255, 0)' },
    ]

    stats.forEach((stat, index) => {
      ctx.fillStyle = stat.color
      ctx.fillText(`${stat.label}: ${stat.value}`, 5, 12 + index * 12)
    })
  }

  animationFrameId = requestAnimationFrame(draw)
}

const webrtcStats = new WebRTCStats({ getStatsInterval: 100 })

/**
 * Draws the lines and updates the stats
 */
function update(): void {
  framerateData.value.push(framerate)
  bitrateData.value.push(bitrate)
  packetLostData.value.push(Math.min(packetLostDelta, maxPacketLost))
  if (framerateData.value.length > maxDataPoints) framerateData.value.shift()
  if (bitrateData.value.length > maxDataPoints) bitrateData.value.shift()
  if (packetLostData.value.length > maxDataPoints) packetLostData.value.shift()
  maxBitrateReceived = Math.max(1000, ...bitrateData.value)
  maxFramerateReceived = Math.min(Math.max(30, ...framerateData.value), absoluteMaxFrameRate)
}

watch(videoStore.activeStreams, (streams): void => {
  Object.keys(streams).forEach((streamName) => {
    if (streamName !== props.streamName) return
    const pcInfo = videoStore.getStreamPeerConnection(streamName)
    if (!pcInfo) return
    if (webrtcStats.peersToMonitor[pcInfo.peerId]) return
    webrtcStats.addConnection({
      pc: pcInfo.peerConnection,
      peerId: pcInfo.peerId,
      connectionId: pcInfo.sessionId,
      remote: false,
    })
  })
})

const fetchRtspInfo = async (): Promise<void> => {
  if (!isRtspStream() || !window.electronAPI) return
  try {
    const allInfo = await window.electronAPI.go2rtcGetStreamsInfo()
    const info = allInfo[props.streamName]
    rtspInfo.value = info
    if (info) {
      if (rtspStartTime === 0) rtspStartTime = Date.now()
      const warmUp = Date.now() - rtspStartTime < 5000
      const isStalled = !warmUp && info.bitrateKbps === 0 ? 1 : 0
      if (isStalled) rtspStallCount++

      rtspBitrateData.value.push(info.bitrateKbps)
      rtspPacketRateData.value.push(info.packetsPerSec)
      rtspStallData.value.push(isStalled)
      if (rtspBitrateData.value.length > maxDataPoints) rtspBitrateData.value.shift()
      if (rtspPacketRateData.value.length > maxDataPoints) rtspPacketRateData.value.shift()
      if (rtspStallData.value.length > maxDataPoints) rtspStallData.value.shift()
      maxRtspBitrate = Math.max(1000, ...rtspBitrateData.value)
      maxRtspPacketRate = Math.max(100, ...rtspPacketRateData.value)
    }
  } catch {
    // go2rtc may not be running yet
  }
}

onMounted(() => {
  intervalId = setInterval(update, props.updateInterval)
  draw()

  if (isRtspStream()) {
    fetchRtspInfo()
    rtspInfoInterval = setInterval(fetchRtspInfo, 100)
  }

  webrtcStats.on('stats', (ev: WebRTCStatsEvent) => {
    try {
      const videoData = ev.data.video.inbound[0]
      if (videoData === undefined) return
      connectionLost = videoData.bitrate === 0
      if (!isNaN(videoData.bitrate)) {
        const newBitrate = videoData.bitrate / 1000
        bitrate = bitrate * 0.8 + newBitrate * 0.2
      }
      packetLostDelta = videoData.packetsLost - packetsLost
      packetsLost = videoData.packetsLost
      nackCount = videoData.nackCount
      pliCount = videoData.pliCount
      firCount = videoData.firCount
      packetsReceived = videoData.packetsReceived
      let totalProcessingDelayDelta = videoData.totalProcessingDelay - totalProcessingDelay
      let framesDelta = videoData.framesReceived - framesReceived
      processingDelayDelta = (1000 * totalProcessingDelayDelta) / framesDelta
      framesReceived = videoData.framesReceived
      totalProcessingDelay = videoData.totalProcessingDelay
      packetLossPercentage = (packetsLost / (packetsLost + packetsReceived)) * 100
      freezes = videoData.freezeCount
      frozenTime = videoData.totalFreezesDuration
      framedrops = videoData.framesDropped
      framerate = videoData.framesPerSecond ?? 0
      videoHeight = videoData.frameHeight
    } catch (e) {
      console.error(e)
    }
  })
})

onUnmounted(() => {
  clearInterval(intervalId)
  if (rtspInfoInterval) clearInterval(rtspInfoInterval)
  cancelAnimationFrame(animationFrameId)
})

onBeforeUnmount(() => {
  webrtcStats.destroy()
})
</script>

<style scoped>
.canvas-container {
  position: absolute;
  top: 50px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2;
}
</style>
