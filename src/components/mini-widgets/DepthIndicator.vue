<template>
  <div class="h-12 p-1 min-w-[8.5rem] text-white transition-all relative scroll-container">
    <span class="h-full left-[0.5rem] bottom-[12%] absolute mdi text-[2.35rem] mdi-wave-arrow-up" />
    <div class="absolute left-[3rem] h-full select-none font-semibold scroll-container w-full">
      <div class="w-full">
        <span class="font-mono text-xl leading-6">{{ parsedState }}</span>
        <span class="text-xl leading-6">
          {{ String.fromCharCode(0x20) }} {{ unitAbbreviation[displayUnitPreferences.distance] }}
        </span>
      </div>
      <span class="w-full text-sm absolute bottom-[0.5rem] whitespace-nowrap text-ellipsis overflow-x-hidden">
        {{ $t('Depth') }}
      </span>
    </div>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[400px]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Depth Indicator Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <div class="absolute top-2 right-2 z-10">
          <v-btn
            icon
            size="30"
            variant="text"
            class="text-white text-[22px]"
            :aria-label="$t('Close')"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <i class="mdi mdi-close"></i>
          </v-btn>
        </div>
        <v-select
          v-if="!configUseCustomAltitudeVariable"
          v-model="configAltitudeVariableId"
          :label="$t('Altitude source')"
          :items="altitudeSourceOptions"
          item-title="title"
          item-value="value"
          hide-details
          theme="dark"
          variant="outlined"
          density="compact"
          @update:model-value="onAltitudeSourceSelected"
        />
        <v-autocomplete
          v-else
          v-model="configAltitudeVariableId"
          :items="availableDataLakeNumberVariables"
          item-title="name"
          item-value="id"
          :label="$t('Data lake variable')"
          hint="Select any numeric data lake variable"
          persistent-hint
          theme="dark"
          variant="outlined"
          density="compact"
          clearable
          prepend-inner-icon="mdi-magnify"
          @update:model-value="onAltitudeSourceSelected"
        />
        <v-checkbox
          v-model="configUseCustomAltitudeVariable"
          :label="$t('Use custom data lake variable')"
          hide-details
          @update:model-value="onUseCustomAltitudeVariableToggled"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { unit } from 'mathjs'
import { computed, onBeforeMount, toRefs } from 'vue'

import { mergeAltitudeVariableOptions, useAltitudeSourceConfig } from '@/composables/useAltitudeSourceConfig'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import {
  altitudeSourceOptions,
  defaultDepthAltitudeVariableId,
  rawAltitudeToMeters,
} from '@/libs/data-sources/altitude'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { unitAbbreviation } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { displayUnitPreferences } = interfaceStore
datalogger.registerUsage(DatalogVariable.depth)

const defaultOptions = {
  altitudeVariableId: defaultDepthAltitudeVariableId,
  useCustomAltitudeVariable: false,
}

onBeforeMount(() => {
  miniWidget.value.options = mergeAltitudeVariableOptions(defaultOptions, miniWidget.value.options)
})

const {
  resolvedAltitudeVariableId,
  configAltitudeVariableId,
  configUseCustomAltitudeVariable,
  availableDataLakeNumberVariables,
  onAltitudeSourceSelected,
  onUseCustomAltitudeVariableToggled,
} = useAltitudeSourceConfig({
  widget: miniWidget,
  isConfigMenuOpen: () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  defaultAltitudeVariableId: defaultDepthAltitudeVariableId,
})

const { value: rawAltitude } = useDataLakeVariable(resolvedAltitudeVariableId)

const currentDepth = computed<number | undefined>(() => {
  if (resolvedAltitudeVariableId.value === undefined || typeof rawAltitude.value !== 'number') return undefined
  const altMeters = rawAltitudeToMeters(resolvedAltitudeVariableId.value, rawAltitude.value)
  const depth = unit(-altMeters, 'm')
  if (depth.value < 0.01) return 0
  return depth.to(displayUnitPreferences.distance).toJSON().value as number
})

const parsedState = computed(() => {
  const fDepth = currentDepth.value
  if (fDepth === undefined) return '--'
  const precision = fDepth < 10 ? 2 : fDepth >= 10 && fDepth < 1000 ? 1 : 0
  return fDepth.toFixed(precision)
})
</script>
