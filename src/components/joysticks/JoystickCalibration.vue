<template>
  <div class="flex flex-col items-start px-5 font-medium">
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center justify-between gap-8">
          <div class="flex items-center gap-1">
            <v-checkbox v-model="currentCalibration.deadband.enabled" density="compact" hide-details class="mt-0" />
            <span>Deadband/Deadzone</span>
          </div>
          <div class="flex items-center gap-1">
            <v-checkbox v-model="currentCalibration.exponential.enabled" density="compact" hide-details class="mt-0" />
            <span>Exponential Scaling</span>
          </div>
        </div>
        <v-btn variant="text" class="text-blue-400" @click="openCalibrationModal"> Calibrate </v-btn>
      </div>
    </div>
  </div>

  <teleport to="body">
    <InteractionDialog v-model="showCalibrationModal" max-width="1000px" variant="text-only" persistent>
      <template #title>
        <div class="flex justify-center w-full font-bold mt-1 relative">
          Joystick Calibration
          <v-icon class="absolute right-2 top-1 cursor-pointer" size="24" @click="showInstructions = !showInstructions">
            mdi-information-outline
          </v-icon>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col items-center gap-2 p-1 -mt-4 mb-2">
          <!-- Info panel for instructions -->
          <v-expand-transition>
            <div v-if="showInstructions" class="help-panel mb-4 p-4 rounded bg-white/5 w-full">
              <div class="mb-1">
                <div class="font-semibold text-base mb-1">Deadband Calibration</div>
                <p class="text-xs text-gray-400 mb-1">
                  This allows ignoring small unwanted movements near the center of each joystick.
                </p>
                <p class="text-xs text-gray-400 mb-1">
                  The deadband regions are the red regions in the center of each graph, specifying how much of the
                  joystick axis range to ignore. Within each deadband the output is clamped to 0, and the output curve
                  (linear or exponential) starts at the edges of the region. This is useful if a spring-loaded joystick
                  does not get consistently returned to the exact center of each axis.
                </p>
                <p class="text-xs text-gray-400 mb-2">
                  To calibrate the deadband, click and drag the deadband regions on the graphs, set the region width
                  numbers directly with the text-input, or click the "auto calibrate deadband" button at the bottom. If
                  auto-calibrating, gently touch the sticks during the calibration, while trying not to actually move
                  them.
                </p>
              </div>
              <div>
                <div class="font-semibold text-base mb-1">Exponential Calibration</div>
                <p class="text-xs text-gray-400 mb-1">This adjusts the sensitivity curve of your joysticks.</p>
                <p class="text-xs text-gray-400 mb-2">
                  Exponential scaling allows reducing the sensitivity of an axis near the center, for more precise
                  control, which then steepens the curve near the edges to use the full range. A value of 1 will result
                  in a linear curve, while greater values result in more rounded exponentials.
                </p>
              </div>
            </div>
          </v-expand-transition>
          <!-- Enable/disable checkboxes inside dialog -->
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              <v-checkbox v-model="currentCalibration.deadband.enabled" density="compact" hide-details />
              <span>Deadband/Deadzone</span>
            </div>
            <div class="flex items-center gap-2">
              <v-checkbox v-model="currentCalibration.exponential.enabled" density="compact" hide-details />
              <span>Exponential Scaling</span>
            </div>
          </div>
          <!-- Deadband Calibration Section -->
          <div class="w-full">
            <div class="flex items-center justify-between mb-2">
              <span v-if="isCalibrating && calibratingAxis === null" class="text-xs text-blue-400 ml-2">
                Calibrating all axes...
              </span>
              <v-progress-linear
                v-if="isCalibrating && calibratingAxis === null"
                :model-value="((Date.now() - calibrationStartTime) / 5000) * 100"
                color="primary"
                height="4"
                striped
                class="w-1/2 ml-2"
              />
            </div>
          </div>
          <!-- Deadband Axis Panels -->
          <div class="grid grid-rows-2 grid-flow-col gap-x-6 gap-y-6 w-full my-2">
            <div
              v-for="(_, index) in controllerStore.currentMainJoystick?.state.axes ?? []"
              :key="index"
              class="border border-gray-700/60 rounded-lg py-2 px-4 bg-gray-900/60 flex flex-col"
            >
              <div class="flex w-full justify-center text-lg font-bold text-white mb-3">Axis {{ index }}</div>
              <div class="w-full h-40 relative">
                <!-- Axis labels -->
                <span class="font-mono text-xs text-gray-400 absolute top-[81px] right-[10px]">
                  in: {{ numberToTwoDigitsSigned(rawAxisValues[index]) }}
                </span>
                <span class="font-mono text-xs text-gray-400 absolute top-[-2px] left-[170px]">
                  out: {{ numberToTwoDigitsSigned(processedAxisValues[index]) }}
                </span>

                <svg
                  :id="`deadband-svg-${index}`"
                  class="w-full h-full my-4"
                  viewBox="0 0 200 130"
                  preserveAspectRatio="true"
                >
                  <!-- Grid lines -->
                  <line x1="0" y1="60" x2="200" y2="60" stroke="#e5e7eb" stroke-width="1" />
                  <line x1="100" y1="0" x2="100" y2="120" stroke="#e5e7eb" stroke-width="1" />

                  <!-- Deadband region -->
                  <rect
                    v-if="currentCalibration.deadband.enabled"
                    :x="100 - deadzoneThresholds[index] * 100"
                    y="0"
                    :width="deadzoneThresholds[index] * 200"
                    height="120"
                    fill="#f87171"
                    fill-opacity="0.3"
                  />
                  <rect
                    v-if="currentCalibration.deadband.enabled"
                    :x="100 - deadzoneThresholds[index] * 100 - 8"
                    y="0"
                    width="16"
                    height="120"
                    fill="transparent"
                    style="cursor: ew-resize"
                    @mousedown="onDeadbandRegionMouseDown(index, $event)"
                  />
                  <rect
                    v-if="currentCalibration.deadband.enabled"
                    :x="100 + deadzoneThresholds[index] * 100 - 8"
                    y="0"
                    width="16"
                    height="120"
                    fill="transparent"
                    style="cursor: ew-resize"
                    @mousedown="onDeadbandRegionMouseDown(index, $event)"
                  />

                  <!-- Processed curve (deadband + exponential) -->
                  <path :d="getCombinedCurvePath(index)" stroke="#3b82f6" stroke-width="2" fill="none" />

                  <!-- Current value indicator -->
                  <circle
                    :cx="100 + (rawAxisValues[index] ?? 0) * 100"
                    :cy="60 - processedAxisValues[index] * 50"
                    r="4"
                    fill="#3b82f6"
                  />

                  <!-- Vertical line (input) -->
                  <line
                    :x1="100 + (rawAxisValues[index] ?? 0) * 100"
                    y1="0"
                    :x2="100 + (rawAxisValues[index] ?? 0) * 100"
                    y2="120"
                    stroke="#3b82f6"
                    stroke-width="1"
                    stroke-dasharray="2,2"
                  />

                  <!-- Horizontal line (output) -->
                  <line
                    x1="0"
                    :y1="60 - processedAxisValues[index] * 50"
                    x2="200"
                    :y2="60 - processedAxisValues[index] * 50"
                    stroke="#3b82f6"
                    stroke-width="1"
                    stroke-dasharray="2,2"
                  />
                </svg>
              </div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 w-full">
                  <span class="text-xs text-gray-300">Deadband: </span>
                  <div class="w-full" />
                  <v-text-field
                    v-model.number="deadzoneThresholds[index]"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    density="compact"
                    hide-details
                    class="min-w-20"
                    variant="outlined"
                    :disabled="!currentCalibration.deadband.enabled"
                  />
                  <v-btn
                    size="x-small"
                    variant="text"
                    class="text-gray-400"
                    :disabled="deadzoneThresholds[index] === 0"
                    @click="deadzoneThresholds[index] = 0"
                  >
                    RESET
                  </v-btn>
                </div>
              </div>
              <div class="flex items-center justify-between mb-2 w-full">
                <span class="text-xs text-gray-300">Exponential: </span>
                <div class="w-full" />
                <v-slider
                  v-model="exponentialFactors[index]"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  hide-details
                  class="w-full"
                  density="compact"
                  color="white"
                  :disabled="!currentCalibration.exponential.enabled"
                />
                <span class="text-xs text-gray-300 w-8 text-end">{{ exponentialFactors[index].toFixed(1) }}</span>
                <v-btn
                  size="x-small"
                  variant="text"
                  class="text-gray-400"
                  :disabled="exponentialFactors[index] === 1.0 || !currentCalibration.exponential.enabled"
                  @click="exponentialFactors[index] = 1.0"
                >
                  RESET
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #actions>
        <v-btn variant="text" @click="cancelCalibration">Cancel</v-btn>
        <div class="w-full" />
        <v-btn variant="text" :disabled="isCalibrating" @click="startCalibration()"> Auto calibrate deadzones </v-btn>

        <v-btn variant="text" :disabled="!allowSavingCalibration" @click="saveCalibration">Save</v-btn>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { defaultJoystickCalibration } from '@/assets/defaults'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { JoystickModel } from '@/libs/joystick/manager'
