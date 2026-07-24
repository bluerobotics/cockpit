<template>
  <v-dialog
    :model-value="modelValue"
    width="560"
    persistent
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card class="relative text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ mode === 'edit' ? 'Edit mission' : 'Create a new mission' }}
      </v-card-title>
      <v-btn icon variant="text" size="small" aria-label="Close" class="absolute top-4 right-4" @click="close">
        <v-icon size="22">mdi-close</v-icon>
      </v-btn>
      <v-card-text class="px-8 flex flex-col gap-4">
        <div>
          <p class="text-subtitle-2 font-weight-bold mb-1">Mission name</p>
          <v-text-field
            v-model="name"
            placeholder="Mission name"
            variant="outlined"
            density="compact"
            theme="dark"
            hide-details
          />
          <div class="flex justify-end mt-1">
            <v-btn variant="text" size="small" class="px-0 text-white" @click="generateName">Generate name</v-btn>
          </div>
        </div>
        <div>
          <p class="text-subtitle-2 font-weight-bold mb-1">Description</p>
          <v-textarea
            v-model="description"
            placeholder="Optional description"
            variant="outlined"
            density="compact"
            theme="dark"
            rows="2"
            auto-grow
            hide-details
          />
        </div>
        <BlueOsCloudLocationPicker v-model="location" />
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn variant="text" @click="close">Cancel</v-btn>
          <v-btn
            variant="flat"
            theme="dark"
            class="bg-[#FFFFFF33] text-white disabled:opacity-40"
            :disabled="!name.trim()"
            @click="submit"
          >
            {{ mode === 'edit' ? 'Save changes' : 'Create mission' }}
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import BlueOsCloudLocationPicker from '@/components/blueos-cloud/BlueOsCloudLocationPicker.vue'
import { generateAutomaticMissionName } from '@/libs/mission/automatic-name'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Payload emitted when the user submits the create/edit mission form.
 */
type MissionFormSubmitPayload = {
  /**
   * Mission title.
   */
  name: string
  /**
   * Mission description.
   */
  description: string
  /**
   * Mission start location, or `null` when unset.
   */
  location: WaypointCoordinates | null
}

const props = withDefaults(
  defineProps<{
    /**
     * Controls dialog visibility.
     */
    modelValue: boolean
    /**
     * Whether the form creates a new mission or edits an existing one.
     */
    mode?: 'create' | 'edit'
    /**
     * Mission name to prefill (used in edit mode).
     */
    initialName?: string
    /**
     * Mission description to prefill (used in edit mode).
     */
    initialDescription?: string
    /**
     * Mission start location to prefill (used in edit mode).
     */
    initialLocation?: WaypointCoordinates | null
  }>(),
  { mode: 'create', initialName: '', initialDescription: '', initialLocation: null }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: MissionFormSubmitPayload): void
}>()

const interfaceStore = useAppInterfaceStore()

const name = ref('')
const description = ref('')
const location = ref<WaypointCoordinates | null>(null)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    name.value = props.initialName
    description.value = props.initialDescription
    location.value = props.initialLocation
  },
  { immediate: true }
)

const generateName = (): void => {
  logUserAction(`Generated a mission name in the ${props.mode} form`)
  name.value = generateAutomaticMissionName()
}

const close = (): void => {
  logUserAction(`Closed the mission ${props.mode} form without saving`)
  emit('update:modelValue', false)
}

const submit = (): void => {
  const trimmedName = name.value.trim()
  if (!trimmedName) return
  emit('submit', { name: trimmedName, description: description.value.trim(), location: location.value })
  emit('update:modelValue', false)
}
</script>
