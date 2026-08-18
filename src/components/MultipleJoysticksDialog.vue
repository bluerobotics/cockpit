<template>
  <v-dialog
    :model-value="controllerStore.multipleJoysticksDialogOpen"
    :width="interfaceStore.isOnPhoneScreen ? '92vw' : '620px'"
    @update:model-value="onDialogVisibilityChange"
  >
    <v-card class="main-dialog px-2 py-1 rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title>
        <div class="flex items-center justify-center gap-3 pt-3 pb-1 text-center">
          <v-icon size="32" color="yellow">mdi-alert-rhombus</v-icon>
          <span class="font-bold" :class="interfaceStore.isOnPhoneScreen ? 'text-[16px]' : 'text-[20px]'">
            Multiple joysticks detected
          </span>
        </div>
      </v-card-title>

      <v-card-text class="pb-2">
        <p class="text-center opacity-90 px-2 mb-1" :class="interfaceStore.isOnPhoneScreen ? 'text-xs' : 'text-sm'">
          More than one joystick is connected and all of them are enabled, but Cockpit can only use one at a time.
        </p>
        <p class="text-center opacity-90 px-2 mb-5" :class="interfaceStore.isOnPhoneScreen ? 'text-xs' : 'text-sm'">
          Choose which one to use. The others will be disabled, and you can re-enable them anytime on the joystick
          configuration page.
        </p>

        <div class="flex flex-col gap-3 px-1 pb-1">
          <button
            v-for="option in joystickOptions"
            :key="option.model"
            class="joystick-option flex items-center gap-4 w-full px-4 py-3 rounded-lg text-left"
            @click="selectJoystick(option.model)"
          >
            <v-icon size="28" class="opacity-90">mdi-gamepad-variant</v-icon>
            <div class="flex flex-col">
              <span class="text-[15px] font-semibold">{{ option.model }}</span>
              <span class="text-xs opacity-60">{{ option.axesCount }} axes · {{ option.buttonsCount }} buttons</span>
            </div>
            <v-icon size="22" class="ml-auto opacity-70">mdi-chevron-right</v-icon>
          </button>
        </div>
      </v-card-text>

      <div class="flex justify-center w-full px-10">
        <v-divider class="opacity-10 border-[#fafafa]" />
      </div>

      <v-card-actions>
        <div class="flex w-full justify-end px-1 py-1">
          <v-btn size="small" variant="text" @click="dismiss">Cancel</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { JoystickModel } from '@/types/joystick-model-defs'

const controllerStore = useControllerStore()
const interfaceStore = useAppInterfaceStore()

/**
 * One selectable entry per distinct connected joystick model, with its input counts for context.
 */
const joystickOptions = computed(() => {
  const optionsByModel = new Map<
    JoystickModel,
    {
      /**
       * Model of the connected joystick.
       */
      model: JoystickModel
      /**
       * Number of axes the device reports.
       */
      axesCount: number
      /**
       * Number of buttons the device reports.
       */
      buttonsCount: number
    }
  >()
  for (const joystick of controllerStore.joysticks.values()) {
    if (optionsByModel.has(joystick.model)) continue
    optionsByModel.set(joystick.model, {
      model: joystick.model,
      axesCount: joystick.gamepad.axes.length,
      buttonsCount: joystick.gamepad.buttons.length,
    })
  }
  return Array.from(optionsByModel.values())
})

const selectJoystick = (model: JoystickModel): void => {
  controllerStore.selectActiveJoystick(model)
}

const dismiss = (): void => {
  controllerStore.dismissMultipleJoysticksDialog()
}

const onDialogVisibilityChange = (value: boolean): void => {
  if (!value) dismiss()
}
</script>

<style scoped>
.main-dialog {
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
}

.joystick-option {
  border: 1px solid #ffffff22;
  background-color: #ffffff12;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}

.joystick-option:hover {
  border-color: #ffffff55;
  background-color: #ffffff22;
}
</style>
