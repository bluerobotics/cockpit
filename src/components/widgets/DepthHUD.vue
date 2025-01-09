<template>
  <div class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Depth HUD config</v-card-title>
      <v-card-text>
        <v-switch
          class="ma-1"
          label="Show height value"
          :model-value="widget.options.showDepthValue"
          :color="widget.options.showDepthValue ? 'white' : undefined"
          hide-details
          @change="widget.options.showDepthValue = !widget.options.showDepthValue"
        />
        <v-expansion-panels theme="dark">
          <v-expansion-panel class="bg-[#FFFFFF11] text-white">
            <v-expansion-panel-title>Color</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-color-picker
                v-model="widget.options.hudColor"
                class="ma-2 text-white bg-[#FFFFFF11]"
                :swatches="colorSwatches"
                width="100%"
                show-swatches
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useWindowSize } from '@vueuse/core'
import { colord } from 'colord'
import gsap from 'gsap'
import { unit } from 'mathjs'
import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { unitAbbreviation } from '@/libs/units'
import { range, resetCanvas, round } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()

datalogger.registerUsage(DatalogVariable.depth)
const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

// Pre-defined HUD colors
const colorSwatches = ref([['#FF2D2D'], ['#0ADB0ACC'], ['#FFFFFF']])

type RenderVariables = {
  /**
   * Object that stores the current state of the variables used on rendering
   * It acts like a buffer between the system state variables and the rendering process
   * Without it the state variables would be synced with rendering, which would
   * make the rendering aliased. With this buffer we use GSAP to control the transisioning smoothing process.
   */
  depthLinesY: { [distance: string]: number }
  /**
   *
   */
  indicatorY: number
}
const renderVars = reactive<RenderVariables>({ depthLinesY: {}, indicatorY: 0 })

const passedDepths = ref<number[]>(Array(10).fill(0))
const depth = computed(() => passedDepths.value[passedDepths.value.length - 1])
const recentDepths = computed(() => passedDepths.value.slice(-10))
const maxRecentDepth = computed(() => Math.max(...recentDepths.value))
const maxGraphDepth = computed(() => (1.3 * maxRecentDepth.value > 10 ? 1.3 * maxRecentDepth.value : 10))
const depthGraphDistances = computed(() => range(0, maxGraphDepth.value + 1))
const maxDepth = computed(() => Math.max(...depthGraphDistances.value))
const currentUnit = computed(() => unitAbbreviation[interfaceStore.displayUnitPreferences.distance])

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showDepthValue: true,
      hudColor: colorSwatches.value[2][0],
    }
  }
})
onMounted(() => {
  depthGraphDistances.value.forEach((distance: number) => (renderVars.depthLinesY[distance] = distanceY(distance)))
  renderCanvas()
})

// Make canvas size follows window resizing
const { height: windowHeight } = useWindowSize()
const canvasSize = computed(() => ({
  width: 128,
  height: widget.value.size.height * windowHeight.value,
}))

// The implementation below makes sure we don't update the Depth value in the widget whenever
// the system Depth (from vehicle) updates, preventing unnecessary performance bottlenecks.
watch(store.altitude, () => {
  const altitude = store.altitude.msl
  const newDepth = unit(-altitude.value, altitude.toJSON().unit)

  const depthDiff = Math.abs(newDepth.value - (depth.value || 0))
  if (depthDiff < 0.1) return

  const depthConverted = newDepth.to(interfaceStore.displayUnitPreferences.distance)
  passedDepths.value.push(depthConverted.toJSON().value)
})

// Returns the projected Y position of the depth line for a given distance
const distanceY = (altitude: number): number => {
  const diff = altitude
  const heightFactor = canvasSize.value.height / maxDepth.value
  return round(heightFactor * diff)
}

