<template>
  <BaseConfigurationView>
    <template #title>Joystick configuration</template>
    <template #content>
      <div v-if="controllerStore.joysticks && !controllerStore.joysticks.size">
        <h2 class="warning flex-centered">
          No joystick detected.<br />
          Make sure that a joystick is connected. You can hit any key to test the joystick connection.
        </h2>
      </div>
      <div
        v-else-if="buttonFunctions.length === 0"
        class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
      >
        <p>Could not stablish communication with the vehicle.</p>
        <p>Button functions will appear as numbers. If connection is restablished, function names will appear.</p>
      </div>
      <div
        v-for="[key, joystick] in controllerStore.joysticks"
        :key="key"
        class="p-4 m-8 shadow-md rounded-2xl flex-centered flex-column position-relative"
      >
        <p class="text-xl font-semibold text-grey-darken-3">{{ joystick.model }} controller</p>
        <JoystickPS
          style="width: 100%"
          model="PS4"
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
          :protocol-mapping="currentProtocolMapping"
          :button-label-correspondency="buttonFunctions"
          @click="(e) => setCurrentInputs(joystick, e)"
        />
      </div>
    </template>
  </BaseConfigurationView>
  <teleport to="body">
    <v-dialog v-model="inputClickedDialog" width="auto">
      <v-card class="pa-2">
        <v-card-title>Update mapping</v-card-title>
        <v-card-text class="flex flex-col justify-between align-center">
          <div v-for="(input, i) in currentInputs" :key="i" class="flex flex-col items-center justify-between">
            <div v-if="input.type === EventType.Axis" class="flex items-center justify-between ma-2">
              <v-icon class="mr-3"
                >{{
                  [Axis.HORIZONTAL_LEFT, Axis.HORIZONTAL_RIGHT].includes(Number(input.value))
                    ? 'mdi-pan-horizontal'
                    : 'mdi-pan-vertical'
                }}
              </v-icon>
              <v-text-field
                v-model.number="controllerStore.protocolMapping.axesMins[input.value]"
                style="width: 10ch; margin: 5px"
                label="Min"
                type="number"
                density="compact"
                variant="solo"
                hide-details
              />
              <v-select
                :model-value="axesCorrespondencies[input.value]"
                :items="controllerStore.availableAxes"
                hide-details
                density="compact"
                variant="solo"
                class="w-16 m-3"
                @update:model-value="(newValue: number | string) => updateMapping(input.value, newValue, input.type)"
              />
              <v-text-field
                v-model.number="controllerStore.protocolMapping.axesMaxs[input.value]"
                style="width: 10ch; margin: 5px"
                label="Max"
                type="number"
                density="compact"
                variant="solo"
                hide-details
              />
            </div>
            <div v-if="input.type === EventType.Button" class="flex flex-col justify-between align-center">
              <p>
                {{
                  remappingInput
                    ? 'Click the button you want to use for this input.'
                    : justRemappedInput === undefined
                    ? ''
                    : justRemappedInput
                    ? 'Input remapped.'
                    : 'No input detected.'
                }}
              </p>
              <v-btn class="w-40 mx-auto my-2" :disabled="remappingInput" @click="remapInput(input)">
                {{ remappingInput ? 'Remapping' : 'Remap button' }}
              </v-btn>
              <v-select
                :key="input.value"
                :model-value="buttons[input.value]"
                :items="buttonFunctions"
                item-title="function"
                item-value="button"
                hide-details
                density="compact"
                variant="solo"
                class="m-3 w-52"
                @update:model-value="(newValue: number | string) => updateMapping(input.value, newValue, input.type)"
              />
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'

import JoystickPS, { type InputSpec, Axis } from '@/components/joysticks/JoystickPS.vue'
import { EventType, JoystickModel } from '@/libs/joystick/manager'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { CockpitButton, Joystick } from '@/types/joystick'

import BaseConfigurationView from './BaseConfigurationView.vue'

const controllerStore = useControllerStore()
const vehicleStore = useMainVehicleStore()

vehicleStore.requestParametersList()

/**
 * Correspondency between protocol buttons and protocol functions
 */
interface buttonFunctionCorrespondency {
  /**
   * Button which triggers the function
   */
  button: number
  /**
   * Name of the parameter option
   */
  function: string
}
const buttonFunctions = reactive<buttonFunctionCorrespondency[]>([])

