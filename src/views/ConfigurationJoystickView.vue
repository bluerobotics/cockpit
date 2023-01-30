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
      <div v-for="[key, joystick] in controllerStore.joysticks" :key="key" class="flex-centered flex-column pa-8">
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
          :t="joystick.values.extraButton4"        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { JoystickModel } from '@/libs/joystick/manager'
import { useControllerStore } from '@/stores/controller'

import BaseConfigurationView from './BaseConfigurationView.vue'

const controllerStore = useControllerStore()
</script>
