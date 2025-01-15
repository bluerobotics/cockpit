<template>
  <div
    v-if="visible"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
    class="context-menu absolute flex justify-center items-center z-[1000] text-white rounded-lg w-auto h-auto"
  >
    <div
      class="flex flex-col rounded-md"
      :style="[interfaceStore.globalGlassMenuStyles, { background: '#333333EE', border: '1px solid #FFFFFF44' }]"
    >
      <v-list-item class="flex items-center gap-x-2 pb-2" @click="handleToggleSurvey">
        <v-icon
          variant="text"
          icon="mdi-transit-connection-variant"
          rounded="full"
          size="x-small"
          color="white"
          class="text-[16px]"
        ></v-icon>
        <span class="text-white text-sm ml-4">{{ surveyCreationButtonText }}</span>
      </v-list-item>
      <v-divider />
      <v-list-item class="flex items-center gap-x-2 pb-2" @click="handleToggleSimpleMission">
        <v-icon
          variant="text"
          icon="mdi-vector-polyline"
          rounded="full"
          size="x-small"
          color="white"
          class="text-[16px]"
        ></v-icon>
        <span class="text-white text-sm ml-4">{{ pathCreationButtonText }}</span>
      </v-list-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

/* eslint-disable jsdoc/require-jsdoc */
const props = defineProps<{
  visible: boolean
  position: {
    x: number
    y: number
  }
  isCreatingSurvey: boolean
  isCreatingSimpleMission: boolean
}>()
/* eslint-enable jsdoc/require-jsdoc */

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'toggleSurvey'): void
  (event: 'toggleSimpleMission'): void
}>()

const surveyCreationButtonText = computed(() => {
  if (props.isCreatingSurvey) {
    return 'Close survey creation'
  }
  if (missionStore.currentPlanningWaypoints.length > 0) {
    return 'Create survey'
  }
  return 'Add survey'
})

const pathCreationButtonText = computed(() => {
  if (props.isCreatingSimpleMission) {
    return 'Close simple path creation'
  }
  if (missionStore.currentPlanningWaypoints.length > 0) {
    return 'Create simple path'
  }
  return 'Add simple path'
})

const handleToggleSurvey = (): void => {
  emit('toggleSurvey')
  emit('close')
}

const handleToggleSimpleMission = (): void => {
  emit('toggleSimpleMission')
  emit('close')
}
</script>

<style scoped>
.context-menu {
  transform-origin: center;
  animation: bloom 0.3s ease-out forwards;
}
</style>
