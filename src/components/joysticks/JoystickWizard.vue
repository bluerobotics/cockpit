<template>
  <GlassModal
    v-if="showWizard"
    :is-visible="showWizard"
    class="px-5 pt-5 pb-2 z-[999]"
    :draggable="true"
    storage-key="cockpit-tutorial-modal"
    is-persistent
  >
    <div class="w-[600px] items-center flex flex-col">
      <v-window v-model="currentWizardStep" class="cursor-move -mt-4 w-full overflow-hidden">
        <v-window-item
          v-for="step in joystickWizardSteps"
          :key="step.id"
          :value="step.id"
          class="flex justify-center h-[450px] items-start overflow-hidden"
        >
          <div class="absolute top-3 right-[50%] translate-x-[50%] justify-center text-h6 text-center -mt-1">
            {{ step.title }}
          </div>
          <div
            v-if="!step.reviewMappings"
            class="flex flex-col h-full justify-center w-[600px] overflow-hidden"
            :class="{ '-mt-2': !step.largeContent }"
          >
            <v-timeline direction="horizontal" class="custom-timeline">
              <v-timeline-item
                :key="step.id"
                ref="timelineItems"
                fill-dot
                size="x-large"
                elevation="3"
                class="cursor-move overflow-hidden"
                :dot-color="isJoystickConnected ? '#4fa483' : '#363636'"
              >
                <div
                  class="fixed left-5 top-5 h-6 pa-1 rounded-md bg-[#3b7e64] border-[1px] border-[#FFFFFF88] mb-10 elevation-1"
                  :style="{
                    opacity: controllerStore.enableForwarding ? 0.7 : 0,
                    transition: 'opacity 0.5s ease-in-out',
                  }"
                >
                  <p class="text-xs">Joystick Enabled</p>
                </div>
                <template #icon>
                  <v-avatar
                    size="x-large"
                    class="border-[1px] border-[#FFFFFF88]"
                    :class="isJoystickConnected ? 'ripple' : ''"
                  >
                    <img :src="CockpitLogo" class="p-[7px] mt-1" />
                  </v-avatar>
                </template>
                <div>
                  <p class="text-center" :class="step.content ? 'mt-4' : 'mt-0'">{{ step.content }}</p>
                </div>
                <template #opposite>
                  <div class="flex flex-col items-center w-[500px] mb-4">
                    <p class="text-center w-full">{{ step.opposite }}</p>
                    <div
                      v-if="isJoystickListVisible"
                      :class="[
                        'mt-4 flex flex-col w-[400px] max-h-[150px] bg-[#00000022] rounded-[8px] border-[1px] items-center justify-between py-2 overflow-y-auto',
                        controllerStore.joysticks.size > 1 ? 'border-red-700' : 'border-[#FFFFFF22]',
                      ]"
                    >
                      <p class="text-center font-bold">Connected Joysticks:</p>
                      <ul v-if="connectedJoysticks.length" class="h-full mt-1">
                        <li v-for="name in connectedJoysticks" :key="name">
                          <v-icon class="mr-3 -mt-[1px]">mdi-controller</v-icon>{{ name }}
                        </li>
                      </ul>
                      <p v-if="!isJoystickConnected" class="text-red-500">
                        No joysticks connected. Please connect a joystick to continue.
                      </p>
                    </div>
                    <template v-if="step.inputType === 'axis'">
                      <div
                        class="flex justify-center items-center w-full pb-6"
                        :class="{ 'opacity-0': !isJoystickConnected }"
                      >
                        <div
                          class="flex justify-between items-center w-3/4 mt-6 bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] h-[60px]"
                        >
                          <p v-if="detectedAxisId !== null" class="w-[90px] text-right font-semibold">
                            {{ `Axis ${detectedAxisId}` }}
                          </p>
                          <p v-else-if="boundAxisInfo" class="w-[90px] text-right font-semibold">
                            {{ `Axis ${boundAxisInfo.idx}` }}
                          </p>
                          <v-divider vertical inset />
                          <AxisVisualization
                            v-if="detectedAxisId !== null"
                            :raw-value="currentAxisValue"
                            :processed-value="currentAxisValue"
                          />
                          <AxisVisualization
                            v-else-if="boundAxisInfo"
                            :raw-value="boundAxisInfo.value"
                            :processed-value="boundAxisInfo.value"
                          />
                          <p v-else class="text-center text-sm opacity-70">Move any axis</p>
                          <div />
                        </div>
                        <v-icon
                          class="ml-8 mt-6 -mr-12 cursor-pointer"
                          :class="{ 'opacity-0': detectedAxisId === null }"
                          icon="mdi-restore"
                          color="white"
                          @click="resetCurrentInputDetection"
                        />
                      </div>
                    </template>
                    <template v-if="step.inputType === 'button'">
                      <div
                        v-if="connectedJoysticks.length >= 1"
                        class="flex justify-center items-center w-full"
                        :class="{ 'opacity-0': !isJoystickConnected }"
                      >
                        <div
                          class="relative left-0 -ml-12 mr-4 -bottom-3 py-1 px-2 rounded-md bg-[#3B78A8] border-[1px] border-[#FFFFFF88] elevation-1"
                          :style="{ opacity: isShiftPressed ? 0.9 : 0, transition: 'opacity .2s' }"
                        >
                          <p class="text-sm">SHIFT</p>
                        </div>
                        <div
                          class="flex justify-between items-center w-3/4 mt-6 bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] h-[60px]"
                        >
                          <p
                            class="text-center font-semibold"
                            :class="detectedButtonId !== null ? 'w-[68%]' : 'w-full ml-4'"
                          >
                            {{ detectedButtonLabel }}
                          </p>
                          <v-divider v-if="detectedButtonId !== null" vertical inset />
                          <div v-if="detectedButtonId !== null" class="flex w-[28%] justify-center">
                            <v-icon
                              class="text-3xl bg-[#FFFFFF11] elevation-6 rounded-full"
                              :class="buttonPressed ? 'text-[#5089b4]' : 'text-[#2c5d8355]'"
                              icon="mdi-circle"
                            />
                          </div>
                        </div>
                        <v-icon
                          class="ml-8 mt-6 -mr-12 cursor-pointer"
                          :class="{ 'opacity-0': detectedButtonId === null }"
                          icon="mdi-restore"
                          color="white"
                          @click="resetCurrentInputDetection"
                        />
                      </div>
                    </template>
                    <template v-if="step.hasSelection">
                      <div class="flex justify-center pt-8 pb-2 items-center w-full">
                        <v-btn
                          v-for="option in step.selectionOptions"
                          :key="option.label"
                          class="mx-[80px]"
                          variant="outlined"
                          @click="option.action()"
                        >
                          {{ option.label }}
                        </v-btn>
                      </div>
                    </template>
                    <template v-if="errorMessage">
                      <div class="flex fixed bottom-[73px] items-center">
                        <div
                          class="text-white bg-red-600 rounded-md text-sm font-bold border-[1px] border-[#FFFFFF88] mt-2 py-[2px] px-2 max-w-[400px] text-center truncate"
                        >
                          {{ errorMessage }}
                        </div>
                        <v-btn
                          class="mt-2 ml-4 -mr-6 border-[1px] border-[#FFFFFF44] font-bold"
                          variant="text"
                          size="x-small"
                          @click="overwriteConflictingMapping"
                        >
                          Overwrite
                        </v-btn>
                      </div>
                    </template>
                    <template v-if="connectedJoysticks.length === 0 && currentWizardStep !== 1">
                      <div class="text-red-500 text-center text-xs mt-10 mb-4">
                        Joystick not active. Before start mapping, move an axis or press a button to activate it.
                      </div>
                    </template>
                  </div>
                </template>
              </v-timeline-item>
            </v-timeline>
          </div>
          <template v-if="step.reviewMappings">
            <v-table
              density="compact"
              class="mt-[50px] w-full max-h-[340px] bg-[#00000022] rounded-md elevation-3 overflow-y-auto"
              theme="dark"
            >
              <thead>
                <tr>
                  <th class="text-left">Input</th>
                  <th class="text-left">Mapped Function</th>
                  <th class="text-center">Live</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in reviewInputsTableRows" :key="row.type + row.id">
                  <td class="w-[150px] truncate">{{ row.label }}</td>
                  <td class="max-w-[250px] truncate">{{ row.fn }}</td>
                  <td class="text-center">
                    <AxisVisualization
                      v-if="row.type === 'Axis'"
                      :raw-value="liveAxes[row.id] ?? 0"
                      :processed-value="liveAxes[row.id] ?? 0"
                      class="w-[120px] scale-75 ml-[45px]"
                    />
                    <v-icon
                      v-else
                      class="text-2xl elevation-1 rounded-full mr-1"
                      :icon="liveButtons[row.id] ? 'mdi-circle' : 'mdi-circle-outline'"
                      :class="liveButtons[row.id] ? 'text-[#5089b4] opacity-100' : 'text-[#5089b4] opacity-35'"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>
          <div class="absolute top-1 right-1">
            <v-btn
              v-if="currentWizardStep !== joystickWizardSteps.length"
              icon="mdi-close"
              size="small"
              variant="text"
              class="absolute top-0 right-2 text-lg"
              @click="closeWizard"
            />
          </div>
          <div class="absolute bottom-[-15px] w-[100%]">
            <v-divider mx-2 />
            <div class="flex justify-between items-center w-full -ml-5 pt-4 pb-[22px]">
              <v-btn
                v-if="currentWizardStep > 3"
                class="ml-4"
                variant="text"
                @click="step.reviewMappings ? resetWizard() : backWizardStep()"
              >
                {{ step.reviewMappings ? 'Restart' : 'Previous' }}
              </v-btn>
              <v-spacer />
              <v-btn
                v-if="step.id > 3 && step.id < 36"
                :class="stepDone ? 'ml-[35px]' : 'mr-8'"
                :disabled="step.disableNextButton || !isJoystickConnected || step.inputType === 'axis'"
                :style="{
                  opacity: step.disableNextButton || !isJoystickConnected || step.inputType === 'axis' ? 0.15 : 1,
                }"
                variant="text"
                size="x-small"
                @click="gotoStep(36)"
              >
                skip to mapping review
              </v-btn>
              <v-spacer />
              <v-btn
                v-if="currentWizardStep === 1"
                class="blink -mr-3"
                variant="text"
                @click="
                  isJoystickConnected
                    ? nextWizardStep()
                    : openSnackbar({ message: 'Please connect a joystick first', variant: 'error' })
                "
              >
                press start...
              </v-btn>
              <v-btn
                v-if="currentWizardStep !== 1 && !step.reviewMappings"
                variant="flat"
                :disabled="step.disableNextButton || !isJoystickConnected || axisNotDetected"
                class="bg-[#ffffff22] shadow-md -mr-3"
                :style="{
                  opacity: step.disableNextButton || !isJoystickConnected || axisNotDetected ? 0.15 : 1,
                  color: step.disableNextButton || !isJoystickConnected || axisNotDetected ? '#000000' : '#FFFFFF',
                  cursor: step.disableNextButton || !isJoystickConnected || axisNotDetected ? 'not-allowed' : 'pointer',
                }"
                @click="nextWizardStep"
              >
                {{ stepDone ? 'Next (start)' : 'Skip' }}
              </v-btn>
              <v-btn
                v-if="step.reviewMappings"
                class="bg-[#ffffff22] shadow-md -mr-3"
                variant="flat"
                width="240px"
                @click="finishAndSaveProfile"
              >
                <v-progress-circular v-if="isLoading" indeterminate size="20" />
                <p v-else>Finish and save profile</p>
              </v-btn>
            </div>
          </div>
        </v-window-item>
      </v-window>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo-minimal.png'
