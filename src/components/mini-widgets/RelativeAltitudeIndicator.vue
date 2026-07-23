<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <img src="@/assets/altitude-icon.svg" class="h-full" :draggable="false" />
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ parsedState }}</span>
        <span class="text-xl font-semibold leading-6 w-fit">
          {{ String.fromCharCode(0x20) }} {{ unitAbbreviation[displayUnitPreferences.distance] }}
        </span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Alt (Rel)</span>
    </div>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[400px]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Relative Altitude Indicator Config</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <div class="absolute top-2 right-2 z-10">
          <v-btn
            icon
            size="30"
            variant="text"
            class="text-white text-[22px]"
            aria-label="Close"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <i class="mdi mdi-close"></i>
          </v-btn>
        </div>
        <v-select
          v-if="!configUseCustomAltitudeVariable"
          v-model="configAltitudeVariableId"
          label="Altitude source"
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
          label="Data lake variable"
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
          label="Use custom data lake variable"
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
  defaultAltitudeIndicatorVariableId,
  rawAltitudeToMeters,
} from '@/libs/data-sources/altitude'
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

const defaultOptions = {
  altitudeVariableId: defaultAltitudeIndicatorVariableId,
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
  defaultAltitudeVariableId: defaultAltitudeIndicatorVariableId,
})

const { value: rawAltitude } = useDataLakeVariable(resolvedAltitudeVariableId)

const currentAltitude = computed<number | undefined>(() => {
  if (resolvedAltitudeVariableId.value === undefined || typeof rawAltitude.value !== 'number') return undefined
  if (!Number.isFinite(rawAltitude.value)) return undefined
  const altMeters = rawAltitudeToMeters(resolvedAltitudeVariableId.value, rawAltitude.value)
  if (!Number.isFinite(altMeters)) return undefined
  return unit(altMeters, 'm').to(displayUnitPreferences.distance).toJSON().value as number
})

const parsedState = computed(() => {
  const altitude = currentAltitude.value
  if (altitude === undefined) return '--'
  return altitude.toFixed(2)
})
</script>
