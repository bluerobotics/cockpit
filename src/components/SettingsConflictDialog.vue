<!-- A dialog that shows settings conflicts and allows individual resolution -->
<template>
  <InteractionDialog
    variant="text-only"
    :show-dialog="isOpen"
    title="Settings Conflicts with BlueOS"
    :actions="interactionDialogActions"
    :max-width="700"
  >
    <template #content>
      <div class="mb-6">
        <p class="mb-4">The settings bellow differ between Cockpit and BlueOS.</p>
        <p class="mb-4">Please select the value you want to keep on each of them and click "Sync".</p>
        <div class="space-y-4">
          <div v-for="conflict in conflicts" :key="conflict.key" class="p-4 border rounded">
            <h3 class="text-lg font-medium text-center">{{ conflict.key }}</h3>
            <div class="mt-2">
              <v-radio-group v-model="resolutions[conflict.key]">
                <div class="flex justify-between items-center">
                  <v-radio :value="true">
                    <template #label>
                      <div class="flex flex-col gap-2">
                        <div class="font-bold text-md">BlueOS value</div>
                        <div class="text-sm">{{ JSON.stringify(conflict.remoteValue) }}</div>
                      </div>
                    </template>
                  </v-radio>
                  <v-radio :value="false">
                    <template #label>
                      <div class="flex flex-col gap-2">
                        <div class="font-bold text-md">Cockpit value</div>
                        <div class="text-sm">{{ JSON.stringify(conflict.localValue) }}</div>
                      </div>
                    </template>
                  </v-radio>
                </div>
              </v-radio-group>
            </div>
          </div>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { type SettingsConflictResolution } from '@/composables/settingsSyncer'

import InteractionDialog from './InteractionDialog.vue'

/**
 * Represents a setting that has a conflict between local and remote values
 */
interface ConflictItem {
  /** The key of the setting with a conflict */
  key: string

  /** The current local value of the setting */
  localValue: unknown

  /** The value of the setting stored in BlueOS */
  remoteValue: unknown

  /** Callback function to resolve the conflict with the user's choice */
  resolve: (useRemoteValue: boolean) => void
}

const props = defineProps<{
  /** Whether the dialog is open */
  modelValue: boolean

  /** List of conflicts to be resolved */
  conflicts: ConflictItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirmed', resolutions: SettingsConflictResolution): void
  (e: 'dismissed'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const resolutions = ref<SettingsConflictResolution>({})

// Initialize resolutions whenever conflicts change
watch(
  () => props.conflicts,
  (newConflicts) => {
    console.debug('Initializing resolutions for conflicts:', newConflicts)
    resolutions.value = {}
    for (const conflict of newConflicts) {
      resolutions.value[conflict.key] = true
    }
  },
  { immediate: true }
)

const resolveAll = (): void => {
  console.debug('Resolving all conflicts with resolutions:', resolutions.value)
  for (const conflict of props.conflicts) {
    conflict.resolve(resolutions.value[conflict.key])
  }
  isOpen.value = false
  emit('confirmed', resolutions.value)
}

const interactionDialogActions = [
  {
    text: 'Decide later',
    action: () => {
      isOpen.value = false
      emit('dismissed')
    },
  },
  {
    text: 'Sync',
    action: () => {
      resolveAll()
    },
  },
]
</script>

<style scoped>
.v-list-item {
  margin-bottom: 16px;
}
</style>