import GlassModal from '@/components/GlassModal.vue'
import AxisVisualization from '@/components/joysticks/AxisVisualization.vue'
import { useSnackbar } from '@/composables/snackbar'
import { axisConfigMapROV, blankWizardMapping, buttonConfigMapROV } from '@/libs/joystick/configuration-wizard'
import { joystickManager } from '@/libs/joystick/manager'
import { otherAvailableActions } from '@/libs/joystick/protocols/other'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import {
  CockpitModifierKeyOption,
  Joystick,
  JoystickAxis,
  JoystickButton,
  JoystickProtocolActionsMapping,
  JoystickState,
} from '@/types/joystick'

/**
 * Interface representing a single step in the joystick wizard
 */
interface JoystickWizardStep {
  /**
   * Unique identifier for the step
   */
  id: number
  /**
   * Title of the step
   */
  title: string
  /**
   * Description of the step
   */
  content?: string
  /**
   * Lower description of the step
   */
  opposite?: string
  /**
   * If true, the content will be larger than usual
   */
  largeContent?: boolean
  /**
   * If true, the step detects an axis movement
   */
  inputType?: 'axis' | 'button'
  /**
   * If true, the step has selection options
   */
  hasSelection?: boolean
  /**
   * Options for the selection step
   */
  selectionOptions?: {
    /**
     * Label for the selection option
     */
    label: string
    /**
     * Action to perform when the option is selected
     */
    action: () => void
  }[]
  /**
   * If true, the next button will be disabled
   */
  disableNextButton?: boolean
  /**
   * If true, the step is for reviewing mappings
   */
  reviewMappings?: boolean
  /**
   *  If the step is disabled
   */
  disabled?: boolean
  /**
   * OnStepReached callback
   * @description Callback function to be called when the step is reached
   */
  onStepReached?: (step: JoystickWizardStep) => void
}

