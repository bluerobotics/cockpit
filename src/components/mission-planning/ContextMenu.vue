<template>
  <div
    v-if="visible"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
    class="context-menu absolute flex justify-center items-center z-[1000] text-white rounded-lg w-auto h-auto"
  >
    <div v-if="menuType === 'survey'" class="relative orbit-container">
      <div class="central-element flex justify-start items-start">
        <ScanDirectionDial
          :angle="angle"
          auto-update
          :polygon-state="false"
          @survey-lines-angle="onSurveyLinesAngleChange"
          @regenerate-survey-waypoints="onRegenerateSurveyWaypoints"
        />
      </div>

      <div id="button-1" class="orbit-button orbit-button-1">
        <v-tooltip :text="'Create survey'">
          <template #activator="{ props: tooltipProps0 }">
            <v-btn
              v-bind="tooltipProps0"
              :style="[interfaceStore.globalGlassMenuStyles, { backgroundColor: '#333333EE' }]"
              variant="elevated"
              icon="mdi-transit-connection-variant"
              rounded="full"
              size="x-small"
              color="#FFFFFF22"
              class="text-[12px] rotate-[145deg]"
              @click="handleToggleSurvey"
            >
            </v-btn>
          </template>
        </v-tooltip>
      </div>

      <div id="button-2" class="orbit-button orbit-button-2">
        <v-tooltip :text="'Add simple path'">
          <template #activator="{ props: tooltipProps1 }">
            <v-btn
              v-bind="tooltipProps1"
              :style="[interfaceStore.globalGlassMenuStyles, { backgroundColor: '#333333EE' }]"
              variant="elevated"
              icon="mdi-vector-polyline"
              rounded="full"
              size="x-small"
              color="#FFFFFF22"
              class="text-[13px] rotate-[170deg]"
              @click="handleToggleSimplePath"
            ></v-btn>
          </template>
        </v-tooltip>
      </div>
      <div v-if="enableUndo" id="button-3" class="orbit-button orbit-button-3">
        <v-tooltip text="Edit survey's polygon">
          <template #activator="{ props: tooltipProps2 }">
            <v-btn
              v-bind="tooltipProps2"
              variant="elevated"
              icon="mdi-pencil"
              :style="{ backgroundColor: '#333333EE' }"
              rounded="full"
              :disabled="undoIsInProgress"
              size="x-small"
              color="#FFFFFF22"
              class="text-[13px] rotate-[220deg]"
              @click="handleUndoGenerateWaypoints"
            ></v-btn>
          </template>
        </v-tooltip>
      </div>
      <v-tooltip text="Delete survey">
        <template #activator="{ props: tooltipProps3 }">
          <div
            v-bind="tooltipProps3"
            class="absolute text-[14px] mt-[10px] ml-[85px] bg-transparent rounded-full cursor-pointer elevation-4"
            variant="text"
            @click="handleDeleteSelectedSurvey"
          >
            <v-icon color="white" class="border-2 rounded-full bg-red">mdi-close</v-icon>
          </div>
        </template>
      </v-tooltip>
    </div>
    <div v-if="menuType === 'map'" class="flex bg-transparent">
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
        <v-list-item class="flex items-center gap-x-2 pb-2" @click="handleToggleSimplePath">
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
        <v-divider />
        <v-list-item class="flex items-center gap-x-2 pb-2" @click="handlePlacePointOfInterest">
          <v-icon
            variant="text"
            icon="mdi-map-marker-plus"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[16px]"
          ></v-icon>
          <span class="text-white text-sm ml-4">Place point of interest</span>
        </v-list-item>
        <v-divider />
        <v-list-item class="flex items-center gap-x-2 pb-2" @click="handleSetHomePosition">
          <v-icon
            variant="text"
            icon="mdi-home-map-marker"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[16px]"
          ></v-icon>
          <span class="text-white text-sm ml-4">Set home waypoint</span>
        </v-list-item>
      </div>
    </div>

    <div
      v-if="menuType === 'waypoint'"
      class="flex flex-col rounded-md w-[221px]"
      :style="[interfaceStore.globalGlassMenuStyles, { background: '#333333EE', border: '1px solid #FFFFFF44' }]"
    >
      <div class="flex justify-between items-center pt-1 pb-2 px-2">
        <p class="text-[14px]">Waypoint {{ missionStore.getWaypointNumber(selectedWaypoint?.id as string) }}</p>
        <div>
          <v-icon
            v-tooltip="'Set home waypoint'"
            variant="text"
            icon="mdi-home-map-marker"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[18px] mr-3"
            @click="handleSetHomePosition"
          ></v-icon>
          <v-icon
            v-tooltip="'Delete waypoint'"
            variant="text"
            icon="mdi-trash-can"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[16px] mr-3"
            @click="handleRemoveWaypoint"
          ></v-icon>
          <v-icon
            v-tooltip="'Edit waypoint'"
            :disabled="interfaceStore.isConfigPanelVisible"
            variant="text"
            icon="mdi-pencil"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[16px] mr-[2px]"
            :class="{ 'opacity-15': interfaceStore.isConfigPanelVisible }"
            @click="handleOpenPanel"
          ></v-icon>
        </div>
      </div>

      <v-divider />

      <div
        class="flex flex-col justify-center w-full items-center py-1 px-2 bg-[#EEEEEE] text-black rounded-bl-md rounded-br-md"
      >
        <div class="flex w-full gap-x-4 justify-between text-[10px] py-[1px] text-center mb-[2px]">
          <p>Lat.:</p>
          <p>{{ waypointOnMissionStore?.coordinates[0].toFixed(7) }}</p>
        </div>
        <v-divider class="border-black w-full" />
        <div class="flex w-full gap-x-4 justify-between text-[10px] py-[1px] text-center">
          <p>Long.:</p>
          <p>{{ waypointOnMissionStore?.coordinates[1].toFixed(7) }}</p>
        </div>
        <v-divider class="border-black w-full" />
        <div class="flex w-full gap-x-4 justify-between text-[10px] py-[1px] text-center">
          <p>Altitude:</p>
          <p>{{ waypointOnMissionStore?.altitude }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue'

import ScanDirectionDial from '@/components/mission-planning/ScanDirectionDial.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { ContextMenuTypes, Survey, Waypoint } from '@/types/mission'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

/* eslint-disable jsdoc/require-jsdoc */
const props = defineProps<{
  visible: boolean
  position: {
    x: number
    y: number
  }
  surveys: Survey[]
  selectedSurveyId: string | null
  isCreatingSurvey: boolean
  isCreatingSimplePath: boolean
  undoIsInProgress: boolean
  enableUndo: boolean
  selectedWaypoint: Waypoint | undefined
  menuType: ContextMenuTypes
}>()
/* eslint-enable jsdoc/require-jsdoc */

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'toggleSurvey'): void
  (event: 'toggleSimplePath'): void
  (event: 'deleteSelectedSurvey'): void
  (event: 'undoGeneratedWaypoints'): void
  (event: 'surveyLinesAngle', angle: number): void
  (event: 'regenerateSurveyWaypoints', angle: number): void
  (event: 'removeWaypoint'): void
  (event: 'placePointOfInterest'): void
  (event: 'setHomePosition'): void
}>()

