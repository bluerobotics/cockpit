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
      <div></div>
      <div
        v-for="[key, joystick] in controllerStore.joysticks"
        :key="key"
        class="flex-centered flex-column ma-8 pa-0 graphs-container"
      >
        <JoystickPS
          style="width: 100%"
          :model="joystick.model === JoystickModel.DualSense ? 'PS5' : 'PS4'"
          :left-axis="[joystick.values.leftAxisHorizontal, joystick.values.leftAxisVertical]"
          :right-axis="[joystick.values.rightAxisHorizontal, joystick.values.rightAxisVertical]"
          :up="joystick.values.directionalTopButton"
          :down="joystick.values.directionalBottomButton"
          :left="joystick.values.directionalLeftButton"
          :right="joystick.values.directionalRightButton"
          :x="joystick.values.rightClusterBottomButton"
          :circle="joystick.values.rightClusterRightButton"
          :square="joystick.values.rightClusterLeftButton"
          :triangle="joystick.values.rightClusterTopButton"
          :l1="joystick.values.leftShoulderButton"
          :l2="joystick.values.leftTriggerButton"
          :l3="joystick.values.leftStickerButton"
          :r1="joystick.values.rightShoulderButton"
          :r2="joystick.values.rightTriggerButton"
          :r3="joystick.values.rightStickerButton"
          :create="joystick.values.extraButton1"
          :options="joystick.values.extraButton2"
          :ps="joystick.values.extraButton3"
          :t="joystick.values.extraButton4"
        />
        <div
          v-for="(axis, axisIdx) in joystick.gamepad.axes"
          :key="axisIdx"
          class="mapping-container"
          :style="`
            transform: translate(-50%, -50%);
            left: ${axisDropdownPosition(joystick, axisIdx).left}%;
            top: ${axisDropdownPosition(joystick, axisIdx).top}%;
          `"
        >
          <v-text-field
            v-model.number="controllerStore.mapping.axesMins[axisIdx]"
            style="width: 10ch; margin: 5px"
            label="Min"
            type="number"
            class="mapping-input"
            density="compact"
            variant="solo"
            hide-details
          />
          <v-select
            :model-value="axesCorrespondencies[axisIdx]"
            :items="controllerStore.availableAxes"
            style="width: 7ch; margin: 5px"
            hide-details
            density="compact"
            variant="solo"
            class="ma-1"
            @update:model-value="(newValue: number | string) => updateMapping(axisIdx, newValue, EventType.Axis)"
          />
          <v-text-field
            v-model.number="controllerStore.mapping.axesMaxs[axisIdx]"
            style="width: 10ch; margin: 5px"
            label="Max"
            type="number"
            class="mapping-input"
            density="compact"
            variant="solo"
            hide-details
          />
        </div>
        <div
          v-for="(button, btnIdx) in joystick.gamepad.buttons"
          :key="btnIdx"
          class="mapping-container"
          :style="`
            transform: translate(-50%, -50%);
            left: ${buttonDropdownPosition(joystick, btnIdx).left}%;
            top: ${buttonDropdownPosition(joystick, btnIdx).top}%;
          `"
        >
          <v-select
            :key="btnIdx"
            :model-value="buttons[btnIdx]"
            :items="controllerStore.availableButtons"
            hide-details
            density="compact"
            variant="solo"
            class="mapping-input"
            @update:model-value="(newValue: number | string) => updateMapping(btnIdx, newValue, EventType.Button)"
          />
        </div>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { EventType, JoystickModel } from '@/libs/joystick/manager'
import { useControllerStore } from '@/stores/controller'
import type { Joystick } from '@/types/joystick'

import BaseConfigurationView from './BaseConfigurationView.vue'

const controllerStore = useControllerStore()

const axesCorrespondencies = ref(controllerStore.mapping.axesCorrespondencies)
const buttons = ref(controllerStore.mapping.buttons)

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
  } else {
    buttons.value = newInputMapping as number[]
  }
}

watch(axesCorrespondencies, () => (controllerStore.mapping.axesCorrespondencies = axesCorrespondencies.value))
watch(buttons, () => (controllerStore.mapping.buttons = buttons.value))

// eslint-disable-next-line jsdoc/require-jsdoc
type InputDropdownPosition = { left: number; top: number }

const axisDropdownPosition = (joystick: Joystick, axisIdx: number): InputDropdownPosition => {
  const positionsPS4 = [
    { left: 15, top: 84 },
    { left: 20, top: 97 },
    { left: 85, top: 84 },
    { left: 73, top: 97 },
  ]
  // TODO: Adjust position of dropdown for PS5 axes
  const positionsPS5 = positionsPS4
  return joystick.model === JoystickModel.DualSense ? positionsPS5[axisIdx] : positionsPS4[axisIdx]
}

const buttonDropdownPosition = (joystick: Joystick, btnIdx: number): InputDropdownPosition => {
  const positionsPS4 = [
    { left: 92, top: 60 },
    { left: 92, top: 38 },
    { left: 92, top: 49 },
    { left: 92, top: 25 },
    { left: 5, top: 14 },
    { left: 91.5, top: 14 },
    { left: 6, top: 1 },
    { left: 90, top: 1 },
    { left: 36, top: 3 },
    { left: 63, top: 3 },
    { left: 38, top: 81 },
    { left: 61, top: 80 },
    { left: 4, top: 28 },
    { left: 4, top: 64 },
    { left: 4, top: 52 },
    { left: 4, top: 40 },
    { left: 49.5, top: 79 },
    { left: 49.5, top: 6 },
  ]
  // TODO: Adjust position of dropdown for PS5 buttons
  const positionsPS5 = positionsPS4
  return joystick.model === JoystickModel.DualSense ? positionsPS5[btnIdx] : positionsPS4[btnIdx]
}
</script>

<style scoped>
.graphs-container {
  position: relative;
}
.mapping-container {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mapping-input {
  width: 9ch;
  margin: 1px;
}
</style>
