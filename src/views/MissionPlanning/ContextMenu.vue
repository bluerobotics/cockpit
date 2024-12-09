<template>
  <div
    v-if="visible"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
    class="context-menu absolute flex justify-center items-center z-[1000] text-white rounded-lg w-auto h-auto"
  >
    <div v-if="selectedSurveyId" class="relative orbit-container">
      <div class="central-element flex justify-start items-start">
        <WindDirectionDial :angle="angle" auto-update :polygon-state="false" />
      </div>

      <div id="button-1" class="orbit-button orbit-button-1">
        <v-btn
          v-tooltip="
            missionStore.surveys.length === 0 && missionStore.currentPlanningWaypoints.length === 0
              ? 'Create survey'
              : 'Add survey'
          "
          :style="[
            interfaceStore.globalGlassMenuStyles,
            {
              borderColor: isCreatingSurvey ? '#FFFF0022' : interfaceStore.globalGlassMenuStyles.backgroundColor,
              backgroundColor: '#333333EE',
            },
          ]"
          variant="elevated"
          icon="mdi-transit-connection-variant"
          rounded="full"
          size="x-small"
          color="#FFFFFF22"
          class="text-[12px] rotate-[145deg]"
          @click="toggleSurvey"
        ></v-btn>
      </div>

      <div id="button-2" class="orbit-button orbit-button-2">
        <v-btn
          v-tooltip="
            missionStore.surveys.length === 0 && missionStore.currentPlanningWaypoints.length === 0
              ? 'Create simple path'
              : 'Add simple path'
          "
          :style="[
            interfaceStore.globalGlassMenuStyles,
            {
              borderColor: isCreatingSimpleMission ? '#FFFF0022' : interfaceStore.globalGlassMenuStyles.backgroundColor,
              backgroundColor: '#333333EE',
            },
          ]"
          variant="elevated"
          icon="mdi-vector-polyline"
          rounded="full"
          size="x-small"
          color="#FFFFFF22"
          class="text-[13px] rotate-[170deg]"
          @click="toggleSimpleMission"
        ></v-btn>
      </div>
      <div v-if="missionStore.surveys.length === 1" id="button-3" class="orbit-button orbit-button-3">
        <v-btn
          v-tooltip="`Edit survey's polygon`"
          variant="elevated"
          icon="mdi-pencil"
          :style="{ backgroundColor: '#333333EE' }"
          rounded="full"
          :disabled="undoIsInProgress"
          size="x-small"
          color="#FFFFFF22"
          class="text-[13px] rotate-[220deg]"
          @click="undoGenerateWaypoints"
        ></v-btn>
      </div>
      <div
        v-tooltip="'Delete survey'"
        class="absolute text-[14px] mt-[10px] ml-[85px] bg-transparent rounded-full cursor-pointer elevation-4"
        variant="text"
        @click="deleteSelectedSurvey"
      >
        <v-icon color="white" class="border-2 rounded-full bg-red">mdi-close</v-icon>
      </div>
    </div>
    <div
      v-else
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
        <span class="text-white text-sm ml-4">{{
          isCreatingSurvey
            ? 'Close survey creation'
            : missionStore.surveys.length === 0
            ? 'Create survey'
            : 'Add survey'
        }}</span>
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
        <span class="text-white text-sm ml-4">{{
          isCreatingSimpleMission
            ? 'Close simple path creation'
            : missionStore.surveys.length === 0
            ? 'Create simple path'
            : 'Add simple path'
        }}</span>
      </v-list-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineEmits, defineProps, inject } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

import WindDirectionDial from './ScanDirectionDial.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

/* eslint-disable jsdoc/require-jsdoc */
const props = defineProps<{
  visible: boolean
  position: {
    x: number
    y: number
  }
  selectedSurveyId: string | undefined
}>()
/* eslint-enable jsdoc/require-jsdoc */

const emit = defineEmits(['close'])

const toggleSurvey = inject<() => void>('toggleSurvey')
const toggleSimpleMission = inject<() => void>('toggleSimpleMission')
const isCreatingSimpleMission = inject<boolean>('isCreatingSimpleMission')
const isCreatingSurvey = inject<boolean>('isCreatingSurvey')
const undoIsInProgress = inject<boolean>('undoIsInProgress')
const undoGenerateWaypoints = inject<() => void>('undoGenerateWaypoints')
const deleteSelectedSurvey = inject<() => void>('deleteSelectedSurvey')

const angle = computed(
  () => missionStore.surveys.find((survey) => survey.id === props.selectedSurveyId)?.surveyLinesAngle
)

const handleToggleSurvey = (): void => {
  toggleSurvey && toggleSurvey()
  emit('close')
}

const handleToggleSimpleMission = (): void => {
  toggleSimpleMission && toggleSimpleMission()
  emit('close')
}
</script>

<style scoped>
.context-menu {
  transform-origin: center;
  opacity: 0;
  animation: bloom 0.3s ease-out forwards;
}

@keyframes bloom {
  0% {
    transform: scale(0.15);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.orbit-container {
  position: relative;
  width: 80px;
  height: 80px;
}

.central-element {
  position: relative;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.orbit-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center;
  opacity: 0;
}

/* Orbit animations for buttons */
.orbit-button-1 {
  animation: orbit-1 0.5s ease-out forwards;
}

.orbit-button-2 {
  animation: orbit-2 0.4s ease-out forwards;
  animation-delay: 0.2s;
}

.orbit-button-3 {
  animation: orbit-3 0.3s ease-out forwards;
  animation-delay: 0.4s;
}

/* Keyframe animations */
@keyframes orbit-1 {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) translateX(0);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-500deg) translateX(90px);
    opacity: 1;
  }
}

@keyframes orbit-2 {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) translateX(0);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-541deg) translateX(90px);
    opacity: 1;
  }
}

@keyframes orbit-3 {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) translateX(0);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-580deg) translateX(90px);
    opacity: 1;
  }
}
</style>