const { openSnackbar } = useSnackbar()
const interfaceStore = useAppInterfaceStore()
const controllerStore = useControllerStore()

const showWizard = ref(false)
const currentWizardStep = ref(1)
const currentJoystick = ref<Joystick>()
const isJoystickConnected = ref<boolean | undefined>(undefined)
const isLoading = ref(false)
const tallContent = ref(false)
const isJoystickListVisible = ref(false)
const detectedAxisId = ref<number | null>(null)
const detectedButtonId = ref<number | null>(null)
const errorMessage = ref<string | null>(null)
const shiftButtonIndex = ref<number | null>(null)
const isShiftPressed = ref(false)
const detectedButtonUsesShift = ref(false)
const stepDone = ref(false)
const startButtonIndex = ref<number | null>(null)
const liveAxes = ref<number[]>([])
const liveButtons = ref<number[]>([])
const wizardJoystickMapping = ref<JoystickProtocolActionsMapping>(blankWizardMapping)

const heldButtons = new Set<number>()
const prevButtonStates = new Map<number, boolean>()
const prevAxisValues = new Map<number, number>()

const axisThreshold = 0.05
let justMappedStartButton = false
let startButtonPressed = false
let lastStep = 1
let nextFrame = false
let skipSeedingHeldButtonsOnce = false

const currentStepMeta = computed(() => {
  return joystickWizardSteps.value.find((step) => step.id === currentWizardStep.value)
})

const axisNotDetected = computed(() => {
  const step = currentStepMeta.value
  return step?.inputType === 'axis' && detectedAxisId.value === null
})

const buttonPressed = computed<boolean>(() => {
  if (detectedButtonId.value === null) return false
  const joy = controllerStore.joysticks.values().next().value
  return joy ? !!joy.state.buttons[detectedButtonId.value] : false
})

const detectedButtonLabel = computed(() => {
  if (detectedButtonId.value === null) return 'Press a button'
  return `${detectedButtonUsesShift.value ? 'Shift + ' : ''}Button ${detectedButtonId.value}`
})

const connectedJoysticks = computed<string[]>(() =>
  Array.from(controllerStore.joysticks.values()).map((js) => String(js.model ?? 'Unknown'))
)

const currentAxisValue = computed(() => {
  if (detectedAxisId.value === null) return 0
  const joy = controllerStore.joysticks.values().next().value
  return joy ? joy.state.axes[detectedAxisId.value] ?? 0 : 0
})