const buttonsFunctionsUpdateInterval = setInterval(() => {
  if (buttonFunctions.length === 0) {
    updateButtonsFunctions()
  }
}, 1000)
onBeforeUnmount(() => {
  clearInterval(buttonsFunctionsUpdateInterval)
})

const updateButtonsFunctions = (): void => {
  if (!vehicleStore.currentParameters || !vehicleStore.parametersTable) return
  const newButtonsFunctions: buttonFunctionCorrespondency[] = []
  // @ts-ignore: This type is huge. Needs refactoring typing here.
  if (vehicleStore.parametersTable['BTN0_FUNCTION'] && vehicleStore.parametersTable['BTN0_FUNCTION']['Values']) {
    const parameterValues: { title: string, value: number }[] = [] // eslint-disable-line
    // @ts-ignore: This type is huge. Needs refactoring typing here.
    Object.entries(vehicleStore.parametersTable['BTN0_FUNCTION']['Values']).forEach((param) => {
      const rawText = param[1] as string
      const formatedText = (rawText.charAt(0).toUpperCase() + rawText.slice(1)).replace(new RegExp('_', 'g'), ' ')
      parameterValues.push({ title: formatedText as string, value: Number(param[0]) })
    })
    Object.entries(vehicleStore.currentParameters).forEach((param) => {
      if (!param[0].startsWith('BTN') || !param[0].endsWith('_FUNCTION')) return
      const button = Number(param[0].replace('BTN', '').replace('_FUNCTION', ''))
      const functionName = parameterValues.find((p) => p.value === param[1])?.title
      if (functionName === undefined) return
      newButtonsFunctions.push({ button: button, function: functionName })
    })
  }
  Object.assign(buttonFunctions, newButtonsFunctions)
}

const setCurrentInputs = (joystick: Joystick, inputs: InputSpec[]): void => {
  currentJoystick.value = joystick
  currentInputs.value = inputs
  inputClickedDialog.value = true
}
const currentJoystick = ref<Joystick>()
const currentInputs = ref()
const remappingInput = ref(false)
const justRemappedInput = ref<boolean>()
const inputClickedDialog = ref(false)

const remapInput = async (input: InputSpec): Promise<void> => {
  justRemappedInput.value = undefined
  let pressedButtonIndex = undefined
  let millisPassed = 0
  const waitingTime = 5000
  remappingInput.value = true
  while ([undefined, -1].includes(pressedButtonIndex) && millisPassed < waitingTime) {
    pressedButtonIndex = currentJoystick.value?.gamepad.buttons.findIndex((button) => button.value === 1)
    await new Promise((r) => setTimeout(r, 100))
    millisPassed += 100
  }
  remappingInput.value = false
  if (![undefined, -1].includes(pressedButtonIndex)) {
    justRemappedInput.value = true
    const joystickModel = controllerStore.joysticks.get(0)?.model || JoystickModel.Unknown
    controllerStore.cockpitStdMappings[joystickModel].buttons[input.value] = pressedButtonIndex as CockpitButton
    return
  }
  justRemappedInput.value = false
}

watch(inputClickedDialog, () => (justRemappedInput.value = undefined))

const axesCorrespondencies = ref(controllerStore.protocolMapping.axesCorrespondencies)
const buttons = ref(controllerStore.protocolMapping.buttons)

const updateMapping = (index: number, newValue: string | number, inputType: EventType): void => {
  if (![EventType.Axis, EventType.Button].includes(inputType)) {
    console.error('Input type should be Axis or Button.')
    return
  }
  const oldInputMapping = inputType === EventType.Axis ? axesCorrespondencies.value : buttons.value
  const inputOldValue = oldInputMapping[index]
  // For the index that previously holded the selected value, use the former value of the modified index
  const newInputMapping = oldInputMapping.map((oldValue) => {
    return oldValue === newValue ? inputOldValue : oldValue
  })
  newInputMapping[index] = newValue
  if (inputType === EventType.Axis) {
    axesCorrespondencies.value = newInputMapping as string[]
    currentProtocolMapping.value.axesCorrespondencies = axesCorrespondencies.value
  } else {
    buttons.value = newInputMapping as number[]
    currentProtocolMapping.value.buttons = buttons.value
  }
}

const currentProtocolMapping = ref(controllerStore.protocolMapping)
watch(axesCorrespondencies, () => (controllerStore.protocolMapping.axesCorrespondencies = axesCorrespondencies.value))
watch(buttons, () => (controllerStore.protocolMapping.buttons = buttons.value))
</script>
