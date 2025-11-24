<template>
  <div class="mission-planning">
    <div id="planningMap" ref="planningMap" class="relative" />
    <v-tooltip location="top" text="Generate waypoints">
      <template #activator="{ props }">
        <div
          v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute text-[22px] bg-transparent rounded-full cursor-pointer elevation-4"
          variant="text"
          @click="generateWaypointsFromSurvey"
        >
          <v-icon color="green" class="border-2 rounded-full bg-white">mdi-check-circle</v-icon>
        </div>
      </template>
    </v-tooltip>
    <v-tooltip location="top" text="Scan spacing">
      <template #activator="{ props }">
        <div
          v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[73px] ml-[10px] rounded-lg elevation-4"
          variant="text"
        >
          <input
            v-model.number="distanceBetweenSurveyLines"
            class="rounded-lg bg-[#333333EE] text-white w-12 pl-2 pa-0"
            type="number"
            min="1"
          />
        </div>
      </template>
    </v-tooltip>
    <v-tooltip location="top" text="Clear survey">
      <template #activator="{ props }">
        <div
          v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute text-[14px] mt-[130px] ml-[3px] bg-transparent rounded-full cursor-pointer elevation-4"
          variant="text"
          @click="clearSurveyCreation"
        >
          <v-icon color="white" class="border-2 rounded-full bg-red">mdi-close</v-icon>
        </div>
      </template>
    </v-tooltip>
    <div
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      :style="confirmButtonStyle"
      class="absolute central-element flex justify-start items-start mt-12 -ml-[80px]"
    >
      <ScanDirectionDial
        v-model:angle="surveyLinesAngle"
        polygon-state
        @survey-lines-angle="onSurveyLinesAngleChange"
        @regenerate-survey-waypoints="regenerateSurveyWaypoints"
      />
    </div>
    <div
      v-show="!interfaceStore.isMainMenuVisible"
      class="absolute flex flex-col left-10 rounded-[10px] max-h-[80vh] overflow-y-auto z-[200]"
      :style="[interfaceStore.globalGlassMenuStyles, { height: 'auto', maxHeight: calculatedHeight, width: '270px' }]"
    >
      <div class="flex flex-col w-full h-full p-2 overflow-y-auto">
        <button
          v-if="!isCreatingSimplePath && !isCreatingSurvey"
          :class="{ ' elevation-4': isCreatingSurvey }"
          class="h-auto py-2 px-2 m-2 font-medium text-md rounded-md elevation-1 bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          @click="toggleSurvey"
        >
          {{ missionStore.currentPlanningWaypoints.length > 0 ? 'ADD SURVEY' : 'CREATE SURVEY' }}
        </button>
        <button
          v-if="!isCreatingSurvey && !isCreatingSimplePath"
          :class="{ ' elevation-4': isCreatingSimplePath }"
          class="h-auto py-2 px-2 m-2 font-medium text-md rounded-md elevation-1 bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          @click="toggleSimplePath"
        >
          {{ missionStore.currentPlanningWaypoints.length > 0 ? 'ADD SIMPLE PATH' : 'CREATE SIMPLE PATH' }}
        </button>
        <div
          v-if="!isCreatingSurvey && !isCreatingSimplePath"
          class="flex flex-row justify-between items-center mx-4 my-1"
        >
          <p class="text-sm">Cruise speed</p>
          <input
            v-model="missionStore.defaultCruiseSpeed"
            class="w-[60px] px-2 py-1 rounded-sm bg-[#FFFFFF22]"
            type="number"
          />
          <p class="text-sm">m/s</p>
        </div>
        <div
          v-if="showMissionCreationTips && !isCreatingSurvey && !isCreatingSimplePath"
          class="flex flex-col px-4 py-3 gap-y-2 ma-2 rounded-md select-none border-[1px] border-[#FFFFFF22] bg-[#00000022]"
        >
          <div class="flex justify-between my-[1px]">
            <p class="self-center text-sm font-bold -mt-1 text-start">New mission checklist</p>
            <v-icon class="text-sm -mr-[5px] cursor-pointer -mt-[1px]" @click="showMissionCreationTips = false"
              >mdi-close</v-icon
            >
          </div>
          <v-divider />
          <div class="text-sm flex justify-start items-center mt-1">
            <v-icon v-if="home === undefined" class="text-sm mr-4 text-red-500">mdi-close-circle</v-icon>
            <v-icon v-else class="text-sm mr-4 text-green-500">mdi-check-circle</v-icon>
            <p :class="{ 'cursor-pointer hover:underline': home === undefined }" @click="handleAddHomeWaypointByClick">
              Set home waypoint
            </p>
          </div>
          <div class="text-sm flex justify-start items-center">
            <v-icon v-if="missionStore.currentPlanningWaypoints.length === 0" class="text-sm mr-4 text-red-500"
              >mdi-close-circle</v-icon
            >
            <v-icon v-else class="text-sm mr-4 text-green-500">mdi-check-circle</v-icon>
            <p
              :class="{ 'cursor-pointer hover:underline': missionStore.currentPlanningWaypoints.length === 0 }"
              @click="missionStore.currentPlanningWaypoints.length === 0 ? toggleSimplePath() : undefined"
            >
              Create mission path
            </p>
          </div>
          <div class="text-sm flex justify-start items-center">
            <v-icon v-if="!hasUploadedMission" class="text-sm mr-4 text-red-500">mdi-close-circle</v-icon>
            <v-icon v-else class="text-sm mr-4 text-green-500">mdi-check-circle</v-icon>
            <p
              :class="{ 'cursor-pointer hover:underline': !hasUploadedMission }"
              @click="!hasUploadedMission ? uploadMissionToVehicle() : undefined"
            >
              Upload to the vehicle
            </p>
          </div>
        </div>
        <div
          v-if="countdownToHideTips !== undefined"
          class="flex flex-row justify-between px-3 py-1 my-2 mx-6 rounded-md select-none border-[1px] border-[#FFFFFF22] bg-[#ffad4322] cursor-pointer opacity-60 elevation-4"
          @click="handleDoNotShowTipsAgain"
        >
          <p class="text-sm">Don't show again</p>
          <p class="text-sm">{{ countdownToHideTips }}</p>
        </div>
        <div
          v-if="home === undefined && !isSettingHomeWaypoint"
          class="flex justify-end ma-2"
          @click="handleAddHomeWaypointByClick"
          @dragstart="handleAddHomeWaypointByClick"
        >
          <p
            class="text-sm flex justify-start items-center bg-[#1e498f] rounded-full pl-3 pr-1 py-1 border-[1px] border-[#FFFFFF44] elevation-2 cursor-pointer"
          >
            <span>Set home waypoint</span>
            <v-icon class="text-md ml-2">mdi-home-circle</v-icon>
          </p>
        </div>
        <v-divider v-if="!isCreatingSimplePath" class="my-2" />
        <div v-if="isCreatingSurvey" class="flex flex-col">
          <p class="m-1 overflow-visible text-sm text-slate-200">Distance between lines (m)</p>
          <input
            v-model.number="distanceBetweenSurveyLines"
            class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
            min="1"
          />
          <p class="m-1 overflow-visible text-sm text-slate-200">Lines angle (degrees)</p>
          <input
            v-model.number="surveyLinesAngleDisplay"
            class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
            min="0"
            max="359"
          />
          <button
            :class="{
              'bg-[#FFFFFF11] hover:bg-[#FFFFFF11] text-[#FFFFFF22] elevation-0':
                surveyPolygonVertexesMarkers.length < 3,
            }"
            class="h-auto py-2 px-2 m-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
            @click="generateWaypointsFromSurvey"
          >
            GENERATE WAYPOINTS
          </button>
          <div class="flex w-full justify-end">
            <v-btn
              :disabled="surveyPolygonVertexesMarkers.length < 1"
              variant="text"
              class="h-auto my-1 font-medium text-xs rounded-md transition-colors duration-200"
              @click="clearSurveyPath"
            >
              Clear Path
            </v-btn>
          </div>
          <button
            v-if="isCreatingSurvey"
            :class="{ ' elevation-4': isCreatingSurvey }"
            class="h-auto py-2 px-2 m-2 font-medium text-md rounded-md elevation-1 bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
            @click="toggleSurvey"
          >
            Cancel Survey
          </button>
        </div>
        <v-divider v-if="isCreatingSurvey" class="my-2" />
        <div v-if="isCreatingSimplePath" class="flex flex-col w-full h-full p-2">
          <p class="overflow-visible my-1 text-sm text-slate-200">Altitude (m)</p>
          <input v-model="currentWaypointAltitude" class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]" />
          <p class="overflow-visible mt-2 text-sm text-slate-200">Altitude type:</p>
          <select
            v-model="currentWaypointAltitudeRefType"
            class="h-auto py-2 px-2 my-2 mx-5 font-medium text-sm rounded-sm bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          >
            <option :value="AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL" class="bg-[#00000099]">
              {{ AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL }}
            </option>
            <option :value="AltitudeReferenceType.RELATIVE_TO_HOME" class="bg-[#00000099]">
              {{ AltitudeReferenceType.RELATIVE_TO_HOME }}
            </option>
            <option :value="AltitudeReferenceType.RELATIVE_TO_TERRAIN" class="bg-[#00000099]">
              {{ AltitudeReferenceType.RELATIVE_TO_TERRAIN }}
            </option>
          </select>
          <v-divider class="my-2" />
          <button
            :disabled="missionStore.currentPlanningWaypoints.length < 2"
            class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
            :class="{ 'bg-[#FFFFFF11] text-[#FFFFFF22]': missionStore.currentPlanningWaypoints.length < 2 }"
            @click="toggleSimplePath"
          >
            END SIMPLE PATH
          </button>
        </div>

        <div>
          <div class="flex w-full justify-between mt-2 mb-2">
            <v-tooltip
              location="top"
              :text="isMissionEstimatesVisible ? 'Hide mission estimates' : 'Show mission estimates'"
            >
              <template v-if="missionStore.currentPlanningWaypoints.length > 0" #activator="{ props }">
                <v-btn
                  v-model="isMissionEstimatesVisible"
                  v-bind="props"
                  icon="mdi-chart-bar-stacked"
                  variant="text"
                  size="24"
                  class="text-[12px] mx-3 mt-[2px] mb-[1px]"
                  @click="toggleMissionEstimates"
                />
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Save mission to file">
              <template v-if="missionStore.currentPlanningWaypoints.length > 0" #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-content-save"
                  variant="text"
                  size="24"
                  class="text-[12px] mx-3 mt-[2px] mb-[1px]"
                  @click="saveMissionToFile"
                />
              </template>
            </v-tooltip>
            <v-divider v-if="missionStore.currentPlanningWaypoints.length > 0" vertical />
            <v-tooltip location="top" text="Load mission from file">
              <template #activator="{ props }">
                <label v-bind="props">
                  <input type="file" accept=".cmp" hidden @change="(e) => loadMissionFromFile(e)" />
                  <v-icon class="text-[16px] cursor-pointer mx-3 mt-[1px]">mdi-folder-open</v-icon>
                </label>
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Clear mission on vehicle">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  variant="text"
                  size="24"
                  class="text-[12px] mx-3 mt-[2px] mb-[1px]"
                  @click="clearMissionOnVehicle"
                />
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Mission Settings">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-cog"
                  variant="text"
                  size="24"
                  class="text-[12px] mx-3 mt-[2px] mb-[1px]"
                  @click="handleOpenMissionSettings"
                />
              </template>
            </v-tooltip>
          </div>
        </div>
        <v-divider v-if="isCreatingSimplePath || isCreatingSurvey" class="my-2" />
        <button
          v-if="isCreatingSimplePath || isCreatingSurvey || missionStore.currentPlanningWaypoints.length > 0"
          :disabled="missionStore.currentPlanningWaypoints.length < 2"
          :class="{
            'bg-[#FFFFFF11] hover:bg-[#FFFFFF11] text-[#FFFFFF22] elevation-0':
              missionStore.currentPlanningWaypoints.length < 2,
          }"
          class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
          @click="uploadMissionToVehicle"
        >
          UPLOAD MISSION TO VEHICLE
        </button>
        <button
          v-if="missionStore.currentPlanningWaypoints.length > 0"
          :disabled="loading"
          class="h-auto py-1 px-1 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
          @click="openCLearMissionDialog"
        >
          <v-progress-circular v-if="loading" size="20" class="py-4" />
          <p v-else>CLEAR CURRENT MISSION</p>
        </button>
        <button
          :disabled="loading"
          class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
          @click="downloadMissionFromVehicle"
        >
          <v-progress-circular v-if="loading" size="20" class="py-4" />
          <p v-else>DOWNLOAD MISSION FROM VEHICLE</p>
        </button>
      </div>
    </div>
    <v-tooltip location="top center" text="Download map tiles">
      <template #activator="{ props: tooltipProps }">
        <v-menu v-model="downloadMenuOpen" :close-on-content-click="false" location="top end">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="{ ...menuProps, ...tooltipProps }"
              class="absolute m-3 rounded-sm shadow-sm bottom-12 bg-slate-50 right-[133px] text-[14px]"
              size="x-small"
              icon="mdi-download-multiple"
            />
          </template>

          <v-list :style="interfaceStore.globalGlassMenuStyles" class="py-0 min-w-[220px] rounded-lg border-[1px]">
            <v-list-item class="py-0" title="Save visible Esri tiles" @click="saveEsri" />
            <v-divider />
            <v-list-item class="py-0" title="Save visible OSM tiles" @click="saveOSM" />
          </v-list>
        </v-menu>
      </template>
    </v-tooltip>
    <v-tooltip location="top center" :text="centerHomeButtonTooltipText">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          class="absolute m-3 rounded-sm shadow-sm bottom-12 bg-slate-50 right-[88px] text-[14px]"
          :class="[!home ? 'active-events-on-disabled' : '']"
          :color="followerTarget == WhoToFollow.HOME ? 'red' : ''"
          icon="mdi-home-search"
          size="x-small"
          v-bind="tooltipProps"
          :disabled="!home"
          @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
          @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
        />
      </template>
    </v-tooltip>
    <v-tooltip location="top center" :text="centerVehicleButtonTooltipText">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          class="absolute m-3 rounded-sm shadow-sm bottom-12 bg-slate-50 right-[44px] text-[14px]"
          :class="[!vehiclePosition ? 'active-events-on-disabled' : '']"
          :color="followerTarget == WhoToFollow.VEHICLE ? 'red' : ''"
          icon="mdi-airplane-marker"
          size="x-small"
          v-bind="tooltipProps"
          :disabled="!vehiclePosition"
          @click.stop="targetFollower.goToTarget(WhoToFollow.VEHICLE, true)"
          @dblclick.stop="targetFollower.follow(WhoToFollow.VEHICLE)"
        />
      </template>
    </v-tooltip>
    <v-progress-linear
      v-if="uploadingMission"
      :model-value="missionUploadProgress"
      absolute
      bottom
      height="10"
      color="white"
      :style="`top: ${widgetStore.currentTopBarHeightPixels}px`"
    />
    <p
      v-if="uploadingMission"
      class="fixed top-[58px] left-[7px] flex text-md font-bold text-white z-30 drop-shadow-md"
    >
      Uploading mission to vehicle...
    </p>
  </div>

  <ContextMenu
    :visible="contextMenuVisible"
    :position="contextMenuPosition"
    :is-creating-survey="isCreatingSurvey"
    :is-creating-simple-path="isCreatingSimplePath"
    :surveys="surveys"
    :selected-survey-id="selectedSurveyId"
    :undo-is-in-progress="undoIsInProgress"
    :enable-undo="enableUndoForCurrentSurvey"
    :selected-waypoint="selectedWaypoint"
    :menu-type="contextMenuType"
    @set-home-position="setHomePosition"
    @close="hideContextMenu"
    @delete-selected-survey="deleteSelectedSurvey"
    @toggle-survey="toggleSurvey"
    @toggle-simple-path="toggleSimplePath"
    @undo-generated-waypoints="undoGenerateWaypoints"
    @regenerate-survey-waypoints="regenerateSurveyWaypoints"
    @survey-lines-angle="onSurveyLinesAngleChange"
    @remove-waypoint="removeSelectedWaypoint"
    @place-point-of-interest="openPoiDialog"
    @add-waypoint-at-cursor="addWaypointFromContextMenu"
  />
  <SideConfigPanel position="right" style="z-index: 600; pointer-events: auto" class="w-[320px]">
    <WaypointConfigPanel
      :selected-waypoint="selectedWaypoint"
      @remove-waypoint="removeSelectedWaypoint"
      @should-update-waypoints="handleShouldUpdateWaypoints"
    />
  </SideConfigPanel>
  <HomePositionSettingHelp v-model="showHomePositionNotSetDialog" />
  <PoiManager ref="poiManagerRef" />

  <v-progress-linear
    v-if="fetchingMission"
    :model-value="missionFetchProgress"
    height="10"
    absolute
    bottom
    color="white"
    :style="{ top: '48px' }"
  />
  <p
    v-if="fetchingMission"
    :style="{ top: '48px' }"
    class="absolute left-[7px] mt-4 flex text-md font-bold text-white z-30 drop-shadow-md"
  >
    Loading mission...
  </p>
  <div
    v-if="isSavingOfflineTiles"
    class="absolute top-14 left-2 flex justify-start items-center text-white text-md py-2 px-4 rounded-lg"
    :style="interfaceStore.globalGlassMenuStyles"
  >
    <p>Saving offline map content:&nbsp;{{ tilesTotal ? Math.round((tilesSaved / tilesTotal) * 100) : 0 }}%</p>
  </div>
  <MissionEstimatesPanel v-model="isMissionEstimatesVisible" />