// Build table rows for the review step
const reviewInputsTableRows = computed(() => {
  // eslint-disable-next-line jsdoc/require-jsdoc
  type Row = { type: 'Axis' | 'Button'; id: number; label: string; fn: string }
  const rows: Row[] = []

  Object.keys(wizardJoystickMapping.value.axesCorrespondencies).forEach((key) => {
    const ax = Number(key) as JoystickAxis
    const entry = wizardJoystickMapping.value.axesCorrespondencies[ax]
    if (!isNoFunction(entry.action)) {
      rows.push({
        type: 'Axis',
        id: ax,
        label: `Axis ${ax}`,
        fn: entry.action.name,
      })
    }
  })
  for (const btnType of ['regular', 'shift'] as const) {
    Object.entries(wizardJoystickMapping.value.buttonsCorrespondencies[btnType]).forEach(([key, entry]) => {
      const btn = Number(key) as JoystickButton
      const isShiftModifier = btnType === 'regular' && btn === shiftButtonIndex.value

      if (!isNoFunction(entry.action) || isShiftModifier) {
        rows.push({
          type: 'Button',
          id: btn,
          label: isShiftModifier ? `Button ${btn}` : btnType === 'shift' ? `Shift + Button ${btn}` : `Button ${btn}`,
          fn: isShiftModifier ? 'Shift modifier' : entry.action.name,
        })
      }
    })
  }
  return rows
})

// Checks if an axis is bound to the current step input
const boundAxisInfo = computed(() => {
  const meta = currentStepMeta.value
  if (!meta || meta.inputType !== 'axis') return null

  const target = axisConfigMapROV[meta.id] // e.g. axis_z
  if (!target) return null

  const idx = Object.keys(wizardJoystickMapping.value.axesCorrespondencies).find(
    (k) => wizardJoystickMapping.value.axesCorrespondencies[Number(k)].action.id === target.action.id
  )

  return idx === undefined
    ? null
    : {
        idx: Number(idx),
        value: controllerStore.joysticks.values().next().value?.state.axes[Number(idx)] ?? 0,
      }
})

const copyInputLiveState = (state: JoystickState): void => {
  if (nextFrame) return
  nextFrame = true
  requestAnimationFrame(() => {
    liveAxes.value = state.axes.map((axis) => axis ?? 0)
    liveButtons.value = state.buttons.map((btn) => btn ?? 0)
    nextFrame = false
  })
}

/* eslint-disable-next-line jsdoc/require-jsdoc */
const isNoFunction = (action: { id: string }): boolean => action.id === otherAvailableActions.no_function.id

// Commits the detected axis/button into the WIP mapping for the step that just finished.
// Includes deduplication safeguards and specific treatment for the SHIFT modifier.
const mapStepInput = (stepIdFinished: number): boolean => {
  // --- Axis mapping logic -------
  if (axisConfigMapROV[stepIdFinished] && detectedAxisId.value !== null) {
    const idx = detectedAxisId.value as JoystickAxis
    const existing = wizardJoystickMapping.value.axesCorrespondencies[idx].action
    const { id, name, protocol } = axisConfigMapROV[stepIdFinished].action

    // Prevents binding duplications
    if (!isNoFunction(existing) && existing.id !== id) {
      const axisName = `Axis ${idx}`
      const msg = `${axisName} is already bound to ${existing.name}`
      openSnackbar({ message: msg, variant: 'error', duration: 4000 })
      errorMessage.value = msg
      return false
    }

    // Bind the action and range into the WIP axis correspondency map.
    wizardJoystickMapping.value.axesCorrespondencies[idx].action = { id, name, protocol }
    wizardJoystickMapping.value.axesCorrespondencies[idx].min = axisConfigMapROV[stepIdFinished].min
    wizardJoystickMapping.value.axesCorrespondencies[idx].max = axisConfigMapROV[stepIdFinished].max
  }

  // --- Button mapping logic -----
  if (buttonConfigMapROV[stepIdFinished] && detectedButtonId.value !== null) {
    const idx = detectedButtonId.value as JoystickButton
    // Binds the Shift button on step 7
    if (stepIdFinished === 7) {
      shiftButtonIndex.value = idx
      joystickWizardSteps.value[6].disableNextButton = false
      wizardJoystickMapping.value.buttonsCorrespondencies.regular[idx].action = buttonConfigMapROV[7].action
      detectedButtonId.value = null
      return true
    }

    const { action } = buttonConfigMapROV[stepIdFinished]
    const buttonType: 'regular' | 'shift' = detectedButtonUsesShift.value ? 'shift' : 'regular'
    const existing = wizardJoystickMapping.value.buttonsCorrespondencies[buttonType][idx].action
    const isShiftKey = idx === shiftButtonIndex.value
    const isSameAction = !isNoFunction(existing) && existing.id === action.id
    const isDuplicate = !isSameAction && !isNoFunction(existing)

    // Prevents binding duplications
    if (isShiftKey || isDuplicate) {
      const reason = isShiftKey ? 'reserved as the Shift modifier' : `already bound to ${existing.name}`
      const msg = `${buttonType === 'shift' ? 'Shift +' : ''} Button ${idx} is ${reason}`
      openSnackbar({ message: msg, variant: 'error', duration: 4000 })
      errorMessage.value = msg
      return false
    }

    // Commits button mapping to the correct modifier table (regular or shift).
    wizardJoystickMapping.value.buttonsCorrespondencies[buttonType][idx].action = action
  }

  // reset per-step detection triggers
  detectedAxisId.value = null
  detectedButtonId.value = null
  prevAxisValues.clear()
  return true
}

