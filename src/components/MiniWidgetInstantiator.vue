<template>
  <template v-if="widgetType === MiniWidgetType.ArmerButton">
    <ArmerButton :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.BaseCommIndicator">
    <BaseCommIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.BatteryIndicator">
    <BatteryIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.DepthIndicator">
    <DepthIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.VeryGenericIndicator">
    <VeryGenericIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.JoystickCommIndicator">
    <JoystickCommIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.MiniVideoRecorder">
    <MiniVideoRecorder :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.ModeSelector">
    <ModeSelector :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.SatelliteIndicator">
    <SatelliteIndicator :options="options" />
  </template>
  <template v-if="widgetType === MiniWidgetType.ViewSelector">
    <ViewSelector :options="options" />
  </template>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import { MiniWidgetType } from '@/types/miniWidgets'

import ArmerButton from './mini-widgets/ArmerButton.vue'
import BaseCommIndicator from './mini-widgets/BaseCommIndicator.vue'
import BatteryIndicator from './mini-widgets/BatteryIndicator.vue'
import DepthIndicator from './mini-widgets/DepthIndicator.vue'
import JoystickCommIndicator from './mini-widgets/JoystickCommIndicator.vue'
import MiniVideoRecorder from './mini-widgets/MiniVideoRecorder.vue'
import ModeSelector from './mini-widgets/ModeSelector.vue'
import SatelliteIndicator from './mini-widgets/SatelliteIndicator.vue'
import VeryGenericIndicator from './mini-widgets/VeryGenericIndicator.vue'
import ViewSelector from './mini-widgets/ViewSelector.vue'

const props = defineProps<{
  /**
   * Type of mini-widget to return
   */
  widgetType: MiniWidgetType
  /**
   * Options to pass to mini-widget
   */
  options: Record<string, unknown>
}>()

const widgetType = toRefs(props).widgetType
const options = toRefs(props).options
</script>