const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()
const renderCanvas = (): void => {
  if (canvasRef.value === undefined || canvasRef.value === null) return
  if (canvasContext.value === undefined) {
    console.debug('Canvas context undefined!')
    canvasContext.value = canvasRef.value.getContext('2d')
    return
  }
  const ctx = canvasContext.value
  const canvasWidth = canvasSize.value.width
  const canvasHeight = canvasSize.value.height
  resetCanvas(ctx)

  const linesFontSize = 12
  const refFontSize = 16
  const refTriangleSize = 10
  const stdPad = 1
  const minorLinesGap = 5
  const initialPaddingY = 10 * stdPad

  // Set canvas general properties
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${linesFontSize}px Arial`
  ctx.strokeStyle = widget.value.options.hudColor
  ctx.fillStyle = widget.value.options.hudColor

  let lineDivisors = [1, 5]
  if (maxGraphDepth.value > 25) lineDivisors = [2, 10]
  if (maxGraphDepth.value > 125) lineDivisors = [5, 25]
  if (maxGraphDepth.value > 250) lineDivisors = [10, 50]
  if (maxGraphDepth.value > 500) lineDivisors = [20, 100]

  // Draw line for each distance
  for (const [distance, y] of Object.entries(renderVars.depthLinesY)) {
    if (Number(distance) % lineDivisors[0] === 0) {
      ctx.beginPath()
      ctx.moveTo(canvasWidth - stdPad - 3.3 * linesFontSize - minorLinesGap, y + initialPaddingY)
      ctx.lineTo(stdPad + 3.9 * refFontSize + refTriangleSize, y + initialPaddingY)
      ctx.lineWidth = '1'
    }
    if (Number(distance) % lineDivisors[1] === 0) {
      // For distances that are multiple of the major graph scale, use a bolder line and write distance down
      ctx.lineWidth = '2'
      ctx.moveTo(canvasWidth - stdPad - 3.3 * linesFontSize, y + initialPaddingY)
      ctx.lineTo(stdPad + 3.9 * refFontSize + refTriangleSize, y + initialPaddingY)
      ctx.fillText(`${distance} ${currentUnit.value}`, canvasWidth - stdPad - 3 * linesFontSize, y + initialPaddingY)
    }
    ctx.stroke()
  }

  const indicatorY = Math.max(renderVars.indicatorY, 0)

  ctx.strokeStyle = widget.value.options.hudColor
  ctx.fillStyle = widget.value.options.hudColor

  // Draw reference text
  if (widget.value.options.showDepthValue) {
    ctx.textAlign = 'right'
    ctx.font = `bold ${refFontSize}px Arial`
    ctx.fillText(
      `${depth.value.toFixed(1)} ${currentUnit.value}`,
      stdPad + 4.3 * refFontSize - refTriangleSize - stdPad,
      indicatorY + initialPaddingY
    )
  }

  // Draw reference triangle
  ctx.beginPath()
  ctx.moveTo(stdPad + 4.3 * refFontSize + stdPad, indicatorY + initialPaddingY)
  ctx.lineTo(stdPad + 4.3 * refFontSize + stdPad - refTriangleSize, indicatorY - refTriangleSize / 2 + initialPaddingY)
  ctx.lineTo(stdPad + 4.3 * refFontSize + stdPad - refTriangleSize, indicatorY + refTriangleSize / 2 + initialPaddingY)
  ctx.closePath()
  ctx.fill()

  // Add transparent mask over widget borders
  ctx.globalCompositeOperation = 'source-in'
  const grH = ctx.createLinearGradient(canvasWidth / 2, 0, canvasWidth / 2, canvasHeight)
  grH.addColorStop(0.95, widget.value.options.hudColor)
  grH.addColorStop(1.0, colord(widget.value.options.hudColor).alpha(0).toRgbString())
  ctx.fillStyle = grH
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
}

// Update the X position of each line in the render variables with GSAP to smooth the transition
watch(depth, () => {
  depthGraphDistances.value.forEach((distance) => {
    renderVars.depthLinesY[distance] ??= round(canvasSize.value.height + 100)
    gsap.to(renderVars.depthLinesY, 0.5, { [distance]: distanceY(distance) })
  })
  const distancesToExclude = Object.keys(renderVars.depthLinesY).filter(
    (distance) => !depthGraphDistances.value.includes(Number(distance))
  )
  distancesToExclude.forEach((distance) => {
    gsap.to(renderVars.depthLinesY, 0.5, { [distance]: round(canvasSize.value.height + 100) })
  })
  gsap.to(renderVars, 0.5, { indicatorY: distanceY(depth.value) })
})

// Update canvas whenever reference variables changes
watch([renderVars, canvasSize, widget.value.options], () => {
  if (!widgetStore.isWidgetVisible(widget.value)) return
  nextTick(() => renderCanvas())
})

const canvasVisible = useElementVisibility(canvasRef)
watch(canvasVisible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible) renderCanvas()
})
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 150px;
  min-height: 200px;
}
</style>
