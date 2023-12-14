<template>
  <div ref="virtualHorizonRoot" class="virtualHorizon">
    <canvas
      ref="canvasRef"
      :height="smallestDimension"
      :width="smallestDimension"
      class="rounded-[15%] bg-slate-950/70"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import gsap from 'gsap'
import { computed, ref } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees, radians, resetCanvas } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

datalogger.registerUsage(DatalogVariable.roll)
datalogger.registerUsage(DatalogVariable.pitch)
const store = useMainVehicleStore()
const virtualHorizonRoot = ref()
const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()

// Object used to store current render state
const renderVariables = {
  pitchAngleDegrees: 0,
  rollAngleDegrees: 0,
}

// Calculates the smallest between the widget dimensions, so we can keep the inner content always inside it, without overlays
const { width, height } = useElementSize(virtualHorizonRoot)
const smallestDimension = computed(() => (width.value < height.value ? width.value : height.value))

// Renders the updated canvas state
const renderCanvas = (): void => {
  if (canvasRef.value === undefined || canvasRef.value === null) return
  if (canvasContext.value === undefined) canvasContext.value = canvasRef.value.getContext('2d')
  const ctx = canvasContext.value
  resetCanvas(ctx)

  const halfCanvasSize = 0.5 * smallestDimension.value

  // Set canvas general properties
  const fontSize = 0.06 * smallestDimension.value
  const baseLineWidth = 0.03 * halfCanvasSize

  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.fillStyle = 'white'
  ctx.lineWidth = baseLineWidth
  ctx.textBaseline = 'middle'

  const outerCircleRadius = 0.7 * halfCanvasSize

  // Start drawing from the center
  ctx.translate(halfCanvasSize, halfCanvasSize)

  // Set 0 degrees on the top position
  ctx.rotate(radians(-90))

  ctx.rotate(radians(90))

  // Draw outer circle
  ctx.save()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1.5 * baseLineWidth
  ctx.beginPath()
  ctx.arc(0, 0, outerCircleRadius, 0, radians(360))
  ctx.stroke()
  ctx.restore()

  ctx.save()

  ctx.rotate(radians(-1 * renderVariables.rollAngleDegrees))

  // Draw circular clipping mask
  ctx.beginPath()
  ctx.arc(0, 0, outerCircleRadius, 0, radians(360))
  ctx.clip()

  const pitchGainFactor = 4
  const zeroPitchLineHeight = pitchGainFactor * (renderVariables.pitchAngleDegrees / 90) * outerCircleRadius

  // Draw virtual horizon ground and sky
  const skyGradient = ctx.createLinearGradient(0, -outerCircleRadius, 0, outerCircleRadius)
  skyGradient.addColorStop(0, 'rgb(69, 144, 190)')
  skyGradient.addColorStop(1, 'rgb(137, 190, 228)')
  ctx.fillStyle = skyGradient
  ctx.fillRect(-1.5 * outerCircleRadius, zeroPitchLineHeight, +3 * outerCircleRadius, -3 * outerCircleRadius)
  const groundGradient = ctx.createLinearGradient(0, -outerCircleRadius, 0, outerCircleRadius)
  groundGradient.addColorStop(0, 'rgb(176, 117, 80)')
  groundGradient.addColorStop(1, 'rgb(200, 149, 98)')
  ctx.fillStyle = groundGradient
  ctx.fillRect(-1.5 * outerCircleRadius, zeroPitchLineHeight, +3 * outerCircleRadius, 3 * outerCircleRadius)

  // Draw virtual horizon moving line
  ctx.lineWidth = 0.6 * baseLineWidth
  ctx.strokeStyle = 'white'
  ctx.beginPath()
  ctx.moveTo(-0.75 * outerCircleRadius, zeroPitchLineHeight)
  ctx.lineTo(-0.45 * outerCircleRadius, zeroPitchLineHeight)
  ctx.lineTo(-0.43 * outerCircleRadius, zeroPitchLineHeight + 0.07 * outerCircleRadius)
  ctx.moveTo(0.75 * outerCircleRadius, zeroPitchLineHeight)
  ctx.lineTo(0.45 * outerCircleRadius, zeroPitchLineHeight)
  ctx.lineTo(0.43 * outerCircleRadius, zeroPitchLineHeight + 0.07 * outerCircleRadius)
  ctx.stroke()

  // Draw pitch lines
  ctx.save()
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 0.5 * baseLineWidth
  ctx.font = `bold ${fontSize}px Arial`
  for (const angle of [-10, 0, 10]) {
    const lineSizeMultiplier = pitchGainFactor * Math.abs(angle / 300) || 0.15
    const pitchLineHeight = pitchGainFactor * (angle / 90) * outerCircleRadius
    const smallerPitchLineHeight = pitchGainFactor * ((angle - 5 * Math.sign(angle)) / 90) * outerCircleRadius
    ctx.beginPath()
    ctx.moveTo(-lineSizeMultiplier * outerCircleRadius, pitchLineHeight)
    ctx.lineTo(+lineSizeMultiplier * outerCircleRadius, pitchLineHeight)
    ctx.moveTo(-0.5 * lineSizeMultiplier * outerCircleRadius, smallerPitchLineHeight)
    ctx.lineTo(+0.5 * lineSizeMultiplier * outerCircleRadius, smallerPitchLineHeight)
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.abs(angle)}`, -1 * (lineSizeMultiplier * outerCircleRadius + 0.3 * fontSize), pitchLineHeight)
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.abs(angle)}`, 1 * (lineSizeMultiplier * outerCircleRadius + 0.3 * fontSize), pitchLineHeight)
  }
  ctx.restore()

  ctx.restore()

  // Draw current horizon fixed reference lines
  ctx.save()
  ctx.lineWidth = 0.8 * baseLineWidth
  ctx.rotate(radians(-1 * renderVariables.rollAngleDegrees))
  ctx.beginPath()
  ctx.moveTo(-1 * outerCircleRadius, 0)
  ctx.lineTo(-0.85 * outerCircleRadius, 0)
  ctx.moveTo(0.85 * outerCircleRadius, 0)
  ctx.lineTo(1 * outerCircleRadius, 0)
  ctx.stroke()
  ctx.restore()

  // Draw current roll fixed reference lines
  for (const angle of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    ctx.save()
    ctx.rotate(radians(angle))
    ctx.beginPath()
    if ([-60, -30, 30, 60].includes(angle)) {
      ctx.lineWidth = 0.8 * baseLineWidth
      ctx.moveTo(0, -1.2 * outerCircleRadius)
      ctx.lineTo(0, -1 * outerCircleRadius)
    } else if ([-20, -10, 10, 20].includes(angle)) {
      ctx.lineWidth = 0.6 * baseLineWidth
      ctx.moveTo(0, -1.1 * outerCircleRadius)
      ctx.lineTo(0, -1 * outerCircleRadius)
    } else if ([-45, 45].includes(angle)) {
      ctx.lineWidth = 0.01 * baseLineWidth
      ctx.moveTo(0, -1.01 * outerCircleRadius)
      ctx.lineTo(-0.05 * outerCircleRadius, -1.15 * outerCircleRadius)
      ctx.lineTo(+0.05 * outerCircleRadius, -1.15 * outerCircleRadius)
      ctx.lineTo(0, -1.01 * outerCircleRadius)
    } else if (angle === 0) {
      ctx.lineWidth = 0.01 * baseLineWidth
      ctx.moveTo(0, -1.01 * outerCircleRadius)
      ctx.lineTo(-0.07 * outerCircleRadius, -1.25 * outerCircleRadius)
      ctx.lineTo(+0.07 * outerCircleRadius, -1.25 * outerCircleRadius)
      ctx.lineTo(0, -1.01 * outerCircleRadius)
    }
    ctx.stroke()
    ctx.fill()
    ctx.restore()
  }

  // Draw virtual roll moving triangle
  ctx.save()
  ctx.beginPath()
  ctx.rotate(radians(90))
  ctx.rotate(radians(-1 * renderVariables.rollAngleDegrees))
  ctx.lineWidth = 0.01 * baseLineWidth
  ctx.fillStyle = 'rgb(221, 43, 43)'
  ctx.moveTo(-1 * outerCircleRadius, 0)
  ctx.lineTo(-0.8 * outerCircleRadius, -0.08 * outerCircleRadius)
  ctx.lineTo(-0.8 * outerCircleRadius, 0.08 * outerCircleRadius)
  ctx.lineTo(-1 * outerCircleRadius, 0)
  ctx.stroke()
  ctx.fill()
  ctx.restore()
}

// Update canvas at 60fps
setInterval(() => {
  gsap.to(renderVariables, 0.1, {
    pitchAngleDegrees: degrees(store.attitude.pitch ?? 0),
    rollAngleDegrees: degrees(store.attitude.roll ?? 0),
  })
  renderCanvas()
}, 1000 / 60)
</script>

<style scoped>
.virtualHorizon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>