// Keeps only "enabled" steps and compute next/prev by id
const nextEnabledId = (from: number): number | null => joystickWizardSteps.value.find((s) => s.id > from)?.id ?? null
const prevEnabledId = (from: number): number | null => {
  let prev: number | null = null
  joystickWizardSteps.value.forEach((step) => {
    if (step.id < from) prev = step.id
  })
  if (prev !== null) return prev
  return null
}

const nextWizardStep = (): void => {
  if (!mapStepInput(currentWizardStep.value)) return
  errorMessage.value = null
  const nextId = nextEnabledId(currentWizardStep.value)
  if (nextId === null) {
    return
  }
  currentWizardStep.value = nextId
  stepDone.value = false
}

const backWizardStep = (): void => {
  const prevId = prevEnabledId(currentWizardStep.value)
  if (prevId !== null) {
    currentWizardStep.value = prevId
    errorMessage.value = null
  }
}

const gotoStep = (rawStepId: number): void => {
  if (rawStepId < 1 || rawStepId > rawWizardStepsROV.length) return
  const getStepByID = joystickWizardSteps.value.find((step) => step.id === rawStepId)?.id
  mapStepInput(currentWizardStep.value)
  skipSeedingHeldButtonsOnce = true
  currentWizardStep.value = getStepByID ?? 1
}

const finishAndSaveProfile = async (): Promise<void> => {
  isLoading.value = true
  try {
    await controllerStore.mergeFunctionsMapping(wizardJoystickMapping.value)
    openSnackbar({ message: 'Joystick profile saved successfully!', variant: 'success' })
    setTimeout(() => {
      isLoading.value = false
      closeWizard()
    }, 1000)
  } catch (error) {
    console.error('Error finishing and saving profile:', error)
    openSnackbar({ message: `Error saving joystick profile (${error}). Please try again.`, variant: 'error' })
    isLoading.value = false
  }
}

const closeWizard = (): void => {
  showWizard.value = false
  interfaceStore.isJoystickWizardVisible = false
  controllerStore.enableForwarding = true
  stepOneProcedure()
  interfaceStore.isMainMenuVisible = true
}

// Assign mapping with "no_function" for all inputs
for (let i = 0; i <= 31; i++) {
  wizardJoystickMapping.value.axesCorrespondencies[i as JoystickAxis] = {
    action: otherAvailableActions.no_function,
    min: -1,
    max: 1,
  }
  for (const mod of ['regular', 'shift'] as CockpitModifierKeyOption[]) {
    wizardJoystickMapping.value.buttonsCorrespondencies[mod][i as JoystickButton] = {
      action: otherAvailableActions.no_function,
    }
  }
}

// Set latches to the first wizard step
const stepOneProcedure = (): void => {
  heldButtons.clear()
  prevButtonStates.clear()
  lastStep = 1
  startButtonIndex.value = null
  startButtonPressed = false
  justMappedStartButton = false
  stepDone.value = false
  detectedAxisId.value = null
  detectedButtonId.value = null
  detectedButtonUsesShift.value = false
  shiftButtonIndex.value = null
  prevAxisValues.clear()
}

const resetWizard = (): void => {
  stepOneProcedure()
  startButtonIndex.value = null
  currentWizardStep.value = 1
  wizardJoystickMapping.value = structuredClone(blankWizardMapping)

  Array.from({ length: 32 }, (_, i) => i as JoystickAxis).forEach((idx) => {
    wizardJoystickMapping.value.axesCorrespondencies[idx] = {
      action: otherAvailableActions.no_function,
      min: -1,
      max: 1,
    }
    ;(['regular', 'shift'] as CockpitModifierKeyOption[]).forEach((mod) => {
      const btnIdx = idx as unknown as JoystickButton
      wizardJoystickMapping.value.buttonsCorrespondencies[mod][btnIdx] = {
        action: otherAvailableActions.no_function,
      }
    })
  })
}

