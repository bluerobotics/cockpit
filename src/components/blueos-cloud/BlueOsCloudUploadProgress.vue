<template>
  <v-dialog
    :model-value="modelValue"
    width="480"
    persistent
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card class="pa-4 text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="flex justify-between items-center">
        <span class="text-lg font-medium">Uploading to BlueOS Cloud</span>
        <v-btn v-if="!isUploadFinished" icon="mdi-close" variant="text" size="small" @click="emit('cancel')" />
      </v-card-title>
      <v-divider class="opacity-20 mx-4" />
      <v-card-text class="px-2 py-4">
        <div class="flex flex-col gap-2">
          <p class="text-sm truncate" :title="fileName"><span class="opacity-70">File:</span> {{ fileName }}</p>
          <p class="text-sm"><span class="opacity-70">Mission:</span> {{ missionName }}</p>
          <v-progress-linear
            :model-value="progress"
            color="white"
            height="10"
            rounded
            :indeterminate="progress < 1 && !isUploadFinished && !errorMessage"
          />
          <p class="text-xs opacity-70 text-right">{{ Math.round(progress) }}%</p>
          <p v-if="errorMessage" class="text-sm text-red-300">{{ errorMessage }}</p>
          <p v-else-if="isUploadFinished" class="text-sm text-green-300">Upload complete!</p>
          <a
            v-if="missionId && isUploadFinished"
            :href="missionUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-sky-300 hover:underline inline-flex items-center gap-1"
          >
            <v-icon size="14">mdi-open-in-new</v-icon>
            View mission on BlueOS Cloud
          </a>
        </div>
      </v-card-text>
      <v-divider class="opacity-20 mx-4" />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn v-if="isUploadFinished || errorMessage" variant="text" @click="emit('update:modelValue', false)">
          Close
        </v-btn>
        <v-btn v-else variant="text" @click="emit('cancel')">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { buildBlueOsCloudMissionUrl } from '@/libs/blueos-cloud/api'
import { useAppInterfaceStore } from '@/stores/appInterface'

const props = defineProps<{
  /**
   * Controls dialog visibility.
   */
  modelValue: boolean
  /**
   * Name of the file being uploaded.
   */
  fileName: string
  /**
   * Mission to which the file is being uploaded.
   */
  missionName: string
  /**
   * Identifier of the mission to which the file is being uploaded; used to render a link to the cloud UI.
   */
  missionId?: string
  /**
   * Current progress in the 0-100 range.
   */
  progress: number
  /**
   * Whether the upload has finished successfully.
   */
  isUploadFinished: boolean
  /**
   * Error message to display when an upload failure happens.
   */
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'cancel'): void
}>()

const interfaceStore = useAppInterfaceStore()

const missionUrl = computed(() => (props.missionId ? buildBlueOsCloudMissionUrl(props.missionId) : ''))
</script>
