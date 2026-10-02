<template>
  <InteractionDialog show-dialog title="Unusual axis range" variant="text-only" max-width="560px" persistent>
    <template #content>
      <div class="flex flex-col gap-y-4 text-sm">
        <div class="flex items-center gap-x-4">
          <v-icon size="40">mdi-alert</v-icon>
          <p class="text-balance">
            The range you typed for <strong>{{ actionName }}</strong> on axis {{ axis }} is very different from the
            default for {{ vehicleTypeName }}.
          </p>
        </div>
        <table class="w-full text-center">
          <thead>
            <tr class="opacity-70">
              <th></th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-start">Typed</td>
              <td>{{ min }}</td>
              <td>{{ max }}</td>
            </tr>
            <tr>
              <td class="text-start">Default</td>
              <td>{{ defaultMin }}</td>
              <td>{{ defaultMax }}</td>
            </tr>
          </tbody>
        </table>
        <p class="font-semibold">
          A range far from the default can make the vehicle's motors spin even when nobody is touching the joystick.
          Only keep it if you know your vehicle needs it.
        </p>
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
}>()

defineEmits<{
  /** Emitted when the user saves the axis with the default range */
  (e: 'use-defaults'): void
  /** Emitted when the user saves the axis with the typed range */
  (e: 'keep-values'): void
}>()
</script>