</template>
<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { useWindowSize } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import L, { type LatLngTuple, LeafletMouseEvent, Map, Marker, Polygon } from 'leaflet'
import { SaveStatus, savetiles, tileLayerOffline } from 'leaflet.offline'
import { v4 as uuid } from 'uuid'
import { type InstanceType, computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw, watch } from 'vue'

import blueboatMarkerImage from '@/assets/blueboat-marker.png'
import brov2MarkerImage from '@/assets/brov2-marker.png'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.png'
import ContextMenu from '@/components/mission-planning/ContextMenu.vue'
import HomePositionSettingHelp from '@/components/mission-planning/HomePositionSettingHelp.vue'
import MissionEstimatesPanel from '@/components/mission-planning/MissionEstimates.vue'
import ScanDirectionDial from '@/components/mission-planning/ScanDirectionDial.vue'
import WaypointConfigPanel from '@/components/mission-planning/WaypointConfigPanel.vue'
import PoiManager from '@/components/poi/PoiManager.vue'
import SideConfigPanel from '@/components/SideConfigPanel.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import {
  clearAllSurveyAreas,
  removeSurveyAreaSquareMeters,
  setSurveyAreaSquareMeters,
  useMissionEstimates,
} from '@/composables/useMissionEstimates'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { centroidLatLng, polygonAreaSquareMeters } from '@/libs/mission/general-estimates'
import { degrees } from '@/libs/utils'
import { createGridOverlay, TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { generateSurveyPath } from '@/libs/utils-map'
import router from '@/router'
import { SubMenuComponentName, SubMenuName, useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { DialogActions } from '@/types/general'
import {
  type CockpitMission,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  ClosestSegmentInfo,
  ContextMenuTypes,
  instanceOfCockpitMission,
  MissionCommand,
  MissionCommandType,
  PointOfInterest,
  Survey,
  SurveyPolygon,
} from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const missionEstimates = useMissionEstimates()
const { height: windowHeight } = useWindowSize()

const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()

const clearMissionOnVehicle = (): void => {
  vehicleStore.clearMissions()
}

const calculatedHeight = computed(() => {
  return windowHeight.value - widgetStore.currentBottomBarHeightPixels - widgetStore.currentTopBarHeightPixels - 20
})

const uploadingMission = ref(false)
const missionUploadProgress = ref(0)
const hasUploadedMission = ref(false)

const defaultNavCommandsTemplate: MissionCommand[] = [
  {
    type: MissionCommandType.MAVLINK_NAV_COMMAND,
    command: MavCmd.MAV_CMD_NAV_WAYPOINT,
    param1: 0,
    param2: 5,
    param3: 0,
    param4: 999,
  },
]

const makeDefaultNavCommands = (): MissionCommand[] => defaultNavCommandsTemplate.map((c) => ({ ...c }))

const cloneCommands = (commands?: MissionCommand[]): MissionCommand[] => {
  if (commands && commands.length) {
    return commands.map((command) => ({ ...command }))
  }

  return makeDefaultNavCommands()
}

const uploadMissionToVehicle = async (): Promise<void> => {
  if (!home.value) {
    showHomePositionNotSetDialog.value = true
    return
  }

  uploadingMission.value = true
  missionUploadProgress.value = 0
  const missionItemsToUpload: Waypoint[] = structuredClone(toRaw(missionStore.currentPlanningWaypoints))

  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionUploadProgress.value = loadingPerc
  }

  const homeWaypoint: Waypoint = {
    id: uuid(),
    coordinates: home.value,
    altitude: 0,
    altitudeReferenceType: currentWaypointAltitudeRefType.value,
    commands: makeDefaultNavCommands(),
  }

  missionItemsToUpload.unshift(homeWaypoint)

  if (missionStore.defaultCruiseSpeed !== 1 && missionItemsToUpload.length > 1) {
    const firstMissionItem = missionItemsToUpload[1]
    const existing = Array.isArray(firstMissionItem.commands) ? firstMissionItem.commands : []

    firstMissionItem.commands = [
      ...existing.filter((cmd) => cmd.command !== MavCmd.MAV_CMD_DO_CHANGE_SPEED),
      {
        type: MissionCommandType.MAVLINK_NAV_COMMAND,
        command: MavCmd.MAV_CMD_DO_CHANGE_SPEED,
        param1: 1,
        param2: Number(missionStore.defaultCruiseSpeed),
        param3: -1,
        param4: 0,
      },
    ]
  }

  try {
    if (!vehicleStore.isVehicleOnline) {
      throw 'Vehicle is not online.'
    }
    await vehicleStore.uploadMission(missionItemsToUpload, loadingCallback)
    const message = 'Go to Flight Mode and click the “play” button to start the mission.'

    if (missionStore.alwaysSwitchToFlightMode) {
      router.push('/')
      missionStore.bumpVehicleMissionRevision(missionItemsToUpload)
      missionStore.clearDraft()
      return
    }
    showDialog({
      variant: 'success',
      title: 'Mission upload succeeded',
      message,
      persistent: false,
      timer: undefined,
      maxWidth: '750px',
      actions: [
        { text: 'Close', color: 'white', action: closeDialog },
        {
          text: 'Always switch to Flight Mode',
          color: 'white',
          action: () => {
            missionStore.alwaysSwitchToFlightMode = true
            openSnackbar({
              variant: 'info',
              message:
                'You will be switched to Flight Mode automatically in the future. To change this, go to Mission Planning settings.',
              duration: 5000,
            })
            router.push('/')
          },
        },
        { text: 'Switch to Flight Mode', color: 'white', action: () => router.push('/') },
      ],
    })
    hasUploadedMission.value = true
    missionStore.bumpVehicleMissionRevision(missionItemsToUpload)
    missionStore.clearDraft()
  } catch (error) {
    showDialog({
      variant: 'error',
      title: 'Mission upload failed',
      message: error as string,
      timer: 3000,
      persistent: false,
    })
    hasUploadedMission.value = false
  } finally {
    uploadingMission.value = false
  }
}

// Allow fetching missions
const downloadMissionFromVehicle = async (): Promise<void> => {
  clearCurrentMission()
  loading.value = true
  fetchingMission.value = true

  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionFetchProgress.value = loadingPerc
  }
  try {
    const missionItemsInVehicle = await vehicleStore.fetchMission(loadingCallback)
    missionItemsInVehicle.forEach((wp: Waypoint, index) => {
      if (index === 0) {
        home.value = wp.coordinates
        currentCursorGeoCoordinates.value = wp.coordinates
        setHomePosition()
      }
      if (index > 0) {
        missionStore.currentPlanningWaypoints.push(wp)
        addWaypointMarker(wp)
      }
    })
    reNumberWaypoints()

    openSnackbar({ variant: 'success', message: 'Mission download succeeded!', duration: 3000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: error as string, timer: 5000 })
  } finally {
    loading.value = false
    fetchingMission.value = false
  }
}

const planningMap = shallowRef<Map | undefined>()
const mapCenter = ref<WaypointCoordinates>(missionStore.defaultMapCenter)
const home = ref<WaypointCoordinates | undefined>(undefined)
const zoom = ref(missionStore.defaultMapZoom)
const followerTarget = ref<WhoToFollow | undefined>(undefined)
const currentWaypointAltitude = ref(0)
const currentWaypointAltitudeRefType = ref<AltitudeReferenceType>(AltitudeReferenceType.RELATIVE_TO_HOME)
const waypointMarkers = ref<{ [id: string]: Marker }>({})
const isCreatingSimplePath = ref(false)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const currentCursorGeoCoordinates = ref<[number, number] | null>(null)
const confirmButtonStyle = ref<Record<string, string>>({})
const surveyPolygonVertexesPositions = ref<L.LatLng[]>([])
const isCreatingSurvey = ref(false)
const selectedSurveyId = ref<string>('')
const surveyPolygonLayers = ref<{ [key: string]: Polygon }>({})
const lastSelectedSurveyId = ref('')
const surveys = ref<Survey[]>([])
const canUndo = ref<Record<string, boolean>>({})
const undoIsInProgress = ref(false)
const lastSurveyState = ref<Record<string, SurveyPolygon>>({})
let dragStartLatLng: L.LatLng | null = null
let polygonLatLngsAtDragStart: L.LatLng[] = []
let ignoreNextClick = false
const selectedWaypoint = ref<Waypoint | undefined>(undefined)
const contextMenuType = ref<ContextMenuTypes>('map')
const cursorCoordinates = ref<[number, number] | null>(null)
const accessingSurveyContextMenu = ref(false)
const isDraggingPolygon = ref(false)
const isDraggingMarker = ref(false)
const showHomePositionNotSetDialog = ref(false)
const fetchingMission = ref(false)
const missionFetchProgress = ref(0)
const loading = ref(false)
const showMissionCreationTips = ref(missionStore.showMissionCreationTips)
const countdownToHideTips = ref<number | undefined>(undefined)
const isSettingHomeWaypoint = ref(false)
const isSavingOfflineTiles = ref(false)
const tilesSaved = ref(0)
const tilesTotal = ref(0)
const savingLayerName = ref<string>('')
const downloadMenuOpen = ref(false)
const gridLayer = shallowRef<L.LayerGroup | undefined>(undefined)
let esriSaveBtn: HTMLAnchorElement | undefined
let osmSaveBtn: HTMLAnchorElement | undefined
const nearMissionPathTolerance = 16 // in pixels
const isMissionEstimatesVisible = ref(true)
const measureLayer = shallowRef<L.LayerGroup | null>(null)
let measureOverlayEl: HTMLDivElement | null = null
let measureSvgEl: SVGSVGElement | null = null
let measureLineEl: SVGLineElement | null = null
let measureTextEl: HTMLDivElement | null = null
const surveyAreaMarkers = shallowRef<Record<string, L.Marker>>({})
const liveSurveyAreaMarker = shallowRef<L.Marker | null>(null)

const clearLiveMeasure = (): void => {
  destroyMeasureOverlay(planningMap.value || undefined)
}

const currentMeasureAnchor = (): L.LatLng | null => {
  if (!planningMap.value) return null
  if (isCreatingSimplePath.value && missionStore.currentPlanningWaypoints.length > 0) {
    const last = missionStore.currentPlanningWaypoints[missionStore.currentPlanningWaypoints.length - 1]
    return L.latLng(last.coordinates[0], last.coordinates[1])
  }
  if (isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length > 0) {
    const last = surveyPolygonVertexesPositions.value[surveyPolygonVertexesPositions.value.length - 1]
    return L.latLng(last.lat, last.lng)
  }

  return null
}

const ensureMeasureOverlay = (map: L.Map): void => {
  if (measureOverlayEl) return
  const container = map.getContainer()

  measureOverlayEl = document.createElement('div')
  measureOverlayEl.className = 'measure-overlay'
  measureOverlayEl.style.pointerEvents = 'none'
  measureOverlayEl.style.position = 'absolute'
  measureOverlayEl.style.top = '0'
  measureOverlayEl.style.left = '0'
  measureOverlayEl.style.width = '100%'
  measureOverlayEl.style.height = '100%'
  measureOverlayEl.style.zIndex = '640'

  measureSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  measureSvgEl.setAttribute('width', '100%')
  measureSvgEl.setAttribute('height', '100%')
  measureSvgEl.style.position = 'absolute'
  measureSvgEl.style.top = '0'
  measureSvgEl.style.left = '0'

  measureLineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  measureLineEl.setAttribute('stroke-width', '2')
  measureLineEl.setAttribute('stroke-dasharray', '10,10')
  measureLineEl.setAttribute('opacity', '0.9')
  measureLineEl.setAttribute('stroke', '#2563eb')

  measureSvgEl.appendChild(measureLineEl)

  measureTextEl = document.createElement('div')
  measureTextEl.className = 'live-measure-pill'
  measureTextEl.style.position = 'absolute'
  measureTextEl.style.transform = 'translate(-50%, -50%)'

  measureOverlayEl.appendChild(measureSvgEl)
  measureOverlayEl.appendChild(measureTextEl)
  container.appendChild(measureOverlayEl)
}

const destroyMeasureOverlay = (map?: L.Map): void => {
  if (!measureOverlayEl) return
  if (measureOverlayEl) {
    ;(map?.getContainer() ?? measureOverlayEl.parentElement)?.removeChild(measureOverlayEl)
  }
  measureOverlayEl.remove()
  measureOverlayEl = null
  measureSvgEl = null
  measureLineEl = null
  measureTextEl = null
}

const isOverSurveyHandle = (evt: L.LeafletMouseEvent): boolean => {
  const el = evt.originalEvent?.target as HTMLElement | null
  if (!el) return false
  return !!el.closest('.custom-div-icon, .edge-marker, .delete-popup, .delete-button')
}

