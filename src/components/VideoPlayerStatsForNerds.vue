<template>
  <div class="canvas-container">
    <canvas ref="canvasRef" :width="width" :height="height"></canvas>
  </div>
</template>

<script lang="ts" setup>
import { WebRTCStats } from '@peermetrics/webrtc-stats'
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'

import { useVideoStore } from '@/stores/video'
import { WebRTCStatsEvent } from '@/types/video'
const videoStore = useVideoStore()

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

  // Draw the plots
  drawPlot(bitrateData.value, 'rgb(255, 165, 0)', maxBitrateReceived)
  drawPlot(framerateData.value, 'rgb(0, 255, 0)', maxFramerateReceived)
  drawPlot(packetLostData.value, 'rgb(255, 0, 0)', maxPacketLost)

  // Print text stats
  const color = connectionLost ? 'red' : 'white'
  const stats = [
    { label: 'Stream', value: props.streamName, color: color },
    { label: 'Size', value: videoHeight ? `${videoHeight}p` : 'N/A', color: color },
    { label: 'Packets Lost', value: `${packetsLost} (${packetLossPercentage.toFixed(0)}%)`, color: color },
    { label: 'Frame drops', value: framedrops, color: color },
    { label: 'Nack', value: nackCount, color: color },
    { label: 'Pli', value: pliCount, color: color },
    { label: 'Fir', value: firCount, color: color },
    { label: 'Processing ', value: `${processingDelayDelta.toFixed(0)}ms`, color: color },
    { label: 'Freezes', value: `${freezes}(${frozenTime.toFixed(1)}s)`, color: color },
    { label: 'Bitrate', value: `${bitrate.toFixed(0)}kbps`, color: 'rgb(255, 165, 0)' },
    { label: 'FPS', value: framerate.toFixed(2), color: 'rgb(0, 255, 0)' },
  ]

  ctx.font = '10px Arial'
  stats.forEach((stat, index) => {
    ctx.fillStyle = stat.color
    ctx.fillText(`${stat.label}: ${stat.value}`, 5, 12 + index * 12)
  })

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

  // Update max values
  maxBitrateReceived = Math.max(maxBitrateReceived, ...bitrateData.value)
  maxFramerateReceived = Math.max(maxFramerateReceived, ...framerateData.value)
  maxFramerateReceived = Math.min(maxFramerateReceived, absoluteMaxFrameRate)
}

watch(videoStore.activeStreams, (streams): void => {
  Object.keys(streams).forEach((streamName) => {
    if (streamName !== props.streamName) return
    const session = streams[streamName]?.webRtcManager.session
    if (!session || !session.peerConnection) return
    if (webrtcStats.peersToMonitor[session.consumerId]) return
    webrtcStats.addConnection({
      pc: session.peerConnection,
      peerId: session.consumerId,
      connectionId: session.id,
      remote: false,
    })
  })
})

onMounted(() => {
  intervalId = setInterval(update, props.updateInterval)
  draw()
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
