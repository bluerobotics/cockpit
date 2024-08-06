<template>
  <div ref="compassRoot" class="compass">
    <canvas
      ref="canvasRef"
      :height="smallestDimension"
      :width="smallestDimension"
      class="rounded-[15%] bg-slate-950/70"
    ></canvas>
  </div>
  <Dialog
    v-model:show="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
    class="flex pa-4 bg-[#ffffff10] text-white backdrop-blur-2xl border-[1px] border-[#FAFAFA12]"
  >
    <div class="flex items-center">
      <span class="mr-3 text-slate-100">Heading style</span>
      <div class="w-40"><Dropdown v-model="widget.options.headingStyle" :options="headingOptions" /></div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import gsap from 'gsap'
import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import Dialog from '@/components/Dialog.vue'
import Dropdown from '@/components/Dropdown.vue'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees, radians, resetCanvas, sequentialArray } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

datalogger.registerUsage(DatalogVariable.heading)
const store = useMainVehicleStore()
const compassRoot = ref()
const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()

// Angles used for the main marks
const mainAngles = {
  [0]: 'N',
  [45]: 'NE',
  [90]: 'E',
  [135]: 'SE',
  [180]: 'S',
  [225]: 'SW',
  [270]: 'W',
  [315]: 'NW',
}

/**
 * Possible compass configurations.
 * North-up keeps the cardinal points fixed, while the vehicle rotates.
 * Head-up keeps the vehicle pointing up, while the cardinal points rotate.
 */
enum HeadingStyle {
  NORTH_UP = 'North Up',
  HEAD_UP = 'Head Up',
}
const headingOptions = Object.values(HeadingStyle)

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      headingStyle: headingOptions[0],
    }
  }
})

onMounted(() => {
  // Set initial value to 0.01 since 0.0 and 360 does not render anything
  adjustLinesX()
  renderCanvas()
})

// Make canvas size follows window resizing
const { width: windowWidth, height: windowHeight } = useWindowSize()
const width = computed(() => widget.value.size.width * windowWidth.value)
const height = computed(() => widget.value.size.height * windowHeight.value)

// Calculates the smallest between the widget dimensions, so we can keep the inner content always inside it, without overlays
const smallestDimension = computed(() => (width.value < height.value ? width.value : height.value))

