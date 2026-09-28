<template>
  <div class="flex flex-col items-start px-5 font-medium">
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center justify-between gap-8">
          <div class="flex items-center gap-1">
            <v-checkbox
              :model-value="currentCalibration.deadband.enabled"
              density="compact"
              hide-details
              class="mt-0"
              @update:model-value="setDeadbandEnabled"
            />
            <span>Deadband/Deadzone</span>
          </div>
          <div class="flex items-center gap-1">
            <v-checkbox
              :model-value="currentCalibration.exponential.enabled"
              density="compact"
              hide-details
              class="mt-0"
              @update:model-value="setExponentialEnabled"
            />
            <span>Exponential Scaling</span>
          </div>
        </div>
        <v-btn variant="text" class="text-blue-400" @click="openCalibrationModal"> Calibrate </v-btn>
      </div>
    </div>
  </div>

  <teleport to="body">
    <InteractionDialog v-model="showCalibrationModal" max-width="1000px" variant="text-only" persistent backdrop>
      <template #title>
        <div class="flex justify-center w-full font-bold mt-1 relative">
          Joystick Calibration
          <v-icon class="absolute right-2 top-1 cursor-pointer" size="24" @click="toggleInstructions">
            mdi-information-outline
          </v-icon>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col items-center gap-2 p-1 -mt-8 mb-2">
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
              <v-checkbox
                :model-value="currentCalibration.deadband.enabled"
                density="compact"
                hide-details
                @update:model-value="setDeadbandEnabled"
              />
              <span>Deadband/Deadzone</span>
            </div>
            <div class="flex items-center gap-2">
              <v-checkbox
                :model-value="currentCalibration.exponential.enabled"
                density="compact"
                hide-details
                @update:model-value="setExponentialEnabled"
              />
              <span>Exponential Scaling</span>
            </div>
          </div>
          <!-- Deadband Calibration Section -->
          <div v-if="isCalibrating && calibratingAxis === null" class="w-full">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-blue-400 ml-2"> Calibrating all inputs... </span>
              <v-progress-linear
                :model-value="((Date.now() - calibrationStartTime) / 5000) * 100"
                color="primary"
                height="4"
                striped
                class="w-1/2 ml-2"
              />
            </div>
          </div>
          <!-- Deadband Axis Panels -->
          <div class="grid grid-rows-2 grid-cols-3 grid-flow-row gap-[18px] w-full -mt-1 mb-2">
            <div
              v-for="index in calibrationPanels"
              :key="index"
              class="border border-gray-700/60 rounded-lg py-2 px-4 bg-gray-900/60 flex flex-col"
            >
              <div class="flex w-full justify-center text-lg font-bold text-white mb-0.5 capitalize">
                {{ inputName(index) }}
              </div>
              <div class="w-full h-40 relative">
                <svg
                  :id="`deadband-svg-${index}`"
                  class="w-full h-full my-4"
                  viewBox="0 0 200 130"
                  preserveAspectRatio="true"
                >
                  <!-- Grid lines -->
                  <line x1="0" y1="60" x2="200" y2="60" stroke="#e5e7eb" stroke-width="1" />
                  <line x1="100" y1="0" x2="100" y2="120" stroke="#e5e7eb" stroke-width="1" />

                  <!-- Axis labels (rendered inside the viewBox so they always align with the gridlines) -->
                  <text x="102" y="9" class="font-mono" fill="#9ca3af" font-size="9" text-anchor="start">
                    out: {{ numberToTwoDigitsSigned(processedInputValues[index]) }}
                  </text>
                  <text x="198" y="56" class="font-mono" fill="#9ca3af" font-size="9" text-anchor="end">
                    in: {{ numberToTwoDigitsSigned(rawInputValues[index]) }}
                  </text>

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
                    :cx="100 + (rawInputValues[index] ?? 0) * 100"
                    :cy="60 - processedInputValues[index] * 50"
                    r="4"
                    fill="#3b82f6"
                  />

                  <!-- Vertical line (input) -->
                  <line
                    :x1="100 + (rawInputValues[index] ?? 0) * 100"
                    y1="0"
                    :x2="100 + (rawInputValues[index] ?? 0) * 100"
                    y2="120"
                    stroke="#3b82f6"
                    stroke-width="1"
                    stroke-dasharray="2,2"
                  />

                  <!-- Horizontal line (output) -->
                  <line
                    x1="0"
                    :y1="60 - processedInputValues[index] * 50"
                    x2="200"
                    :y2="60 - processedInputValues[index] * 50"
                    stroke="#3b82f6"
                    stroke-width="1"
                    stroke-dasharray="2,2"
                  />
                </svg>
              </div>
              <div class="flex items-center justify-between mt-3 mb-2">
                <div class="flex items-center gap-2 w-full">
                  <span
                    class="text-xs"
                    :class="currentCalibration.deadband.enabled ? 'text-gray-300' : 'text-[#FFFFFF66]'"
                  >
                    Deadband:
                  </span>
                  <div class="w-full" />
                  <div
                    class="group relative flex w-20 shrink-0 bg-[#FFFFFF11]"
                    :class="{ 'opacity-40': !currentCalibration.deadband.enabled }"
                  >
                    <input
                      v-model.number="deadzoneThresholds[index]"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      class="calibration-input w-full min-w-0 px-2 group-focus-within:pr-7 py-1 text-[13px] text-white bg-transparent disabled:cursor-not-allowed"
                      :disabled="!currentCalibration.deadband.enabled"
                      :aria-label="`Deadband for ${inputName(index)}`"
                    />
                    <div class="absolute inset-y-0 right-0 hidden group-focus-within:flex flex-col" @mousedown.prevent>
                      <v-btn
                        icon
                        variant="text"
                        rounded="0"
                        :width="24"
                        class="flex-1 !h-0 min-h-0"
                        :aria-label="`Increase deadband for ${inputName(index)}`"
                        :disabled="!currentCalibration.deadband.enabled || deadzoneThresholds[index] >= 1"
                        @click="stepDeadband(index, 1)"
                      >
                        <v-icon size="18">mdi-menu-up</v-icon>
                      </v-btn>
                      <v-btn
                        icon
                        variant="text"
                        rounded="0"
                        :width="24"
                        class="flex-1 !h-0 min-h-0"
                        :aria-label="`Decrease deadband for ${inputName(index)}`"
                        :disabled="!currentCalibration.deadband.enabled || deadzoneThresholds[index] <= 0"
                        @click="stepDeadband(index, -1)"
                      >
                        <v-icon size="18">mdi-menu-down</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <v-btn
                    size="x-small"
                    variant="text"
                    class="text-gray-400"
                    :disabled="deadzoneThresholds[index] === 0"
                    @click="resetDeadband(index)"
                  >
                    RESET
                  </v-btn>
                </div>
              </div>
              <div class="flex items-center justify-between mb-px w-full">
                <span
                  class="text-xs"
                  :class="currentCalibration.exponential.enabled ? 'text-gray-300' : 'text-[#FFFFFF66]'"
                >
                  Exponential:
                </span>
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
                <span
                  class="text-xs w-8 text-end"
                  :class="currentCalibration.exponential.enabled ? 'text-gray-300' : 'text-[#FFFFFF66]'"
                >
                  {{ exponentialFactors[index].toFixed(1) }}
                </span>
                <v-btn
                  size="x-small"
                  variant="text"
                  class="text-gray-400"
                  :disabled="exponentialFactors[index] === 1.0 || !currentCalibration.exponential.enabled"
                  @click="resetExponential(index)"
                >
                  RESET
                </v-btn>
              </div>
            </div>
          </div>
          <p v-if="analogButtons.size === 0" class="text-xs text-gray-400">
            Analog buttons get a card here once pressed partway. On/off buttons have no calibration.
          </p>
        </div>
      </template>
      <template #actions>
        <div class="flex w-full justify-between items-center px-1 py-2">
          <v-btn variant="text" size="small" @click="cancelCalibration">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn variant="text" size="small" :disabled="isCalibrating" @click="startCalibration()">
              Auto calibrate deadzones
            </v-btn>
            <v-btn
              size="small"
              class="bg-[#FFFFFF22] text-white"
              :disabled="!allowSavingCalibration"
              @click="saveCalibration"
            >
              Save
            </v-btn>
          </div>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { defaultJoystickCalibration } from '@/assets/defaults'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { hasTriggerAxes, JoystickModel } from '@/libs/joystick/manager'
