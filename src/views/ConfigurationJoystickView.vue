<template>
  <BaseConfigurationView>
    <template #title>Joystick configuration</template>
    <template #content>
      <div :class="interfaceStore.isOnSmallScreen ? 'max-w-[88vw] max-h-[95vh]' : 'max-w-[880px] max-h-[85vh]'">
        <div
          v-if="controllerStore.joysticks && !controllerStore.joysticks.size"
          class="px-6 pb-2 flex-centered flex-column position-relative"
          :class="interfaceStore.isOnSmallScreen ? 'pt-1' : 'pt-3'"
        >
          <p class="text-base text-center font-bold mt-6 mb-4">Connect a joystick and press any key.</p>
        </div>
        <ExpansiblePanel v-else class="mt-3" no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Funcitons mapping</template>
          <template #info>
            <div class="flex flex-col items-center px-5 font-medium">
              Click the buttons in your physical controller and see them being activated here. If any button does not
              light up in this virtual joystick or is switched with another, click in it here and follow the
              instructions to remap it.
              <br />
              <br />
              By clicking the virtual buttons and axis you are also able to choose the function in your vehicle that
              this button controls, as whel as set axis limits.
            </div>
          </template>
          <template v-if="showJoystickWarningMessage" #warning>
            <div class="text-center text-yellow-200">
              <p class="font-semibold">System update is recommended</p>
              <br />
              <p class="font-medium">
                It seems like you're running versions of Mavlink2Rest (BlueOS) and/or ArduPilot that do not support the
                extended MAVLink MANUAL_CONTROL message. We strongly suggest upgrading both so you can have support for
                additional buttons and axes on the joystick. This is especially important if you sometimes use other
                control station software, like QGroundControl, as Cockpit can preferentially use the extended buttons to
                reduce configuration clashes. We recommend using BlueOS &ge; 1.2.0, and &ge; version 4.1.2 for
                ArduPilot-based autopilot firmware.
              </p>
              <p />
            </div>
          </template>
          <template #content>
            <div class="flex flex-col items-center max-h-[75vh] overflow-auto">
              <div class="flex flex-col items-center">
                <div
                  v-if="
                    controllerStore.availableButtonActions.every((b) => b.protocol === JoystickProtocol.CockpitAction)
                  "
                  class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
                >
                  <p>Could not stablish communication with the vehicle.</p>
                  <p>
                    Button functions will appear as numbers. If connection is restablished, function names will appear.
                  </p>
                </div>
                <div v-if="availableModifierKeys" class="flex flex-col items-center mt-2">
                  <div class="flex">
                    <Button
                      v-for="functionMapping in controllerStore.protocolMappings"
                      :key="functionMapping.name"
                      class="m-2"
                      :class="{
                        'bg-[#FFFFFF33]': controllerStore.protocolMapping.name === functionMapping.name,
                        'text-sm': interfaceStore.isOnSmallScreen,
                      }"
                      @click="controllerStore.loadProtocolMapping(functionMapping)"
                    >
                      {{ functionMapping.name }}
                    </Button>
                  </div>
                  <div class="flex flex-row justify-around items-center w-full mt-2">
                    <v-combobox
                      v-model="vehicleTypesAssignedToCurrentProfile"
                      :items="availableVehicleTypes"
                      label="Vehicle types that use this profile by default:"
                      chips
                      multiple
                      density="compact"
                      variant="outlined"
                      class="w-10/12 mt-4 scale-90"
                      theme="dark"
                    />
                    <div class="flex items-center gap-x-8">
                      <Button
                        v-for="key in availableModifierKeys"
                        :key="key.id"
                        :class="{
                          'bg-[#FFFFFF33]': currentModifierKey.id === key.id,
                          'text-sm': interfaceStore.isOnSmallScreen,
                        }"
                        @click="changeModifierKeyTab(key.id as CockpitModifierKeyOption)"
                      >
                        {{ key.name }}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-for="[key, joystick] in controllerStore.joysticks"
                :key="key"
                class="w-[95%] flex-centered flex-column position-relative"
              >
                <p class="text-md font-semibold">{{ joystick.model }} controller</p>
                <div
                  v-if="showJoystickLayout"
                  class="flex flex-col items-center justify-center"
                  :class="interfaceStore.isOnSmallScreen ? 'w-[90%]' : 'w-[80%]'"
                >
                  <JoystickPS
                    class="w-[100%]"
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
                  <div class="flex flex-col items-center pt-2 max-w-[40%] mb-4 border-[1px] rounded-lg scale-90">
                    <span class="mb-2 font-bold" :class="interfaceStore.isOnSmallScreen ? 'text-md' : 'text-lg'"
                      >Joystick Mapping</span
                    >
                    <v-divider class="w-full opacity-95" />
                    <div class="flex flex-wrap items-center justify-evenly">
                      <button
                        :class="interfaceStore.isOnSmallScreen ? 'text-sm' : 'text-md'"
                        class="w-full p-[10px] border-b text-uppercase bg-[#00000011]"
                        @click="controllerStore.exportJoystickMapping(joystick)"
                      >
                        Export to computer
                      </button>
                      <label
                        :class="interfaceStore.isOnSmallScreen ? 'text-sm' : 'text-md'"
                        class="w-full p-[10px] border-b text-center text-uppercase bg-[#00000011]"
                      >
                        <input
                          type="file"
                          accept="application/json"
                          hidden
                          @change="(e) => controllerStore.importJoystickMapping(joystick, e)"
                        />
                        Import from computer
                      </label>
                    </div>
                  </div>
                  <div class="flex flex-col items-center pt-2 max-w-[40%] mb-4 border-[1px] rounded-lg scale-90">
                    <span class="mb-2 font-bold" :class="interfaceStore.isOnSmallScreen ? 'text-md' : 'text-lg'"
                      >Functions Mapping</span
                    >
                    <v-divider class="w-full opacity-95" />
                    <div class="flex flex-wrap items-center justify-evenly">
                      <button
                        :class="interfaceStore.isOnSmallScreen ? 'text-sm' : 'text-md'"
                        class="w-full p-[10px] border-b text-uppercase bg-[#00000011]"
                        @click="controllerStore.exportFunctionsMapping(controllerStore.protocolMapping)"
                      >
                        Export to computer
                      </button>
                      <label
                        class="w-full p-[10px] border-b text-center text-uppercase bg-[#00000011]"
                        :class="interfaceStore.isOnSmallScreen ? 'text-sm' : 'text-md'"
                      >
                        <input
                          type="file"
                          accept="application/json"
                          hidden
                          @change="(e) => controllerStore.importFunctionsMapping(e)"
                        />
                        Import from computer
                      </label>
                    </div>
                  </div>
                </div>
                <v-switch
                  v-model="controllerStore.holdLastInputWhenWindowHidden"
                  label="Hold last joystick input when window is hidden (tab changed or window minimized)"
                  class="m-2"
                />
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
  <teleport to="body">
    <InteractionDialog
      v-if="currentJoystick"
      :show-dialog="inputClickedDialog"
      max-width="auto"
      variant="text-only"
      persistent
    >
      <template #title>
        <div class="flex justify-center w-full font-bold mt-1">Input mapping</div>
      </template>
      <template #content>
        <div
          v-for="input in currentButtonInputs"
          :key="input.id"
          class="flex flex-row justify-between w-full align-center gap-x-16"
        >
          <div class="flex flex-col items-center justify-between my-2">
            <p class="flex items-center justify-center w-full text-lg font-semibold mb-4">Button mapping</p>
            <v-btn
              class="bg-[#FFFFFF22] mx-auto my-1 w-fit"
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
            <v-tooltip location="bottom" :text="confirmationRequiredTooltipText(input)">
              <template #activator="{ props: tooltipProps }">
                <div class="flex justify-center items-center mt-4">
                  <v-switch
                    v-model="controllerStore.actionsJoystickConfirmRequired[getCurrentButtonAction(input).id]"
                    style="pointer-events: all; height: 56px"
                    :disabled="!isConfirmRequiredAvailable(input)"
                    v-bind="tooltipProps"
                  />
                  <v-label class="ml-2">Confirmation <br />Required</v-label>
                </div>
              </template>
            </v-tooltip>
          </div>
          <div class="flex flex-col w-[300px] justify-evenly">
            <ExpansiblePanel
              v-for="protocol in JoystickProtocol"
              :key="protocol"
              mark-expanded
              darken-content
              hover-effect
            >
              <template #title>{{ protocol }}</template>
              <template #content>
                <div class="max-h-[30vh] p-1 overflow-y-auto">
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
              </template>
            </ExpansiblePanel>
          </div>
        </div>
        <Transition>
          <p v-if="showButtonFunctionAssignmentFeedback" class="text-lg font-medium">
            {{ buttonFunctionAssignmentFeedback }}
          </p>
        </Transition>
        <template v-if="currentAxisInputs.length > 0">
          <p class="flex items-center justify-center w-full text-lg font-semibold mt-8">Axis mapping</p>
        </template>
        <div class="flex flex-col items-center justify-between my-2">
          <Transition>
            <p v-if="showAxisRemappingText" class="font-medium">{{ axisRemappingText }}</p>
          </Transition>
          <Transition>
            <v-progress-linear v-if="remappingAxisInput" v-model="remapAxisTimeProgress" />
          </Transition>
        </div>
        <div v-for="input in currentAxisInputs" :key="input.id" class="flex items-center justify-between p-2 mb-1">
          <v-icon class="mr-3">
            {{
              [JoystickAxis.A0, JoystickAxis.A2].includes(Number(input.id)) ? 'mdi-pan-horizontal' : 'mdi-pan-vertical'
            }}
          </v-icon>
          <v-text-field
            v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].min"
            class="bg-transparent w-[110px]"
            label="Min"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-select
            v-model="controllerStore.protocolMapping.axesCorrespondencies[input.id].action"
            :items="controllerStore.availableAxesActions"
            item-title="name"
            hide-details
            density="compact"
            variant="outlined"
            class="bg-transparent w-[120px] mx-2"
            theme="dark"
            return-object
          />
          <v-text-field
            v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].max"
            class="bg-transparent w-[110px]"
            label="Max"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-btn
            class="bg-[#FFFFFF22] w-40 ml-2"
            :disabled="remappingAxisInput !== false"
            @click="remapAxisInput(currentJoystick as Joystick, input)"
          >
            {{ remappingAxisInput && remappingAxisInput === input.id ? 'Remapping' : 'Click to remap' }}
          </v-btn>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end w-full">
          <v-btn variant="text" class="m-1" @click="inputClickedDialog = false"> Close </v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import semver from 'semver'
import { type Ref, computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import Button from '@/components/Button.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { getArdupilotVersion, getMavlink2RestVersion } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { CockpitActionsFunction } from '@/libs/joystick/protocols/cockpit-actions'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { sleep } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
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
const interfaceStore = useAppInterfaceStore()

const m2rSupportsExtendedManualControl = ref<boolean>()
const ardupilotSupportsExtendedManualControl = ref<boolean>()
const showJoystickWarningMessage = ref(false)

onMounted(async () => {
  controllerStore.enableForwarding = false
  const m2rVersion = await getMavlink2RestVersion(globalAddress)
  m2rSupportsExtendedManualControl.value = semver.gte(m2rVersion, '0.11.19')
  const ardupilotVersion = await getArdupilotVersion(globalAddress)
  ardupilotSupportsExtendedManualControl.value = semver.gte(ardupilotVersion, '4.1.2')

  if (m2rSupportsExtendedManualControl.value || ardupilotSupportsExtendedManualControl.value) {
    showJoystickWarningMessage.value = true
  }
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