const rawWizardStepsROV: JoystickWizardStep[] = [
  {
    id: 1,
    title: 'Joystick configuration wizard',
    content:
      'Welcome to the control mapping assistant. This guide will help you pair each axis and button on any joystick or gamepad with the corresponding ROV function.',
    opposite:
      'Press Start (or any button of your choice) to continue. During this assistant, this button will advance to the' +
      'next step while still being available to map normally as a vehicle function.',
    largeContent: true,
    onStepReached: () => stepOneProcedure(),
  },
  {
    id: 2,
    title: 'Controller check',
    content: 'More than one joystick detected. Please connect and configure only one device at a time.',
    opposite:
      'Unplug the extra devices. When a single device appears in the list below, press **Next** to start mapping.',
    largeContent: true,
    onStepReached: () => {
      isJoystickListVisible.value = true
      if (controllerStore.joysticks.size === 1) {
        nextWizardStep()
      }
    },
  },
  {
    id: 3,
    title: 'Heave (ascend / descend)',
    content:
      'Slowly move the axis you want to use for vertical thrust. The selected direction will ascend; the inverse will descend.',
    opposite: 'Typical choice: right stick ↑↓',
    largeContent: true,
    inputType: 'axis',
    onStepReached: () => {
      isJoystickListVisible.value = false
    },
  },
  {
    id: 4,
    title: 'Sway (port / starboard)',
    content:
      'Move the axis you want for lateral translation (slide left / right). The selected direction will move the ROV to the left; the inverse will move it to the right.',
    opposite: 'Typical choice: left stick ←→',
    largeContent: true,
    inputType: 'axis',
  },
  {
    id: 5,
    title: 'Forward / Backward',
    content:
      'Move the axis you prefer to control the vehicle forward and backward. The selected direction will move the ROV forward; the inverse will move it backward.',
    opposite: 'Typical choice: left stick ↑↓',
    largeContent: true,
    inputType: 'axis',
  },
  {
    id: 6,
    title: 'Yaw (heading)',
    content:
      'Twist or move the axis you want to rotate the ROV left / right. The selected direction will rotate the ROV to the left; the inverse will rotate it to the right.',
    opposite: 'Typical choice: right stick ←→ or stick twist',
    largeContent: true,
    inputType: 'axis',
  },
  {
    id: 7,
    title: 'Shift modifier button',
    content:
      'Press the button that will act as a SHIFT modifier for the joystick. This is used to switch between different control modes and access additional functions using' +
      'the same controller buttons.',
    opposite: 'Typical choice: Button A or X',
    largeContent: true,
    inputType: 'button',
  },
  {
    id: 8,
    title: 'Vehicle Information',
    content: 'Please select the options that apply to your vehicle.',
    opposite: 'Is your vehicle equipped with a manipulator like the Newton Subsea Gripper or similar?',
    hasSelection: true,
    selectionOptions: [
      { label: 'No', action: () => gotoStep(11) },
      { label: 'Yes', action: () => gotoStep(9) },
    ],
    disableNextButton: true,
  },
  {
    id: 9,
    title: 'Manipulator – Open gripper',
    content: 'Press the button that will command the gripper to open.',
    opposite: 'Typical choice: right stick button or a trigger',
    inputType: 'button',
  },
  {
    id: 10,
    title: 'Manipulator – Close gripper',
    content: 'Press the button that will command the gripper to close.',
    opposite: 'Typical choice: left stick button or a trigger',
    inputType: 'button',
  },
  {
    id: 11,
    title: 'Camera capabilities',
    content: 'Does your ROV camera have advanced features such as manual zoom, manual focus, and white balance?',
    opposite: 'If not, the related mapping steps will be skipped.',
    hasSelection: true,
    selectionOptions: [
      { label: 'No', action: () => gotoStep(18) },
      { label: 'Yes', action: () => gotoStep(12) },
    ],
    disableNextButton: true,
  },
  {
    id: 12,
    title: 'Camera – Zoom in',
    content: 'Press the button for optical zoom-in. Skip if your camera does not support zoom.',
    opposite: 'Typical choice: right stick button or a trigger',
    inputType: 'button',
  },
  {
    id: 13,
    title: 'Camera – Zoom out',
    content: 'Press the button for optical zoom-out. Skip if your camera does not support zoom.',
    opposite: 'Typical choice: left stick button or a trigger',
    inputType: 'button',
  },
  {
    id: 14,
    title: 'Camera – Focus near',
    content: 'Press the button for focus-near (focus in).',
    opposite: 'A second prompt will follow for focus-far.',
    inputType: 'button',
  },
  {
    id: 15,
    title: 'Camera – Focus far',
    content: 'Press the button for focus-far (focus out).',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 16,
    title: 'Camera – Auto-focus',
    content: 'Press the button to toggle auto-focus.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 17,
    title: 'Camera – Auto white balance',
    content: 'Press the button to trigger auto white balance.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 18,
    title: 'Pilot gain – Increase',
    content: 'Press the button that increases pilot gain (more authority).',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 19,
    title: 'Pilot gain – Decrease',
    content: 'Press the button that decreases pilot gain (less authority).',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 20,
    title: 'Arm',
    content: 'Press the button to arm the ROV.',
    opposite: 'Typical choice: Start',
    inputType: 'button',
  },
  {
    id: 21,
    title: 'Disarm',
    content: 'Press the button to disarm the ROV.',
    opposite: 'Typical choice: Select',
    inputType: 'button',
  },
  {
    id: 22,
    title: 'Camera mount tilt up',
    content: 'Press the button to tilt the camera mount up.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 23,
    title: 'Camera mount tilt down',
    content: 'Press the button to tilt the camera mount down.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 24,
    title: 'Camera mount center',
    content: 'Press the button to center the camera mount.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 25,
    title: 'Lights – Brighter',
    content:
      'Press the button that increases the brightness of the lights. If your ROV has multiple lights, this will increase the brightness of all of them.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 26,
    title: 'Lights – Dimmer',
    content:
      'Press the button that decreases the brightness of the lights. If your ROV has multiple lights, this will decrease the brightness of all of them.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 27,
    title: 'Trim pitch forward',
    content:
      'Press the button that trims pitch forward (nose down). This is used to adjust vehicle attitude in flight.',
    opposite:
      'Typical choice for this and the next two steps is a hat switch on a joystick or a dedicated trim wheel on a controller.',
    largeContent: true,
    inputType: 'button',
    disabled: true,
  },
  {
    id: 28,
    title: 'Trim pitch backward',
    content: 'Press the button that trims pitch backward (nose up). This is used to adjust vehicle attitude in flight.',
    opposite: '',
    inputType: 'button',
    disabled: true,
  },
  {
    id: 29,
    title: 'Trim roll right',
    content:
      'Press the button that trims roll right (roll to the right). This is used to adjust vehicle attitude in flight.',
    opposite: '',
    inputType: 'button',
    disabled: true,
  },
  {
    id: 30,
    title: 'Trim roll left',
    content:
      'Press the button that trims roll left (roll to the left). This is used to adjust vehicle attitude in flight.',
    opposite: '',
    inputType: 'button',
    disabled: true,
  },
  {
    id: 31,
    title: 'Mode – Manual',
    content: 'Press the button to switch to manual mode.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 32,
    title: 'Mode – Depth-hold',
    content: 'Press the button to switch to depth-hold mode.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 33,
    title: 'Mode – Stabilize',
    content: 'Press the button to switch to stabilize mode.',
    opposite: '',
    inputType: 'button',
  },
  {
    id: 34,
    title: 'Toggle input hold',
    content:
      'Press the button to toggle input hold. This will stop all ROV movement and hold the current position until toggled again.',
    opposite:
      'Typical choice is a dedicated button on a controller or a hat switch on a joystick. If not available, you can skip this step.',
    largeContent: true,
    inputType: 'button',
    disabled: true,
  },
  {
    id: 35,
    title: 'Roll & Pitch toggle',
    content:
      'Press the button that toggles between Roll & Pitch control and Heave & Sway control. This is used for advanced maneuvers.',
    opposite:
      'Typical choice is a dedicated button on a controller or a hat switch on a joystick. If not available, you can skip this step.',
    largeContent: true,
    inputType: 'button',
    disabled: true,
  },
  {
    id: 36,
    title: 'Review mapping',
    content: 'Move each axis and press every mapped button to verify the on-screen overlay responds as expected.',
    opposite: 'If something is wrong, select a step on the sidebar to remap it before continuing.',
    reviewMappings: true,
    largeContent: true,
    onStepReached: () => {
      stepDone.value = true
    },
  },
]