import { round } from '@/libs/utils'
import { useControllerStore } from '@/stores/controller'
import { type JoystickCalibration } from '@/types/joystick'

const controllerStore = useControllerStore()

const showCalibrationModal = ref(false)
const exponentialFactors = ref<number[]>([])
const rawAxisValues = ref<number[]>([])
const processedAxisValues = ref<number[]>([])
const allowSavingCalibration = ref(false)
const deadzoneThresholds = ref<number[]>([])
const isCalibrating = ref(false)
const calibrationStartTime = ref(0)
const maxDeviations = ref<number[]>([])
const calibratingAxis = ref<number | null>(null)

// Track which axis (if any) is being dragged for deadband
const draggingDeadbandAxis = ref<number | null>(null)

const currentJoystickModel = computed<JoystickModel>(() => {
  return controllerStore.currentMainJoystick?.model ?? JoystickModel.Unknown
})

const currentCalibration = computed<JoystickCalibration>({
  get: () => {
    return controllerStore.joystickCalibrationOptions[currentJoystickModel.value] ?? defaultJoystickCalibration
  },
  set: (newValue: JoystickCalibration) => {
    controllerStore.joystickCalibrationOptions[currentJoystickModel.value] = newValue
  },
})

const openCalibrationModal = (): void => {
  showCalibrationModal.value = true
  const numAxes = controllerStore.currentMainJoystick?.state.axes.length ?? 0
  exponentialFactors.value =
    currentCalibration.value.exponential.factors.axes.length === numAxes
      ? [...currentCalibration.value.exponential.factors.axes]
      : Array(numAxes).fill(1.0)
  deadzoneThresholds.value =
    currentCalibration.value.deadband.thresholds.axes.length === numAxes
      ? [...currentCalibration.value.deadband.thresholds.axes]
      : Array(numAxes).fill(0.05)
  rawAxisValues.value = Array(numAxes).fill(0)
  processedAxisValues.value = Array(numAxes).fill(0)
  allowSavingCalibration.value = true
}

