<template>
  <v-dialog :model-value="modelValue" width="560" persistent>
    <v-card class="relative text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">BlueOS Cloud mission</v-card-title>
      <v-btn icon variant="text" size="small" aria-label="Close" class="absolute top-4 right-4" @click="emit('close')">
        <v-icon size="22">mdi-close</v-icon>
      </v-btn>
      <v-card-text class="px-8 pb-6 flex flex-col gap-4">
        <p class="text-sm opacity-80 text-center ma-0">
          Choose how you want to work with BlueOS Cloud missions for this session.
        </p>
        <BlueOsCloudMissionDecisionOptions
          :previous-mission="previousMission"
          show-skip
          @continue-previous="emit('continue-previous')"
          @select-existing="emit('select-existing')"
          @create-new="emit('create-new')"
          @skip="emit('skip')"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import BlueOsCloudMissionDecisionOptions from '@/components/blueos-cloud/BlueOsCloudMissionDecisionOptions.vue'
import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { useAppInterfaceStore } from '@/stores/appInterface'

defineProps<{
  /**
   * Controls dialog visibility.
   */
  modelValue: boolean
  /**
   * Last linked cloud mission, when one is available to continue.
   */
  previousMission: BlueOsCloudMission | null
}>()

const emit = defineEmits<{
  (e: 'continue-previous'): void
  (e: 'select-existing'): void
  (e: 'create-new'): void
  (e: 'skip'): void
  (e: 'close'): void
}>()

const interfaceStore = useAppInterfaceStore()
</script>
