<template>
  <BaseConfigurationView>
    <template #title>Joystick configuration</template>
    <template #content>
      <div
        v-if="controllerStore.joysticks && !controllerStore.joysticks.size"
        class="p-12 m-8 shadow-md rounded-2xl flex-centered flex-column position-relative"
      >
        <p class="text-2xl font-semibold">No joystick detected.</p>
        <br />
        <p class="text-base text-center">Make sure that a joystick is connected.</p>
        <p class="text-base text-center">You can hit any key to test the joystick connection.</p>
      </div>
      <div v-else class="flex flex-col items-center">
        <div
          class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-fit"
        >
          <p class="font-bold">
            This is the joystick configuration page. Here you can calibrate your joystick and map its buttons to
            functions in your drone.
          </p>
          <br />
          <p>
            Click the buttons in your physical controller and see them being activated here. If any button does not
            light up in this virtual joystick or is switched with another, click in it here and follow the instructions
            to remap it.
          </p>
          <br />
          <p>
            By clicking the virtual buttons and axis you are also able to choose the function in your drone that this
            button controls, as whel as set axis limits.
          </p>
        </div>
        <div
          v-if="!m2rSupportsExtendedManualControl || !ardupilotSupportsExtendedManualControl"
          class="px-5 py-3 m-1 text-center border-yellow-300 bg-yellow-200/10 border-2 rounded-md max-w-[80%] text-slate-600"
        >
          <p class="font-semibold">System update is recommended</p>
          <br />
          <p class="font-medium">
            It seems like you're running versions of Mavlink2Rest (BlueOS) and/or ArduPilot that do not support the
            extended MAVLink MANUAL_CONTROL message. We strongly suggest upgrading both so you can have support for
            additional buttons and axes on the joystick. This is especially important if you sometimes use other control
            station software, like QGroundControl, as Cockpit can preferentially use the extended buttons to reduce
            configuration clashes. We recommend using BlueOS &ge; 1.2.0, and &ge; version 4.1.2 for ArduPilot-based
            autopilot firmware.
          </p>
          <p />
        </div>
        <div
          v-if="controllerStore.availableButtonActions.every((b) => b.protocol === JoystickProtocol.CockpitAction)"
          class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
        >
          <p>Could not stablish communication with the vehicle.</p>
          <p>Button functions will appear as numbers. If connection is restablished, function names will appear.</p>
        </div>
        <div v-if="availableModifierKeys" class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md">
          <div class="flex">
            <Button
              v-for="functionMapping in controllerStore.protocolMappings"
              :key="functionMapping.name"
              class="m-2"
              :class="{ 'bg-slate-700': controllerStore.protocolMapping.name === functionMapping.name }"
              @click="controllerStore.loadProtocolMapping(functionMapping)"
            >
              {{ functionMapping.name }}
            </Button>
          </div>
          <div class="flex flex-col items-center w-full my-2">
            <v-combobox
              v-model="vehicleTypesAssignedToCurrentProfile"
              :items="availableVehicleTypes"
              label="Vehicle types that use this profile by default:"
              chips
              multiple
              variant="outlined"
              class="w-10/12 m-4"
            />
          </div>
        </div>
        <div class="flex items-center px-5 py-3 m-5 font-bold border rounded-md">
          <Button
            v-for="key in availableModifierKeys"
            :key="key.id"
            class="m-2"
            :class="{ 'bg-slate-700': currentModifierKey.id === key.id }"
            @click="changeModifierKeyTab(key.id as CockpitModifierKeyOption)"
          >
            {{ key.name }}
          </Button>
        </div>
      </div>
      <div
        v-for="[key, joystick] in controllerStore.joysticks"
        :key="key"
        class="w-[95%] p-4 shadow-md rounded-2xl flex-centered flex-column position-relative"
      >
        <p class="text-xl font-semibold text-grey-darken-3">{{ joystick.model }} controller</p>
        <div v-if="showJoystickLayout" class="flex flex-col items-center justify-center w-full">
          <JoystickPS
            class="w-[70%]"
            :model="joystick.model"
            :left-axis-horiz="joystick.state.axes[0]"
            :left-axis-vert="joystick.state.axes[1]"
            :right-axis-horiz="joystick.state.axes[2]"
            :right-axis-vert="joystick.state.axes[3]"
            :b0="joystick.state.buttons[0]"
            :b1="joystick.state.buttons[1]"
            :b2="joystick.state.buttons[2]"
            :b3="joystick.state.buttons[3]"
            :b4="joystick.state.buttons[4]"
            :b5="joystick.state.buttons[5]"
            :b6="joystick.state.buttons[6]"
            :b7="joystick.state.buttons[7]"
            :b8="joystick.state.buttons[8]"
            :b9="joystick.state.buttons[9]"
            :b10="joystick.state.buttons[10]"
            :b11="joystick.state.buttons[11]"
            :b12="joystick.state.buttons[12]"
            :b13="joystick.state.buttons[13]"
            :b14="joystick.state.buttons[14]"
            :b15="joystick.state.buttons[15]"
            :b16="joystick.state.buttons[16]"
            :b17="joystick.state.buttons[17]"
            :buttons-actions-correspondency="currentButtonActions"
            @click="(e) => setCurrentInputs(joystick, e)"
          />
        </div>
        <div class="flex items-center justify-evenly">
          <div class="flex flex-col items-center max-w-[30%] mb-4">
            <span class="mb-2 text-xl font-medium text-slate-500">Joystick mapping</span>
            <div class="flex flex-wrap items-center justify-evenly">
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="controllerStore.exportJoystickMapping(joystick)"
              >
                Export to computer
              </button>
              <label class="p-2 m-1 font-medium border rounded-md cursor-pointer text-uppercase">
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  @change="(e) => controllerStore.importJoystickMapping(joystick, e)"
                />
                Import from computer
              </label>
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="
                  controllerStore.exportJoysticksMappingsToVehicle(globalAddress, controllerStore.cockpitStdMappings)
                "
              >
                Export to vehicle
              </button>
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="controllerStore.importJoysticksMappingsFromVehicle(globalAddress)"
              >
                Import from vehicle
              </button>
            </div>
          </div>
          <div class="flex flex-col items-center max-w-[30%] mb-4">
            <span class="mb-2 text-xl font-medium text-slate-500">Functions mapping</span>
            <div class="flex flex-wrap items-center justify-evenly">
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="controllerStore.exportFunctionsMapping(controllerStore.protocolMapping)"
              >
                Export to computer
              </button>
              <label class="p-2 m-1 font-medium border rounded-md cursor-pointer text-uppercase">
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  @change="(e) => controllerStore.importFunctionsMapping(e)"
                />
                Import from computer
              </label>
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="
                  controllerStore.exportFunctionsMappingToVehicle(globalAddress, controllerStore.protocolMappings)
                "
              >
                Export to vehicle
              </button>
              <button
                class="p-2 m-1 font-medium border rounded-md text-uppercase"
                @click="importFunctionsMappingFromVehicle"
              >
                Import from vehicle
              </button>
            </div>
          </div>
        </div>
        <v-switch
          v-model="controllerStore.holdLastInputWhenWindowHidden"
          label="Hold last joystick input when window is hidden (tab changed or window minimized)"
          class="m-2 text-slate-800"
        />
      </div>
    </template>
  </BaseConfigurationView>
  <teleport to="body">
    <v-dialog v-if="currentJoystick" v-model="inputClickedDialog" class="w-[80%] max-h-[90%]">
      <v-card class="p-6">
        <p class="flex items-center justify-center w-full p-2 text-2xl font-bold text-slate-600">Input mapping</p>
        <div class="flex flex-col items-center justify-between">
          <div class="w-[90%] h-[2px] my-5 bg-slate-900/20" />
          <p class="flex items-center justify-center w-full text-xl font-bold text-slate-600">Button mapping</p>
          <div
            v-for="input in currentButtonInputs"
            :key="input.id"
            class="flex flex-col justify-between w-full p-3 align-center"
          >
            <div class="flex flex-col items-center justify-between my-2">
              <v-btn
                class="mx-auto my-1 w-fit"
                :disabled="remappingInput"
                @click="remapInput(currentJoystick as Joystick, input)"
              >
                {{ remappingInput ? 'Remapping' : 'Click to remap' }}
              </v-btn>
              <Transition>
                <p v-if="showButtonRemappingText" class="font-medium text-slate-400">{{ buttonRemappingText }}</p>
              </Transition>
              <Transition>
                <v-progress-linear v-if="remappingInput" v-model="remapTimeProgress" />
              </Transition>
            </div>
            <v-tooltip location="bottom" :text="confirmationRequiredTooltipText(input)">
              <template #activator="{ props: tooltipProps }">
                <div class="flex justify-center items-center">
                  <v-switch
                    v-model="controllerStore.actionsJoystickConfirmRequired[getCurrentButtonAction(input).id]"
                    style="pointer-events: all; height: 56px"
                    class="m-2 text-slate-800"
                    color="rgb(0, 20, 80)"
                    :disabled="!isConfirmRequiredAvailable(input)"
                    v-bind="tooltipProps"
                  />
                  <v-label style="height: 56px">Confirmation Required</v-label>
                </div>
              </template>
            </v-tooltip>
            <div class="flex flex-col items-center justify-between w-full my-2">
              <div class="flex w-[90%] justify-evenly">
                <div v-for="protocol in JoystickProtocol" :key="protocol" class="flex flex-col items-center h-40 mx-4">
                  <span class="mx-auto text-xl font-bold">{{ protocol }}</span>
                  <div class="flex flex-col items-center px-2 py-1 overflow-y-auto">
                    <Button
                      v-for="action in buttonActionsToShow.filter((a) => a.protocol === protocol)"
                      :key="action.name"
                      class="w-full my-1 text-sm hover:bg-slate-700"
                      :class="{
                        'bg-slate-700':
                          currentButtonActions[input.id].action.protocol == action.protocol &&
                          currentButtonActions[input.id].action.id == action.id,
                      }"
                      @click="updateButtonAction(input, action)"
                    >
                      {{ action.name }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Transition>
            <p v-if="showButtonFunctionAssignmentFeedback" class="text-lg font-medium">
              {{ buttonFunctionAssignmentFeedback }}
            </p>
          </Transition>
          <template v-if="currentAxisInputs.length > 0">
            <div class="w-[90%] h-[2px] my-5 bg-slate-900/20" />
            <p class="flex items-center justify-center w-full text-xl font-bold text-slate-600">Axis mapping</p>
          </template>
          <div class="flex flex-col items-center justify-between my-2">
            <Transition>
              <p v-if="showAxisRemappingText" class="font-medium text-slate-400">{{ axisRemappingText }}</p>
            </Transition>
            <Transition>
              <v-progress-linear v-if="remappingAxisInput" v-model="remapAxisTimeProgress" />
            </Transition>
          </div>
          <div v-for="input in currentAxisInputs" :key="input.id" class="flex items-center justify-between p-2">
            <v-icon class="mr-3">
              {{
                [JoystickAxis.A0, JoystickAxis.A2].includes(Number(input.id))
                  ? 'mdi-pan-horizontal'
                  : 'mdi-pan-vertical'
              }}
            </v-icon>
            <v-text-field
              v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].min"
              class="w-24"
              label="Min"
              type="number"
              density="compact"
              variant="solo"
              hide-details
            />
            <v-select
              v-model="controllerStore.protocolMapping.axesCorrespondencies[input.id].action"
              :items="controllerStore.availableAxesActions"
              item-title="name"
              hide-details
              density="compact"
              variant="solo"
              class="w-40 mx-2"
              return-object
            />
            <v-text-field
              v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].max"
              class="w-24"
              label="Max"
              type="number"
              density="compact"
              variant="solo"
              hide-details
            />
            <v-btn
              class="w-40 ml-2"
              :disabled="remappingAxisInput !== false"
              @click="remapAxisInput(currentJoystick as Joystick, input)"
            >
              {{ remappingAxisInput && remappingAxisInput === input.id ? 'Remapping' : 'Click to remap' }}
            </v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import semver from 'semver'
