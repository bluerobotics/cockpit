<template>
  <div class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="px-8 pb-6 pt-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">HUD Compass widget config</v-card-title>
      <v-card-text>
        <v-switch
          class="ma-1"
          label="Show yaw value"
          :color="widget.options.showYawValue ? 'white' : undefined"
          :model-value="widget.options.showYawValue"
          hide-details
          @change="widget.options.showYawValue = !widget.options.showYawValue"
        />
        <v-switch
          class="ma-1"
          label="Use -180/+180 range"
          :color="widget.options.useNegativeRange ? 'white' : undefined"
          :model-value="widget.options.useNegativeRange"
          hide-details
          @change="widget.options.useNegativeRange = !widget.options.useNegativeRange"
        />
        <v-expansion-panels theme="dark">
          <v-expansion-panel class="bg-[#FFFFFF11] text-white mt-2">
            <v-expansion-panel-title>Color</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-color-picker
                v-model="widget.options.hudColor"
                theme="dark"
                class="ma-1 bg-[#FFFFFF11] text-white"
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
import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees, radians, resetCanvas } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

datalogger.registerUsage(DatalogVariable.heading)
const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

// Pre-defined HUD colors
const colorSwatches = ref([['#FFFFFF'], ['#FF2D2D'], ['#0ADB0ACC']])

// prettier-ignore
const angleRender = (angle: number): string => {
  switch (angle) {
    case -180: return 'S'
    case -135: return 'SW'
    case -90: return 'W'
    case -45: return 'NW'
    case 0: return 'N'
    case 45: return 'NE'
    case 90: return 'E'
    case 135: return 'SE'
    case 180: return 'S'
    case 225: return 'SW'
    case 270: return 'W'
    case 315: return 'NW'
    case 360: return 'N'
    default:
      return `${angle}°`
  }
}

type RenderVariables = {
  /**
   * Object that stores the current state of the variables used on rendering
   * It acts like a buffer between the system state variables and the rendering process
   * Without it the state variables would be synced with rendering, which would
   * make the rendering aliased. With this buffer we use GSAP to control the transisioning smoothing process.
   */
  yawLinesX: { [angle: string]: number }
}
const renderVars = reactive<RenderVariables>({ yawLinesX: {} })

// Yaw angles for which vertical indication lines are rendered.
const yawAngles: number[] = []
let i = -180
while (i < 181) {
  yawAngles.push(i)
  i += 3
}

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showYawValue: true,
      hudColor: colorSwatches.value[0][0],
      useNegativeRange: false,
    }
  }
})
onMounted(() => {
  yawAngles.forEach((angle: number) => (renderVars.yawLinesX[angle] = angleX(angle)))
  renderCanvas()
})

// Make canvas size follows window resizing
const { width: windowWidth } = useWindowSize()
const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: 64,
}))

// The implementation below makes sure we don't update the Yaw value in the widget whenever
// the system Yaw (from vehicle) updates, preventing unnecessary performance bottlenecks.
const yaw = ref(0)
let oldYaw: number | undefined = undefined
watch(store.attitude, (attitude) => {
  const yawDiff = Math.abs(degrees(attitude.yaw - (oldYaw || 0)))
  if (yawDiff > 0.1) {
    oldYaw = attitude.yaw
    yaw.value = degrees(store.attitude.yaw)
  }
})

// Returns the projected X position of the yaw line for a given angle
const angleX = (angle: number): number => {
  const diff = angle - yaw.value || 0
  let x = -diff
  if (x < -180) {
    x += 360
  } else if (x > 180) {
    x -= 360
  }
  return -x
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
  resetCanvas(ctx)

  const halfCanvasWidth = 0.5 * canvasSize.value.width
  const halfCanvasHeight = 0.5 * canvasSize.value.height
  const linesFontSize = 12
  const refFontSize = 16
  const refTriangleSize = 10
  const stdPad = 2
  const minorLinesGap = 7

  // Set canvas general properties
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.font = `bold ${linesFontSize}px Arial`
  ctx.fillStyle = 'white'

  // Draw line for each angle
  for (const [angle, x] of Object.entries(renderVars.yawLinesX)) {
    if (x < -90 || x > 90) continue
    const angleOffsetX = ((2 * halfCanvasWidth) / Math.PI) * Math.sin(radians(x))
    const anglePositionX = halfCanvasWidth + angleOffsetX
    ctx.beginPath()
    ctx.moveTo(anglePositionX, refFontSize + stdPad + refTriangleSize + stdPad)
    ctx.lineTo(anglePositionX, halfCanvasHeight * 2 - linesFontSize - stdPad - minorLinesGap)
    ctx.lineWidth = '1'

    // For angles that are multiple of 15 degrees, use a bolder line and write angle down
    if (Number(angle) % 15 === 0) {
      ctx.lineWidth = '2'
      ctx.lineTo(anglePositionX, halfCanvasHeight * 2 - linesFontSize - stdPad)
      let finalAngle = Number(angle)
      if (!widget.value.options.useNegativeRange) {
        finalAngle = finalAngle < 0 ? finalAngle + 360 : finalAngle
      }
      ctx.fillText(angleRender(Number(finalAngle)), anglePositionX, halfCanvasHeight * 2 - stdPad)
    }
    ctx.stroke()
  }

  // Draw reference text
  if (widget.value.options.showYawValue) {
    ctx.font = `bold ${refFontSize}px Arial`

    let finalAngle = Number(yaw.value)
    if (!widget.value.options.useNegativeRange) {
      finalAngle = finalAngle < 0 ? finalAngle + 360 : finalAngle
    }
    ctx.fillText(`${finalAngle.toFixed(1)}°`, halfCanvasWidth, refFontSize)
  }

  // Draw reference triangle
  ctx.beginPath()
  ctx.moveTo(halfCanvasWidth, refFontSize + stdPad + refTriangleSize)
  ctx.lineTo(halfCanvasWidth - 0.5 * refTriangleSize, stdPad + refFontSize + stdPad)
  ctx.lineTo(halfCanvasWidth + 0.5 * refTriangleSize, stdPad + refFontSize + stdPad)
  ctx.lineTo(halfCanvasWidth, refFontSize + stdPad + refTriangleSize)
  ctx.closePath()
  ctx.fill()

  // Add transparent mask over widget borders
  ctx.globalCompositeOperation = 'source-in'
  const grH = ctx.createLinearGradient(0, halfCanvasHeight, canvasSize.value.width, halfCanvasHeight)
  grH.addColorStop(0.18, colord(widget.value.options.hudColor).alpha(0).toRgbString())
  grH.addColorStop(0.3, colord(widget.value.options.hudColor).alpha(1).toRgbString())
  grH.addColorStop(0.7, colord(widget.value.options.hudColor).alpha(1).toRgbString())
  grH.addColorStop(0.82, colord(widget.value.options.hudColor).alpha(0).toRgbString())
  ctx.fillStyle = grH
  ctx.fillRect(0, 0, canvasSize.value.width, halfCanvasHeight * 2)
}

// Update the X position of each line in the render variables with GSAP to smooth the transition
watch(yaw, () => {
  yawAngles.forEach((angle: number) => {
    const position = angleX(angle)
    // Only interpolate angle render with GSAP when the angle is not changing
    // sides, so it doesn't cross across the screen.
    if (Math.abs(renderVars.yawLinesX[angle] - position) > 90) {
      renderVars.yawLinesX[angle] = position
    } else {
      gsap.to(renderVars.yawLinesX, { duration: 2.5, ease: 'elastic.out(1.2, 0.5)', [angle]: position })
    }
  })
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
  min-width: 200px;
  min-height: 60px;
}
</style>
