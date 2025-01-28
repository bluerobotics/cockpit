<!-- A dialog that shows settings conflicts and allows individual resolution -->
<template>
  <v-dialog v-model="isOpen" :max-width="600" persistent>
    <v-card>
      <v-card-title class="text-h5">Settings Conflicts with BlueOS</v-card-title>
      <v-card-text>
        <p class="mb-4">The following settings differ between Cockpit and BlueOS:</p>
        <v-list>
          <v-list-item v-for="conflict in conflicts" :key="conflict.key">
            <v-list-item-content>
              <v-list-item-title>{{ conflict.key }}</v-list-item-title>
              <v-list-item-subtitle class="mt-2">
                <div class="text-sm mb-2">
                  <div>Local value: {{ JSON.stringify(conflict.localValue) }}</div>
                  <div>BlueOS value: {{ JSON.stringify(conflict.remoteValue) }}</div>
                </div>
                <v-radio-group v-model="resolutions[conflict.key]" row>
                  <v-radio label="Use BlueOS value" :value="true" />
                  <v-radio label="Keep Cockpit value" :value="false" />
                </v-radio-group>
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="resolveAll">Apply</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { type SettingsConflictResolution } from '@/composables/settingsConflictDialog'

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

onMounted(() => {
  console.log('Mounted SettingsConflictDialog')
})
</script>

<style scoped>
.v-list-item {
  margin-bottom: 16px;
}
</style>
