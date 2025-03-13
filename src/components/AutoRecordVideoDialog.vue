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
          <v-radio class="mb-2" label="Start recording all streams when vehicle is armed" value="all"></v-radio>
          <div>
            <v-radio class="mb-2" label="Auto start recording only the following streams:" value="selected"></v-radio>
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
                @update:model-value="
                  (val) => {
                    if (val.length > 0) autoRecordOption = 'selected'
                    if (val.length === 0) autoRecordOption = 'none'
                  }
                "
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
          <v-radio class="mb-2" label="Do not record streams when vehicle is armed" value="none"></v-radio>
        </v-radio-group>
        <v-checkbox v-model="rememberChoice" label="Remember my choice" class="mt-4 -mb-8"></v-checkbox>
      </v-card-text>
    </template>
    <template #actions>
      <v-btn color="#FFFFFF" class="my-1" @click="handleCloseModal">{{
        rememberChoice ? 'Save and apply' : 'Apply'
      }}</v-btn>
    </template>
  </InteractionDialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useVideoStore } from '@/stores/video'
import { AutoRecordVideoStreams, VideoStreamCorrespondency } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'
const videoStore = useVideoStore()

const emit = defineEmits(['close'])

const visible = ref(false)
const cockpitAutoRecordStreams = useBlueOsStorage<AutoRecordVideoStreams>('cockpit-auto-record-streams', {
  autoRecordOption: 'none',
  selectedStreams: [],
})
const autoRecordOption = ref<'none' | 'all' | 'selected'>(cockpitAutoRecordStreams.value.autoRecordOption || 'none')
const selectedStreams = ref<VideoStreamCorrespondency[]>(cockpitAutoRecordStreams.value.selectedStreams || [])
const availableStreams = computed(() => videoStore.streamsCorrespondency)
const rememberChoice = ref(true)

const handleCloseModal = (): void => {
  if (rememberChoice.value) {
    cockpitAutoRecordStreams.value = {
      autoRecordOption: autoRecordOption.value,
      selectedStreams: selectedStreams.value,
    }
  }
  videoStore.currentAutoRecordOptions = {
    autoRecordOption: autoRecordOption.value,
    selectedStreams: selectedStreams.value,
  }
  visible.value = false
  emit('close')
}
</script>
