<template>
  <div class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Depth HUD config</v-card-title>
      <v-card-text>
        <v-select
          v-if="!configUseCustomAltitudeVariable"
          v-model="configAltitudeVariableId"
          label="Altitude source"
          :items="altitudeSourceOptions"
          item-title="title"
          item-value="value"
          hide-details
          theme="dark"
          variant="outlined"
          density="compact"
          class="mb-2"
          @update:model-value="onAltitudeSourceSelected"
        />
        <v-autocomplete
          v-else
          v-model="configAltitudeVariableId"
          :items="availableDataLakeNumberVariables"
          item-title="name"
          item-value="id"
          label="Data lake variable"
          hint="Select any numeric data lake variable"
          persistent-hint
          theme="dark"
          variant="outlined"
          density="compact"
          clearable
          prepend-inner-icon="mdi-magnify"
          class="mb-2"
          @update:model-value="onAltitudeSourceSelected"
        />
        <v-checkbox
          v-model="configUseCustomAltitudeVariable"
          label="Use custom data lake variable"
          hide-details
          class="mb-2"
          @update:model-value="onUseCustomAltitudeVariableToggled"
        />
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

import { mergeAltitudeVariableOptions, useAltitudeSourceConfig } from '@/composables/useAltitudeSourceConfig'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useRangefinderDistance } from '@/composables/useRangefinderDistance'
import {
  altitudeSourceOptions,
  defaultDepthAltitudeVariableId,
  rawAltitudeToMeters,
} from '@/libs/data-sources/altitude'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { unitAbbreviation } from '@/libs/units'
import { resetCanvas, round, sequentialArray } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

datalogger.registerUsage(DatalogVariable.depth)

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

// Pre-defined HUD colors
const colorSwatches = ref([['#FF2D2D'], ['#0ADB0ACC'], ['#FFFFFF']])

const defaultOptions = {
  showDepthValue: true,
  hudColor: '#FFFFFF',
  altitudeVariableId: defaultDepthAltitudeVariableId,
  useCustomAltitudeVariable: false,
}

const {
  resolvedAltitudeVariableId,
  configAltitudeVariableId,
  configUseCustomAltitudeVariable,
  availableDataLakeNumberVariables,
  onAltitudeSourceSelected,
  onUseCustomAltitudeVariableToggled,
} = useAltitudeSourceConfig({
  widget,
  isConfigMenuOpen: () => widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen,
  defaultAltitudeVariableId: defaultDepthAltitudeVariableId,
})

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

const { distanceInMeters: rangefinderDistance } = useRangefinderDistance()

// Depth of the seafloor, or undefined when no rangefinder is measuring it
const seafloorDepth = computed(() => {
  if (rangefinderDistance.value === undefined) return undefined
  const distanceToBottom = unit(rangefinderDistance.value, 'm').to(interfaceStore.displayUnitPreferences.distance)
  return depth.value + distanceToBottom.toJSON().value
})

// Depth the bottom of the scale stands for: the seafloor when a rangefinder measures it, as that is the actual
// bottom, and otherwise room around the depths the vehicle has been through
const scaleBottom = computed(() => {
  if (seafloorDepth.value !== undefined) return Math.max(seafloorDepth.value, 0.1)
  return 1.3 * maxRecentDepth.value > 10 ? 1.3 * maxRecentDepth.value : 10
})

// Distance between plain lines and between the bolder, labeled ones, for the current scale. The sub-unit steps keep
// the scale readable when the rangefinder finds the bottom a few centimeters away.
const graphScaleSteps = computed(() => {
  if (scaleBottom.value <= 2) return { minor: 0.1, major: 0.5 }
  if (scaleBottom.value <= 5) return { minor: 0.25, major: 1 }
  if (scaleBottom.value <= 25) return { minor: 1, major: 5 }
  if (scaleBottom.value <= 125) return { minor: 2, major: 10 }
  if (scaleBottom.value <= 250) return { minor: 5, major: 25 }
  if (scaleBottom.value <= 500) return { minor: 10, major: 50 }
  return { minor: 20, major: 100 }
})

const depthGraphDistances = computed(() => {
  // Lines stop before the seafloor, as nothing belongs under it. Without one they carry on past the bottom of the
  // scale, into the band left at the edge of the widget.
  const linesPastScaleBottom = seafloorDepth.value === undefined ? 2 : 0
  const numberOfLines = Math.ceil(scaleBottom.value / graphScaleSteps.value.minor) + linesPastScaleBottom
  return sequentialArray(numberOfLines).map((index) => round(index * graphScaleSteps.value.minor, 2))
})

// Compares in step counts, as the remainder of a fractional step is not exact (0.3 % 0.1 is not 0).
const isMultipleOfStep = (distance: number, step: number): boolean => round(distance / step, 3) % 1 === 0
const currentUnit = computed(() => unitAbbreviation[interfaceStore.displayUnitPreferences.distance])

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  widget.value.options = mergeAltitudeVariableOptions(defaultOptions, widget.value.options)
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
const { value: rawAltitude } = useDataLakeVariable(resolvedAltitudeVariableId)

