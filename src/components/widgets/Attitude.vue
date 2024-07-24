<template>
  <div class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="45%">
    <v-card class="pa-4" :style="interfaceStore.globalGlassMenuStyles" style="border-radius: 15px">
      <v-card-title class="text-center">Attitude widget config</v-card-title>
      <v-card-text>
        <div class="flex justify-center gap-x-8 mb-4">
          <v-switch
            class="ma-1"
            label="Show roll/pitch values"
            :model-value="widget.options.showRollPitchValues"
            :color="widget.options.showRollPitchValues ? 'white' : undefined"
            hide-details
            @change="widget.options.showRollPitchValues = !widget.options.showRollPitchValues"
          />
          <v-switch
            class="ma-1"
            label="Show center aim"
            :model-value="widget.options.showCenterAim"
            :color="widget.options.showCenterAim ? 'white' : undefined"
            hide-details
            @change="widget.options.showCenterAim = !widget.options.showCenterAim"
          />
          <v-switch
            class="ma-1"
            label="Show pitch lines"
            :model-value="widget.options.showPitchLines"
            :color="widget.options.showPitchLines ? 'white' : undefined"
            hide-details
            @change="widget.options.showPitchLines = !widget.options.showPitchLines"
          />
        </div>
        <v-slider
          v-model="widget.options.cameraFOV"
          color="white"
          label="Camera vertical FOV"
          :min="20"
          :max="180"
          thumb-label
        />
        <v-slider
          v-model="widget.options.desiredAimRadius"
          label="Center circle radius"
          color="white"
          :min="10"
          :max="300"
          thumb-label
        />
        <v-expansion-panels theme="dark">
          <v-expansion-panel class="bg-[#FFFFFF22]">
            <v-expansion-panel-title>Color</v-expansion-panel-title>
            <v-expansion-panel-text class="pa-2">
              <v-color-picker
                v-model="widget.options.hudColor"
                class="ma-1 bg-[#FFFFFF11] text-white"
                :swatches="colorSwatches"
                show-swatches
                width="100%"
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
import gsap from 'gsap'
import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { constrain, degrees, radians, resetCanvas, round } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

datalogger.registerUsage(DatalogVariable.roll)
datalogger.registerUsage(DatalogVariable.pitch)
const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()

type RenderVariables = {
  /**
   * Rendering roll value, in degrees
   */
  rollDegrees: number
  /**
   * Vertical height of the pitch line for each angle
   */
  pitchLinesHeights: { [angle: string]: number }

  /**
   * Camera tilt angle, in degrees
   */
  cameraTiltDeg: number

  /**
   * Rendering pitch value, in degrees
   */
  pitchDegrees: number
}

const rollAngleDeg = ref(0)
const pitchAngleDeg = ref(0)
const cameraTiltDeg = ref(undefined as number | undefined)

// Pitch angles for which horizontal indication lines are rendered.
const pitchAngles = [-90, -70, -45, -30, -10, 0, 10, 30, 45, 70, 90]

// Rendering variables. Store current rendering state.
const renderVars = reactive<RenderVariables>({
  rollDegrees: 0,
  pitchLinesHeights: {},
  cameraTiltDeg: 0,
  pitchDegrees: 0,
})

// Pre-defined HUD colors
const colorSwatches = ref([['#FFFFFF'], ['#FF2D2D'], ['#0ADB0ACC']])

const defaultOptions = {
  showCenterAim: true,
  showPitchLines: true,
  showRollPitchValues: true,
  desiredAimRadius: 150,
  hudColor: colorSwatches.value[0][0],
  cameraFOV: 64,
}
onBeforeMount(() => {
  // Set initial widget options if they don't exist
  Object.entries(defaultOptions).forEach(([key, value]) => {
    if (widget.value.options[key] === undefined) {
      widget.value.options[key] = value
    }
  })
})

onMounted(() => {
  // Instantiate the initial pitch object
  pitchAngles.forEach((a: number) => (renderVars.pitchLinesHeights[a] = 5 * a))
  renderCanvas()
})

// Make canvas size follows window resizing
const { width: windowWidth, height: windowHeight } = useWindowSize()
const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: widget.value.size.height * windowHeight.value,
}))

// Center aim radius, constrained from user's input
const aimRadius = computed(() => constrain(widget.value.options.desiredAimRadius, 35, 0.2 * canvasSize.value.width))

/**
 * Deal with high frequency update and decrease cpu usage when drawing
 * low degrees changes
 */
let oldRoll: number | undefined = undefined
let oldPitch: number | undefined = undefined
watch(store.attitude, (attitude) => {
  const rollDiff = Math.abs(degrees(attitude.roll - (oldRoll || 0)))
  const pitchDiff = Math.abs(degrees(attitude.pitch - (oldPitch || 0)))

  if (rollDiff > 0.1) {
    oldRoll = attitude.roll
    rollAngleDeg.value = degrees(store.attitude.roll)
  }

  if (pitchDiff > 0.1) {
    oldPitch = attitude.pitch
    pitchAngleDeg.value = degrees(store.attitude.pitch)
  }
})

watch(store.genericVariables, (message: Record<string, unknown>) => {
  const new_tilt = message.cameraTiltDeg as number
  if (cameraTiltDeg.value === undefined || Math.abs(new_tilt - cameraTiltDeg.value) > 0.1) {
    cameraTiltDeg.value = new_tilt
  }
})

// Returns the projected height of a pitch line for a given angle
const angleY = (angle: number): number => {
  // if we had 180 deg of fov, top would be 90
  // if we had 90 deg of fov, top would be 45
  // then we scale the angle accordingly.
  const angle_factor = 180 / widget.value.options.cameraFOV
  // now we scale the current angle to 180 deg fov
  const scaled_angle = angle / 180
  const ret = scaled_angle * angle_factor * canvasSize.value.height
  return ret
}