const joystickWizardSteps = computed(() => rawWizardStepsROV.filter((step) => !step.disabled))

// Clears mapping for the function currently targeted by the step
const resetCurrentInputDetection = (): void => {
  // reset axis mapping if one was detected
  const stepType = currentStepMeta.value

  if (stepType?.inputType === 'axis') {
    const targetId = axisConfigMapROV[stepType.id]?.action.id
    if (targetId) {
      Object.entries(wizardJoystickMapping.value.axesCorrespondencies).some(([, entry]) => {
        if (entry.action.id === targetId) {
          entry.action = otherAvailableActions.no_function
          entry.min = -1
          entry.max = 1
          return true // stops .some() once the match is cleared
        }
        return false
      })
    }
  } else if (stepType?.inputType === 'button') {
    const targetId = buttonConfigMapROV[stepType.id]?.action.id
    if (targetId) {
      ;['regular', 'shift'].forEach((mod) => {
        Object.values(wizardJoystickMapping.value.buttonsCorrespondencies[mod as CockpitModifierKeyOption]).forEach(
          (entry) => {
            if (entry.action.id === targetId) {
              entry.action = otherAvailableActions.no_function
            }
          }
        )
      })
    }
  }
  heldButtons.clear()
  prevButtonStates.clear()
  justMappedStartButton = false
  startButtonPressed = false
  detectedAxisId.value = null
  detectedButtonId.value = null
  errorMessage.value = null
  prevAxisValues.clear()
}

// Overwrites (by user action) the current mapping if a conflicting axis or button is detected
const overwriteConflictingMapping = (): void => {
  const stepId = currentWizardStep.value
  errorMessage.value = null

  if (axisConfigMapROV[stepId] && detectedAxisId.value !== null) {
    const idx = detectedAxisId.value as JoystickAxis
    const { action, min, max } = axisConfigMapROV[stepId]
    const axisEntry = wizardJoystickMapping.value.axesCorrespondencies[idx]
    axisEntry.action = action
    axisEntry.min = min
    axisEntry.max = max
  } else if (buttonConfigMapROV[stepId] && detectedButtonId.value !== null) {
    const idx = detectedButtonId.value as JoystickButton

    if (stepId === 7) {
      shiftButtonIndex.value = idx
      joystickWizardSteps.value[6].disableNextButton = false
      wizardJoystickMapping.value.buttonsCorrespondencies.regular[idx].action = buttonConfigMapROV[7].action
    } else {
      const btnType: 'regular' | 'shift' = detectedButtonUsesShift.value ? 'shift' : 'regular'
      const { id, name, protocol } = buttonConfigMapROV[stepId].action
      wizardJoystickMapping.value.buttonsCorrespondencies[btnType][idx].action = { id, name, protocol }
    }
  }
  detectedAxisId.value = null
  detectedButtonId.value = null
  stepDone.value = false
  prevAxisValues.clear()
  nextWizardStep()
}