const handleMapMouseMove = (e: L.LeafletMouseEvent): void => {
  if (!planningMap.value) return

  const anchor = currentMeasureAnchor()
  const measuring = !!anchor && (isCreatingSimplePath.value || isCreatingSurvey.value)
  if (!measuring) {
    destroyMeasureOverlay(planningMap.value)
    return
  }

  const map = planningMap.value
  ensureMeasureOverlay(map)

  // NEW: hide/show the live pill when hovering survey nodes/add/delete UI
  if (measureTextEl) {
    measureTextEl.style.display = isOverSurveyHandle(e) ? 'none' : 'block'
  }

  const a = map.latLngToContainerPoint(anchor!)
  const b = map.latLngToContainerPoint(e.latlng)

  if (measureLineEl) {
    measureLineEl.setAttribute('x1', String(a.x))
    measureLineEl.setAttribute('y1', String(a.y))
    measureLineEl.setAttribute('x2', String(b.x))
    measureLineEl.setAttribute('y2', String(b.y))
  }

  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const dist = anchor!.distanceTo(e.latlng)

  const hidePill = isOverSurveyHandle(e) || isOverLastWaypointMarker(e) || dist < 1 // hide if closer than 1 meter to last wp on the array

  const text = missionEstimates.formatMetersShort(dist)
  if (measureTextEl) {
    measureTextEl.textContent = text
    measureTextEl.style.left = `${midX}px`
    measureTextEl.style.top = `${midY}px`
    measureTextEl.style.display = hidePill ? 'none' : 'block'
  }
}

const toggleMissionEstimates = (): void => {
  isMissionEstimatesVisible.value = !isMissionEstimatesVisible.value
}

const saveEsri = (): void => {
  esriSaveBtn?.click()
  downloadMenuOpen.value = false
}
const saveOSM = (): void => {
  osmSaveBtn?.click()
  downloadMenuOpen.value = false
}

// Grid overlay functions for mission planning view
const createGridOverlayLocal = (): void => {
  if (!planningMap.value) return

  try {
    gridLayer.value = createGridOverlay(planningMap.value, gridLayer.value as L.LayerGroup)
  } catch (error) {
    console.error('Failed to create grid overlay:', error)
  }
}

const removeGridOverlayLocal = (): void => {
  if (gridLayer.value && planningMap.value) {
    planningMap.value.removeLayer(gridLayer.value as L.LayerGroup)
    gridLayer.value = undefined
  }
}

// Standard Leaflet scale control
const scaleControl = L.control.scale({
  position: 'bottomright',
  metric: true,
  imperial: false,
  maxWidth: 100,
})

const createScaleControl = (): void => {
  if (!planningMap.value) return

  // Remove existing scale control
  removeScaleControl()

  // Add standard Leaflet scale control
  scaleControl.addTo(planningMap.value)
}

const removeScaleControl = (): void => {
  if (planningMap.value) {
    try {
      planningMap.value.removeControl(scaleControl)
    } catch (e) {
      // Control might not be added yet, ignore error
    }
  }
}

// Creates an overlay on the map so elements can be added without interfering with the main map components and events
let mapActionsOverlayEl: HTMLDivElement | null = null
let mapActionsKnobEl: HTMLDivElement | null = null
let mapActionsKnobSegmentIndex: number | null = null
let knobShowTimer: number | null = null
let knobFadeOutTimer: number | null = null
let lastHoverSegmentIndex: number | null = null
let knobPendingShow = false

const isCtrlDown = ref(false)
const isShiftDown = ref(false)
const cursorLivePositionX = ref(0)
const cursorLivePositionY = ref(0)
const cursorSymbol = computed(() => (isCtrlDown.value ? '+' : isShiftDown.value ? '−' : ''))
const showCursorDeco = computed(() => isCtrlDown.value || isShiftDown.value)

let cursorDecoEl: HTMLDivElement | null = null
let setHomeOnFirstClick: ((e: L.LeafletMouseEvent) => void) | null = null

watch(showMissionCreationTips, (newVal) => {
  if (!newVal) {
    countdownToHideTips.value = 10
    const interval = setInterval(() => {
      if (countdownToHideTips.value && countdownToHideTips.value > 0) {
        countdownToHideTips.value--
      }
      if (countdownToHideTips.value === 0) {
        clearInterval(interval)
        countdownToHideTips.value = undefined
      }
    }, 1000)
  }
})

const handleDoNotShowTipsAgain = (): void => {
  countdownToHideTips.value = undefined
  missionStore.showMissionCreationTips = false
  openSnackbar({
    variant: 'info',
    message: 'Mission checklist will not be shown again. You can enable them back in the settings.',
    duration: 5000,
  })
}

const handleAddHomeWaypointByClick = (): void => {
  if (home.value !== undefined) return
  isSettingHomeWaypoint.value = true
  openSnackbar({
    variant: 'info',
    message: 'Click anywhere on the map to set the home position',
    duration: 5000,
  })
}

const handleOpenMissionSettings = (): void => {
  interfaceStore.isMainMenuVisible = true
  interfaceStore.mainMenuCurrentStep = 2
  interfaceStore.currentSubMenuName = SubMenuName.settings
  interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsMission
}

const poiManagerRef = ref<InstanceType<typeof PoiManager> | null>(null)
const planningPoiMarkers = shallowRef<{ [id: string]: L.Marker }>({})

const clearCurrentMission = (): void => {
  missionStore.clearMission()
  Object.values(waypointMarkers.value).forEach((marker) => {
    planningMap.value?.removeLayer(marker)
  })
  waypointMarkers.value = {}
  if (missionWaypointsPolyline.value) {
    planningMap.value?.removeLayer(missionWaypointsPolyline.value)
    missionWaypointsPolyline.value = undefined
  }
  clearSurveyPath()
  surveys.value = []
  selectedSurveyId.value = ''
  lastSelectedSurveyId.value = ''
  canUndo.value = {}
  lastSurveyState.value = {}
  clearLiveMeasure()
  clearAllSurveyAreas()
}

const openCLearMissionDialog = (): void => {
  showDialog({
    message: 'Clear current mission?',
    maxWidth: '400px',
    variant: 'warning',
    persistent: false,
    actions: [
      {
        text: 'Cancel',
        action: () => {
          closeDialog()
        },
      },
      {
        text: 'Clear',
        action: () => {
          clearCurrentMission()
          closeDialog()
          openSnackbar({
            variant: 'success',
            message: 'Current mission cleared',
          })
        },
      },
    ],
  })
}

const enableUndoForCurrentSurvey = computed(() => {
  return (
    surveys.value.length > 0 &&
    selectedSurveyId.value === surveys.value[surveys.value.length - 1].id &&
    canUndo.value[selectedSurveyId.value]
  )
})

const selectedSurvey = computed(() => {
  return surveys.value.find((survey) => survey.id === selectedSurveyId.value)
})

const addSurvey = (survey: Survey): void => {
  surveys.value.push(survey)
}

const updateSurvey = (id: string, updatedSurvey: Partial<Survey>): void => {
  const index = surveys.value.findIndex((s) => s.id === id)
  if (index !== -1) {
    surveys.value[index] = { ...surveys.value[index], ...updatedSurvey }
  }
}

const calculateBottomRightCorner = (points: L.LatLng[]): L.LatLng | null => {
  if (points.length === 0) return null

  let bottomRightWaypoint = points[0]

  points.forEach((point) => {
    if (point.lat <= bottomRightWaypoint.lat && point.lng >= bottomRightWaypoint.lng) {
      bottomRightWaypoint = point
    }
  })

  return bottomRightWaypoint
}

const updateConfirmButtonPosition = (): void => {
  if (!planningMap.value) return

  if (isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length >= 3) {
    const position = calculateBottomRightCorner(surveyPolygonVertexesPositions.value)
    if (position) {
      const point = planningMap.value.latLngToContainerPoint(position)

      confirmButtonStyle.value = {
        left: `${point.x + 62}px`,
        top: `${point.y + 62}px`,
      }
    }
  } else {
    confirmButtonStyle.value = { display: 'none' }
  }
}

const setMapCursor = (): void => {
  const map = planningMap.value as any
  const el: HTMLElement | null = map && typeof map.getContainer === 'function' ? map.getContainer() : null
  if (!el) return

  // when setting home, keep the special cursor
  if (isSettingHomeWaypoint.value) return

  if (isCtrlDown.value || isShiftDown.value) {
    el.style.cursor = 'pointer'
    return
  }
  if (isCreatingSurvey.value || isCreatingSimplePath.value) {
    el.style.cursor = 'crosshair'
  } else {
    el.style.cursor = ''
  }
}

const ensureCursorDeco = (): void => {
  if (!planningMap.value) return
  ensureMapActionsOverlay(planningMap.value)
  if (cursorDecoEl) return

  cursorDecoEl = document.createElement('div')
  cursorDecoEl.style.position = 'absolute'
  cursorDecoEl.style.transform = 'translate(15px, 15px)'
  cursorDecoEl.style.pointerEvents = 'none'
  cursorDecoEl.style.zIndex = '650'
  cursorDecoEl.style.fontSize = '18px'
  cursorDecoEl.style.fontWeight = '700'
  cursorDecoEl.style.color = 'white'
  cursorDecoEl.style.textShadow = '0 0 3px white'
  cursorDecoEl.style.display = 'none'
  mapActionsOverlayEl!.appendChild(cursorDecoEl)
}

const updateCursorDeco = (): void => {
  if (!planningMap.value) return
  ensureCursorDeco()
  if (!cursorDecoEl) return

  if (showCursorDeco.value) {
    cursorDecoEl.textContent = cursorSymbol.value
    cursorDecoEl.style.left = `${cursorLivePositionX.value}px`
    cursorDecoEl.style.top = `${cursorLivePositionY.value}px`
    cursorDecoEl.style.display = 'block'
  } else {
    cursorDecoEl.style.display = 'none'
  }
}

// global key/mouse handlers
const onGlobalKeyDown = (e: KeyboardEvent): void => {
  if (e.ctrlKey || e.metaKey) isCtrlDown.value = true
  if (e.shiftKey) isShiftDown.value = true
  setMapCursor()
  updateCursorDeco()
}
const onGlobalKeyUp = (e: KeyboardEvent): void => {
  if (e.key.toLowerCase() === 'control' || e.key === 'Meta') isCtrlDown.value = e.ctrlKey || e.metaKey
  if (e.key === 'Shift') isShiftDown.value = e.shiftKey
  if (!e.ctrlKey && !e.metaKey) isCtrlDown.value = false
  if (!e.shiftKey) isShiftDown.value = false
  setMapCursor()
  updateCursorDeco()
}
const onWindowBlur = (): void => {
  isCtrlDown.value = false
  isShiftDown.value = false
  setMapCursor()
  updateCursorDeco()
}
const onWindowMouseMove = (e: MouseEvent): void => {
  cursorLivePositionX.value = e.clientX
  cursorLivePositionY.value = e.clientY
  updateCursorDeco()
}

const ensureMapActionsOverlay = (map: L.Map): void => {
  if (mapActionsOverlayEl) return
  const container = map.getContainer()

  const el = document.createElement('div')
  el.className = 'map-actions-overlay'
  el.style.position = 'absolute'
  el.style.top = '0'
  el.style.left = '0'
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.zIndex = '640'
  el.style.pointerEvents = 'none'
  container.appendChild(el)
  mapActionsOverlayEl = el
}

