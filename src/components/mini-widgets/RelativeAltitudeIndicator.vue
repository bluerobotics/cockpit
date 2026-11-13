<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <img src="@/assets/altitude-icon.svg" class="h-full" :draggable="false" />
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ parsedState }}</span>
        <span class="text-xl font-semibold leading-6 w-fit"> {{ String.fromCharCode(0x20) }} {{ altitudeUnit }} </span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">{{ t`Alt (Rel)` }}</span>
    </div>
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="auto">
    <v-card class="pa-4 text-white w-[400px]" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">{{ t`Relative Altitude Indicator Config` }}</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <div class="absolute top-2 right-2 z-10">
          <v-btn
            icon
            size="30"
            variant="text"
            class="text-white text-[22px]"
            :aria-label="t`Close`"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <i class="mdi mdi-close"></i>
          </v-btn>
        </div>
        <DataSourceSelect
          :config="altitudeSourceConfig"
          :presets="altitudeSourceOptions"
          :label="t`Altitude source`"
          :custom-hint="t`Any numeric data lake variable, read in meters`"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, toRefs } from 'vue'

import DataSourceSelect from '@/components/DataSourceSelect.vue'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useDataSourceConfig } from '@/composables/useDataSourceConfig'
import {
  altitudeDataSource,
  altitudeSourceOptions,
  defaultAltitudeIndicatorVariableId,
  rawAltitudeToMeters,
} from '@/libs/data-sources/altitude'
import { mergeDataSourceOptions } from '@/libs/data-sources/source-options'
import { convertValue, readingLengthsAs, unitAbbreviation } from '@/libs/units'
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

const defaultOptions = {
  altitudeVariableId: defaultAltitudeIndicatorVariableId,
  useCustomAltitudeVariable: false,
}

onBeforeMount(() => {
  miniWidget.value.options = mergeDataSourceOptions(defaultOptions, miniWidget.value.options, [altitudeDataSource])
})

const altitudeSourceConfig = useDataSourceConfig({
  widget: miniWidget,
  isConfigMenuOpen: () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  source: altitudeDataSource,
  defaultVariableId: defaultAltitudeIndicatorVariableId,
  sourceName: 'altitude',
})
const resolvedAltitudeVariableId = altitudeSourceConfig.resolvedVariableId

const { value: rawAltitude } = useDataLakeVariable(resolvedAltitudeVariableId)

const currentAltitude = computed<number | undefined>(() => {
  if (resolvedAltitudeVariableId.value === undefined || typeof rawAltitude.value !== 'number') return undefined
  const altMeters = rawAltitudeToMeters(resolvedAltitudeVariableId.value, rawAltitude.value)
  return convertValue(altMeters, 'm', readingLengthsAs(interfaceStore.displayUnitPreferences, 'altitude')).value
})

const altitudeUnit = computed(() => unitAbbreviation[interfaceStore.displayUnitPreferences.altitude])

const parsedState = computed(() => {
  const altitude = currentAltitude.value
  if (altitude === undefined) return '--'
  return altitude.toFixed(2)
})
</script>