import { round } from '@/libs/utils'
import { useControllerStore } from '@/stores/controller'
import { type JoystickCalibration, standardTriggerAxes } from '@/types/joystick'

const controllerStore = useControllerStore()

const showCalibrationModal = ref(false)
// Per-input arrays hold every axis first, then every button. Buttons follow the raw gamepad index calibration is
// applied at, while axes follow the model profile's order, which only matches it for profiles that keep device order
const numAxes = ref(0)
const exponentialFactors = ref<number[]>([])
const rawInputValues = ref<number[]>([])
const processedInputValues = ref<number[]>([])
const analogButtons = ref(new Set<number>())
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

const currentButtonValues = (): number[] =>
  controllerStore.currentMainJoystick?.gamepad.buttons.map((button) => button.value) ?? []

// Triggers are calibrated on their axis card, which their button copy follows
const triggerButtons = computed<number[]>(() => {
  const gamepad = controllerStore.currentMainJoystick?.gamepad
  return gamepad && hasTriggerAxes(gamepad) ? standardTriggerAxes.map(({ button }) => button) : []
})

const inputName = (index: number): string =>
  index < numAxes.value ? `axis ${index}` : `button ${index - numAxes.value}`

const calibrationPanels = computed<number[]>(() => [
  ...Array.from({ length: numAxes.value }, (_, index) => index),
  ...[...analogButtons.value].sort((a, b) => a - b).map((button) => numAxes.value + button),
])

