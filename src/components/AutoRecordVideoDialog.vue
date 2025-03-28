<template>
  <InteractionDialog v-model:visible="visible" variant="text-only" width="600">
    <template #title
      ><div class="flex justify-between mt-2">
        <div class="w-full text-center -mr-10">Auto record video streams</div>
        <v-btn icon="mdi-close" size="medium" variant="text" @click="handleCloseModal" /></div
    ></template>
    <template #content>
      <v-card-text class="flex flex-col">
        <v-radio-group v-model="autoRecordOption" class="flex flex-col">
          <v-radio class="mb-2" label="Start recording all streams when the vehicle is armed" value="all"></v-radio>
          <div>
            <v-radio
              class="mb-2"
              label="Automatically start recording only the following streams:"
              value="selected"
              @click="showReminder = false"
            ></v-radio>
            <div class="ml-6 mb-4">
              <v-combobox
                v-model="selectedStreams"
                :items="availableStreams"
                multiple
                hide-details
                chips
                label="Available streams"
                theme="dark"
                class="w-4/5"
                density="compact"
                :close-on-content-click="false"
                return-object
                :item-title="(stream: VideoStreamCorrespondency) => stream.name"
                :item-value="(stream: VideoStreamCorrespondency) => stream"
                @update:model-value="handleComboBoxUpdate"
              >
                <template #item="{ item, props }">
                  <v-list-item v-bind="props">
                    {{ (item as unknown as VideoStreamCorrespondency).name }}
                  </v-list-item>
                </template>
                <template #selection="{ item, index }">
                  <v-chip :key="index" close @click:close="selectedStreams.splice(index, 1)">
                    {{ (item as unknown as VideoStreamCorrespondency).name }}
                  </v-chip>
                </template>
              </v-combobox>
            </div>
          </div>
          <v-radio class="mb-2" label="Do not auto record streams when vehicle is armed" value="none"></v-radio>
        </v-radio-group>
        <v-checkbox
          v-model="showReminder"
          hide-details
          label="Show recording reminder when the vehicle is armed"
          class="-mb-2"
        ></v-checkbox>
        <div class="flex w-auto justify-items-start items-center ml-10 opacity-70">
          <p>Delay:</p>
          <input
            v-model="reminderDelay"
            type="number"
            min="0"
            max="9999"
            step="1"
            class="bg-[#FFFFFF11] w-[80px] mx-1"
          />
          <p>{{ reminderDelay > 1 ? 'seconds' : 'second' }}</p>
        </div>
        <v-checkbox
          v-model="stopRecordingOnDisarm"
          hide-details
          label="Stop recording when the vehicle is disarmed"
          class="-mb-2"
        ></v-checkbox>
      </v-card-text>
    </template>
    <template #actions>
      <div class="flex justify-between items-center w-full">
        <v-checkbox
          v-model="rememberChoice"
          density="comfortable"
          hide-details
          label="Remember my choice"
          class="ml-2"
        ></v-checkbox>
        <v-btn color="#FFFFFF" @click="handleCloseModal">{{ rememberChoice ? 'Save and apply' : 'Apply' }}</v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { defaultAutoRecordingOptions } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useVideoStore } from '@/stores/video'
import { AutoRecordVideoStreams, VideoStreamCorrespondency } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'
const videoStore = useVideoStore()

const emit = defineEmits(['close'])

const visible = ref(false)
const showReminder = ref(true)
const reminderDelay = ref(1)
const stopRecordingOnDisarm = ref(false)
const cockpitAutoRecordStreams = useBlueOsStorage<AutoRecordVideoStreams>(
  'cockpit-auto-record-streams',
  defaultAutoRecordingOptions
)
const autoRecordOption = ref<'none' | 'all' | 'selected' | undefined>(
  cockpitAutoRecordStreams.value.autoRecordOption || 'none'
)
const selectedStreams = ref<VideoStreamCorrespondency[]>(cockpitAutoRecordStreams.value.selectedStreams || [])
const availableStreams = computed(() => videoStore.streamsCorrespondency)
const rememberChoice = ref(true)

const handleComboBoxUpdate = (): void => {
  if (selectedStreams.value.length > 0) {
    autoRecordOption.value = 'selected'
    showReminder.value = false
  }
  if (selectedStreams.value.length === 0) autoRecordOption.value = 'none'
}

const handleCloseModal = (): void => {
  let currentOptions = {
    autoRecordOption: autoRecordOption.value,
    stopRecordingOnDisarm: stopRecordingOnDisarm.value,
    showReminder: autoRecordOption.value === 'none' ? true : showReminder.value,
    reminderDelay: reminderDelay.value,
    selectedStreams: selectedStreams.value,
  }

  if (rememberChoice.value) {
    cockpitAutoRecordStreams.value = currentOptions
  }
  videoStore.currentAutoRecordOptions = currentOptions
  visible.value = false
  emit('close')
}

watch(autoRecordOption, (value) => {
  if (value === 'none') {
    showReminder.value = true
  }
  if (value === 'all') {
    showReminder.value = false
  }
})
</script>
