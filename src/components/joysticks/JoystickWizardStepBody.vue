<template>
  <div class="flex flex-col items-center w-[500px] mb-[10px]">
    <div
      v-if="wizard.step.value.kind === 'intro'"
      class="flex flex-col w-[400px] bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] elevation-1 items-center gap-y-1 p-3"
    >
      <p class="text-center font-bold">Controller to map</p>
      <p v-for="name in wizard.connectedJoystickNames.value" :key="name" class="text-center">
        <v-icon class="mr-3 -mt-[1px]">mdi-controller</v-icon>{{ name }}
      </p>
    </div>

    <div
      v-if="wizard.step.value.kind === 'vehicle'"
      class="flex flex-col w-[400px] bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] elevation-1 items-center gap-y-2 p-3"
    >
      <v-select
        :model-value="wizard.vehicle.value"
        :items="wizard.vehicleOptions"
        aria-label="Vehicle to map for"
        theme="dark"
        variant="outlined"
        density="compact"
        hide-details
        class="w-full"
        @update:model-value="wizard.setVehicle($event)"
      />
      <p class="text-center text-sm opacity-70">{{ wizard.flowSummary.value }}</p>
    </div>

    <div v-if="wizard.step.value.kind === 'axis'" class="relative flex justify-center items-center w-full">
      <div
        class="flex justify-between items-center w-3/4 bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] elevation-1 h-[60px]"
      >
        <template v-if="wizard.detectedAxisIndex.value !== undefined">
          <p class="grow text-center font-semibold">Axis {{ wizard.detectedAxisIndex.value }}</p>
          <v-divider vertical inset />
          <AxisVisualization class="mx-4" :raw-value="wizard.detectedAxisValue.value" />
          <div
            class="flex items-center justify-center w-[80px]"
            :class="[arrows.stacked ? 'flex-col' : 'flex-row', arrows.flattened ? 'scale-y-[0.35]' : '']"
          >
            <v-icon
              class="transition-colors"
              :class="[
                arrows.flattened ? 'text-4xl' : 'text-2xl',
                arrows.stacked ? 'mb-1' : 'mr-2',
                wizard.detectedAxisDirection.value === 'negative' ? 'text-[#4faedd]' : 'text-[#ffffff55]',
              ]"
              :icon="arrows.negative"
            />
            <v-icon
              class="transition-colors"
              :class="[
                arrows.flattened ? 'text-4xl' : 'text-2xl',
                arrows.stacked ? 'mt-1' : 'ml-2',
                wizard.detectedAxisDirection.value === 'positive' ? 'text-[#4faedd]' : 'text-[#ffffff55]',
              ]"
              :icon="arrows.positive"
            />
          </div>
        </template>
        <p v-else class="text-center text-sm opacity-70 w-full">Move any axis</p>
      </div>
      <v-btn
        v-show="wizard.detectedAxisIndex.value !== undefined"
        icon="mdi-restore"
        variant="text"
        size="small"
        class="absolute right-0"
        aria-label="Forget the detected axis"
        @click="wizard.clearDetection()"
      />
    </div>

    <div v-if="wizard.step.value.kind === 'button'" class="relative flex justify-center items-center w-full">
      <div
        class="absolute left-0 bottom-1.5 py-1 px-2 rounded-md bg-[#3B78A8] border-[1px] border-[#FFFFFF88] elevation-1"
        :style="{ opacity: wizard.isShiftPressed.value ? 0.9 : 0, transition: 'opacity .2s' }"
      >
        <p class="text-xs">Shift</p>
      </div>
      <div
        class="flex justify-between items-center w-3/4 bg-[#00000022] rounded-[8px] border-[1px] border-[#FFFFFF22] elevation-1 h-[60px]"
      >
        <p class="text-center font-semibold" :class="wizard.hasDetection.value ? 'w-[68%]' : 'w-full'">
          {{ wizard.detectedButtonLabel.value }}
        </p>
        <template v-if="wizard.hasDetection.value">
          <v-divider vertical inset />
          <div class="flex w-[28%] justify-center">
            <v-icon
              class="text-3xl bg-[#FFFFFF11] elevation-6 rounded-full"
              :class="wizard.isDetectedButtonPressed.value ? 'text-[#5089b4]' : 'text-[#2c5d8355]'"
              icon="mdi-circle"
            />
          </div>
        </template>
      </div>
      <v-btn
        v-show="wizard.hasDetection.value"
        icon="mdi-restore"
        variant="text"
        size="small"
        class="absolute right-0"
        aria-label="Forget the detected button"
        @click="wizard.clearDetection()"
      />
    </div>

    <div v-if="wizard.step.value.kind === 'question'" class="flex justify-center items-center w-full gap-x-20">
      <v-btn
        v-for="(option, index) in wizard.step.value.options"
        :key="option.label"
        :variant="index === wizard.highlightedOptionIndex.value ? 'flat' : 'outlined'"
        :class="index === wizard.highlightedOptionIndex.value ? 'bg-[#FFFFFF33] text-white' : ''"
        @click="wizard.choose(option.label, option.goTo)"
      >
        {{ option.label }}
      </v-btn>
    </div>

    <div v-if="wizard.conflictMessage.value" class="flex items-center mt-5">
      <div
        class="text-white bg-red-600 rounded-md text-sm font-bold border-[1px] border-[#FFFFFF88] py-[2px] px-2 max-w-[400px] text-center"
      >
        {{ wizard.conflictMessage.value }}
      </div>
      <v-btn
        class="ml-4 border-[1px] border-[#FFFFFF44] font-bold"
        variant="text"
        size="x-small"
        @click="wizard.overwriteConflict()"
      >
        Overwrite
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AxisVisualization from '@/components/joysticks/AxisVisualization.vue'
import { type JoystickWizardController } from '@/composables/joystick/useJoystickWizard'
import { type WizardAxisHint } from '@/libs/joystick/wizard/types'

const props = defineProps<{
  /**
   * Wizard state and commands, shared with the modal shell
   */
  wizard: JoystickWizardController
}>()

/**
 * How the pair of direction arrows of an axis step is drawn.
 */
interface AxisArrowSet {
  /**
   * Icon of the direction the browser reports as negative
   */
  negative: string
  /**
   * Icon of the direction the browser reports as positive
   */
  positive: string
  /**
   * Whether the arrows sit one above the other rather than side by side
   */
  stacked: boolean
  /**
   * Whether the arrows are squashed vertically, reading as pointing away from and towards the pilot
   */
  flattened: boolean
}

// Arrows are keyed on the sign the browser reports, where up and left read negative
const arrowsByHint: Record<WizardAxisHint, AxisArrowSet> = {
  vertical: { negative: 'mdi-arrow-up-bold', positive: 'mdi-arrow-down-bold', stacked: true, flattened: false },
  surge: { negative: 'mdi-arrow-up-bold', positive: 'mdi-arrow-down-bold', stacked: true, flattened: true },
  horizontal: { negative: 'mdi-arrow-left-bold', positive: 'mdi-arrow-right-bold', stacked: false, flattened: false },
  yaw: {
    negative: 'mdi-arrow-u-down-left-bold',
    positive: 'mdi-arrow-u-down-right-bold',
    stacked: false,
    flattened: false,
  },
}

const arrows = computed(() => {
  const step = props.wizard.step.value
  return arrowsByHint[step.kind === 'axis' ? step.hint : 'horizontal']
})
</script>