// Controls the "add waypoint" knob that appears when hovering near a mission path segment
const showSegmentAddKnobAt = (midpoint: L.LatLng, segmentIndex: number): void => {
  if (!planningMap.value) return
  ensureMapActionsOverlay(planningMap.value)
  const pt = planningMap.value.latLngToContainerPoint(midpoint)

  if (!mapActionsKnobEl) {
    const knob = document.createElement('div')
    knob.className = 'mission-segment-add-knob'
    knob.style.position = 'absolute'
    knob.style.transform = 'translate(-50%, -50%) scale(0.85)'
    knob.style.opacity = '0'
    knob.style.pointerEvents = 'none'
    knob.style.display = 'none'
    knob.style.cursor = 'pointer'
    knob.style.zIndex = '660'
    knob.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
           xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" fill="white" stroke="#3B82F6" stroke-width="2"/>
        <path d="M10 5V15M5 10H15" stroke="#3B82F6" stroke-width="2"/>
      </svg>
    `
    knob.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (mapActionsKnobSegmentIndex !== null) {
        insertWaypointAtSegmentMidpoint(mapActionsKnobSegmentIndex)
        hideSegmentAddKnob()
      }
    })
    mapActionsOverlayEl!.appendChild(knob)
    mapActionsKnobEl = knob
  }

  mapActionsKnobEl!.style.left = `${pt.x}px`
  mapActionsKnobEl!.style.top = `${pt.y}px`
  const segChanged = lastHoverSegmentIndex !== segmentIndex
  lastHoverSegmentIndex = segmentIndex
  mapActionsKnobSegmentIndex = segmentIndex

  if (knobFadeOutTimer && segChanged) {
    clearTimeout(knobFadeOutTimer)
    knobFadeOutTimer = null
  }
  const isVisible = mapActionsKnobEl!.classList.contains('visible')

  if (isVisible) {
    mapActionsKnobEl!.style.display = 'block'
    mapActionsKnobEl!.style.pointerEvents = 'auto'
    return
  }

  if (!segChanged && knobPendingShow) return

  mapActionsKnobEl!.style.display = 'block'
  mapActionsKnobEl!.style.pointerEvents = 'none'
  mapActionsKnobEl!.classList.remove('visible')

  if (segChanged && knobShowTimer) {
    clearTimeout(knobShowTimer)
    knobShowTimer = null
  }

  knobPendingShow = true
  knobShowTimer = window.setTimeout(() => {
    mapActionsKnobEl!.classList.add('visible')
    mapActionsKnobEl!.style.pointerEvents = 'auto'
    knobPendingShow = false
    knobShowTimer = null
  }, 300)
}

const hideSegmentAddKnob = (): void => {
  if (!mapActionsKnobEl) return

  if (knobShowTimer) {
    clearTimeout(knobShowTimer)
    knobShowTimer = null
  }
  knobPendingShow = false
  lastHoverSegmentIndex = null
  mapActionsKnobEl.classList.remove('visible')
  mapActionsKnobEl.style.pointerEvents = 'none'

  if (knobFadeOutTimer) clearTimeout(knobFadeOutTimer)
  knobFadeOutTimer = window.setTimeout(() => {
    if (!mapActionsKnobEl!.classList.contains('visible')) {
      mapActionsKnobEl!.style.display = 'none'
    }
    knobFadeOutTimer = null
  }, 180)

  mapActionsKnobSegmentIndex = null
}

const getClosestMissionPathSegmentInfo = (segmentLatLngs: L.LatLng[], mouseLatLng: L.LatLng): ClosestSegmentInfo => {
  const map = planningMap.value!
  const mousePoint = map.latLngToLayerPoint(mouseLatLng)
  let bestIndex = -1
  let bestDistance = Infinity
  let bestProjectedPoint: L.Point = mousePoint

  for (let i = 0; i < segmentLatLngs.length - 1; i++) {
    const a = map.latLngToLayerPoint(segmentLatLngs[i])
    const b = map.latLngToLayerPoint(segmentLatLngs[i + 1])
    const projected = (L as any).LineUtil.closestPointOnSegment(mousePoint, a, b)
    const dist = mousePoint.distanceTo(projected)
    if (dist < bestDistance) {
      bestDistance = dist
      bestIndex = i
      bestProjectedPoint = projected
    }
  }
  return { segmentIndex: bestIndex, distanceInPixels: bestDistance, closestPointOnSegment: bestProjectedPoint }
}

const insertWaypointAtSegmentMidpoint = (segmentIndex: number): void => {
  if (!planningMap.value || missionStore.currentPlanningWaypoints.length < 2) return

  const wpLatLngs = missionStore.currentPlanningWaypoints.map((w) => L.latLng(w.coordinates[0], w.coordinates[1]))
  const a = wpLatLngs[segmentIndex]
  const b = wpLatLngs[segmentIndex + 1]
  const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2)

  const prev = missionStore.currentPlanningWaypoints[segmentIndex]
  const newWp: Waypoint = {
    id: uuid(),
    coordinates: [mid.lat, mid.lng],
    altitude: prev.altitude,
    altitudeReferenceType: prev.altitudeReferenceType,
    commands: makeDefaultNavCommands(),
  }

  missionStore.currentPlanningWaypoints.splice(segmentIndex + 1, 0, newWp)
  addWaypointMarker(newWp)
  reNumberWaypoints()
}

const handleMapMouseMoveNearMissionPath = (event: L.LeafletMouseEvent): void => {
  if (!planningMap.value || !missionWaypointsPolyline.value || missionStore.currentPlanningWaypoints.length < 2) {
    hideSegmentAddKnob()
    return
  }

  if (isCreatingSurvey.value || isDraggingMarker.value || isDraggingPolygon.value) {
    hideSegmentAddKnob()
    return
  }

  const latlngs = missionStore.currentPlanningWaypoints.map((w) => L.latLng(w.coordinates[0], w.coordinates[1]))
  const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, event.latlng)
  if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
    const A = latlngs[segmentIndex]
    const B = latlngs[segmentIndex + 1]
    const mid = L.latLng((A.lat + B.lat) / 2, (A.lng + B.lng) / 2)
    showSegmentAddKnobAt(mid, segmentIndex)
  } else {
    hideSegmentAddKnob()
  }
}

const handleMissionPathDoubleClick = (event: L.LeafletMouseEvent): void => {
  if (!planningMap.value || missionStore.currentPlanningWaypoints.length < 2) return
  const latlngs = missionStore.currentPlanningWaypoints.map((w) => L.latLng(w.coordinates[0], w.coordinates[1]))
  const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, event.latlng)
  if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
    insertWaypointAtSegmentMidpoint(segmentIndex)
  }
}

const addWaypointFromClick = (latlng: L.LatLng): void => {
  if (!planningMap.value) return

  if (missionStore.currentPlanningWaypoints.length >= 2) {
    const latlngs = missionStore.currentPlanningWaypoints.map((w) => L.latLng(w.coordinates[0], w.coordinates[1]))
    const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, latlng)
    if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
      insertWaypointAtSegmentMidpoint(segmentIndex)
      return
    }
  }

  addWaypoint([latlng.lat, latlng.lng], currentWaypointAltitude.value, currentWaypointAltitudeRefType.value)
  reNumberWaypoints()
}

const addWaypointFromContextMenu = (): void => {
  if (!currentCursorGeoCoordinates.value) return
  const ll = L.latLng(currentCursorGeoCoordinates.value[0], currentCursorGeoCoordinates.value[1])
  addWaypointFromClick(ll)
}

const makeAreaMarker = (at: L.LatLng, text: string): L.Marker => {
  return L.marker(at, {
    pane: 'measurePane',
    interactive: false,
    keyboard: false,
    bubblingMouseEvents: false,
    icon: L.divIcon({
      className: 'measure-area-icon',
      html: `<div class="measure-area-pill">${text}</div>`,
    }),
  })
}

const addAreaToMeasureLayer = (m: L.Layer): void => {
  if (measureLayer.value) {
    measureLayer.value.addLayer(m)
  } else {
    planningMap.value?.addLayer(m)
  }
}

const updateLiveSurveyAreaLabel = (coords: WaypointCoordinates[]): void => {
  if (!coords.length) return

  const m2 = polygonAreaSquareMeters(coords)
  const label = missionEstimates.formatArea(m2)

  const centerTuple = centroidLatLng(coords)
  if (!Number.isFinite(centerTuple[0]) || !Number.isFinite(centerTuple[1])) return

  const center = L.latLng(centerTuple[0], centerTuple[1])

  if (!liveSurveyAreaMarker.value) {
    liveSurveyAreaMarker.value = makeAreaMarker(center, label)
    addAreaToMeasureLayer(liveSurveyAreaMarker.value)
  } else {
    liveSurveyAreaMarker.value.setLatLng(center)
    const el = liveSurveyAreaMarker.value.getElement()
    if (el) el.querySelector('.measure-area-pill')!.textContent = label
  }
}

const createSurveyAreaLabel = (surveyId: string, coords: [number, number][]): void => {
  const m2 = polygonAreaSquareMeters(coords)
  const label = missionEstimates.formatArea(m2)
  const centerTuple = centroidLatLng(coords)
  const center = L.latLng(centerTuple[0], centerTuple[1])

  const marker = makeAreaMarker(center, label)
  addAreaToMeasureLayer(marker)
  surveyAreaMarkers.value[surveyId] = marker
  setSurveyAreaSquareMeters(surveyId, m2)
}

const isOverLastWaypointMarker = (event: L.LeafletMouseEvent): boolean => {
  const el = event.originalEvent?.target as HTMLElement | null
  if (!el) return false
  const waypoints = missionStore.currentPlanningWaypoints
  if (!Array.isArray(waypoints) || waypoints.length === 0) return false
  const lastWp = waypoints[waypoints.length - 1]
  const lastMarker = waypointMarkers.value[lastWp.id]
  const lastElement = lastMarker?.getElement?.()
  return !!lastElement && (lastElement === el || lastElement.contains(el))
}

const onPolygonMouseDown = (event: L.LeafletMouseEvent): void => {
  isDraggingPolygon.value = true
  dragStartLatLng = event.latlng
  polygonLatLngsAtDragStart = surveyPolygonVertexesPositions.value.map((latlng) => latlng.clone())
  planningMap.value?.dragging.disable()

  planningMap.value?.on('mousemove', onPolygonMouseMove)
  planningMap.value?.on('mouseup', onPolygonMouseUp)

  L.DomEvent.stopPropagation(event.originalEvent)
  L.DomEvent.preventDefault(event.originalEvent)
}

const onPolygonMouseUp = (event: L.LeafletMouseEvent): void => {
  isDraggingPolygon.value = false
  dragStartLatLng = null
  polygonLatLngsAtDragStart = []
  planningMap.value?.dragging.enable()

  planningMap.value?.off('mousemove', onPolygonMouseMove)
  planningMap.value?.off('mouseup', onPolygonMouseUp)

  L.DomEvent.stopPropagation(event.originalEvent)
  L.DomEvent.preventDefault(event.originalEvent)
}

const onPolygonMouseMove = (event: L.LeafletMouseEvent): void => {
  if (!isDraggingPolygon.value || !dragStartLatLng) return

  if (surveyPolygonLayer.value && surveyPolygonVertexesPositions.value.length >= 3) {
    updateLiveSurveyAreaLabel(surveyPolygonVertexesPositions.value.map((p) => [p.lat, p.lng] as WaypointCoordinates))
  }

  const latDiff = event.latlng.lat - dragStartLatLng.lat
  const lngDiff = event.latlng.lng - dragStartLatLng.lng

  surveyPolygonVertexesPositions.value = polygonLatLngsAtDragStart.map((latlng) =>
    L.latLng(latlng.lat + latDiff, latlng.lng + lngDiff)
  )

  surveyPolygonLayer.value?.setLatLngs(surveyPolygonVertexesPositions.value)
  surveyPolygonVertexesMarkers.value.forEach((marker, index) => {
    marker.setLatLng(surveyPolygonVertexesPositions.value[index])
  })

  updateSurveyEdgeAddMarkers()
  createSurveyPath()
  updateConfirmButtonPosition()

  L.DomEvent.stopPropagation(event.originalEvent)
  L.DomEvent.preventDefault(event.originalEvent)
}

const enablePolygonDragging = (): void => {
  if (surveyPolygonLayer.value) {
    surveyPolygonLayer.value.off('mousedown', onPolygonMouseDown)
    surveyPolygonLayer.value.on('mousedown', onPolygonMouseDown)
  }
}

const disablePolygonDragging = (): void => {
  if (surveyPolygonLayer.value) {
    surveyPolygonLayer.value.off('mousedown', onPolygonMouseDown)
  }
}

const showContextMenu = (event: L.LeafletMouseEvent): void => {
  cursorCoordinates.value = [event.latlng.lat, event.latlng.lng]
  event.originalEvent.preventDefault()
  contextMenuPosition.value = {
    x: event.originalEvent.clientX,
    y: event.originalEvent.clientY,
  }
  contextMenuVisible.value = true
}

const hideContextMenu = (): void => {
  contextMenuVisible.value = false
  selectedSurveyId.value = ''
}

const setHomePosition = async (): Promise<void> => {
  if (!currentCursorGeoCoordinates.value) return
  const newHome: [number, number] = [currentCursorGeoCoordinates.value[0], currentCursorGeoCoordinates.value[1]]
  try {
    home.value = newHome
    await vehicleStore.setHomeWaypoint(newHome, 0)
    openSnackbar({
      variant: 'success',
      message: `Home position set to ${newHome[0].toFixed(2)}, ${newHome[1].toFixed(2)}`,
    })
  } catch (error) {
    openSnackbar({
      variant: 'error',
      message: `Failed to set home position: ${error}`,
    })
  }
}

const toggleSimplePath = (): void => {
  if (isCreatingSimplePath.value) {
    isCreatingSimplePath.value = false
    return
  }
  isCreatingSimplePath.value = true
}

const toggleSurvey = (): void => {
  if (isCreatingSimplePath.value) {
    isCreatingSimplePath.value = false
  }
  if (isCreatingSurvey.value) {
    isCreatingSurvey.value = false
    lastSurveyState.value = {}
    canUndo.value = {}
    return
  }
  isCreatingSurvey.value = true
  hideContextMenu()
}

const targetFollower = new TargetFollower(
  (newTarget: WhoToFollow | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (mapCenter.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)

const addSurveyPolygonToMap = (survey: Survey): void => {
  if (!planningMap.value) return

  const surveyPolygonLayer = L.polygon(
    survey.polygonCoordinates.map((coord) => [coord[0], coord[1]]),
    {
      color: survey.id === selectedSurveyId.value ? '#FFD700' : '#3B82F6',
      fillColor: survey.id === selectedSurveyId.value ? '#FFD700' : '#60A5FA',
      fillOpacity: 0.2,
      weight: 3,
      className: 'survey-polygon',
    }
  ).addTo(planningMap.value)

  surveyPolygonLayers.value[survey.id] = surveyPolygonLayer

  surveyPolygonLayer.on('click', (event: LeafletMouseEvent) => {
    if (isCreatingSimplePath.value) return
    accessingSurveyContextMenu.value = false
    selectedSurveyId.value = survey.id
    lastSelectedSurveyId.value = survey.id
    selectedWaypoint.value = undefined
    L.DomEvent.stopPropagation(event)
  })

  surveyPolygonLayer.on('contextmenu', (event: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)

    accessingSurveyContextMenu.value = true
    contextMenuType.value = 'survey'
    if (selectedSurveyId.value !== survey.id && !isCreatingSimplePath.value) {
      selectedWaypoint.value = undefined
      selectedSurveyId.value = survey.id
      lastSelectedSurveyId.value = survey.id
    }

    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)
    currentCursorGeoCoordinates.value = [event.latlng.lat, event.latlng.lng]
    showContextMenu(event)
  })

  let pressTimer: number | null = null
  const LONG_PRESS_DURATION = 500

  const handleTouchStart = (event: TouchEvent): void => {
    if (isCreatingSimplePath.value) return

    event.preventDefault()

    pressTimer = window.setTimeout(() => {
      if (selectedSurveyId.value !== survey.id) {
        selectedSurveyId.value = survey.id
      }
      const touch = event.touches[0]
      const x = touch.clientX
      const y = touch.clientY

      contextMenuPosition.value = { x, y }
      contextMenuVisible.value = true
    }, LONG_PRESS_DURATION)
  }

  const handleTouchEnd = (): void => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  createSurveyAreaLabel(survey.id, survey.polygonCoordinates)
  surveyPolygonLayer.on('touchstart', handleTouchStart as any) // eslint-disable @typescript-eslint/no-explicit-any
  surveyPolygonLayer.on('touchend', handleTouchEnd)
  surveyPolygonLayer.on('touchcancel', handleTouchEnd)
}

const clearSurveyVertexMarkers = (): void => {
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
}

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    if (isCreatingSurvey.value) {
      clearSurveyCreation()
    }
    if (isCreatingSimplePath.value) {
      isCreatingSimplePath.value = false
    }
  }
  if (event.key === 'Enter' && isCreatingSurvey.value) {
    generateWaypointsFromSurvey()
  }
  if (event.key === 'Delete' && !interfaceStore.configPanelVisible) {
    if (selectedWaypoint.value) {
      removeSelectedWaypoint()
      selectedWaypoint.value = undefined
      contextMenuType.value = 'map'
    } else if (selectedSurveyId.value) {
      deleteSelectedSurvey()
      selectedSurveyId.value = ''
      contextMenuType.value = 'map'
    }
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    if (isCreatingSimplePath.value) {
      const lastWaypoint = missionStore.currentPlanningWaypoints[missionStore.currentPlanningWaypoints.length - 1]
      const belongsToSurvey = surveys.value.some((survey) => survey.waypoints.some((wp) => wp.id === lastWaypoint.id))

      if (missionStore.currentPlanningWaypoints.length === 0) return

      if (lastWaypoint && !belongsToSurvey) {
        selectedWaypoint.value = lastWaypoint
        removeSelectedWaypoint()
        selectedWaypoint.value = undefined
      }
      return
    }
    if (enableUndoForCurrentSurvey.value && !undoIsInProgress.value) {
      undoGenerateWaypoints()
      event.preventDefault()
    }
  }
}

const clearSurveyCreation = (): void => {
  clearSurveyPath()
  isCreatingSurvey.value = false
  lastSurveyState.value = {}
  canUndo.value = {}
  clearLiveMeasure()
}

const deleteSelectedSurvey = (): void => {
  const surveyId = selectedSurveyId.value
  if (!surveyId) {
    openSnackbar({ variant: 'error', message: 'No survey selected to delete.', duration: 2000 })
    return
  }

  const surveyIndex = surveys.value.findIndex((s) => s.id === surveyId)
  if (surveyIndex === -1) {
    openSnackbar({ variant: 'error', message: 'Selected survey does not exist.', duration: 2000 })
    return
  }

  const polygonLayer = surveyPolygonLayers.value[surveyId]
  if (polygonLayer) {
    planningMap.value?.removeLayer(polygonLayer)
    delete surveyPolygonLayers.value[surveyId]
  }

  clearSurveyVertexMarkers()

  const waypointsToRemove = surveys.value[surveyIndex].waypoints
  waypointsToRemove.forEach((waypoint) => {
    const waypointIndex = missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === waypoint.id)
    if (waypointIndex !== -1) {
      missionStore.currentPlanningWaypoints.splice(waypointIndex, 1)
    }
    const waypointMarker = waypointMarkers.value[waypoint.id]
    if (waypointMarker) {
      planningMap.value?.removeLayer(waypointMarker)
      delete waypointMarkers.value[waypoint.id]
    }
  })

  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.length = 0

  surveys.value.splice(surveyIndex, 1)

  if (selectedSurveyId.value === surveyId) {
    selectedSurveyId.value = surveys.value.length > 0 ? surveys.value[0].id : ''
  }
  if (lastSurveyState.value[surveyId]) {
    delete lastSurveyState.value[surveyId]
  }
  if (canUndo.value[surveyId]) {
    delete canUndo.value[surveyId]
  }

  const areaMarker = surveyAreaMarkers.value[surveyId]
  if (areaMarker) {
    planningMap.value?.removeLayer(areaMarker)
    delete surveyAreaMarkers.value[surveyId]
    removeSurveyAreaSquareMeters(surveyId)
  }

  openSnackbar({ variant: 'success', message: 'Survey deleted.', duration: 2000 })
  hideContextMenu()
  reNumberWaypoints()
}

const homeWaypointCursor =
  'url("data:image/svg+xml;utf8,' +
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>" +
  "<circle cx='12' cy='12' r='11' fill='%231e498f' stroke='%23ffffff55' stroke-width='1'/>" +
  // scale path to 90 % and re-center ( (24 − 24×0.9) / 2 = 1.2 )
  "<g transform='translate(4 3) scale(0.7)'>" +
  "<path fill='%23ffffff' d='M12,3L2,12H5V20H19V12H22L12,3M12,7.7C14.1,7.7 15.8,9.4 15.8,11.5C15.8,14.5 " +
  '12,18 12,18C12,18 8.2,14.5 8.2,11.5C8.2,9.4 9.9,7.7 12,7.7M12,10A1.5,1.5 0 0,0 10.5,11.5A1.5,1.5 ' +
  "0 0,0 12,13A1.5,1.5 0 0,0 13.5,11.5A1.5,1.5 0 0,0 12,10Z'/>" +
  '</g>' +
  '</svg>") 12 12, crosshair'

// Set home WP with a click
watch(isSettingHomeWaypoint, (active) => {
  if (!planningMap.value) return
  const mapContainer = planningMap.value.getContainer()

  if (active) {
    mapContainer.style.cursor = homeWaypointCursor
    setHomeOnFirstClick = (evt: L.LeafletMouseEvent): void => {
      currentCursorGeoCoordinates.value = [evt.latlng.lat, evt.latlng.lng]
      setHomePosition()
      planningMap.value?.off('click', setHomeOnFirstClick!)
      setHomeOnFirstClick = null
      isSettingHomeWaypoint.value = false
    }
    planningMap.value.on('click', setHomeOnFirstClick)
  } else {
    mapContainer.style.cursor = ''
    if (setHomeOnFirstClick) {
      planningMap.value?.off('click', setHomeOnFirstClick)
      setHomeOnFirstClick = null
    }
  }
})

// Keep an eye on the existent surveys and highlight the selected one
watch(selectedSurveyId, (newId, oldId) => {
  // Un-highlight old polygon
  if (oldId && surveyPolygonLayers.value[oldId]) {
    surveyPolygonLayers.value[oldId].setStyle({
      color: '#3B82F6',
      fillColor: '#60A5FA',
    })
  }

  // Highlight new polygon
  if (newId && surveyPolygonLayers.value[newId]) {
    surveyPolygonLayers.value[newId].setStyle({
      color: '#FFD700',
      fillColor: '#FFD700',
    })
  }
})

// Responsible for updating the survey polygon markers
watch(
  () => surveys.value.slice(),
  (newSurveys) => {
    // Remove old polygons from the map
    Object.values(surveyPolygonLayers.value).forEach((layer) => {
      planningMap.value?.removeLayer(layer)
    })
    surveyPolygonLayers.value = {}

    Object.values(surveyAreaMarkers.value).forEach((m) => {
      planningMap.value?.removeLayer(m)
    })

    // Add new polygons
    newSurveys.forEach((survey) => {
      addSurveyPolygonToMap(survey)
    })
  },
  { immediate: true }
)

watch(
  [surveyPolygonVertexesPositions, isCreatingSurvey],
  () => {
    updateConfirmButtonPosition()
  },
  { immediate: true, deep: true }
)

// Watches for changes in the selected waypoint and updates marker accordingly
watch(selectedWaypoint, (newWaypoint, oldWaypoint) => {
  if (oldWaypoint) {
    const oldMarker = waypointMarkers.value[oldWaypoint.id]
    if (oldMarker) {
      oldMarker.setIcon(
        L.divIcon({
          html: createWaypointMarkerHtml(oldWaypoint.commands.length, false),
          className: 'waypoint-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      )
    }
  }
  if (newWaypoint) {
    const newMarker = waypointMarkers.value[newWaypoint.id]
    if (newMarker) {
      newMarker.setIcon(
        L.divIcon({
          html: createWaypointMarkerHtml(newWaypoint.commands.length, true),
          className: 'waypoint-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      )
    }
  }
})

watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  planningMap.value?.setZoom(zoom.value)
})

const addWaypoint = (
  coordinates: WaypointCoordinates,
  altitude: number,
  altitudeReferenceType: AltitudeReferenceType,
  commands?: MissionCommand[]
): void => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  const waypointId = uuid()
  const waypoint: Waypoint = {
    id: waypointId,
    coordinates,
    altitude,
    altitudeReferenceType,
    commands: cloneCommands(commands),
  }

  missionStore.currentPlanningWaypoints.push(waypoint)

  const newMarker = L.marker(coordinates, { draggable: true })
  // @ts-ignore - onMove is a valid LeafletMouseEvent
  newMarker.on('drag', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypointId, [latlng.lat, latlng.lng])
    isDraggingMarker.value = true
  })

  newMarker.on('dragend', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypointId, [latlng.lat, latlng.lng])
    isDraggingMarker.value = false
  })
  newMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
    selectedWaypoint.value = waypoint
    contextMenuType.value = 'waypoint'
    currentCursorGeoCoordinates.value = [e.latlng.lat, e.latlng.lng]
    showContextMenu(e)
  })

  const markerIcon = L.divIcon({
    html: createWaypointMarkerHtml(waypoint.commands.length, false),
    className: 'waypoint-marker-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
  newMarker.setIcon(markerIcon)
  const markerTooltip = L.tooltip({
    content: '',
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })
  newMarker.bindTooltip(markerTooltip)
  planningMap.value.addLayer(newMarker)
  waypointMarkers.value[waypointId] = newMarker

  // Update waypoint numbering to account for command counts
  reNumberWaypoints()
}

const removeSelectedWaypoint = (): void => {
  const waypoint = selectedWaypoint.value
  if (!waypoint) return
  const index = missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === waypoint.id)
  if (index !== -1) {
    missionStore.currentPlanningWaypoints.splice(index, 1)
  } else {
    console.warn(`Waypoint with id ${waypoint.id} not found in currentPlanningWaypoints`)
  }

  surveys.value.forEach((survey) => {
    const surveyWaypointIndex = survey.waypoints.findIndex((wp) => wp.id === waypoint.id)
    if (surveyWaypointIndex !== -1) {
      survey.waypoints.splice(surveyWaypointIndex, 1)
      updateSurvey(survey.id, { ...survey })
    }
  })

  const marker = waypointMarkers.value[waypoint.id]
  if (marker) {
    planningMap.value?.removeLayer(marker)
    delete waypointMarkers.value[waypoint.id]
  } else {
    console.warn(`No marker found for waypoint id: ${waypoint.id}`)
  }

  if (missionWaypointsPolyline.value) {
    const newCoordinates = missionStore.currentPlanningWaypoints.map((w) => w.coordinates)
    missionWaypointsPolyline.value.setLatLngs(newCoordinates)
  }

  reNumberWaypoints()
  hideContextMenu()
}

const handleShouldUpdateWaypoints = (): void => {
  reNumberWaypoints()
}

const saveMissionToFile = async (): Promise<void> => {
  const cockpitMissionFile: CockpitMission = {
    version: 0,
    settings: {
      mapCenter: mapCenter.value,
      zoom: zoom.value,
      currentWaypointAltitude: currentWaypointAltitude.value,
      currentWaypointAltitudeRefType: currentWaypointAltitudeRefType.value,
      defaultCruiseSpeed: missionStore.defaultCruiseSpeed,
    },
    waypoints: missionStore.currentPlanningWaypoints,
  }
  const blob = new Blob([JSON.stringify(cockpitMissionFile, null, 2)], {
    type: 'application/json',
  })
  const date = format(new Date(), 'LLL_dd_yyyy_HH_mm_ss')
  saveAs(blob, `cockpit_mission_plan_${date}.cmp`)
}

const loadMissionFromFile = async (e: Event): Promise<void> => {
  const reader = new FileReader()
  reader.onload = (event: Event) => {
    // @ts-ignore: We know the event type and need refactor of the event typing
    const contents = event.target.result
    const maybeMission = JSON.parse(contents)
    if (!instanceOfCockpitMission(maybeMission)) {
      showDialog({ variant: 'error', message: 'Invalid mission file.', timer: 3000 })
      return
    }
    mapCenter.value = maybeMission['settings']['mapCenter']
    zoom.value = maybeMission['settings']['zoom']
    currentWaypointAltitude.value = maybeMission['settings']['currentWaypointAltitude']
    currentWaypointAltitudeRefType.value = maybeMission['settings']['currentWaypointAltitudeRefType']
    missionStore.defaultCruiseSpeed = maybeMission['settings']['defaultCruiseSpeed']
    maybeMission['waypoints'].forEach((w: Waypoint) => {
      addWaypoint(w.coordinates, w.altitude, w.altitudeReferenceType, cloneCommands(w.commands))
    })
  }
  // @ts-ignore: We know the event type and need refactor of the event typing
  reader.readAsText(e.target.files[0])
}

const surveyPolygonVertexesMarkers = ref<L.Marker[]>([])
const rawDistanceBetweenSurveyLines = ref(10)
const rawSurveyLinesAngle = ref(0)
const existingWaypoints = ref<Waypoint[]>([])
const surveyWaypoints = ref<Waypoint[]>([])

// Distance between lines in the survey path
const distanceBetweenSurveyLines = computed({
  get: () => Math.max(1, rawDistanceBetweenSurveyLines.value),
  set: (value) => (rawDistanceBetweenSurveyLines.value = Math.max(1, value)), // Ensure the distance is at least 1
})

// Angle of the survey path lines
const surveyLinesAngle = computed({
  get: () => ((rawSurveyLinesAngle.value % 360) + 360) % 360, // This ensures the angle is always between 0 and 359
  set: (value) => (rawSurveyLinesAngle.value = ((value % 360) + 360) % 360),
})

const surveyLinesAngleDisplay = computed({
  get() {
    return Number(surveyLinesAngle.value.toFixed(1))
  },
  set(value) {
    surveyLinesAngle.value = value
  },
})

const onSurveyLinesAngleChange = (angle: number): void => {
  surveyLinesAngle.value = angle
}

const surveyPathLayer = shallowRef<L.Polyline | null>(null)
const surveyPolygonLayer = shallowRef<L.Polygon | null>(null)

const clearSurveyPath = (): void => {
  if (surveyPathLayer.value) {
    planningMap.value?.removeLayer(surveyPathLayer.value as unknown as L.Layer)
    surveyPathLayer.value = null
  }
  if (surveyPolygonLayer.value) {
    disablePolygonDragging()
    planningMap.value?.removeLayer(surveyPolygonLayer.value as unknown as L.Layer)
    surveyPolygonLayer.value = null
  }
  if (liveSurveyAreaMarker.value) {
    planningMap.value?.removeLayer(liveSurveyAreaMarker.value)
    liveSurveyAreaMarker.value = null
  }
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
  surveyPolygonVertexesPositions.value = []
}

watch([isCreatingSurvey, isCreatingSimplePath], (isCreatingNow) => {
  if (!isCreatingNow) clearSurveyPath()
  clearLiveMeasure()

  if (planningMap.value) {
    const mapContainer = planningMap.value.getContainer()
    mapContainer.style.cursor = 'crosshair'
    planningMap.value.on('mousedown', () => {
      mapContainer.style.cursor = 'grabbing'
    })
    planningMap.value.on('mouseup', () => {
      mapContainer.style.cursor = 'crosshair'
    })
    planningMap.value.on('mouseout', () => {
      mapContainer.style.cursor = 'crosshair'
    })
    if (isCreatingNow) {
      mapContainer.classList.add('survey-cursor')
    } else {
      mapContainer.classList.remove('survey-cursor')
    }
  }
})

// Watches for outside WP coordinate changes
watch(
  () => missionStore.currentPlanningWaypoints,
  (newWaypoints) => {
    newWaypoints.forEach((wp) => {
      const marker = waypointMarkers.value[wp.id]
      if (!marker) return

      const currentLatLng = marker.getLatLng()
      if (
        Math.abs(currentLatLng.lat - wp.coordinates[0]) > 1e-8 ||
        Math.abs(currentLatLng.lng - wp.coordinates[1]) > 1e-8
      ) {
        // Only set if there's an actual difference
        marker.setLatLng(wp.coordinates)
      }
    })
  },
  { deep: true }
)

const updateSurveyMarkersPositions = (): void => {
  surveyPolygonVertexesMarkers.value.forEach((marker, index) => {
    const latlng = surveyPolygonVertexesPositions.value[index]
    marker.setLatLng(latlng)
  })
  updateSurveyEdgeAddMarkers()
}

const updatePolygon = (): void => {
  surveyPolygonVertexesPositions.value = surveyPolygonVertexesMarkers.value.map((marker) => marker.getLatLng())
  if (surveyPolygonLayer.value) {
    surveyPolygonLayer.value.setLatLngs(surveyPolygonVertexesPositions.value)
  } else if (surveyPolygonVertexesPositions.value.length >= 3) {
    surveyPolygonLayer.value = L.polygon(surveyPolygonVertexesPositions.value, {
      color: '#3B82F6',
      fillColor: '#60A5FA',
      fillOpacity: 0.2,
      weight: 3,
      className: 'survey-polygon',
    }).addTo(toRaw(planningMap.value)!)

    enablePolygonDragging()
  }
  if (surveyPolygonLayer.value && surveyPolygonVertexesPositions.value.length >= 3) {
    surveyPolygonVertexesPositions.value.map((p) => [p.lat, p.lng] as WaypointCoordinates)
  }
  updateSurveyMarkersPositions()
}

const checkAndRemoveSurveyPath = (): void => {
  if (surveyPolygonVertexesPositions.value.length >= 4 || !surveyPathLayer.value) return
  planningMap.value?.removeLayer(surveyPathLayer.value as unknown as L.Layer)
  surveyPathLayer.value = null
}

const createSurveyPath = (): void => {
  if (surveyPolygonVertexesPositions.value.length < 4) {
    checkAndRemoveSurveyPath()
    return
  }

  try {
    const adjustedAngle = 90 - surveyLinesAngle.value
    const continuousPath = generateSurveyPath(
      surveyPolygonVertexesPositions.value,
      distanceBetweenSurveyLines.value,
      adjustedAngle
    )

    if (continuousPath.length === 0) {
      showDialog({
        variant: 'error',
        message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
        timer: 5000,
      })
      return
    }

    if (surveyPathLayer.value) {
      planningMap.value?.removeLayer(surveyPathLayer.value as unknown as L.Layer)
    }

    surveyPathLayer.value = L.polyline(continuousPath, {
      color: '#2563EB',
      weight: 3,
      opacity: 0.8,
      className: 'survey-path',
    }).addTo(toRaw(planningMap.value)!)
  } catch (error) {
    showDialog({
      variant: 'error',
      message: `Failed to generate survey path: ${(error as Error).message}`,
      timer: 5000,
    })
  }
}

// Watch for changes in distanceBetweenSurveyLines and surveyLinesAngle
watch([distanceBetweenSurveyLines, surveyLinesAngle], () => createSurveyPath())

const surveyEdgeAddMarkers: L.Marker[] = []

const updateSurveyEdgeAddMarkers = (): void => {
  // Remove existing edge markers
  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.length = 0

  // Add new edge markers
  if (surveyPolygonVertexesPositions.value.length >= 3) {
    for (let i = 0; i < surveyPolygonVertexesPositions.value.length; i++) {
      const start = surveyPolygonVertexesPositions.value[i]
      const end = surveyPolygonVertexesPositions.value[(i + 1) % surveyPolygonVertexesPositions.value.length]
      const middle = L.latLng((start.lat + end.lat) / 2, (start.lng + end.lng) / 2)

      const surveyEdgeAddMarker = L.marker(middle, {
        icon: L.divIcon({
          html: `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <circle cx="10" cy="10" r="9" fill="white" stroke="#3B82F6" stroke-width="2"/>
              <path d="M10 5V15M5 10H15" stroke="#3B82F6" stroke-width="2"/>
            </svg>
          `,
          className: 'edge-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })

      surveyEdgeAddMarker.on('click', (e: L.LeafletMouseEvent) => addSurveyPoint(e.latlng, i))
      surveyEdgeAddMarker.addTo(toRaw(planningMap.value)!)
      surveyEdgeAddMarkers.push(surveyEdgeAddMarker)
    }
  }
}

const addSurveyPoint = (latlng: L.LatLng, edgeIndex: number | undefined = undefined): void => {
  if (!isCreatingSurvey.value) return

  if (edgeIndex === undefined) {
    surveyPolygonVertexesPositions.value.push(latlng)
  } else {
    surveyPolygonVertexesPositions.value.splice(edgeIndex + 1, 0, latlng)
  }

  const newMarker = createSurveyVertexMarker(
    latlng,
    // onClick callback
    (marker) => {
      const index = surveyPolygonVertexesMarkers.value.indexOf(marker)
      if (index !== -1) {
        surveyPolygonVertexesPositions.value.splice(index, 1)
        surveyPolygonVertexesMarkers.value.splice(index, 1)
        marker.remove()
        updatePolygon()
        updateSurveyEdgeAddMarkers()
        checkAndRemoveSurveyPath()
        createSurveyPath()
      }
    },
    // onDrag callback
    () => {
      updatePolygon()
      createSurveyPath()
    }
  ).addTo(toRaw(planningMap.value)!)

  if (edgeIndex === undefined) {
    surveyPolygonVertexesMarkers.value.push(newMarker)
  } else {
    surveyPolygonVertexesMarkers.value.splice(edgeIndex + 1, 0, newMarker)
  }

  updatePolygon()
  updateSurveyEdgeAddMarkers()
  createSurveyPath()
}

watch(isCreatingSurvey, (isCreatingNow) => {
  if (isCreatingNow) {
    existingWaypoints.value = [...missionStore.currentPlanningWaypoints]
    surveyWaypoints.value = []
  } else {
    clearSurveyPath()
  }
})

const generateWaypointsFromSurvey = (): void => {
  if (!surveyPathLayer.value) {
    showDialog({ variant: 'error', message: 'No survey path to generate waypoints from.', timer: 2000 })
    return
  }

  const newSurveyId = uuid()
  canUndo.value[newSurveyId] = true

  const polygonCoordinates: WaypointCoordinates[] = surveyPolygonVertexesPositions.value.map((latLng) => [
    latLng.lat,
    latLng.lng,
  ])

  lastSurveyState.value[newSurveyId] = {
    polygonPositions: polygonCoordinates,
  }

  const adjustedAngle = 90 - surveyLinesAngle.value
  const continuousPath = generateSurveyPath(
    surveyPolygonVertexesPositions.value,
    distanceBetweenSurveyLines.value,
    adjustedAngle
  )

  if (!continuousPath.length) {
    showDialog({
      variant: 'error',
      message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
      timer: 3000,
    })
    return
  }

  const newSurveyWaypoints: Waypoint[] = continuousPath.map((latLng: L.LatLng) => ({
    id: uuid(),
    coordinates: [latLng.lat, latLng.lng],
    altitude: currentWaypointAltitude.value,
    altitudeReferenceType: currentWaypointAltitudeRefType.value,
    commands: makeDefaultNavCommands(),
  }))

  missionStore.currentPlanningWaypoints.push(...newSurveyWaypoints)

  const newSurvey: Survey = {
    id: newSurveyId,
    polygonCoordinates: polygonCoordinates,
    distanceBetweenLines: distanceBetweenSurveyLines.value,
    surveyLinesAngle: surveyLinesAngle.value,
    waypoints: newSurveyWaypoints,
  }
  addSurvey(newSurvey)
  selectedSurveyId.value = newSurvey.id

  newSurveyWaypoints.forEach((waypoint) => addWaypointMarker(waypoint))

  const firstWaypoint = newSurveyWaypoints[0]
  const lastWaypoint = newSurveyWaypoints[newSurveyWaypoints.length - 1]
  const firstMarker = waypointMarkers.value[firstWaypoint.id]
  const lastMarker = waypointMarkers.value[lastWaypoint.id]
  if (firstMarker) {
    firstMarker.getElement()?.classList.add('green-marker')
  }
  if (lastMarker && lastMarker !== firstMarker) {
    lastMarker.getElement()?.classList.add('green-marker')
  }

  clearSurveyPath()
  isCreatingSurvey.value = false
  reNumberWaypoints()

  openSnackbar({ variant: 'success', message: 'Waypoints generated from survey path.', duration: 1000 })
}

// Helper function to create waypoint marker HTML with command count indicator
const createWaypointMarkerHtml = (commandCount: number, isSelected = false): string => {
  const baseClass = isSelected ? 'selected-marker' : 'marker-icon'
  return `
    <div class="waypoint-marker-container">
      <div class="${baseClass} waypoint-main-marker"></div>
      ${commandCount > 1 ? `<div class="command-count-indicator">${commandCount}</div>` : ''}
    </div>
  `
}

const reNumberWaypoints = (): void => {
  let cumulativeCommandCount = 1 // Start numbering from 1

  missionStore.currentPlanningWaypoints.forEach((wp) => {
    const marker = waypointMarkers.value[wp.id]
    if (marker) {
      marker.getTooltip()?.setContent(`${cumulativeCommandCount}`)

      // Update marker icon to show command count
      const isSelected = selectedWaypoint.value?.id === wp.id
      marker.setIcon(
        L.divIcon({
          html: createWaypointMarkerHtml(wp.commands.length, isSelected),
          className: 'waypoint-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      )
    }
    // Add the number of commands this waypoint has for the next waypoint's number
    cumulativeCommandCount += wp.commands.length
  })
}

const regenerateSurveyWaypoints = (angle?: number): void => {
  if (!selectedSurveyId.value) {
    openSnackbar({ variant: 'error', message: 'No survey selected.', duration: 2000 })
    return
  }

  if (selectedSurvey.value) {
    selectedSurvey.value?.waypoints.forEach((waypoint) => {
      const marker = waypointMarkers.value[waypoint.id]
      if (marker) {
        planningMap.value?.removeLayer(marker)
        delete waypointMarkers.value[waypoint.id]
      }
    })

    const adjustedAngle = 90 - (angle || selectedSurvey.value.surveyLinesAngle)
    const continuousPath = generateSurveyPath(
      selectedSurvey.value.polygonCoordinates.map((coord) => L.latLng(coord[0], coord[1])),
      selectedSurvey.value.distanceBetweenLines,
      adjustedAngle
    )

    if (!continuousPath.length) {
      openSnackbar({
        message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
        variant: 'error',
        duration: 2000,
      })
      return
    }

    const newWaypoints: Waypoint[] = continuousPath.map((latLng: L.LatLng) => ({
      id: uuid(),
      coordinates: [latLng.lat, latLng.lng],
      altitude: currentWaypointAltitude.value,
      altitudeReferenceType: currentWaypointAltitudeRefType.value,
      commands: [],
    }))

    const firstOldWaypointIndex = missionStore.currentPlanningWaypoints.findIndex(
      (wp) => wp.id === selectedSurvey.value!.waypoints[0].id
    )

    if (firstOldWaypointIndex === -1) {
      openSnackbar({ variant: 'error', message: 'Failed to find old waypoints.', duration: 2000 })
      return
    }

    missionStore.currentPlanningWaypoints.splice(
      firstOldWaypointIndex,
      selectedSurvey.value.waypoints.length,
      ...newWaypoints
    )

    selectedSurvey.value.waypoints = newWaypoints
    selectedSurvey.value.surveyLinesAngle = angle || selectedSurvey.value.surveyLinesAngle
    updateSurvey(selectedSurveyId.value, { ...selectedSurvey.value })

    newWaypoints.forEach((waypoint) => addWaypointMarker(waypoint))

    const firstWaypoint = newWaypoints[0]
    const lastWaypoint = newWaypoints[newWaypoints.length - 1]
    const firstMarker = waypointMarkers.value[firstWaypoint.id]
    const lastMarker = waypointMarkers.value[lastWaypoint.id]
    if (firstMarker) {
      firstMarker.getElement()?.classList.add('green-marker')
    }
    if (lastMarker && lastMarker !== firstMarker) {
      lastMarker.getElement()?.classList.add('green-marker')
    }

    reNumberWaypoints()
  }
}

const createSurveyVertexMarker = (
  latlng: L.LatLng,
  onClick: (marker: L.Marker, evt: L.LeafletEvent) => void,
  onDrag: () => void
): L.Marker => {
  let justCreated = true

  return L.marker(latlng, {
    icon: L.divIcon({
      html: `
        <div class="survey-vertex-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="5" fill="#3B82F6" stroke="white" stroke-width="2"/>
          </svg>
          <div class="delete-popup" style="display: none;">
            <button class="delete-button">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
                      stroke="white" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
          </div>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
    draggable: true,
  })
    .on('drag', () => {
      onDrag()
    })
    .on('mouseover', (event: L.LeafletEvent) => {
      if (justCreated) {
        justCreated = false
        return
      }
      const target = event.target as L.Marker
      const popup = target.getElement()?.querySelector('.delete-popup') as HTMLDivElement
      if (popup) popup.style.display = 'block'
    })
    .on('mouseout', (event: L.LeafletEvent) => {
      const target = event.target as L.Marker
      const popup = target.getElement()?.querySelector('.delete-popup') as HTMLDivElement
      if (popup) popup.style.display = 'none'
    })
    .on('click', (event: L.LeafletEvent) => {
      const target = event.target as L.Marker
      onClick(target, event)
    })
}