const savedOrFilled = (saved: number[], length: number, fill: number): number[] =>
  Array.from({ length }, (_, index) => saved[index] ?? fill)

const openCalibrationModal = (): void => {
  logUserAction('Opened joystick calibration dialog')
  showCalibrationModal.value = true
  numAxes.value = controllerStore.currentMainJoystick?.state.axes.length ?? 0
  const numButtons = currentButtonValues().length
  const { deadband, exponential } = currentCalibration.value
  exponentialFactors.value = [
    ...savedOrFilled(exponential.factors.axes, numAxes.value, 1.0),
    ...savedOrFilled(exponential.factors.buttons, numButtons, 1.0),
  ]
  deadzoneThresholds.value = [
    ...savedOrFilled(deadband.thresholds.axes, numAxes.value, 0.05),
    ...savedOrFilled(deadband.thresholds.buttons, numButtons, 0),
  ]
  const calibratedButtons = Array.from({ length: numButtons }, (_, button) => button).filter((button) => {
    const index = numAxes.value + button
    const calibrated = deadzoneThresholds.value[index] !== 0 || exponentialFactors.value[index] !== 1
    return calibrated && !triggerButtons.value.includes(button)
  })
  analogButtons.value = new Set(calibratedButtons)
  rawInputValues.value = Array(numAxes.value + numButtons).fill(0)
  processedInputValues.value = Array(numAxes.value + numButtons).fill(0)
  allowSavingCalibration.value = true
}

const startCalibration = (axisIndex?: number): void => {
  logUserAction(`Started deadband auto-calibration (${axisIndex === undefined ? 'all inputs' : inputName(axisIndex)})`)
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
  logUserAction('Cancelled joystick calibration')
  showCalibrationModal.value = false
}

