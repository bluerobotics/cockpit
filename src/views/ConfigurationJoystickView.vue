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
          v-if="
            controllerStore.availableProtocolButtonFunctions.every(
              (b) => b.input.protocol === JoystickProtocol.CockpitAction
            )
          "
          class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
        >
          <p>Could not stablish communication with the vehicle.</p>
          <p>Button functions will appear as numbers. If connection is restablished, function names will appear.</p>
        </div>
      </div>
      <div
        v-for="[key, joystick] in controllerStore.joysticks"
        :key="key"
        class="w-[95%] p-4 shadow-md rounded-2xl flex-centered flex-column position-relative"
      >
        <p class="text-xl font-semibold text-grey-darken-3">{{ joystick.model }} controller</p>
        <div class="flex items-center justify-center w-full">
          <JoystickPS
            class="w-[70%]"
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
            :protocol-mapping="controllerStore.protocolMapping"
            :button-label-correspondency="controllerStore.availableProtocolButtonFunctions"
            @click="(e) => setCurrentInputs(joystick, e)"
          />
        </div>
        <div class="flex">
          <button
            class="w-auto p-3 m-2 font-medium rounded-md shadow-md text-uppercase"
            @click="controllerStore.downloadJoystickProfile(joystick)"
          >
            Download profile
          </button>
          <label class="w-auto p-3 m-2 font-medium rounded-md shadow-md cursor-pointer text-uppercase">
            <input
              type="file"
              accept="application/json"
              hidden
              @change="(e) => controllerStore.loadJoystickProfile(joystick, e)"
            />
            Load profile
          </label>
        </div>
      </div>
    </template>
  </BaseConfigurationView>
  <teleport to="body">
    <v-dialog v-if="currentJoystick" v-model="inputClickedDialog" width="80%" max-height="90%">
      <v-card class="p-2">
        <v-card-title class="flex justify-center w-full">Update mapping</v-card-title>
        <v-card-text class="flex justify-between align-center">
          <JoystickPS
            class="w-[50%] p-6"
            model="PS4"
            :left-axis-horiz="currentJoystick.state.axes[0]"
            :left-axis-vert="currentJoystick.state.axes[1]"
            :right-axis-horiz="currentJoystick.state.axes[2]"
            :right-axis-vert="currentJoystick.state.axes[3]"
            :b0="currentJoystick.state.buttons[0]"
            :b1="currentJoystick.state.buttons[1]"
            :b2="currentJoystick.state.buttons[2]"
            :b3="currentJoystick.state.buttons[3]"
            :b4="currentJoystick.state.buttons[4]"
            :b5="currentJoystick.state.buttons[5]"
            :b6="currentJoystick.state.buttons[6]"
            :b7="currentJoystick.state.buttons[7]"
            :b8="currentJoystick.state.buttons[8]"
            :b9="currentJoystick.state.buttons[9]"
            :b10="currentJoystick.state.buttons[10]"
            :b11="currentJoystick.state.buttons[11]"
            :b12="currentJoystick.state.buttons[12]"
            :b13="currentJoystick.state.buttons[13]"
            :b14="currentJoystick.state.buttons[14]"
            :b15="currentJoystick.state.buttons[15]"
            :b16="currentJoystick.state.buttons[16]"
            :b17="currentJoystick.state.buttons[17]"
            :protocol-mapping="controllerStore.protocolMapping"
            :button-label-correspondency="controllerStore.availableProtocolButtonFunctions"
          />
          <div>
            <div v-for="(input, i) in currentInputs" :key="i" class="flex flex-col items-center justify-between">
              <div v-if="input.type === InputType.Axis" class="flex items-center justify-between ma-2">
                <v-icon class="mr-3"
                  >{{
                    [JoystickAxis.A0, JoystickAxis.A2].includes(Number(input.value))
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
                  :model-value="controllerStore.protocolMapping.axesCorrespondencies[input.value]"
                  :items="controllerStore.availableProtocolAxesFunctions"
                  item-title="prettyName"
                  item-value="input"
                  hide-details
                  density="compact"
                  variant="solo"
                  class="w-40 m-3"
                  @update:model-value="(newValue: ProtocolInput) => updateMapping(input.value, newValue, input.type)"
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
              <div v-if="input.type === InputType.Button" class="flex flex-col justify-between p-6 align-center">
                <div class="flex flex-col items-center justify-between">
                  <span>Calibrate</span>
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
                  <v-btn
                    class="w-40 mx-auto my-2"
                    :disabled="remappingInput"
                    @click="remapInput(currentJoystick as Joystick, input)"
                  >
                    {{ remappingInput ? 'Remapping' : 'Remap button' }}
                  </v-btn>
                </div>
                <div class="flex flex-col items-center justify-between">
                  <span>Assign</span>
                  <div class="flex flex-col flex-wrap">
                    <div
                      v-for="[protocol, buttons] in Object.entries(availableProtocolButtonFunctions)"
                      :key="protocol"
                      class="flex flex-col m-2"
                    >
                      <span class="mb-2 text-xl font-bold">{{ protocol }}</span>
                      <div class="overflow-y-auto max-h-40 protocol-button-container">
                        <Button
                          v-for="buttonFunction in buttons"
                          :key="buttonFunction.prettyName"
                          class="m-1 hover:bg-slate-700"
                          :class="{
                            'bg-slate-700':
                              controllerStore.protocolMapping.buttonsCorrespondencies[input.value].protocol ==
                                buttonFunction.input.protocol &&
                              controllerStore.protocolMapping.buttonsCorrespondencies[input.value].value ==
                                buttonFunction.input.value,
                          }"
                          @click="updateMapping(input.value, buttonFunction.input, input.type)"
                        >
                          {{ buttonFunction.prettyName }}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { computed, ref, watch } from 'vue'
import { onMounted } from 'vue'
import { onUnmounted } from 'vue'

import Button from '@/components/Button.vue'
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { MavParamType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type InputWithPrettyName, mavlinkAvailableButtons, OtherProtocol } from '@/libs/joystick/protocols'
import type { ArduPilotParameterSetData } from '@/libs/vehicle/ardupilot/types'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import {
  type CockpitButton,
  type Joystick,
  type JoystickInput,
  type ProtocolInput,
  InputType,
  JoystickAxis,
  JoystickProtocol,
} from '@/types/joystick'

import BaseConfigurationView from './BaseConfigurationView.vue'

const controllerStore = useControllerStore()
const vehicleStore = useMainVehicleStore()

onMounted(() => {
  controllerStore.enableForwarding = false
})

onUnmounted(() => {
  controllerStore.enableForwarding = true
})

const currentJoystick = ref<Joystick>()
const currentInputs = ref()
const remappingInput = ref(false)
const justRemappedInput = ref<boolean>()
const inputClickedDialog = ref(false)

watch(inputClickedDialog, () => (justRemappedInput.value = undefined))

const availableProtocolButtonFunctions = computed(() => {
  // eslint-disable-next-line jsdoc/require-jsdoc
  const organizedButtons: { [key in JoystickProtocol]: InputWithPrettyName[] } = {
    [JoystickProtocol.MAVLink]: [],
    [JoystickProtocol.CockpitAction]: [],
    [JoystickProtocol.Other]: [],
  }
  controllerStore.availableProtocolButtonFunctions.forEach((btn) => organizedButtons[btn.input.protocol].push(btn))
  vehicleStore.buttonParameterTable.forEach((btn) => {
    if (organizedButtons[JoystickProtocol.MAVLink].map((b) => b.prettyName).includes(btn.title)) return
    organizedButtons[JoystickProtocol.MAVLink].push({
      input: { protocol: JoystickProtocol.MAVLink, value: btn.title },
      prettyName: btn.title,
    })
  })
  return organizedButtons
})

const setCurrentInputs = (joystick: Joystick, inputs: JoystickInput[]): void => {
  currentJoystick.value = joystick
  currentInputs.value = inputs
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

  // Wait for a button press or until the waiting time expires
  while ([undefined, -1].includes(pressedButtonIndex) && millisPassed < waitingTime) {
    // Check if any button on the joystick is pressed, and if so, get it's index
    pressedButtonIndex = joystick.gamepad.buttons.findIndex((button) => button.value === 1)
    await new Promise((r) => setTimeout(r, 100))
    millisPassed += 100
  }

  // End the remapping process
  remappingInput.value = false

  // If a button was pressed, update the mapping of that joystick model in the controller store and return
  if (![undefined, -1].includes(pressedButtonIndex)) {
    justRemappedInput.value = true
    controllerStore.cockpitStdMappings[joystick.model].buttons[input.value] = pressedButtonIndex as CockpitButton
    return
  }
  // If remapping was unsuccessful, indicate it, so we can warn the user
  justRemappedInput.value = false
}

/**
 * Updates which physical button or axis in the joystick maps to it's correspondent virtual input.
 * @param {number} index - The index of the input mapping to update.
 * @param {ProtocolInput} newValue - The new value for the input mapping.
 * @param {InputType} inputType - The type of input (either Axis or Button).
 */
const updateMapping = (index: number, newValue: ProtocolInput, inputType: InputType): void => {
  // Ensure the input type is either a Axis or a Button
  if (![InputType.Axis, InputType.Button].includes(inputType)) {
    console.error('Input type should be Axis or Button.')
    return
  }

  // Get the current input mapping based on the input type
  const oldInputMapping =
    inputType === InputType.Axis
      ? controllerStore.protocolMapping.axesCorrespondencies
      : controllerStore.protocolMapping.buttonsCorrespondencies

  if (inputType === InputType.Axis) {
    // If the input type is an Axis, create a new input mapping, unassigning indexes use to held
    // the selected value, so we don't have two axis sending data to the same channel
    const undefinedInput = { protocol: JoystickProtocol.Other, value: OtherProtocol.NO_FUNCTION }
    const newInputMapping = oldInputMapping.map((oldValue) => {
      return oldValue.protocol === newValue.protocol && oldValue.value === newValue.value ? undefinedInput : oldValue
    })
    // Update the axes correspondences and current protocol mapping
    newInputMapping[index] = newValue
    controllerStore.protocolMapping.axesCorrespondencies = newInputMapping
  } else {
    // If the input type is a Button, simply update the value at the specified index
    const newInputMapping = oldInputMapping

    let newInput = newValue

    // When we use an unmapped MAVLink function, we use the same mapping but we have te new function to that button
    if (newValue.protocol === JoystickProtocol.MAVLink && typeof newValue.value !== 'number') {
      const buttonParameterValue = vehicleStore.buttonParameterTable.find((btn) => btn.title === newValue.value)?.value
      if (buttonParameterValue === undefined) {
        Swal.fire({ text: `Could not find MAVLink parameter ${newValue.value}.`, icon: 'error', timer: 5000 })
        return
      }

      let mavlinkButton: undefined | number = undefined
      const usedMavButtons = oldInputMapping.filter((i) => i.protocol === JoystickProtocol.MAVLink).map((i) => i.value)
      const availableMavButtons = mavlinkAvailableButtons.filter((b) => !usedMavButtons.includes(b))
      const oldButtonInput = oldInputMapping[index]

      if (oldButtonInput.protocol !== JoystickProtocol.MAVLink && !availableMavButtons.isEmpty()) {
        mavlinkButton = availableMavButtons[0]
      } else if (oldButtonInput.protocol === JoystickProtocol.MAVLink) {
        // Check if there's more than one Cockpit button assigned to this same MAVLink button
        const doubleMapped = usedMavButtons.filter((b) => b === oldButtonInput.value).length > 1
        if (doubleMapped && !availableMavButtons.isEmpty()) {
          // In case there's a double mapping but there are MAVLink buttons still not used, pick one.
          mavlinkButton = availableMavButtons[0]
        } else if (!doubleMapped) {
          // If there's onlyy one Cockpit button mapped to this MAVLink button, use it.
          mavlinkButton = oldButtonInput.value as number
        }
      }

      if (mavlinkButton === undefined) {
        // If the variable is still undefined, it means we could not find an available MAVLink button to be used, thus we cannot proceed mapping.
        const errorMessage = `None of the 16 MAVLink Manual Control buttons are available.
            Please assign "No function" to one already used.`
        console.error(errorMessage)
        Swal.fire({ text: errorMessage, icon: 'error', timer: 5000 })
        return
      }
      newInput = { protocol: JoystickProtocol.MAVLink, value: mavlinkButton }
      const configurationSettings: ArduPilotParameterSetData = {
        id: `BTN${mavlinkButton}_FUNCTION`,
        value: buttonParameterValue,
        type: { type: MavParamType.MAV_PARAM_TYPE_INT8 },
      }
      vehicleStore.configure(configurationSettings)
    }

    newInputMapping[index] = newInput
    controllerStore.protocolMapping.buttonsCorrespondencies = newInputMapping
  }

  const protocolButtonContainers = document.getElementsByClassName('protocol-button-container')
  for (let container of protocolButtonContainers as unknown as HTMLElement[]) {
    container.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }
}
</script>