const startCalibration = (axisIndex?: number): void => {
  isCalibrating.value = true
  calibrationStartTime.value = Date.now()
  calibratingAxis.value = axisIndex ?? null
  if (axisIndex !== undefined) {
    maxDeviations.value[axisIndex] = 0
  } else {
    maxDeviations.value = maxDeviations.value.map(() => 0)
  }
}

const cancelCalibration = (): void => {
  showCalibrationModal.value = false
}

const saveCalibration = (): void => {
  currentCalibration.value.deadband.thresholds.axes = [...deadzoneThresholds.value]
  currentCalibration.value.deadband.enabled = true
  currentCalibration.value.exponential.factors.axes = [...exponentialFactors.value]
  currentCalibration.value.exponential.enabled = true
  showCalibrationModal.value = false
}

/**
 * Apply deadband and exponential scaling to joystick input, respecting enabled/disabled state.
 * @param {number} input The raw input value (-1 to 1)
 * @param {number} deadband The deadband threshold (0 to 1)
 * @param {number} factor The exponential scaling factor (>=1)
 * @param {boolean} deadbandEnabled Whether deadband is enabled
 * @param {boolean} exponentialEnabled Whether exponential is enabled
 * @returns {number} The processed output value
 */
function applyDeadbandAndExponential(
  input: number,
  deadband: number,
  factor: number,
  deadbandEnabled: boolean,
  exponentialEnabled: boolean
): number {
  let out = input
  if (deadbandEnabled) {
    if (Math.abs(out) < deadband) return 0
    // Remap input from [deadband, 1] to [0, 1]
    const sign = Math.sign(out)
    const norm = (Math.abs(out) - deadband) / (1 - deadband)
    if (norm <= 0) return 0
    out = sign * norm
  }
  if (exponentialEnabled) {
    out = Math.sign(out) * Math.pow(Math.abs(out), factor)
  }
  return out
}

/**
 * Generate SVG path for the combined deadband + exponential curve for a given axis.
 * @param {number} axisIndex The axis index
 * @returns {string} SVG path string
 */
function getCombinedCurvePath(axisIndex: number): string {
  const deadband = deadzoneThresholds.value[axisIndex] ?? 0
  const factor = exponentialFactors.value[axisIndex] ?? 1.0
  const deadbandEnabled = currentCalibration.value.deadband.enabled
  const exponentialEnabled = currentCalibration.value.exponential.enabled
  const points: string[] = []
  for (let x = -1; x <= 1.001; x += 0.025) {
    const y = applyDeadbandAndExponential(x, deadband, factor, deadbandEnabled, exponentialEnabled)
    const svgX = 100 + x * 100
    const svgY = 60 - y * 50
    points.push(`${svgX},${svgY}`)
  }
  return `M ${points.join(' L ')}`
}