const saveCalibration = (): void => {
  logUserAction('Saved joystick calibration')
  currentCalibration.value.deadband.thresholds.axes = deadzoneThresholds.value.slice(0, numAxes.value)
  currentCalibration.value.deadband.thresholds.buttons = deadzoneThresholds.value.slice(numAxes.value)
  currentCalibration.value.exponential.factors.axes = exponentialFactors.value.slice(0, numAxes.value)
  currentCalibration.value.exponential.factors.buttons = exponentialFactors.value.slice(numAxes.value)
  showCalibrationModal.value = false
}

const setDeadbandEnabled = (value: boolean | null): void => {
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} deadband calibration`)
  currentCalibration.value.deadband.enabled = enabled
}

const setExponentialEnabled = (value: boolean | null): void => {
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} exponential scaling calibration`)
  currentCalibration.value.exponential.enabled = enabled
}

const resetDeadband = (index: number): void => {
  logUserAction(`Reset deadband for ${inputName(index)}`)
  deadzoneThresholds.value[index] = 0
}

const stepDeadband = (index: number, direction: 1 | -1): void => {
  const threshold = Math.min(
    1,
    Math.max(0, round((Number(deadzoneThresholds.value[index]) || 0) + direction * 0.01, 2))
  )
  deadzoneThresholds.value[index] = threshold
  logUserAction(`Stepped deadband for ${inputName(index)} to ${threshold}`)
}

const resetExponential = (index: number): void => {
  logUserAction(`Reset exponential factor for ${inputName(index)}`)
  exponentialFactors.value[index] = 1.0
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
  if (draggingDeadbandAxis.value !== null) {
    const axisIndex = draggingDeadbandAxis.value
    logUserAction(`Adjusted deadband for ${inputName(axisIndex)} to ${deadzoneThresholds.value[axisIndex]}`)
  }
  draggingDeadbandAxis.value = null
  document.body.style.userSelect = ''
}

// Watch for joystick movements and update processed values
watch(
  [
    () => controllerStore.currentMainJoystick?.state.axes,
    currentButtonValues,
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
    const buttons = currentButtonValues()
    buttons.forEach((value, button) => {
      if (value > 0 && value < 1 && !triggerButtons.value.includes(button)) analogButtons.value.add(button)
    })
    const inputs = [...axes.map((axis) => axis ?? 0), ...buttons]
    const deadbandEnabled = currentCalibration.value.deadband.enabled
    const exponentialEnabled = currentCalibration.value.exponential.enabled
    rawInputValues.value = inputs
    processedInputValues.value = inputs.map((value, index) => {
      const deadband = deadzoneThresholds.value[index] ?? 0
      const factor = exponentialFactors.value[index] ?? 1.0
      return applyDeadbandAndExponential(value, deadband, factor, deadbandEnabled, exponentialEnabled)
    })
    // Deadband calibration logic
    if (isCalibrating.value) {
      const elapsed = Date.now() - calibrationStartTime.value
      // Hidden digital buttons are skipped, as a press during calibration would give them a deadband of 1
      calibrationPanels.value.forEach((index) => {
        if (calibratingAxis.value === null || calibratingAxis.value === index) {
          const deviation = Math.abs(inputs[index] ?? 0)
          maxDeviations.value[index] = Math.max(maxDeviations.value[index] ?? 0, deviation)
        }
      })
      if (elapsed >= 5000) {
        isCalibrating.value = false
        // Set the deadzone threshold to the maximum deviation plus a small buffer
        calibrationPanels.value.forEach((index) => {
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

const toggleInstructions = (): void => {
  logUserAction(`${showInstructions.value ? 'Hid' : 'Showed'} calibration instructions`)
  showInstructions.value = !showInstructions.value
}

onMounted(() => {
  window.addEventListener('mousemove', onDeadbandRegionMouseMove)
  window.addEventListener('mouseup', onDeadbandRegionMouseUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDeadbandRegionMouseMove)
  window.removeEventListener('mouseup', onDeadbandRegionMouseUp)
})
</script>

<style scoped>
.calibration-input[type='number']::-webkit-inner-spin-button,
.calibration-input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.calibration-input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