const undoGenerateWaypoints = (): void => {
  if (undoIsInProgress.value) return
  contextMenuVisible.value = false
  undoIsInProgress.value = true
  const surveyId = selectedSurveyId.value

  if (!surveyId || !canUndo.value[surveyId] || !lastSurveyState.value[surveyId]) {
    openSnackbar({ variant: 'error', message: 'Nothing to undo.', duration: 2000 })
    undoIsInProgress.value = false
    return
  }

  if (selectedSurvey.value) {
    selectedSurvey.value.waypoints.forEach((waypoint) => {
      const index = missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === waypoint.id)
      if (index !== -1) {
        missionStore.currentPlanningWaypoints.splice(index, 1)
      }
      const marker = waypointMarkers.value[waypoint.id]
      if (marker) {
        planningMap.value?.removeLayer(marker)
        delete waypointMarkers.value[waypoint.id]
      }
    })
  }

  planningMap.value?.eachLayer((layer) => {
    if (layer instanceof L.Polyline && layer.options.className === 'waypoint-connection') {
      planningMap.value?.removeLayer(layer)
    }
  })

  const index = surveys.value.findIndex((survey) => survey.id === surveyId)
  if (index !== -1) {
    surveys.value.splice(index, 1)
  }
  selectedSurveyId.value = ''

  const surveyState = lastSurveyState.value[surveyId]
  surveyPolygonVertexesPositions.value = surveyState.polygonPositions.map(([lat, lng]) => L.latLng(lat, lng))

  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []

  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.length = 0

  if (surveyPolygonLayer.value) {
    planningMap.value?.removeLayer(surveyPolygonLayer.value as unknown as L.Layer)
    surveyPolygonLayer.value = null
  }
  if (surveyPathLayer.value) {
    planningMap.value?.removeLayer(surveyPathLayer.value as unknown as L.Layer)
    surveyPathLayer.value = null
  }

  surveyPolygonVertexesPositions.value.forEach((latLng) => {
    const newMarker = createSurveyVertexMarker(
      latLng,
      // onClick callback
      (marker) => {
        const targetIndex = surveyPolygonVertexesMarkers.value.indexOf(marker)
        if (targetIndex !== -1) {
          surveyPolygonVertexesPositions.value.splice(targetIndex, 1)
          surveyPolygonVertexesMarkers.value.splice(targetIndex, 1)
          marker.remove()
          updatePolygon()
          updateSurveyEdgeAddMarkers()
          createSurveyPath()
        }
      },
      // onDrag callback
      () => {
        updatePolygon()
        createSurveyPath()
      }
    ).addTo(planningMap.value!)

    surveyPolygonVertexesMarkers.value.push(newMarker)
  })

  updateSurveyEdgeAddMarkers()

  surveyPolygonLayer.value = L.polygon(surveyPolygonVertexesPositions.value, {
    color: '#3B82F6',
    fillColor: '#60A5FA',
    fillOpacity: 0.2,
    weight: 3,
    className: 'survey-polygon',
  }).addTo(planningMap.value!)

  enablePolygonDragging()

  delete lastSurveyState.value[surveyId]
  delete canUndo.value[surveyId]
  isCreatingSurvey.value = true

  createSurveyPath()
  openSnackbar({ variant: 'success', message: 'Undo successful.', duration: 1000 })
  undoIsInProgress.value = false
  removeSurveyAreaSquareMeters(surveyId)
}