import Swal from 'sweetalert2'
import { type Ref, computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import Button from '@/components/Button.vue'
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { getArdupilotVersion, getMavlink2RestVersion } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { CockpitActionsFunction } from '@/libs/joystick/protocols/cockpit-actions'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { sleep } from '@/libs/utils'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import {
  type CockpitButton,
  type Joystick,
  type JoystickInput,
  type ProtocolAction,
  CockpitModifierKeyOption,
  InputType,
  JoystickAxis,
  JoystickAxisInput,
  JoystickButton,
  JoystickButtonInput,
  JoystickProtocol,
} from '@/types/joystick'

import BaseConfigurationView from './BaseConfigurationView.vue'

/**
 * The time in milliseconds that the remapping process waits for a button press
 * before considering it unsuccessful in milliseconds.
 */
const remappingTimeTotalMs = 5000

/**
 * The minimum value a certain axis must change to be considered a full range move.
 */
const joystickAxisFullRangeThreshold = 3.5

const controllerStore = useControllerStore()
const { globalAddress } = useMainVehicleStore()

const m2rSupportsExtendedManualControl = ref<boolean>()
const ardupilotSupportsExtendedManualControl = ref<boolean>()
onMounted(async () => {
  controllerStore.enableForwarding = false
  const m2rVersion = await getMavlink2RestVersion(globalAddress)
  m2rSupportsExtendedManualControl.value = semver.gte(m2rVersion, '0.11.19')
  const ardupilotVersion = await getArdupilotVersion(globalAddress)
  ardupilotSupportsExtendedManualControl.value = semver.gte(ardupilotVersion, '4.1.2')
})

onUnmounted(() => {
  controllerStore.enableForwarding = true
})

// Does not let the joystick forwarding to be enabled while the user is in this page
// This could happen, for example, when the joystick is reconnected while in this page
watch(
  () => controllerStore.enableForwarding,
  () => (controllerStore.enableForwarding = false)
)

const currentJoystick = ref<Joystick>()
const currentButtonInputs = ref<JoystickButtonInput[]>([])
const currentAxisInputs = ref<JoystickAxisInput[]>([])
const remappingInput = ref(false)
const remappingAxisInput = ref<false | JoystickAxis>(false)
const remapTimeProgress = ref()
const remapAxisTimeProgress = ref()
const showButtonRemappingText = ref(false)
const showAxisRemappingText = ref(false)
const buttonFunctionAssignmentFeedback = ref('')
const showButtonFunctionAssignmentFeedback = ref(false)
const justRemappedInput = ref<boolean>()
const justRemappedAxisInput = ref<boolean>()
const inputClickedDialog = ref(false)
const currentModifierKey: Ref<ProtocolAction> = ref(modifierKeyActions.regular)
const availableModifierKeys: ProtocolAction[] = Object.values(modifierKeyActions)
const showJoystickLayout = ref(true)
watch(inputClickedDialog, () => {
  justRemappedInput.value = undefined
  justRemappedAxisInput.value = undefined
})

const setCurrentInputs = (joystick: Joystick, inputs: JoystickInput[]): void => {
  currentJoystick.value = joystick

  currentButtonInputs.value = inputs
    .filter((i) => i.type === InputType.Button)
    .map((i) => new JoystickButtonInput(i.id as JoystickButton))
  currentAxisInputs.value = inputs
    .filter((i) => i.type === InputType.Axis)
    .map((i) => new JoystickAxisInput(i.id as JoystickAxis))

  inputClickedDialog.value = true
}

const importFunctionsMappingFromVehicle = async (): Promise<void> => {
  try {
    await controllerStore.importFunctionsMappingFromVehicle(globalAddress)
    Swal.fire({ icon: 'success', text: 'Joystick functions mappings imported from the vehicle.' })
  } catch (error) {
    Swal.fire({ icon: 'error', text: `${error}` })
  }
}

/**
 * Remaps the input of a given joystick. The function waits for a button press on the joystick and then
 * updates the mapping to associate the joystick input with the pressed button. If no button is pressed
 * within a specified waiting time, the remapping is considered unsuccessful.
 * @param {Joystick} joystick - The joystick object that needs input remapping.
 * @param {JoystickInput} input - The joystick input that is to be remapped.
 * @returns {Promise<void>} A promise that resolves once the remapping process is complete.
 */
const remapInput = async (joystick: Joystick, input: JoystickInput): Promise<void> => {
  // Initialize the remapping state
  justRemappedInput.value = undefined
  let pressedButtonIndex = undefined
  let millisPassed = 0
  remappingInput.value = true
  remapTimeProgress.value = 0
  showButtonRemappingText.value = true

  // Wait for a button press or until the waiting time expires
  while ([undefined, -1].includes(pressedButtonIndex) && millisPassed < remappingTimeTotalMs) {
    // Check if any button on the joystick is pressed, and if so, get it's index
    pressedButtonIndex = joystick.gamepad.buttons.findIndex((button) => button.value === 1)
    await sleep(100)
    millisPassed += 100
    remapTimeProgress.value = 100 * (millisPassed / remappingTimeTotalMs)
  }

  // End the remapping process
  remappingInput.value = false

  setTimeout(() => (showButtonRemappingText.value = false), 5000)

  // If a button was pressed, update the mapping of that joystick model in the controller store and return
  if (![undefined, -1].includes(pressedButtonIndex)) {
    justRemappedInput.value = true
    controllerStore.cockpitStdMappings[joystick.model].buttons[input.id] = pressedButtonIndex as CockpitButton
    return
  }
  // If remapping was unsuccessful, indicate it, so we can warn the user
  justRemappedInput.value = false
}

/**
 * Remaps the input of a given joystick axis. The function waits for a full range move of some axis and then
 * updates the mapping to associate the joystick axis input with the moved axis. If no axis is moved
 * within a specified waiting time, the remapping is considered unsuccessful.
 * @param {Joystick} joystick - The joystick object that needs input remapping.
 * @param {JoystickInput} input - The joystick input that is to be remapped.
 * @returns {Promise<void>} A promise that resolves once the remapping process is complete.
 */
const remapAxisInput = async (joystick: Joystick, input: JoystickInput): Promise<void> => {
  // Initialize the remapping state
  justRemappedAxisInput.value = undefined
  remappingAxisInput.value = input.id as JoystickAxis
  remapAxisTimeProgress.value = 0
  showAxisRemappingText.value = true

  // Save the initial state of joystick axes values
  const lastAxisValues = [...joystick.gamepad.axes]
  const totalAxisDiff = new Array(lastAxisValues.length).fill(0)

  // Time tracking could be simplified by calculating the end time first
  const endTime = Date.now() + remappingTimeTotalMs

  // Wait for a button press or until the waiting time expires
  while (Date.now() < endTime) {
    const currentAxisValues = joystick.gamepad.axes

    totalAxisDiff.forEach((_, i) => {
      totalAxisDiff[i] += Math.abs(currentAxisValues[i] - lastAxisValues[i])
    })

    if (totalAxisDiff.some((diff) => diff > joystickAxisFullRangeThreshold)) {
      break
    }

    // Await a short period before the next check
    await sleep(100)
    const timePassed = Date.now() - endTime + remappingTimeTotalMs
    remapAxisTimeProgress.value = (timePassed / remappingTimeTotalMs) * 100
  }
  setTimeout(() => {
    if (remappingAxisInput.value === false) {
      showAxisRemappingText.value = false
    }
  }, 5000)

  // Determine success and update the mapping if successful
  const remappedIndex = totalAxisDiff.findIndex((diff) => diff > joystickAxisFullRangeThreshold)
  const success = remappedIndex !== -1

  // End the remapping process
  justRemappedAxisInput.value = success
  remappingAxisInput.value = false

  if (success) {
    controllerStore.cockpitStdMappings[joystick.model].axes[input.id] = remappedIndex as JoystickAxis
  }
}

const currentButtonActions = computed(
  () => controllerStore.protocolMapping.buttonsCorrespondencies[currentModifierKey.value.id as CockpitModifierKeyOption]
)

const getCurrentButtonAction = (input: JoystickInput): ProtocolAction => {
  return controllerStore.protocolMapping.buttonsCorrespondencies[
    currentModifierKey.value.id as CockpitModifierKeyOption
  ][input.id].action
}

const isHoldToConfirm = (input: JoystickInput): boolean => {
  return getCurrentButtonAction(input).id === CockpitActionsFunction.hold_to_confirm
}

const isConfirmRequiredAvailable = (input: JoystickInput): boolean => {
  return getCurrentButtonAction(input).protocol === JoystickProtocol.CockpitAction && !isHoldToConfirm(input)
}

const confirmationRequiredTooltipText = (input: JoystickInput): string => {
  if (isConfirmRequiredAvailable(input)) {
    return (
      'Enabling this setting requires a confirmation step for critical actions. ' +
      'For ease of use, assign "Hold to confirm" to a controller button, avoiding the need for mouse interaction.'
    )
  } else if (isHoldToConfirm(input)) {
    return 'Hold to confirm cannot require confirmation.'
  } else {
    return 'This confirmation setting is applicable only to cockpit actions.'
  }
}

const updateButtonAction = (input: JoystickInput, action: ProtocolAction): void => {
  controllerStore.protocolMapping.buttonsCorrespondencies[currentModifierKey.value.id as CockpitModifierKeyOption][
    input.id
  ].action = action
  setTimeout(() => {
    showJoystickLayout.value = false
    nextTick(() => (showJoystickLayout.value = true))
  }, 1000)
  buttonFunctionAssignmentFeedback.value = `Button ${input.id} remapped to function '${action.name}'.`
  showButtonFunctionAssignmentFeedback.value = true
  setTimeout(() => (showButtonFunctionAssignmentFeedback.value = false), 5000)
}

// Automatically change between modifier key tabs/layouts when they are pressed
watch(controllerStore.joysticks, () => {
  if (currentJoystick.value === undefined) {
    if (controllerStore.joysticks.size <= 0) return
    currentJoystick.value = controllerStore.joysticks.entries().next().value[1]
  }

  const modifierKeysIds = Object.values(modifierKeyActions).map((v) => v.id)
  const regularLayout = controllerStore.protocolMapping.buttonsCorrespondencies[CockpitModifierKeyOption.regular]
  const activeModKeys = Object.entries(regularLayout)
    .filter((v) => currentJoystick.value?.state.buttons[Number(v[0]) as JoystickButton])
    .map((v) => v[1].action)
    .filter((v) => v.protocol === JoystickProtocol.CockpitModifierKey)
    .filter((v) => modifierKeysIds.includes(v.id))
    .filter((v) => v !== modifierKeyActions.regular)

  if (activeModKeys.isEmpty()) return
  if (currentModifierKey.value.id === activeModKeys[0].id) {
    changeModifierKeyTab(modifierKeyActions.regular.id as CockpitModifierKeyOption)
    return
  }
  changeModifierKeyTab(activeModKeys[0].id as CockpitModifierKeyOption)
})

let lastModTabChange = new Date().getTime()
const changeModifierKeyTab = (modKeyOption: CockpitModifierKeyOption): void => {
  if (!Object.keys(modifierKeyActions).includes(modKeyOption)) return

  // Buffer so we change tab once per button press
  if (new Date().getTime() - lastModTabChange < 200) return
  lastModTabChange = new Date().getTime()

  currentModifierKey.value = modifierKeyActions[modKeyOption]
}

const buttonRemappingText = computed(() => {
  return remappingInput.value
    ? 'Click the button you want to use for this input.'
    : justRemappedInput.value === undefined
    ? ''
    : justRemappedInput.value
    ? 'Input remapped.'
    : 'No input detected.'
})

const axisRemappingText = computed(() => {
  return remappingAxisInput.value
    ? 'Make a full range move on the axis you want to use for this input.'
    : justRemappedAxisInput.value === undefined
    ? ''
    : justRemappedAxisInput.value
    ? 'Axis input remapped.'
    : 'No axis detected.'
})

const buttonActionsToShow = computed(() =>
  controllerStore.availableButtonActions.filter((a) => JSON.stringify(a) !== JSON.stringify(modifierKeyActions.regular))
)

const availableVehicleTypes = computed(() => Object.keys(MavType))

const vehicleTypesAssignedToCurrentProfile = computed({
  get() {
    return Object.keys(controllerStore.vehicleTypeProtocolMappingCorrespondency).filter((vType) => {
      // @ts-ignore: Enums in TS such
      return controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] === controllerStore.protocolMapping.hash
    })
  },
  set(selectedVehicleTypes: string[]) {
    availableVehicleTypes.value.forEach((vType) => {
      // @ts-ignore: Enums in TS such
      if (controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] === controllerStore.protocolMapping.hash) {
        // @ts-ignore: Enums in TS such
        controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] = undefined
      }
      if (selectedVehicleTypes.includes(vType)) {
        // @ts-ignore: Enums in TS such
        controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] = controllerStore.protocolMapping.hash
      }
    })
  },
})
</script>
