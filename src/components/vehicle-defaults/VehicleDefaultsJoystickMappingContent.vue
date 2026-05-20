<template>
  <div>
    <div v-if="evaluation?.joystick.defaultMapping && hasImportOffer" class="space-y-3">
      <div class="space-y-1.5 text-sm opacity-80">
        <p class="pl-2 mb-2">
          Cockpit has a default joystick mapping for {{ evaluation.vehicleTypeName }} with
          {{ defaultMappingAxisCount }} axis function(s)
        </p>
        <ul v-if="!isCurrentMappingBlank" class="list-none space-y-1.5 pl-2">
          <li class="flex items-start gap-2">
            <v-icon color="white" size="16" class="mt-0.5 shrink-0">
              {{ evaluation.joystick.missingAxisFunctions === 0 ? 'mdi-check' : 'mdi-close' }}
            </v-icon>
            <span>
              Your current mapping is missing {{ evaluation.joystick.missingAxisFunctions }} default axis function(s).
            </span>
          </li>
          <li class="flex items-start gap-2">
            <v-icon color="white" size="16" class="mt-0.5 shrink-0">
              {{ evaluation.joystick.axisFunctionsWithRangeMismatch === 0 ? 'mdi-check' : 'mdi-close' }}
            </v-icon>
            <span>
              Your current mapping has {{ evaluation.joystick.axisFunctionsWithRangeMismatch }} axis function(s) with a
              range that differs from the default by more than 5%.
            </span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg border border-white/10 px-2.5 py-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-semibold">Bindings to import ({{ joystickImportRows.length }})</span>
          <div class="flex gap-1">
            <v-btn size="x-small" variant="text" @click="selectAllJoystickRows">All</v-btn>
            <v-btn size="x-small" variant="text" @click="selectNoneJoystickRows">None</v-btn>
          </div>
        </div>
        <div class="max-h-[280px] space-y-1.5 overflow-y-auto pr-0.5">
          <label
            v-for="row in joystickImportRows"
            :key="row.id"
            class="flex min-h-[52px] cursor-pointer items-center gap-1 rounded-md bg-gray-600/60 px-2 py-1.5"
          >
            <v-checkbox
              v-model="selectedJoystickRowIds"
              :value="row.id"
              density="compact"
              hide-details
              class="m-0 shrink-0 p-0 [&_.v-label]:hidden [&_.v-selection-control]:min-h-7 [&_.v-selection-control__wrapper]:h-7 [&_.v-selection-control__wrapper]:w-7"
            />
            <div class="flex min-h-[52px] min-w-0 flex-1 flex-col">
              <div class="flex min-h-0 flex-1 flex-col items-center justify-end">
                <p class="mb-2.5 text-center text-[11px] leading-none text-gray-300/50">{{ row.inputLabel }}</p>
              </div>
              <div class="flex w-full shrink-0 items-center justify-center gap-2.5">
                <span
                  class="max-w-[42%] flex-[0_1_42%] truncate text-right text-xs leading-snug text-gray-300"
                  :title="row.fromActionName"
                >
                  {{ row.fromActionName }}
                </span>
                <v-icon size="16" color="green" class="shrink-0">mdi-arrow-right</v-icon>
                <span
                  class="max-w-[42%] flex-[0_1_42%] truncate text-left text-xs leading-snug text-green-400"
                  :title="row.toActionName"
                >
                  {{ row.toActionName }}
                </span>
              </div>
              <div class="min-h-0 flex-1" />
            </div>
          </label>
        </div>
      </div>
    </div>

    <div v-else-if="evaluation?.joystick.defaultMapping && !hasImportOffer" class="space-y-3">
      <p class="my-8 text-sm text-center opacity-80">
        <template v-if="variant === 'wizard'">
          Your joystick mapping already matches the default for {{ evaluation.vehicleTypeName }}. Click
          <strong>Next</strong> to continue to the views group screen.
        </template>
        <template v-else-if="!isCurrentMappingBlank">
          Your joystick mapping matches the default for {{ evaluation.vehicleTypeName }} exactly.
        </template>
        <template v-else>
          Your joystick mapping already matches the default for {{ evaluation.vehicleTypeName }}.
        </template>
      </p>
    </div>

    <div v-else class="py-2 text-center text-sm opacity-80">
      <template v-if="variant === 'wizard'">
        No default joystick mapping is available for {{ evaluation?.vehicleTypeName ?? 'this vehicle' }}. Click
        <strong>Next</strong> to continue.
      </template>
      <template v-else>
        No default joystick mapping is available for {{ evaluation?.vehicleTypeName ?? 'this vehicle' }}.
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVehicleDefaultsJoystickImportInject } from '@/composables/vehicleDefaults/useVehicleDefaultsJoystickImport'

withDefaults(
  defineProps<{
    /** Wizard steps reference Next; standalone omits that copy */
    variant?: 'wizard' | 'standalone'
  }>(),
  { variant: 'standalone' }
)

const {
  evaluation,
  hasImportOffer,
  isCurrentMappingBlank,
  defaultMappingAxisCount,
  joystickImportRows,
  selectedJoystickRowIds,
  selectAllJoystickRows,
  selectNoneJoystickRows,
} = useVehicleDefaultsJoystickImportInject()
</script>