// Renders the updated canvas state
const renderCanvas = (): void => {
  if (canvasRef.value === undefined || canvasRef.value === null) return
  if (canvasContext.value === undefined) canvasContext.value = canvasRef.value.getContext('2d')

  const ctx = canvasContext.value
  resetCanvas(ctx)

  const halfCanvasSize = 0.5 * smallestDimension.value

  // Set canvas general properties
  const fontSize = 0.13 * smallestDimension.value
  const baseLineWidth = 0.03 * halfCanvasSize

  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.fillStyle = 'white'
  ctx.lineWidth = baseLineWidth
  ctx.textBaseline = 'middle'

  const outerCircleRadius = 0.7 * halfCanvasSize
  const innerIndicatorRadius = 0.4 * halfCanvasSize
  const outerIndicatorRadius = 0.55 * halfCanvasSize

  // Start drawing from the center
  ctx.translate(halfCanvasSize, halfCanvasSize)

  // Draw central angle text
  ctx.font = `bold ${fontSize}px Arial`
  ctx.fillText(`${renderVariables.yawAngleDegrees.toFixed(0)}°`, 0.15 * fontSize, 0)

  // Set 0 degrees on the top position
  ctx.rotate(radians(-90))

  // Draw line and identification for each cardinal and sub-cardinal angle
  if (widget.value.options.headingStyle == HeadingStyle.HEAD_UP) {
    ctx.rotate(-radians(renderVariables.yawAngleDegrees))
  }
  for (const [angleDegrees, angleName] of Object.entries(mainAngles)) {
    ctx.save()

    ctx.rotate(radians(Number(angleDegrees)))
    ctx.beginPath()
    ctx.moveTo(outerIndicatorRadius, 0)
    ctx.lineTo(outerCircleRadius, 0)

    // Draw angle text
    ctx.textBaseline = 'bottom'
    ctx.font = `bold ${0.7 * fontSize}px Arial`
    ctx.translate(outerCircleRadius * 1.025, 0)
    ctx.rotate(radians(90))
    ctx.fillText(angleName, 0, 0)

    ctx.stroke()
    ctx.restore()
  }

  // Draw line for each smaller angle, with 9 degree steps
  for (const angleDegrees of sequentialArray(360)) {
    if (angleDegrees % 9 !== 0) continue
    ctx.save()
    ctx.lineWidth = 0.25 * baseLineWidth
    ctx.rotate(radians(Number(angleDegrees)))
    ctx.beginPath()
    ctx.moveTo(1.1 * outerIndicatorRadius, 0)
    ctx.lineTo(outerCircleRadius, 0)
    ctx.stroke()
    ctx.restore()
  }

  // Draw outer circle
  ctx.beginPath()
  ctx.arc(0, 0, outerCircleRadius, 0, radians(360))
  ctx.stroke()

  // Draw central indicator
  if (widget.value.options.headingStyle == HeadingStyle.NORTH_UP) {
    ctx.rotate(radians(renderVariables.yawAngleDegrees))
  } else {
    ctx.rotate(radians(renderVariables.yawAngleDegrees))
  }
  ctx.beginPath()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'red'
  ctx.fillStyle = 'red'
  const triangleBaseSize = 0.05 * halfCanvasSize
  ctx.moveTo(innerIndicatorRadius, triangleBaseSize)
  ctx.lineTo(outerIndicatorRadius - 0.5 * triangleBaseSize, 0)
  ctx.lineTo(innerIndicatorRadius, -triangleBaseSize)
  ctx.lineTo(innerIndicatorRadius, triangleBaseSize)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

/**
 * Deal with high frequency update and decrease cpu usage when drawing low degrees changes
 */

const yaw = ref(0.01)
let oldYaw: number | undefined = undefined
watch(store.attitude, (attitude) => {
  if (oldYaw === undefined) {
    yaw.value = degrees(store.attitude.yaw)
    oldYaw = attitude.yaw
    return
  }
  const yawDiff = Math.abs(degrees(attitude.yaw - oldYaw))
  if (yawDiff > 0.1) {
    oldYaw = attitude.yaw
    yaw.value = degrees(store.attitude.yaw)
  }
})

// eslint-disable-next-line jsdoc/require-jsdoc
type RenderVariables = { yawAngleDegrees: number }
// Object used to store current render state
const renderVariables = reactive<RenderVariables>({ yawAngleDegrees: 0 })

// Update the X position of each line in the render variables with GSAP to smooth the transition
const adjustLinesX = (): void => {
  const angleDegrees = yaw.value

  const fullRangeAngleDegrees = angleDegrees < 0 ? angleDegrees + 360 : angleDegrees

  const fromWestToEast = renderVariables.yawAngleDegrees > 270 && fullRangeAngleDegrees < 90
  const fromEastToWest = renderVariables.yawAngleDegrees < 90 && fullRangeAngleDegrees > 270
  // If cruzing 0 degrees, use a chained animation, so the pointer does not turn 360 degrees to the other side (visual artifact)
  if (fromWestToEast) {
    gsap.to(renderVariables, 0.05, { yawAngleDegrees: 0 })
    gsap.fromTo(renderVariables, 0.05, { yawAngleDegrees: 0 }, { yawAngleDegrees: fullRangeAngleDegrees })
  } else if (fromEastToWest) {
    gsap.to(renderVariables, 0.05, { yawAngleDegrees: 360 })
    gsap.fromTo(renderVariables, 0.05, { yawAngleDegrees: 360 }, { yawAngleDegrees: fullRangeAngleDegrees })
  } else {
    gsap.to(renderVariables, 0.1, { yawAngleDegrees: fullRangeAngleDegrees })
  }
}

// When the yaw changes, adjust the lines X position
watch(yaw, () => adjustLinesX())

// Update canvas whenever reference variables changes
watch([renderVariables, width, height], () => {
  if (!widgetStore.isWidgetVisible(widget.value)) return
  nextTick(() => renderCanvas())
})
</script>

<style scoped>
.compass {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>