const addWaypointMarker = (waypoint: Waypoint): void => {
  if (!planningMap.value) return

  const newMarker = L.marker(waypoint.coordinates, { draggable: true })

  newMarker.on('drag', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypoint.id, [latlng.lat, latlng.lng])
    isDraggingMarker.value = true
  })

  newMarker.on('dragend', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypoint.id, [latlng.lat, latlng.lng])
    isDraggingMarker.value = false
  })

  newMarker.on('contextmenu', (event: LeafletMouseEvent) => {
    contextMenuType.value = 'waypoint'
    selectedWaypoint.value = waypoint
    selectedSurveyId.value = ''
    interfaceStore.configPanelVisible = false
    currentCursorGeoCoordinates.value = [event.latlng.lat, event.latlng.lng]
    showContextMenu(event)
  })

  newMarker.on('click', (event: LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(event)
    L.DomEvent.preventDefault(event)

    const mouse = event.originalEvent as MouseEvent
    if (mouse.shiftKey) {
      selectedWaypoint.value = waypoint
      removeSelectedWaypoint()
      return
    }

    // Default: open config panel
    selectedWaypoint.value = waypoint
    selectedSurveyId.value = ''
    hideContextMenu()
    interfaceStore.configPanelVisible = true
  })

  const markerIcon = L.divIcon({
    html: createWaypointMarkerHtml(waypoint.commands.length, false),
    className: 'waypoint-marker-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
  newMarker.setIcon(markerIcon)

  const markerTooltip = L.tooltip({
    content: '',
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })
  newMarker.bindTooltip(markerTooltip)

  newMarker.addTo(planningMap.value)
  waypointMarkers.value[waypoint.id] = newMarker
}

// Watches for changes in the selected waypoint and updates marker accordingly
watch(selectedWaypoint, (newWaypoint, oldWaypoint) => {
  if (oldWaypoint) {
    const oldMarker = waypointMarkers.value[oldWaypoint.id]
    if (oldMarker) {
      oldMarker.setIcon(
        L.divIcon({
          html: createWaypointMarkerHtml(oldWaypoint.commands.length, false),
          className: 'waypoint-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      )
      const oldSurvey = surveys.value.find((s) => s.waypoints.some((w) => w.id === oldWaypoint.id))
      if (oldSurvey) {
        const oldM = waypointMarkers.value[oldWaypoint.id]
        oldM?.getElement()?.classList.remove('green-marker')
      }
    }
  }

  if (newWaypoint) {
    const newMarker = waypointMarkers.value[newWaypoint.id]
    if (newMarker) {
      newMarker.setIcon(
        L.divIcon({
          html: createWaypointMarkerHtml(newWaypoint.commands.length, true),
          className: 'waypoint-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      )
      const newSurvey = surveys.value.find((s) => s.waypoints.some((w) => w.id === newWaypoint.id))
      if (newSurvey && newSurvey.waypoints.length > 0) {
        newSurvey.waypoints.forEach((w) => {
          const m = waypointMarkers.value[w.id]
          if (m) m.getElement()?.classList.remove('green-marker')
        })
        const firstW = newSurvey.waypoints[0]
        const lastW = newSurvey.waypoints[newSurvey.waypoints.length - 1]
        const firstMarker = waypointMarkers.value[firstW.id]
        const lastMarker = waypointMarkers.value[lastW.id]
        if (firstMarker) firstMarker.getElement()?.classList.add('green-marker')
        if (lastMarker && lastMarker !== firstMarker) lastMarker.getElement()?.classList.add('green-marker')
      }
    }
  }
})

let homeRetryTimer: ReturnType<typeof setInterval> | null = null
const tryFetchHome = async (): Promise<void> => {
  const MAX_ATTEMPTS = 30
  let attempts = 0
  if (vehicleStore.isVehicleOnline) {
    try {
      const wp = await vehicleStore.fetchHomeWaypoint()
      home.value = [...wp.coordinates] as [number, number]
      clearInterval(homeRetryTimer!)
    } catch (err) {
      console.warn('HOME fetch failed, will retry…', err)
    }
  }
  if (++attempts >= MAX_ATTEMPTS) {
    clearInterval(homeRetryTimer!)
  }
}

const loadDraftMission = async (mission: CockpitMission): Promise<void> => {
  missionStore.clearMission()

  try {
    mapCenter.value = mission.settings.mapCenter
    zoom.value = mission.settings.zoom
    currentWaypointAltitude.value = mission.settings.currentWaypointAltitude
    currentWaypointAltitudeRefType.value = mission.settings.currentWaypointAltitudeRefType
    missionStore.defaultCruiseSpeed = mission.settings.defaultCruiseSpeed

    mission.waypoints.forEach((wp) => {
      addWaypoint(wp.coordinates, wp.altitude, wp.altitudeReferenceType, wp.commands)
    })
    if (!home.value) {
      await tryFetchHome()
      homeRetryTimer = setInterval(tryFetchHome, 1000)
    }
    openSnackbar({ variant: 'success', message: 'Draft mission loaded.', duration: 2000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: `Failed to load draft mission: ${error}`, duration: 3000 })
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

const onMapClick = (e: L.LeafletMouseEvent): void => {
  hideContextMenu()

  if (interfaceStore.configPanelVisible) {
    selectedWaypoint.value = undefined
    interfaceStore.configPanelVisible = false
  }

  if (ignoreNextClick) {
    ignoreNextClick = false
    return
  }

  const mouse = e.originalEvent as MouseEvent
  if (!isCreatingSurvey.value && (mouse.ctrlKey || mouse.metaKey)) {
    addWaypointFromClick(e.latlng)
    return
  }

  if (mouse.shiftKey && planningMap.value) {
    const clickPoint = planningMap.value.latLngToContainerPoint(e.latlng)
    let targetWpId: string | null = null
    for (const [id, marker] of Object.entries(waypointMarkers.value)) {
      const markerPoint = planningMap.value.latLngToContainerPoint(marker.getLatLng())
      if (clickPoint.distanceTo(markerPoint) <= nearMissionPathTolerance) {
        targetWpId = id
        break
      }
    }
    if (targetWpId) {
      const wp = missionStore.currentPlanningWaypoints.find((w) => w.id === targetWpId)
      if (wp) {
        selectedWaypoint.value = wp
        removeSelectedWaypoint()
      }
      return
    }
  }

  if (isCreatingSurvey.value) {
    addSurveyPoint(e.latlng)
    clearLiveMeasure()
  }

  if (planningMap.value) {
    // Check if there is an existing waypoint near the click location
    const clickPoint = planningMap.value.latLngToContainerPoint(e.latlng)
    let markerUnderMouse = false
    const thresholdInPixels = 10

    for (const marker of Object.values(waypointMarkers.value)) {
      const markerPoint = planningMap.value.latLngToContainerPoint(marker.getLatLng())
      const distance = clickPoint.distanceTo(markerPoint)
      if (distance < thresholdInPixels) {
        markerUnderMouse = true
        selectedWaypoint.value = missionStore.currentPlanningWaypoints.find(
          (wp) => wp.coordinates[0] === marker.getLatLng().lat && wp.coordinates[1] === marker.getLatLng().lng
        )
        interfaceStore.configPanelVisible = true
        break
      }
    }

    if (
      !markerUnderMouse &&
      !contextMenuVisible.value &&
      !interfaceStore.configPanelVisible &&
      isCreatingSimplePath.value
    ) {
      addWaypoint([e.latlng.lat, e.latlng.lng], currentWaypointAltitude.value, currentWaypointAltitudeRefType.value)
    }
    clearLiveMeasure()
  }
}

const confirmDownloadDialog =
  (layerLabel: string) =>
  (status: SaveStatus, ok: () => void): void => {
    showDialog({
      variant: 'info',
      message: `Save ${status._tilesforSave.length} ${layerLabel} tiles for offline use?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Save tiles',
          color: 'white',
          action: () => {
            ok()
            closeDialog()
          },
        },
      ] as DialogActions[],
    })
  }

const deleteDownloadedTilesDialog =
  (layerLabel: string) =>
  (_status: SaveStatus, ok: () => void): void => {
    showDialog({
      variant: 'warning',
      message: `Remove all saved ${layerLabel} tiles for this layer?`,
      persistent: false,
      maxWidth: '450px',
      actions: [
        { text: 'Cancel', color: 'white', action: closeDialog },
        {
          text: 'Remove tiles',
          color: 'white',
          action: () => {
            ok()
            closeDialog()
            openSnackbar({ message: `${layerLabel} offline tiles removed`, variant: 'info', duration: 3000 })
          },
        },
      ] as DialogActions[],
    })
  }

const downloadOfflineMapTiles = (layer: any, layerLabel: string, maxZoom: number): L.Control => {
  return savetiles(layer, {
    saveWhatYouSee: true,
    maxZoom,
    alwaysDownload: false,
    position: 'topright',
    parallel: 20,
    confirm: confirmDownloadDialog(layerLabel),
    confirmRemoval: deleteDownloadedTilesDialog(layerLabel),
    saveText: `<i class="mdi mdi-download" title="Save ${layerLabel} tiles"></i>`,
    rmText: `<i class="mdi mdi-trash-can" title="Remove ${layerLabel} tiles"></i>`,
  })
}

const attachOfflineProgress = (layer: any, layerName: string): void => {
  layer.on('savestart', (e: any) => {
    tilesSaved.value = 0
    tilesTotal.value = e?._tilesforSave?.length ?? 0
    savingLayerName.value = layerName
    isSavingOfflineTiles.value = true
    openSnackbar({ message: `Saving ${tilesTotal.value} ${layerName} tiles...`, variant: 'info', duration: 2000 })
  })

  layer.on('loadtileend', () => {
    tilesSaved.value += 1
    if (tilesTotal.value > 0 && tilesSaved.value >= tilesTotal.value) {
      openSnackbar({ message: `${layerName} offline tiles saved!`, variant: 'success', duration: 3000 })
      isSavingOfflineTiles.value = false
      savingLayerName.value = ''
      tilesSaved.value = 0
      tilesTotal.value = 0
    }
  })
}

onMounted(async () => {
  const osm = tileLayerOffline('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap',
  })
  const esri = tileLayerOffline(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 23,
      maxNativeZoom: 19,
      attribution: '© Esri World Imagery',
    }
  )

  const baseMaps = {
    'OpenStreetMap': osm,
    'Esri World Imagery': esri,
  }

  planningMap.value = L.map('planningMap', { layers: [osm, esri] }).setView(mapCenter.value as LatLngTuple, zoom.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(planningMap.value)
  planningMap.value.zoomControl.setPosition('bottomright')

  const pane = planningMap.value!.createPane('measurePane')
  pane.style.zIndex = '640'
  pane.style.pointerEvents = 'none'
  measureLayer.value = L.layerGroup().addTo(planningMap.value!) as L.LayerGroup

  planningMap.value.on('moveend', () => {
    if (planningMap.value === undefined) return
    let { lat, lng } = planningMap.value.getCenter()
    if (lat && lng) {
      mapCenter.value = [lat, lng]
    }
  })
  planningMap.value.on('zoomstart', clearLiveMeasure)
  planningMap.value.on('zoomend', () => {
    if (planningMap.value === undefined) return
    zoom.value = planningMap.value?.getZoom() ?? mapCenter.value
  })

  const saveCtlEsri = downloadOfflineMapTiles(esri, 'Esri', 19)
  const saveCtlOSM = downloadOfflineMapTiles(osm, 'OSM', 19)

  if (planningMap.value) {
    saveCtlEsri.addTo(planningMap.value)
    saveCtlOSM.addTo(planningMap.value)
  }

  // Hide native UI for offline map download controls
  const hideCtl = (ctl: any): void => {
    const el = (ctl.getContainer?.() ?? ctl._container) as HTMLElement | undefined
    if (!el) return
    el.classList.add('hidden-savetiles')
    el.style.display = 'none'
  }
  hideCtl(saveCtlEsri)
  hideCtl(saveCtlOSM)

  await nextTick()
  const getBtns = (ctl: any): HTMLAnchorElement[] => {
    const el = (ctl.getContainer?.() ?? ctl._container) as HTMLElement | undefined
    return Array.from(el?.querySelectorAll('a') ?? []) as HTMLAnchorElement[]
  }
  ;[esriSaveBtn] = getBtns(saveCtlEsri) // [0]=save, [1]=remove
  ;[osmSaveBtn] = getBtns(saveCtlOSM)

  // Download progress hooks
  attachOfflineProgress(esri, 'Esri')
  attachOfflineProgress(osm, 'OSM')

  await nextTick()

  planningMap.value.on('mousemove', handleMapMouseMoveNearMissionPath)
  window.addEventListener('keydown', onGlobalKeyDown)
  window.addEventListener('keyup', onGlobalKeyUp)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('mousemove', onWindowMouseMove)

  planningMap.value.on('contextmenu', (e: LeafletMouseEvent) => {
    if (isCreatingSurvey.value) return
    selectedWaypoint.value = undefined
    contextMenuType.value = selectedSurveyId.value === '' ? 'map' : contextMenuType.value
    currentCursorGeoCoordinates.value = [e.latlng.lat, e.latlng.lng]
    showContextMenu(e)
  })

  planningMap.value.on('drag', updateConfirmButtonPosition)
  planningMap.value.on('mousemove', handleMapMouseMove)
  planningMap.value.on('click', (e: L.LeafletMouseEvent) => {
    onMapClick(e)
  })

  const layerControl = L.control.layers(baseMaps)
  planningMap.value.addControl(layerControl)

  // Initialize scale control (always show)
  createScaleControl()

  // Initialize grid overlay
  if (missionStore.showGridOnMissionPlanning) {
    createGridOverlayLocal()
  }

  targetFollower.enableAutoUpdate()
  missionStore.clearMission()
  clearAllSurveyAreas()

  if (instanceOfCockpitMission(missionStore.draftMission)) {
    loadDraftMission(missionStore.draftMission)
  }
})

onUnmounted(() => {
  targetFollower.disableAutoUpdate()
  if (planningMap.value) {
    planningMap.value.off('mousemove', handleMapMouseMoveNearMissionPath)
    window.removeEventListener('keydown', onGlobalKeyDown)
    window.removeEventListener('keyup', onGlobalKeyUp)
    window.removeEventListener('blur', onWindowBlur)
    window.removeEventListener('mousemove', onWindowMouseMove)
  }
  planningMap.value?.off('mousemove', handleMapMouseMove)
  clearLiveMeasure()
})

const vehiclePosition = computed((): [number, number] | undefined =>
  vehicleStore.coordinates.latitude
    ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude]
    : undefined
)

// Create marker for the vehicle
const vehicleMarker = shallowRef<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (!planningMap.value || !vehiclePosition.value) return

  if (vehicleMarker.value === undefined) {
    let vehicleIconUrl = genericVehicleMarkerImage

    if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
      vehicleIconUrl = blueboatMarkerImage
    } else if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) {
      vehicleIconUrl = brov2MarkerImage
    }

    const vehicleMarkerIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `<img src="${vehicleIconUrl}" style="width: 64px; height: 64px;">`,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    })

    vehicleMarker.value = L.marker(vehiclePosition.value, { icon: vehicleMarkerIcon })

    const vehicleMarkerTooltip = L.tooltip({
      content: 'No data available',
      className: 'waypoint-tooltip',
      offset: [40, 0],
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    planningMap.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
})

// Calculate live vehicle heading
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw) : 0))

// Calculate time since last vehicle heartbeat
const timeAgoSeenText = computed(() => {
  const lastBeat = vehicleStore.lastHeartbeat
  return lastBeat ? `${formatDistanceToNow(lastBeat ?? 0, { includeSeconds: true })} ago` : 'never'
})

// Dinamically update data of the vehicle tooltip
watch([vehiclePosition, vehicleHeading, timeAgoSeenText, () => vehicleStore.isArmed], () => {
  if (vehicleMarker.value === undefined) return

  vehicleMarker.value.getTooltip()?.setContent(`
    <p>Coordinates: ${vehiclePosition.value?.[0].toFixed(6)}, ${vehiclePosition.value?.[1].toFixed(6)}</p>
    <p>Velocity: ${vehicleStore.velocity.ground?.toFixed(2) ?? 'N/A'} m/s</p>
    <p>Heading: ${vehicleHeading.value.toFixed(2)}°</p>
    <p>${vehicleStore.isArmed ? 'Armed' : 'Disarmed'}</p>
    <p>Last seen: ${timeAgoSeenText.value}</p>
  `)

  // Update the rotation
  const iconElement = vehicleMarker.value.getElement()?.querySelector('img')
  if (iconElement) {
    iconElement.style.transform = `rotate(${vehicleHeading.value}deg)`
  }
})

const homeMarker = shallowRef<L.Marker>()

watch(home, () => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  const position = home.value
  if (position === undefined) return

  if (!homeMarker.value) {
    homeMarker.value = L.marker(position as LatLngTuple, {
      icon: L.divIcon({ className: 'marker-icon', iconSize: [24, 24], iconAnchor: [12, 12] }),
      draggable: true,
    })
    const homeMarkerTooltip = L.tooltip({
      content: '<i class="mdi mdi-home-map-marker text-[18px]"></i>',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    homeMarker.value.on('dragend', (e: L.DragEndEvent) => {
      const marker = e.target as L.Marker
      const latlng = marker.getLatLng()
      currentCursorGeoCoordinates.value = [latlng.lat, latlng.lng]
      setHomePosition()
    })
    planningMap.value.addLayer(homeMarker.value)
  } else {
    homeMarker.value.setLatLng(position as LatLngTuple)
  }
})

watch(planningMap, (newMap, oldMap) => {
  if (planningMap.value !== undefined && newMap?.options === undefined) {
    planningMap.value = oldMap
  }
})

// Watch for grid overlay changes
watch(
  () => missionStore.showGridOnMissionPlanning,
  (show) => {
    if (!planningMap.value) return
    if (show) {
      createGridOverlayLocal()
    } else {
      removeGridOverlayLocal()
    }
  }
)

// Watch for zoom/move changes to update grid and scale
watch([zoom, mapCenter], () => {
  if (missionStore.showGridOnMissionPlanning && planningMap.value) {
    createGridOverlayLocal()
  }
  if (planningMap.value) {
    createScaleControl()
  }
})

const missionWaypointsPolyline = shallowRef<L.Polyline | null>(null)

const getMissionPathLatLngs = (): L.LatLng[] =>
  missionStore.currentPlanningWaypoints.map((waypoint) => L.latLng(waypoint.coordinates[0], waypoint.coordinates[1]))

watch(
  () => missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates.slice()),
  () => {
    if (!planningMap.value) return

    const missionPathLatLngs = getMissionPathLatLngs()

    if (!missionWaypointsPolyline.value) {
      missionWaypointsPolyline.value = L.polyline(missionPathLatLngs).addTo(planningMap.value)

      missionWaypointsPolyline.value.on('dblclick', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        handleMissionPathDoubleClick(event)
      })
    } else {
      missionWaypointsPolyline.value.setLatLngs(missionPathLatLngs)
    }
  },
  { immediate: true, deep: true }
)

watch([isCtrlDown, isShiftDown, isCreatingSurvey, isCreatingSimplePath, isSettingHomeWaypoint], () => setMapCursor())
watch(planningMap, () => setMapCursor())

// Try to update map center position based on browser geolocation
navigator?.geolocation?.watchPosition(
  (position) => {
    if (!home.value && !vehiclePosition.value) {
      mapCenter.value = [position.coords.latitude, position.coords.longitude]
    }
  },
  (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
)

watch(
  () => interfaceStore.mainMenuCurrentStep,
  (step) => {
    if (step > 1) {
      isCreatingSimplePath.value = false
      isCreatingSurvey.value = false
      return
    }
  }
)

// If vehicle position is updated and map was not yet centered on it, center
let initialVehiclePanDone = false
watch(
  [() => planningMap.value, () => vehiclePosition.value],
  ([mapInstance, vehiclePos]) => {
    if (mapInstance && vehiclePos && !initialVehiclePanDone) {
      mapInstance.setView(vehiclePos, zoom.value)
      mapCenter.value = [...vehiclePos]
      initialVehiclePanDone = true
    }
  },
  { immediate: true }
)

// If home position is updated and map was not yet centered on it, center
watch(
  () => mapCenter.value,
  (newCenter, oldCenter) => {
    if (!planningMap.value || !newCenter) return
    if (oldCenter && newCenter.toString() === oldCenter.toString()) return

    const currentZoom = planningMap.value.getZoom()

    planningMap.value.setView(newCenter as LatLngTuple, currentZoom, { animate: true })
  }
)

const centerHomeButtonTooltipText = computed(() => {
  if (home.value === undefined) {
    return 'Cannot center map on home (home position undefined).'
  }
  if (followerTarget.value === WhoToFollow.HOME) {
    return 'Tracking home position. Click to stop tracking.'
  }
  return 'Click once to center on home or twice to track it.'
})

const centerVehicleButtonTooltipText = computed(() => {
  if (!vehicleStore.isVehicleOnline) {
    return 'Cannot center map on vehicle (vehicle offline).'
  }
  if (vehiclePosition.value === undefined) {
    return 'Cannot center map on vehicle (vehicle position undefined).'
  }
  if (followerTarget.value === WhoToFollow.VEHICLE) {
    return 'Tracking vehicle position. Click to stop tracking.'
  }
  return 'Click once to center on vehicle or twice to track it.'
})

const openPoiDialog = (): void => {
  if (cursorCoordinates.value && poiManagerRef.value) {
    poiManagerRef.value.openDialog(cursorCoordinates.value)
  } else if (!cursorCoordinates.value) {
    showDialog({ variant: 'error', title: 'Error', message: 'Cannot place Point of Interest without map coordinates.' })
    console.error('Cannot open POI dialog without click coordinates for new POI')
  } else if (!poiManagerRef.value) {
    showDialog({ variant: 'error', title: 'Error', message: 'POI Manager is not available.' })
    console.error('Cannot open POI dialog, POI Manager ref is not set.')
  }
  hideContextMenu()
}

// POI Marker Management Functions for MissionPlanningView
const poiIconConfig = (poi: PointOfInterest): L.DivIconOptions => {
  const poiIconHtml = `
    <div class="poi-marker-container">
      <div class="poi-marker-background" style="background-color: ${poi.color}80;"></div>
      <i class="v-icon notranslate mdi ${poi.icon}" style="color: rgba(255, 255, 255, 0.7); position: relative; z-index: 2;"></i>
    </div>
  `

  return {
    html: poiIconHtml,
    className: 'poi-marker-icon',
    iconSize: [32, 32], // Match the actual container size
    iconAnchor: [16, 32], // Center horizontally, bottom vertically (like a pin)
  }
}

// POI Marker Management Functions for MissionPlanningView
const addPoiMarkerToPlanningMap = (poi: PointOfInterest): void => {
  if (!planningMap.value || !planningMap.value.getContainer()) return

  const poiMarkerIcon = L.divIcon(poiIconConfig(poi))

  const marker = L.marker(poi.coordinates as LatLngTuple, { icon: poiMarkerIcon, draggable: true }).addTo(
    planningMap.value
  )

  const tooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  const tooltipConfig = { permanent: false, direction: 'top', offset: [0, -40], className: 'poi-tooltip' }
  marker.bindTooltip(tooltipContent, tooltipConfig)

  marker.on('drag', (event) => {
    const newCoords = event.target.getLatLng()
    const updatedTooltipContent = `
      <strong>${poi.name}</strong><br>
      ${poi.description ? poi.description + '<br>' : ''}
      Lat: ${newCoords.lat.toFixed(8)}, Lng: ${newCoords.lng.toFixed(8)}
    `
    marker.getTooltip()?.setContent(updatedTooltipContent)
  })

  marker.on('dragend', (event) => {
    const newCoords = event.target.getLatLng()
    missionStore.movePointOfInterest(poi.id, [newCoords.lat, newCoords.lng])
  })

  marker.on('click', (event) => {
    L.DomEvent.stopPropagation(event)
    if (poiManagerRef.value) {
      poiManagerRef.value.openDialog(undefined, poi)
    }
  })

  planningPoiMarkers.value[poi.id] = marker
}

const updatePoiMarkerOnPlanningMap = (poi: PointOfInterest): void => {
  if (!planningMap.value || !planningMap.value.getContainer() || !planningPoiMarkers.value[poi.id]) return

  const marker = planningPoiMarkers.value[poi.id]
  marker.setLatLng(poi.coordinates as LatLngTuple)

  marker.setIcon(L.divIcon(poiIconConfig(poi)))

  const updatedTooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  marker.getTooltip()?.setContent(updatedTooltipContent)
}

const removePoiMarkerFromPlanningMap = (poiId: string): void => {
  if (!planningMap.value || !planningPoiMarkers.value[poiId]) return

  planningPoiMarkers.value[poiId].remove()
  delete planningPoiMarkers.value[poiId]
}

// Watch for changes in POIs from the store and update markers
watch(
  () => missionStore.pointsOfInterest,
  async (newPois) => {
    if (!planningMap.value || !planningMap.value.getContainer()) {
      // Defer if map not ready, try again on next tick or when map becomes available
      await nextTick()
      if (!planningMap.value || !planningMap.value.getContainer()) {
        console.warn('MissionPlanningView: POI watcher - planningMap not ready after nextTick.')
        return
      }
    }

    const newPoiIds = new Set(newPois.map((p) => p.id))

    // Remove markers for POIs that no longer exist
    Object.keys(planningPoiMarkers.value).forEach((poiId) => {
      if (!newPoiIds.has(poiId)) {
        removePoiMarkerFromPlanningMap(poiId)
      }
    })

    // Add or update markers
    newPois.forEach((poi) => {
      if (planningPoiMarkers.value[poi.id]) {
        updatePoiMarkerOnPlanningMap(poi)
      } else {
        addPoiMarkerToPlanningMap(poi)
      }
    })
  },
  { deep: true, immediate: true }
)

// Ensure POIs are drawn when the map becomes available, if not already handled by immediate watcher
watch(
  planningMap,
  (currentMap) => {
    if (currentMap && currentMap.getContainer()) {
      // Map is ready, ensure all POIs from the store are drawn
      // This helps if POIs loaded from store before mapInstance was fully initialized
      // or if the immediate watcher for pointsOfInterest ran too early.
      missionStore.pointsOfInterest.forEach((poi) => {
        if (!planningPoiMarkers.value[poi.id]) {
          addPoiMarkerToPlanningMap(poi)
        } else {
          // Potentially update if details changed while map was not ready
          updatePoiMarkerOnPlanningMap(poi)
        }
      })
    }
  },
  { immediate: true }
) // Immediate to catch initial map state
</script>

<style>
#planningMap {
  position: absolute;
  z-index: 0;
  height: 100%;
  width: 100%;
}
.mission-planning {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.waypoint-marker-icon {
  background: none;
  border: none;
}

.waypoint-marker-container {
  position: relative;
  width: 24px;
  height: 24px;
}

.waypoint-main-marker {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
}

.marker-icon {
  background-color: #1e498f;
  border: 1px solid #ffffff55;
  border-radius: 50%;
  z-index: 100 !important;
}

.mission-segment-add-knob {
  transition: opacity 180ms ease, transform 180ms ease;
  will-change: opacity, transform;
}

.mission-segment-add-knob.visible {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
}

.selected-marker {
  border: 2px solid #ffff0099;
  background-color: #1e498f;
}

.green-marker {
  background-color: #034103aa;
}

.command-count-indicator {
  position: absolute;
  top: -6px;
  right: -6px;
  background-color: #ff6b35;
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  z-index: 200 !important;
}
.waypoint-tooltip {
  background-color: transparent;
  border: 0;
  box-shadow: none;
  color: white;
}

.vehicle-marker {
  z-index: 300 !important;
}
.live-measure-line {
  pointer-events: none;
}

.live-measure-tag {
  pointer-events: none;
}
.live-measure-pill {
  position: relative;
  left: -50%;
  top: -50%;
  display: inline-block;
  padding: 6px 10px;
  border-radius: 16px;
  background: #00000011;
  color: #fff;
  font-size: 14px;
  line-height: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  white-space: nowrap;
  transform: translate(0, -50%);
}
.measure-area-icon {
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.measure-area-pill {
  transform: translate(-50%, -50%);
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(6px);
  white-space: nowrap;
}
.set-home-cursor {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%231e498f' stroke='%23ffffff55' stroke-width='2'/%3E%3Cpath d='M12 2c5 0 9 4 9 9 0 3.73-2.63 7.43-8.03 13.2a1 1 0 0 1-1.42 0C5.63 18.43 3 14.73 3 11a9 9 0 0 1 9-9z' fill='white'/%3E%3Cpath d='M8.5 10L12 6.5 15.5 10h-2.5v3h-2v-3H8.5z' fill='%231e498f'/%3E%3C/svg%3E")
      12 12,
    crosshair;
}
.leaflet-top {
  margin-top: 50px;
}
.active-events-on-disabled {
  pointer-events: all;
}
.survey-polygon {
  fill-opacity: 0.2;
  stroke-width: 2;
  stroke: #3b82f6;
  cursor: crosshair;
}
.survey-path {
  stroke-width: 2;
  stroke-dasharray: 16, 16;
  stroke: #2563eb;
}
.survey-cursor {
  cursor: crosshair;
}
.custom-div-icon {
  background: none;
  border: none;
}

.custom-div-icon svg {
  display: block;
}

/* Increase clickable area */
.custom-div-icon::after {
  content: '';
  cursor: grab;
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
}

.edge-marker {
  background: none;
  border: none;
}

.edge-marker svg {
  transition: all 0.3s ease;
}

.edge-marker:hover svg {
  transform: scale(1.2);
}

/* Add hover effect to survey point markers */
.custom-div-icon:hover .delete-icon {
  display: block;
}

/* Add animation to survey path */
@keyframes move {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -100%;
  }
}

.survey-path {
  animation: move 30s infinite linear;
}

.survey-vertex-icon {
  position: relative;
}

.delete-popup {
  position: absolute;
  top: -20px;
  left: -20px;
  background-color: rgba(239, 68, 68, 0.8);
  border-radius: 50%;
  padding: 6px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-button {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poi-marker-icon {
  /* Style for POI markers, if needed, e.g., cursor */
  cursor: pointer;
  background: none;
  color: white;
  border: none;
}

.poi-marker-container {
  font-size: 20px;
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poi-marker-background {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.7);
  z-index: 1;
}

.poi-tooltip {
  /* Style for POI tooltips */
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
}
</style>

<style scoped>
/* Style the standard Leaflet scale control */
:deep(.leaflet-control-scale) {
  position: absolute;
  right: 180px; /* Position to the left of the buttons */
  bottom: 54px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
  padding: 8px 8px;
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14),
    0px 1px 5px 0px rgba(0, 0, 0, 0.12);
}

:deep(.leaflet-control-zoom) {
  bottom: 30px;
}
</style>
