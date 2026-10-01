<template>
  <InteractionDialog show-dialog title="Unusual axis range" variant="text-only" max-width="560px" persistent>
    <template #content>
      <div class="flex flex-col gap-y-4 text-sm">
        <div class="flex items-center gap-x-4">
          <v-icon size="40" class="text-yellow-400">mdi-alert</v-icon>
          <p class="text-balance">
            The range you typed for <strong>{{ actionName }}</strong> on axis {{ axis }} differs from the default for
            {{ vehicleTypeName }}.
          </p>
        </div>
        <table class="w-full text-center border-collapse">
          <thead>
            <tr class="opacity-70">
              <th></th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-start px-2">Typed</td>
              <td>
                <span :class="{ [highlightClass]: offEndpoints.includes('min') }">{{ min }}</span>
              </td>
              <td>
                <span :class="{ [highlightClass]: offEndpoints.includes('max') }">{{ max }}</span>
              </td>
            </tr>
            <tr>
              <td class="text-start px-2">Default</td>
              <td>{{ defaultMin }}</td>
              <td>{{ defaultMax }}</td>
            </tr>
          </tbody>
        </table>
        <div class="flex flex-col gap-y-2 font-semibold">
          <p v-if="issues.includes('off-center')">
            Its center is away from the default one, so the vehicle's motors can spin even when nobody is touching the
            joystick.
          </p>
          <p v-if="issues.includes('beyond-limits')">
            It goes past the default limits, and the vehicle may ignore the values beyond them.
          </p>
          <p>Only keep it if you know your vehicle needs it.</p>
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-between w-full px-1 py-2">
        <v-btn variant="text" @click="$emit('keep-values')">Keep my values</v-btn>
        <v-btn variant="elevated" class="bg-[#FFFFFF33]" @click="$emit('use-defaults')">Use defaults</v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import InteractionDialog from '@/components/InteractionDialog.vue'
import type { AxisRangeIssue } from '@/libs/joystick/default-mappings'

defineProps<{
  /** Axis being saved */
  axis: number
  /** Name of the function mapped to the axis */
  actionName: string
  /** Friendly name of the connected vehicle type */
  vehicleTypeName: string
  /** Typed minimum */
  min: number
  /** Typed maximum */
  max: number
  /** Default minimum for the function on this vehicle */
  defaultMin: number
  /** Default maximum for the function on this vehicle */
  defaultMax: number
  /** What is wrong with the typed range */
  issues: AxisRangeIssue[]
  /** Typed endpoints that cause the issues */
  offEndpoints: ('min' | 'max')[]
}>()

const highlightClass = 'px-2 py-0.5 rounded bg-yellow-400 text-black'

defineEmits<{
  /** Emitted when the user saves the axis with the default range */
  (e: 'use-defaults'): void
  /** Emitted when the user saves the axis with the typed range */
  (e: 'keep-values'): void
}>()
</script>