// Core controller input loop - detects button presses and axis movements
const detectInputs = (state: JoystickState): void => {
  // Push live values for the UI (Axis visualization / button highlights)
  copyInputLiveState(state)

  // Check if the shift button was bound earlier
  if (shiftButtonIndex.value !== null) {
    // Push live state of the shift button to the UI
    isShiftPressed.value = !!state.buttons[shiftButtonIndex.value]
  }

  const fallingEdges = new Set<number>()
  // Start button detection (if not already bound)
  state.buttons.forEach((isDown, idx) => {
    const wasDown = prevButtonStates.get(idx) ?? false
    if (!isDown && wasDown) fallingEdges.add(idx)
    prevButtonStates.set(idx, !!isDown)
  })

  state.buttons.forEach((_, idx) => {
    if (fallingEdges.has(idx) && !heldButtons.has(idx) && startButtonIndex.value === null) {
      startButtonIndex.value = idx
      nextWizardStep()
    }
  })

  // On step changed, resets the held buttons memory - so they aren't immediately re-detected as new input on the next step
  if (currentWizardStep.value !== lastStep) {
    justMappedStartButton = false
    heldButtons.clear()

    if (!skipSeedingHeldButtonsOnce) {
      state.buttons.forEach((isDown, idx) => {
        if (isDown) heldButtons.add(idx)
      })
    }

    skipSeedingHeldButtonsOnce = false
    lastStep = currentWizardStep.value
  }

  // Checks on the step dictionary to see what type of input to detect
  const stepMeta = currentStepMeta.value

  // Starts detection for the current step
  // ----------- Axis detection -----------
  if (stepMeta?.inputType === 'axis') {
    state.axes.forEach((val, idx) => {
      const now = val ?? 0
      const prev = prevAxisValues.get(idx) ?? 0
      if (Math.abs(now - prev) > axisThreshold && detectedAxisId.value === null) {
        detectedAxisId.value = idx
      }
      prevAxisValues.set(idx, now)
      stepDone.value = detectedAxisId.value !== null
    })
    // ---------- Button detection ----------
  } else if (stepMeta?.inputType === 'button') {
    state.buttons.forEach((isDown, idx) => {
      if (!isDown) heldButtons.delete(idx)

      const canDetect =
        fallingEdges.has(idx) &&
        detectedButtonId.value === null &&
        idx !== shiftButtonIndex.value &&
        !heldButtons.has(idx)

      if (canDetect) {
        if (idx === startButtonIndex.value) {
          justMappedStartButton = true
        }
        // Binds the SHIFT button state at detection time (on release), so mapping is deterministic.
        detectedButtonId.value = idx
        detectedButtonUsesShift.value = isShiftPressed.value
        stepDone.value = true
      }
    })
  } else {
    // No input to detection to be done on this step. Clear states
    detectedAxisId.value = null
    detectedButtonId.value = null
    detectedButtonUsesShift.value = false
    prevAxisValues.clear()
  }

  // Auto-advance when pressing the START button (users don't need to reach for keyboard or mouse)
  const startIsDown = startButtonIndex.value !== null ? !!state.buttons[startButtonIndex.value] : false
  if (!startIsDown) justMappedStartButton = false
  if (stepDone.value && startIsDown && !startButtonPressed && !justMappedStartButton) {
    nextWizardStep()
  }
  startButtonPressed = startIsDown
}

watch(
  () => interfaceStore.isJoystickWizardVisible,
  (isVisible) => {
    showWizard.value = isVisible
    interfaceStore.isMainMenuVisible = false
  },
  { immediate: true }
)

watch(showWizard, (isShowing) => {
  interfaceStore.isJoystickWizardVisible = isShowing
  if (!isShowing) resetWizard()
})

// Fires current step's callback
watch(
  () => currentWizardStep.value,
  (step: number) => {
    const currentStep = joystickWizardSteps.value.find((s) => s.id === step)
    if (currentStep) {
      currentStep.onStepReached?.(currentStep)
      setTimeout(() => {
        resetCurrentInputDetection()
      }, 100)
      stepDone.value = false
      tallContent.value = currentStep.largeContent ?? false
      if (currentStep.id === 1) {
        stepOneProcedure()
      }
    } else {
      console.warn(`No step found for ID ${step}`)
    }
  },
  { immediate: true }
)

// Automatically set the current joystick when it changes for the first time
watch(
  controllerStore.joysticks,
  () => {
    if (isJoystickConnected.value === undefined) {
      if (controllerStore.joysticks.size <= 0) return
      const firstJoystick = controllerStore.joysticks.values().next().value
      currentJoystick.value = firstJoystick
      isJoystickConnected.value = true
      openSnackbar({ message: 'Joystick connected', variant: 'success', duration: 3000 })
    }
  },
  { immediate: true }
)

// Does not let the joystick forwarding to be enabled while the user is in this page
// This could happen, for example, when the joystick is reconnected while in this page
watch(
  () => controllerStore.enableForwarding,
  () => {
    if (!interfaceStore.isJoystickWizardVisible) return
    controllerStore.enableForwarding = false
  }
)

watch(
  () => controllerStore.joysticks.values().next().value?.state,
  (state) => state && detectInputs(state),
  { deep: true }
)

onMounted(() => {
  controllerStore.enableForwarding = false
  joystickManager.onJoystickConnectionUpdate((event) => {
    isJoystickConnected.value = event.size !== 0
  })
})

onUnmounted(() => {
  controllerStore.enableForwarding = true
})
</script>
<style>
.custom-timeline .v-timeline-divider__after {
  background-color: #ffffff44;
}
.custom-timeline .v-timeline-divider__before {
  background-color: #ffffff44;
}

@keyframes rotateAndRipple {
  100% {
    transform: rotate(720deg);
  }
}

@keyframes rippleEffect {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.rotate-and-ripple {
  position: relative;
  animation: rotateAndRipple 1.2s ease-in-out forwards;
}

.ripple {
  position: relative;
  animation: ripple 1.2s ease-in-out forwards;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: rippleEffect 1s ease-out forwards;
  animation-delay: 1s;
  pointer-events: none;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.blink {
  animation: fadeInOut 1.5s infinite;
}
</style>