const menuType = computed(() => props.menuType)
const selectedWaypoint = computed<Waypoint | undefined>(() => props.selectedWaypoint)
const visible = computed(() => props.visible)
const angle = computed(() => props.surveys.find((survey) => survey.id === props.selectedSurveyId)?.surveyLinesAngle)

const waypointOnMissionStore = computed(() =>
  missionStore.currentPlanningWaypoints.find((waypoint) => waypoint.id === selectedWaypoint.value?.id)
)

const surveyCreationButtonText = computed(() => {
  if (props.isCreatingSurvey) {
    return 'Close survey creation'
  }
  if (props.surveys.length === 0) {
    return 'Create survey'
  }
  return 'Add survey'
})

const pathCreationButtonText = computed(() => {
  if (props.isCreatingSimplePath) {
    return 'Close simple path creation'
  }
  if (props.surveys.length === 0) {
    return 'Create simple path'
  }
  return 'Add simple path'
})

const handleClose = (): void => {
  emit('close')
}

const handleToggleSurvey = (): void => {
  emit('toggleSurvey')
  emit('close')
}

const handleToggleSimplePath = (): void => {
  emit('toggleSimplePath')
  emit('close')
}

const handlePlacePointOfInterest = (): void => {
  emit('placePointOfInterest')
  emit('close')
}

const handleUndoGenerateWaypoints = (): void => {
  emit('undoGeneratedWaypoints')
}

const handleDeleteSelectedSurvey = (): void => {
  emit('deleteSelectedSurvey')
}

const handleRemoveWaypoint = (): void => {
  emit('removeWaypoint')
}

const handleSetHomePosition = (): void => {
  emit('setHomePosition')
  emit('close')
}

const onRegenerateSurveyWaypoints = (newAngle: number): void => {
  emit('regenerateSurveyWaypoints', newAngle)
}

const onSurveyLinesAngleChange = (newAngle: number): void => {
  emit('surveyLinesAngle', newAngle)
}

const handleOpenPanel = (): void => {
  interfaceStore.configPanelVisible = true
  handleClose()
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

.orbit-button-1 {
  animation: orbit-1 0.05s ease-out forwards;
}

.orbit-button-2 {
  animation: orbit-2 0.05s ease-out forwards;
  animation-delay: 0.05s;
}

.orbit-button-3 {
  animation: orbit-3 0.05s ease-out forwards;
  animation-delay: 0.05s;
}

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
