<template>
  <div class="flex flex-col items-center w-full gap-y-4">
    <p class="text-center">
      Move each axis and press every mapped button to check the readout responds the way you expect.
    </p>
    <v-table
      density="compact"
      class="w-full max-h-[340px] bg-[#00000022] rounded-md elevation-1 overflow-y-auto"
      theme="dark"
    >
      <thead>
        <tr>
          <th class="text-left">Input</th>
          <th class="text-left">Mapped function</th>
          <th class="text-center">Live</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.type}-${row.label}`">
          <td class="w-[150px] truncate">{{ row.label }}</td>
          <td class="max-w-[250px] truncate">{{ row.action }}</td>
          <td class="text-center">
            <AxisVisualization
              v-if="row.type === 'axis'"
              :raw-value="liveAxes[row.index] ?? 0"
              :processed-value="commandedValue(row)"
              class="w-[120px] scale-75 mx-auto"
            />
            <v-icon
              v-else
              class="text-2xl elevation-1 rounded-full mr-1 text-[#5089b4]"
              :icon="liveButtons[row.index] ? 'mdi-circle' : 'mdi-circle-outline'"
              :class="liveButtons[row.index] ? 'opacity-100' : 'opacity-35'"
            />
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="3" class="text-center opacity-70 py-4">
            Nothing was mapped. Restart the wizard to map your controller.
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import AxisVisualization from '@/components/joysticks/AxisVisualization.vue'
import { type WizardMappingRow } from '@/libs/joystick/wizard/mapping'
import { scale } from '@/libs/utils'

const props = defineProps<{
  /**
   * Bindings the wizard produced
   */
  rows: WizardMappingRow[]
  /**
   * Live value of every axis of the controller
   */
  liveAxes: number[]
  /**
   * Live value of every button of the controller
   */
  liveButtons: number[]
}>()

// What the binding actually sends, which is the only readout that reveals an inverted axis
const commandedValue = (row: WizardMappingRow): number | undefined => {
  if (row.range === undefined) return undefined
  return scale(props.liveAxes[row.index] ?? 0, -1, 1, row.range.min, row.range.max)
}
</script>
