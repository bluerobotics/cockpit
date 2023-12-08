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
          v-if="controllerStore.availableButtonActions.every((b) => b.protocol === JoystickProtocol.CockpitAction)"
          class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
        >
          <p>Could not stablish communication with the vehicle.</p>
          <p>Button functions will appear as numbers. If connection is restablished, function names will appear.</p>
        </div>
        <div class="flex items-center px-5 py-3 m-5 font-bold border rounded-md">
          <Button
            v-for="key in availableModifierKeys"
            :key="key.id"
            class="m-2"
            :class="{ 'bg-slate-700': currentModifierKey.id === key.id }"
            @click="currentModifierKey = key"
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
        <div class="flex flex-wrap">
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.exportJoystickMapping(joystick)"
          >
            Export joystick mapping
          </button>
          <label class="w-auto p-3 m-2 font-medium rounded-md shadow-md cursor-pointer text-uppercase">
            <input
              type="file"
              accept="application/json"
              hidden
              @change="(e) => controllerStore.importJoystickMapping(joystick, e)"
            />
            Import joystick mapping
          </label>
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.exportJoysticksMappingsToVehicle(globalAddress, controllerStore.cockpitStdMappings)"
          >
            Export joystick mapping to vehicle
          </button>
          <div class="grow" />
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.exportFunctionsMapping(controllerStore.protocolMapping)"
          >
            Export functions mapping
          </button>
          <label class="w-auto p-3 m-2 font-medium rounded-md shadow-md cursor-pointer text-uppercase">
            <input
              type="file"
              accept="application/json"
              hidden
              @change="(e) => controllerStore.importFunctionsMapping(e)"
            />
            Import functions mapping
          </label>
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.exportFunctionsMappingToVehicle(globalAddress, controllerStore.protocolMapping)"
          >
            Export functions mapping to vehicle
          </button>
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.importFunctionsMappingFromVehicle(globalAddress)"
          >
            Import functions mapping from vehicle
          </button>
        </div>
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
          <div v-for="input in currentAxisInputs" :key="input.id" class="flex items-center justify-between p-2">
            <v-icon class="mr-3">
              {{ [JoystickAxis.A0, JoystickAxis.A2].includes(input.id) ? 'mdi-pan-horizontal' : 'mdi-pan-vertical' }}
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
          </div>
        </div>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import Button from '@/components/Button.vue'
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
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

const controllerStore = useControllerStore()
const { globalAddress } = useMainVehicleStore()

onMounted(() => {
  controllerStore.enableForwarding = false
})

onUnmounted(() => {
  controllerStore.enableForwarding = true
})

const currentJoystick = ref<Joystick>()
const currentButtonInputs = ref<JoystickButtonInput[]>([])
const currentAxisInputs = ref<JoystickAxisInput[]>([])
const remappingInput = ref(false)
const remapTimeProgress = ref()
const showButtonRemappingText = ref(false)
const buttonFunctionAssignmentFeedback = ref('')
const showButtonFunctionAssignmentFeedback = ref(false)
const justRemappedInput = ref<boolean>()
const inputClickedDialog = ref(false)
const currentModifierKey = ref(modifierKeyActions.regular)
const availableModifierKeys = Object.values(modifierKeyActions)
const showJoystickLayout = ref(true)
watch(inputClickedDialog, () => (justRemappedInput.value = undefined))

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
  const waitingTime = 5000
  remappingInput.value = true
  remapTimeProgress.value = 0
  showButtonRemappingText.value = true

  // Wait for a button press or until the waiting time expires
  while ([undefined, -1].includes(pressedButtonIndex) && millisPassed < waitingTime) {
    // Check if any button on the joystick is pressed, and if so, get it's index
    pressedButtonIndex = joystick.gamepad.buttons.findIndex((button) => button.value === 1)
    await new Promise((r) => setTimeout(r, 100))
    millisPassed += 100
    remapTimeProgress.value = 100 * (millisPassed / waitingTime)
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

const currentButtonActions = computed(
  () => controllerStore.protocolMapping.buttonsCorrespondencies[currentModifierKey.value.id as CockpitModifierKeyOption]
)

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
  if (activeModKeys.isEmpty() && currentModifierKey.value !== modifierKeyActions.regular) {
    currentModifierKey.value = modifierKeyActions.regular
    return
  }
  currentModifierKey.value = activeModKeys[0]
})

const buttonRemappingText = computed(() => {
  return remappingInput.value
    ? 'Click the button you want to use for this input.'
    : justRemappedInput.value === undefined
    ? ''
    : justRemappedInput.value
    ? 'Input remapped.'
    : 'No input detected.'
})

const buttonActionsToShow = computed(() =>
  controllerStore.availableButtonActions.filter((a) => JSON.stringify(a) !== JSON.stringify(modifierKeyActions.regular))
)
</script>