const canvasVisible = useElementVisibility(canvasRef)
watch(canvasVisible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible) renderCanvas()
})

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
  const refFontSize = 22
  const stdPad = 2

  // Set canvas general properties
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.font = `bold ${linesFontSize}px Arial`
  ctx.fillStyle = 'white'
  const pitchLinesStartRadius = 2.0 * aimRadius.value

  ctx.translate(halfCanvasWidth, halfCanvasHeight)
  ctx.rotate(radians(renderVars.rollDegrees))

  let centerPos = 0
  if (cameraTiltDeg.value !== undefined) {
    centerPos = -angleY(renderVars.cameraTiltDeg + renderVars.pitchDegrees)
  }

  // Draw line for each angle
  for (const [angle, height] of Object.entries(renderVars.pitchLinesHeights)) {
    ctx.beginPath()

    const lineWidthFactor = Number(angle) === 0 ? 1.0 : 0.7
    const lineDashPattern = Number(angle) === 0 ? [] : [5, 2]
    const lineThickness = Number(angle) === 0 ? 3 : 2

    ctx.lineWidth = lineThickness
    ctx.setLineDash(lineDashPattern)

    if (widget.value.options.showPitchLines) {
      const distanceFromCenter = pitchLinesStartRadius + lineWidthFactor * (halfCanvasWidth - pitchLinesStartRadius)
      // Draw left side of the line
      ctx.moveTo(-distanceFromCenter + stdPad, height)
      ctx.lineTo(-pitchLinesStartRadius, height)
      ctx.lineTo(-pitchLinesStartRadius + 5, height + 15)
      ctx.fillText(Number(angle), -pitchLinesStartRadius - 4 * stdPad, height - 3 * stdPad)

      // Draw right side of the line
      ctx.moveTo(+distanceFromCenter - stdPad, height)
      ctx.lineTo(pitchLinesStartRadius, height)
      ctx.lineTo(pitchLinesStartRadius - 5, height + 15)
      ctx.fillText(Number(angle), pitchLinesStartRadius + 4 * stdPad, height - 3 * stdPad)

      ctx.stroke()
    }
  }

  ctx.lineWidth = 3
  ctx.setLineDash([])
  ctx.font = `bold ${refFontSize}px Arial`

  if (widget.value.options.showCenterAim) {
    // Draw left side of the aim circle
    ctx.beginPath()
    ctx.moveTo(-aimRadius.value, centerPos)
    ctx.lineTo(-1.5 * aimRadius.value, centerPos)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, centerPos, aimRadius.value, radians(135), radians(225))
    ctx.stroke()

    // Draw right side of the aim circle
    ctx.beginPath()
    ctx.moveTo(aimRadius.value, centerPos)
    ctx.lineTo(1.5 * aimRadius.value, centerPos)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, centerPos, aimRadius.value, radians(-45), radians(45))
    ctx.stroke()
  }

  if (widget.value.options.showRollPitchValues) {
    const rollText = `r: ${Number(rollAngleDeg.value).toFixed(2)}`
    const pitchText = `p: ${Number(pitchAngleDeg.value).toFixed(2)}`

    ctx.rotate(radians(-renderVars.rollDegrees))
    if (aimRadius.value < 200) {
      ctx.fillText(rollText, 0, constrain(-1.5 * aimRadius.value, -0.8 * halfCanvasHeight, 0))
      ctx.fillText(pitchText, 0, constrain(+1.5 * aimRadius.value, 0, 0.8 * halfCanvasHeight))
    } else {
      ctx.textAlign = 'start'
      ctx.fillText(rollText, -aimRadius.value + refFontSize, -30)
      ctx.fillText(pitchText, -aimRadius.value + refFontSize, +30)
    }
    ctx.stroke()
  }

  // Revert translation and rotation
  ctx.translate(-halfCanvasWidth, -halfCanvasHeight)

  // Add transparent mask over widget borders
  ctx.globalCompositeOperation = 'source-in'
  const grH = ctx.createLinearGradient(0, 0, canvasSize.value.width, canvasSize.value.height)
  grH.addColorStop(0.0, widget.value.options.hudColor)
  grH.addColorStop(1.0, widget.value.options.hudColor)
  ctx.fillStyle = grH
  ctx.fillRect(0, 0, canvasSize.value.width, canvasSize.value.height)
}

// Update the height of each pitch line when the vehicle pitch is updated
watch(pitchAngleDeg, () => {
  pitchAngles.forEach((angle: number) => {
    const y = -round(angleY(angle + renderVars.cameraTiltDeg - degrees(store.attitude.pitch)), 2)
    gsap.to(renderVars.pitchLinesHeights, 0.1, { [angle]: y })
  })
  gsap.to(renderVars, 0.1, { pitchDegrees: pitchAngleDeg.value })
})

// Update the HUD roll angle when the vehicle roll is updated
watch(rollAngleDeg, () => {
  gsap.to(renderVars, 0.1, { rollDegrees: -round(rollAngleDeg.value, 2) })
})

watch(cameraTiltDeg, () => {
  gsap.to(renderVars, 0.1, { cameraTiltDeg: cameraTiltDeg.value })
  pitchAngles.forEach((angle: number) => {
    const y = -round(angleY(angle + renderVars.cameraTiltDeg - degrees(store.attitude.pitch)), 2)
    gsap.to(renderVars.pitchLinesHeights, 0.1, { [angle]: y })
  })
})

// Update canvas whenever reference variables changes
watch([renderVars, canvasSize, widget.value.options], () => {
  if (!widgetStore.isWidgetVisible(widget.value)) return
  nextTick(() => renderCanvas())
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
}
</style>
