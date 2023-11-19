<template>
  <template v-if="miniWidget.component === MiniWidgetType.RelativeAltitudeIndicator">
    <RelativeAltitudeIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.ArmerButton">
    <ArmerButton :options="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.BaseCommIndicator">
    <BaseCommIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.BatteryIndicator">
    <BatteryIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.DepthIndicator">
    <DepthIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.VeryGenericIndicator">
    <VeryGenericIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.JoystickCommIndicator">
    <JoystickCommIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.MiniVideoRecorder">
    <MiniVideoRecorder :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.ModeSelector">
    <ModeSelector :options="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.SatelliteIndicator">
    <SatelliteIndicator :mini-widget="miniWidget" />
  </template>
  <template v-if="miniWidget.component === MiniWidgetType.ViewSelector">
    <ViewSelector :options="miniWidget" />
  </template>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import { type MiniWidget, MiniWidgetType } from '@/types/miniWidgets'

import ArmerButton from './mini-widgets/ArmerButton.vue'
import BaseCommIndicator from './mini-widgets/BaseCommIndicator.vue'
import BatteryIndicator from './mini-widgets/BatteryIndicator.vue'
import DepthIndicator from './mini-widgets/DepthIndicator.vue'
import JoystickCommIndicator from './mini-widgets/JoystickCommIndicator.vue'
import MiniVideoRecorder from './mini-widgets/MiniVideoRecorder.vue'
import ModeSelector from './mini-widgets/ModeSelector.vue'
import RelativeAltitudeIndicator from './mini-widgets/RelativeAltitudeIndicator.vue'
import SatelliteIndicator from './mini-widgets/SatelliteIndicator.vue'
import VeryGenericIndicator from './mini-widgets/VeryGenericIndicator.vue'
import ViewSelector from './mini-widgets/ViewSelector.vue'

const props = defineProps<{
  /**
   * Mini-widget instance
   */
  miniWidget: MiniWidget
}>()

const miniWidget = toRefs(props).miniWidget
</script>
