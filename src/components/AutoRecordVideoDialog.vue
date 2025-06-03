<template>
  <InteractionDialog v-model:visible="visible" variant="text-only" width="600">
    <template #title>
      <div class="flex justify-between mt-2">
        <div class="w-full text-center -mr-10">Auto record video streams</div>
        <v-btn icon="mdi-close" size="medium" variant="text" @click="handleCloseModal" />
      </div>
    </template>
    <template #content>
      <v-card-text class="flex flex-col">
        <v-radio-group v-model="autoRecordMode" class="flex flex-col">
          <v-radio class="mb-2" label="Start recording all streams when the vehicle is armed" value="all" />
          <div>
            <v-radio
              class="mb-2"
              label="Automatically start recording only the following streams:"
              value="selected"
              @click="showReminder = false"
            />
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
                  <v-chip :key="index" close @click:close="removeSelectedStream(index)">
                    {{ (item as unknown as VideoStreamCorrespondency).name }}
                  </v-chip>
                </template>
              </v-combobox>
            </div>
          </div>
          <v-radio class="mb-2" label="Do not auto record streams when vehicle is armed" value="none" />
        </v-radio-group>
        <v-checkbox
          v-model="showReminder"
          hide-details
          label="Show recording reminder when the vehicle is armed"
          class="-mb-2"
        />
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
        />
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
        />
        <v-btn color="#FFFFFF" @click="handleCloseModal">
          {{ rememberChoice ? 'Save and apply' : 'Apply' }}
        </v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useVideoStore } from '@/stores/video'
import { VideoStreamCorrespondency } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'

const videoStore = useVideoStore()
const emit = defineEmits(['close'])
const visible = ref(false)
const rememberChoice = ref(true)

const autoRecordMode = computed({
  get: () => videoStore.momentaryAutoRecordOptions.autoRecordMode || 'none',
  set: (value: 'none' | 'all' | 'selected') => {
    videoStore.momentaryAutoRecordOptions.autoRecordMode = value
  },
})

const stopRecordingOnDisarm = computed({
  get: () => videoStore.momentaryAutoRecordOptions.stopRecordingOnDisarm ?? false,
  set: (value: boolean) => {
    videoStore.momentaryAutoRecordOptions.stopRecordingOnDisarm = value
  },
})

const showReminder = computed({
  get: () => videoStore.momentaryAutoRecordOptions.showReminder ?? true,
  set: (value: boolean) => {
    videoStore.momentaryAutoRecordOptions.showReminder = value
  },
})

const reminderDelay = computed({
  get: () => videoStore.momentaryAutoRecordOptions.reminderDelay ?? 1,
  set: (value: number) => {
    videoStore.momentaryAutoRecordOptions.reminderDelay = value
  },
})

const selectedStreams = computed<VideoStreamCorrespondency[]>({
  get: () => videoStore.momentaryAutoRecordOptions.selectedStreams || [],
  set: (value: VideoStreamCorrespondency[]) => {
    videoStore.momentaryAutoRecordOptions.selectedStreams = value
  },
})

const availableStreams = computed(() => videoStore.streamsCorrespondency)

const removeSelectedStream = (index: number): void => {
  const updated = [...selectedStreams.value]
  updated.splice(index, 1)
  selectedStreams.value = updated
}

const handleComboBoxUpdate = (): void => {
  if (selectedStreams.value.length > 0) {
    autoRecordMode.value = 'selected'
    showReminder.value = false
  }
}

const handleCloseModal = (): void => {
  if (rememberChoice.value) {
    Object.assign(videoStore.persistentAutoRecordOptions, videoStore.momentaryAutoRecordOptions)
  }
  visible.value = false
  emit('close')
}

watch(autoRecordMode, (value) => {
  if (value === 'none') {
    showReminder.value = true
  } else if (value === 'all') {
    showReminder.value = false
  }
})
</script>