// Reset the depth history when the altitude source changes so the graph scale doesn't carry
// over the previous source's range while new values are still flowing in.
watch(resolvedAltitudeVariableId, () => {
  passedDepths.value = Array(10).fill(0)
})

watch([rawAltitude, resolvedAltitudeVariableId], ([newAlt, resolvedId]) => {
  if (resolvedId === undefined || typeof newAlt !== 'number') return
  const altMeters = rawAltitudeToMeters(resolvedId, newAlt)
  const newDepth = unit(-altMeters, 'm')

  const depthDiff = Math.abs(newDepth.value - (depth.value || 0))
  if (depthDiff < 0.01) return

  const depthConverted = newDepth.to(interfaceStore.displayUnitPreferences.distance)
  passedDepths.value.push(depthConverted.toJSON().value)
})

// Y position of the bottom of the scale, where the seafloor line sits when a rangefinder measures it. It stays short
// of the bottom of the widget so that its label clears the fade over the edge.
const scaleBottomY = computed(() => round(0.88 * canvasSize.value.height))

// Returns the projected Y position of the depth line for a given distance
const distanceY = (altitude: number): number => round((altitude / scaleBottom.value) * scaleBottomY.value)

// Y position where lines that should not be seen are parked, below the bottom of the widget
const hiddenLineY = (): number => round(canvasSize.value.height + 100)

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

  // Draw line for each distance
  for (const [distance, y] of Object.entries(renderVars.depthLinesY)) {
    // Nothing belongs under the seafloor, not even a line from a previous scale still animating its way out
    if (seafloorDepth.value !== undefined && y > scaleBottomY.value) continue

    const isMajorLine = isMultipleOfStep(Number(distance), graphScaleSteps.value.major)

    ctx.beginPath()
    ctx.moveTo(canvasWidth - stdPad - 3.3 * linesFontSize - minorLinesGap, y + initialPaddingY)
    ctx.lineTo(stdPad + 3.9 * refFontSize + refTriangleSize, y + initialPaddingY)
    ctx.lineWidth = '1'

    if (isMajorLine) {
      // For distances that are multiple of the major graph scale, use a bolder line and write distance down
      ctx.lineWidth = '2'
      ctx.moveTo(canvasWidth - stdPad - 3.3 * linesFontSize, y + initialPaddingY)
      ctx.lineTo(stdPad + 3.9 * refFontSize + refTriangleSize, y + initialPaddingY)
      // The seafloor keeps its own label when the two are too close for both to be readable
      const isCoveredBySeafloorLabel =
        seafloorDepth.value !== undefined && Math.abs(y - scaleBottomY.value) < linesFontSize
      if (!isCoveredBySeafloorLabel) {
        ctx.fillText(`${distance} ${currentUnit.value}`, canvasWidth - stdPad - 3 * linesFontSize, y + initialPaddingY)
      }
    }
    ctx.stroke()
  }

  // Draw the seafloor line and its depth, over the same span as the labeled lines of the scale, but thicker
  if (seafloorDepth.value !== undefined) {
    ctx.beginPath()
    ctx.lineWidth = '3'
    ctx.moveTo(canvasWidth - stdPad - 3.3 * linesFontSize, scaleBottomY.value + initialPaddingY)
    ctx.lineTo(stdPad + 3.9 * refFontSize + refTriangleSize, scaleBottomY.value + initialPaddingY)
    ctx.stroke()
    // Matches the precision of the scale, so the label does not read as a repeat of the line right above it
    const seafloorDecimals = graphScaleSteps.value.minor < 1 ? 2 : 1
    ctx.fillText(
      `${round(seafloorDepth.value, seafloorDecimals)} ${currentUnit.value}`,
      canvasWidth - stdPad - 3 * linesFontSize,
      scaleBottomY.value + initialPaddingY
    )
  }

  const indicatorY = Math.max(renderVars.indicatorY, 0)

  ctx.strokeStyle = widget.value.options.hudColor
  ctx.fillStyle = widget.value.options.hudColor

  // Draw reference text
  if (widget.value.options.showDepthValue) {
    ctx.textAlign = 'right'
    ctx.font = `bold ${refFontSize}px Arial`
    ctx.fillText(
      `${depth.value.toFixed(Math.abs(depth.value) < 1 ? 2 : 1)} ${currentUnit.value}`,
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
watch([depth, scaleBottom], () => {
  depthGraphDistances.value.forEach((distance) => {
    renderVars.depthLinesY[distance] ??= hiddenLineY()
    gsap.to(renderVars.depthLinesY, 0.5, { [distance]: distanceY(distance) })
  })
  const distancesToExclude = Object.keys(renderVars.depthLinesY).filter(
    (distance) => !depthGraphDistances.value.includes(Number(distance))
  )
  distancesToExclude.forEach((distance) => {
    gsap.to(renderVars.depthLinesY, 0.5, { [distance]: hiddenLineY() })
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