/**
 * Handle mousedown on the deadband region to start dragging.
 * @param {number} axisIndex The axis index
 * @param {MouseEvent} event Mouse event
 */
function onDeadbandRegionMouseDown(axisIndex: number, event: MouseEvent): void {
  if (!currentCalibration.value.deadband.enabled) return
  // Only allow dragging if the target is a handle (transparent rect)
  const target = event.target as SVGRectElement
  if (target.getAttribute('fill') !== 'transparent') return
  draggingDeadbandAxis.value = axisIndex
  document.body.style.userSelect = 'none'
}

/**
 * Handle mousemove event to update the deadband threshold while dragging.
 * @param {MouseEvent} event Mouse event
 */
function onDeadbandRegionMouseMove(event: MouseEvent): void {
  if (draggingDeadbandAxis.value === null) return
  const axisIndex = draggingDeadbandAxis.value
  // Find the SVG element for this axis
  const svg = document.getElementById(`deadband-svg-${axisIndex}`) as SVGSVGElement | null
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const x = event.clientX - rect.left
  const center = rect.width / 2
  // 0 at center, 1 at either edge
  let threshold = Math.abs((x - center) / (rect.width / 2))
  threshold = Math.max(0, Math.min(1, threshold))
  deadzoneThresholds.value[axisIndex] = round(threshold, 2)
}

/**
 * Handle mouseup event to stop dragging the deadband region.
 */
function onDeadbandRegionMouseUp(): void {
  draggingDeadbandAxis.value = null
  document.body.style.userSelect = ''
}

// Watch for joystick movements and update processed values
watch(
  [
    () => controllerStore.currentMainJoystick?.state.axes,
    () => [...exponentialFactors.value],
    () => [...deadzoneThresholds.value],
    () => currentCalibration.value.deadband.enabled,
    () => currentCalibration.value.exponential.enabled,
    () => isCalibrating.value,
    () => calibratingAxis.value,
    () => calibrationStartTime.value,
  ],
  () => {
    const axes = controllerStore.currentMainJoystick?.state.axes ?? []
    const deadbandEnabled = currentCalibration.value.deadband.enabled
    const exponentialEnabled = currentCalibration.value.exponential.enabled
    rawAxisValues.value = axes.map((axis) => axis ?? 0)
    processedAxisValues.value = axes.map((value, index) => {
      const deadband = deadzoneThresholds.value[index] ?? 0
      const factor = exponentialFactors.value[index] ?? 1.0
      return applyDeadbandAndExponential(value ?? 0, deadband, factor, deadbandEnabled, exponentialEnabled)
    })
    // Deadband calibration logic
    if (isCalibrating.value) {
      const elapsed = Date.now() - calibrationStartTime.value
      axes.forEach((value, index) => {
        if (calibratingAxis.value === null || calibratingAxis.value === index) {
          const deviation = Math.abs(value ?? 0)
          maxDeviations.value[index] = Math.max(maxDeviations.value[index] ?? 0, deviation)
        }
      })
      if (elapsed >= 5000) {
        isCalibrating.value = false
        // Set the deadzone threshold to the maximum deviation plus a small buffer
        axes.forEach((_, index) => {
          if (calibratingAxis.value === null || calibratingAxis.value === index) {
            deadzoneThresholds.value[index] = Math.min(1, round(maxDeviations.value[index], 2) ?? 0)
          }
        })
        calibratingAxis.value = null
      }
    }
    allowSavingCalibration.value =
      deadzoneThresholds.value.every((threshold) => threshold >= 0 && threshold <= 1) &&
      exponentialFactors.value.every((factor) => factor >= 1.0 && factor <= 5.0)
  },
  { deep: true }
)

const numberToTwoDigitsSigned = (value: number): string => {
  const numberWithTwoDigits = round(value, 2).toFixed(2)
  return numberWithTwoDigits.startsWith('-') ? numberWithTwoDigits : `+${numberWithTwoDigits}`
}

const showInstructions = ref(false)

onMounted(() => {
  window.addEventListener('mousemove', onDeadbandRegionMouseMove)
  window.addEventListener('mouseup', onDeadbandRegionMouseUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDeadbandRegionMouseMove)
  window.removeEventListener('mouseup', onDeadbandRegionMouseUp)
})
</script>
