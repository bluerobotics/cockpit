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
      class="absolute flex flex-col left-10 rounded-[10px]"
      :style="[interfaceStore.globalGlassMenuStyles, { height: 'auto', maxHeight: calculatedHeight, width: '250px' }]"
    >
      <div class="flex flex-col w-full h-full p-2 overflow-y-auto">
        <button
          v-if="!isCreatingSimpleMission"
          :class="{ ' elevation-4': isCreatingSurvey }"
          class="h-auto py-2 px-2 m-2 font-medium text-md rounded-md elevation-1 bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          @click="toggleSurvey"
        >
          {{
            isCreatingSurvey
              ? 'CANCEL SURVEY'
              : missionStore.currentPlanningWaypoints.length > 0
              ? 'ADD SURVEY'
              : 'CREATE SURVEY'
          }}
        </button>
        <button
          v-if="!isCreatingSurvey && !isCreatingSimpleMission"
          :class="{ ' elevation-4': isCreatingSimpleMission }"
          class="h-auto py-2 px-2 m-2 font-medium text-md rounded-md elevation-1 bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          @click="toggleSimpleMission"
        >
          {{ missionStore.currentPlanningWaypoints.length > 0 ? 'ADD SIMPLE PATH' : 'CREATE SIMPLE PATH' }}
        </button>
        <v-divider v-if="!isCreatingSimpleMission" class="my-2" />
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
        </div>
        <v-divider v-if="isCreatingSurvey" class="my-2" />
        <div v-if="isCreatingSurvey || isCreatingSimpleMission" class="flex flex-col w-full h-full p-2">
          <p class="text-sm text-slate-200">Waypoint type</p>
          <select
            v-model="WaypointType.PASS_BY"
            class="h-auto py-2 px-2 my-2 mx-5 font-medium text-sm rounded-sm bg-[#FFFFFF33] hover:bg-[#FFFFFF44] transition-colors duration-200"
          >
            <option :value="WaypointType.PASS_BY">Pass-by</option>
          </select>

          <v-divider class="my-2" />
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
          <p class="m-1 overflow-visible mt-2 text-sm text-slate-200">Default cruise speed (m/s)</p>
          <input v-model="defaultCruiseSpeed" class="px-2 py-1 mt-1 mb-2 mx-5 rounded-sm bg-[#FFFFFF22]" />
          <v-divider class="my-2" />
          <button
            :disabled="missionStore.currentPlanningWaypoints.length < 2"
            class="bg-[#FFFFFF33] hover:bg-[#FFFFFF44] text-[12px] mx-8 py-2 rounded-sm my-2"
            :class="{ 'bg-[#FFFFFF11] text-[#FFFFFF22]': missionStore.currentPlanningWaypoints.length < 2 }"
            @click="toggleSimpleMission"
          >
            ADD TO MISSION
          </button>
        </div>

        <div>
          <div class="flex justify-end mt-2 mb-2">
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
          </div>
        </div>
        <v-divider v-if="isCreatingSimpleMission || isCreatingSurvey" class="my-2" />
        <button
          v-if="isCreatingSimpleMission || isCreatingSurvey || missionStore.currentPlanningWaypoints.length > 0"
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
      </div>
    </div>
    <div
      v-if="missionStore.currentPlanningWaypoints.length > 0"
      class="absolute flex flex-col right-8 m-4 p-2 rounded-[16px] max-h-[70%] w-52"
      :style="interfaceStore.globalGlassMenuStyles"
    >
      <div class="flex flex-col w-full h-full p-2 overflow-y-auto">
        <p v-if="missionStore.currentPlanningWaypoints.length === 0" class="text-lg text-center text-slate-100">
          No waypoints added to the mission.
        </p>
        <div v-for="(waypoint, index) in missionStore.currentPlanningWaypoints" :key="waypoint.id">
          <div class="flex w-full items-center justify-between px-1">
            <div>
              <p class="text-base text-slate-100">Waypoint {{ index }} ({{ waypoint.type }})</p>
              <p class="text-sm text-slate-200">Altitude: {{ waypoint.altitude }} m</p>
            </div>
            <button class="flex items-center justify-center w-6 h-6 m-2 rounded-sm" @click="removeWaypoint(waypoint)">
              <v-icon>mdi-delete</v-icon>
            </button>
          </div>
          <div
            v-if="index !== missionStore.currentPlanningWaypoints.length - 1"
            class="w-full h-px my-3 bg-[#FFFFFF33]"
          />
        </div>
      </div>
    </div>
    <v-tooltip location="top center" text="Home position is currently undefined" :disabled="Boolean(home)">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          class="absolute m-3 rounded-sm shadow-sm bottom-14 bg-slate-50"
          :class="[!home ? 'active-events-on-disabled' : '', isCreatingSurvey ? 'left-[320px]' : 'left-6']"
          :color="followerTarget == WhoToFollow.HOME ? 'red' : ''"
          icon="mdi-home-map-marker"
          size="x-small"
          v-bind="tooltipProps"
          :disabled="!home"
          @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
          @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
        />
      </template>
    </v-tooltip>
    <v-tooltip
      location="top center"
      text="Vehicle position is currently undefined"
      :disabled="Boolean(vehiclePosition)"
    >
      <template #activator="{ props: tooltipProps }">
        <v-btn
          class="absolute m-3 rounded-sm shadow-sm bottom-14 bg-slate-50"
          :class="[!vehiclePosition ? 'active-events-on-disabled' : '', isCreatingSurvey ? 'left-[360px]' : 'left-16']"
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
    :is-creating-simple-mission="isCreatingSimpleMission"
    :surveys="surveys"
    :selected-survey-id="selectedSurveyId"
    @close="hideContextMenu"
    @delete-selected-survey="deleteSelectedSurvey"
    @toggle-survey="toggleSurvey"
    @toggle-simple-mission="toggleSimpleMission"
    @regenerate-survey-waypoints="regenerateSurveyWaypoints"
    @survey-lines-angle="onSurveyLinesAngleChange"
  />
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

import { useWindowSize } from '@vueuse/core'
import { saveAs } from 'file-saver'
import L, { type LatLngTuple, LeafletMouseEvent, Map, Marker, Polygon } from 'leaflet'
import { v4 as uuid } from 'uuid'
import type { Ref } from 'vue'
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'

import ContextMenu from '@/components/mission-planning/ContextMenu.vue'
import ScanDirectionDial from '@/components/mission-planning/ScanDirectionDial.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { generateSurveyPath } from '@/libs/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import {
  type CockpitMission,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  instanceOfCockpitMission,
  Survey,
  SurveyPolygon,
  WaypointType,
} from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const { height: windowHeight } = useWindowSize()

const { showDialog } = useInteractionDialog()
const { showSnackbar } = useSnackbar()

const clearMissionOnVehicle = (): void => {
  vehicleStore.clearMissions()
}

const calculatedHeight = computed(() => {
  return windowHeight.value - widgetStore.currentBottomBarHeightPixels - widgetStore.currentTopBarHeightPixels - 20
})

const uploadingMission = ref(false)
const missionUploadProgress = ref(0)
const uploadMissionToVehicle = async (): Promise<void> => {
  uploadingMission.value = true
  missionUploadProgress.value = 0
  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionUploadProgress.value = loadingPerc
  }
  try {
    if (!vehicleStore.isVehicleOnline) {
      throw 'Vehicle is not online.'
    }
    await vehicleStore.uploadMission(missionStore.currentPlanningWaypoints, loadingCallback)
    const message = `Mission upload succeed! Open the Map widget in Flight Mode and click the "play" button to start the mission.`
    showDialog({ variant: 'success', message, timer: 6000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission upload failed', message: error as string, timer: 5000 })
  } finally {
    uploadingMission.value = false
  }
}

const planningMap: Ref<Map | undefined> = ref()
const mapCenter = ref<WaypointCoordinates>(missionStore.defaultMapCenter)
const home = ref(mapCenter.value)
const zoom = ref(missionStore.defaultMapZoom)
const followerTarget = ref<WhoToFollow | undefined>(undefined)
const currentWaypointType = ref<WaypointType>(WaypointType.PASS_BY)
const currentWaypointAltitude = ref(0)
const defaultCruiseSpeed = ref(1)
const currentWaypointAltitudeRefType = ref<AltitudeReferenceType>(AltitudeReferenceType.RELATIVE_TO_HOME)
const waypointMarkers = ref<{ [id: string]: Marker }>({})
const isCreatingSimpleMission = ref(false)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const confirmButtonStyle = ref<Record<string, string>>({})
const surveyPolygonVertexesPositions = ref<L.LatLng[]>([])
const isCreatingSurvey = ref(false)
const selectedSurveyId = ref<string>('')
const surveyPolygonLayers = ref<{ [key: string]: Polygon }>({})
const lastSelectedSurveyId = ref('')
const surveys = ref<Survey[]>([])
const isDragging = ref(false)
let dragStartLatLng: L.LatLng | null = null
let polygonLatLngsAtDragStart: L.LatLng[] = []
let ignoreNextClick = false

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

const onPolygonMouseDown = (event: L.LeafletMouseEvent): void => {
  isDragging.value = true
  dragStartLatLng = event.latlng
  polygonLatLngsAtDragStart = surveyPolygonVertexesPositions.value.map((latlng) => latlng.clone())
  planningMap.value?.dragging.disable()

  planningMap.value?.on('mousemove', onPolygonMouseMove)
  planningMap.value?.on('mouseup', onPolygonMouseUp)

  L.DomEvent.stopPropagation(event.originalEvent)
  L.DomEvent.preventDefault(event.originalEvent)
}

const onPolygonMouseUp = (event: L.LeafletMouseEvent): void => {
  isDragging.value = false
  dragStartLatLng = null
  polygonLatLngsAtDragStart = []
  planningMap.value?.dragging.enable()

  planningMap.value?.off('mousemove', onPolygonMouseMove)
  planningMap.value?.off('mouseup', onPolygonMouseUp)

  ignoreNextClick = true

  L.DomEvent.stopPropagation(event.originalEvent)
  L.DomEvent.preventDefault(event.originalEvent)
}

const onPolygonMouseMove = (event: L.LeafletMouseEvent): void => {
  if (!isDragging.value || !dragStartLatLng) return

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

const showContextMenu = (event: LeafletMouseEvent): void => {
  if (isCreatingSurvey.value) return
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

const toggleSimpleMission = (): void => {
  if (isCreatingSimpleMission.value) {
    isCreatingSimpleMission.value = false
    return
  }
  isCreatingSimpleMission.value = true
}

const toggleSurvey = (): void => {
  if (isCreatingSimpleMission.value) {
    isCreatingSimpleMission.value = false
  }
  if (isCreatingSurvey.value) {
    isCreatingSurvey.value = false
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

const goHome = async (): Promise<void> => {
  if (!home.value || !planningMap.value) return

  targetFollower.goToTarget(WhoToFollow.HOME)
}

// Draws a polygon inside the surveys waypoints
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
    if (isCreatingSimpleMission.value) return
    selectedSurveyId.value = survey.id
    lastSelectedSurveyId.value = survey.id
    L.DomEvent.stopPropagation(event)
  })

  surveyPolygonLayer.on('contextmenu', (event: LeafletMouseEvent) => {
    if (selectedSurveyId.value !== survey.id && !isCreatingSimpleMission.value) {
      selectedSurveyId.value = survey.id
      lastSelectedSurveyId.value = survey.id
    }

    L.DomEvent.stopPropagation(event.originalEvent)
    L.DomEvent.preventDefault(event.originalEvent)

    showContextMenu(event)
  })

  let pressTimer: number | null = null
  const LONG_PRESS_DURATION = 500

  const handleTouchStart = (event: TouchEvent): void => {
    if (isCreatingSimpleMission.value) return

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

  surveyPolygonLayer.on('touchstart', handleTouchStart as any) // eslint-disable @typescript-eslint/no-explicit-any
  surveyPolygonLayer.on('touchend', handleTouchEnd)
  surveyPolygonLayer.on('touchcancel', handleTouchEnd)
}

const clearSurveyVertexMarkers = (): void => {
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
}

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && isCreatingSurvey.value) {
    clearSurveyCreation()
  }
  if (event.key === 'Enter' && isCreatingSurvey.value) {
    generateWaypointsFromSurvey()
  }
  if (event.key === 'Delete' && selectedSurveyId.value) {
    deleteSelectedSurvey()
  }
}

const clearSurveyCreation = (): void => {
  clearSurveyPath()
  isCreatingSurvey.value = false
}

const deleteSelectedSurvey = (): void => {
  const surveyId = selectedSurveyId.value
  if (!surveyId) {
    showSnackbar({ variant: 'error', message: 'No survey selected to delete.', duration: 2000 })
    return
  }

  const surveyIndex = surveys.value.findIndex((s) => s.id === surveyId)
  if (surveyIndex === -1) {
    showSnackbar({ variant: 'error', message: 'Selected survey does not exist.', duration: 2000 })
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

  showSnackbar({ variant: 'success', message: 'Survey deleted.', duration: 2000 })
  hideContextMenu()
}

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

watch(mapCenter, (newCenter, oldCenter) => {
  if (newCenter.toString() === oldCenter.toString()) return
  planningMap.value?.panTo(newCenter as LatLngTuple)
})
watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  planningMap.value?.setZoom(zoom.value)
})

const addWaypoint = (
  coordinates: WaypointCoordinates,
  altitude: number,
  type: WaypointType,
  altitudeReferenceType: AltitudeReferenceType
): void => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  const waypointId = uuid()
  const waypoint: Waypoint = { id: waypointId, coordinates, altitude, type, altitudeReferenceType }

  missionStore.currentPlanningWaypoints.push(waypoint)

  const newMarker = L.marker(coordinates, { draggable: true })
  // @ts-ignore - onMove is a valid LeafletMouseEvent
  newMarker.on('move', (e: L.LeafletMouseEvent) => {
    missionStore.moveWaypoint(waypointId, [e.latlng.lat, e.latlng.lng])
  })
  newMarker.on('contextmenu', () => {
    removeWaypoint(waypoint)
  })

  const markerIcon = L.divIcon({
    className: 'marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
  newMarker.setIcon(markerIcon)
  const markerTooltip = L.tooltip({
    content: `${missionStore.currentPlanningWaypoints.length}`,
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: 1,
  })
  newMarker.bindTooltip(markerTooltip)
  planningMap.value.addLayer(newMarker)
  waypointMarkers.value[waypointId] = newMarker

  const existingWaypointsCount = missionStore.currentPlanningWaypoints.length

  if (existingWaypointsCount > 1) {
    const previousWaypoint = missionStore.currentPlanningWaypoints[existingWaypointsCount - 2]
    addWaypointConnection(previousWaypoint, waypoint)
  }
}

const removeWaypoint = (waypoint: Waypoint): void => {
  const index = missionStore.currentPlanningWaypoints.indexOf(waypoint)
  missionStore.currentPlanningWaypoints.splice(index, 1)
  // @ts-ignore: Marker type is always a layer and thus can be deleted
  planningMap.value?.removeLayer(waypointMarkers.value[waypoint.id])
  delete waypointMarkers.value[waypoint.id]
}

const saveMissionToFile = async (): Promise<void> => {
  const cockpitMissionFile: CockpitMission = {
    version: 0,
    settings: {
      mapCenter: mapCenter.value,
      zoom: zoom.value,
      currentWaypointType: currentWaypointType.value,
      currentWaypointAltitude: currentWaypointAltitude.value,
      currentWaypointAltitudeRefType: currentWaypointAltitudeRefType.value,
      defaultCruiseSpeed: defaultCruiseSpeed.value,
    },
    waypoints: missionStore.currentPlanningWaypoints,
  }
  const blob = new Blob([JSON.stringify(cockpitMissionFile, null, 2)], {
    type: 'application/json',
  })
  saveAs(blob, 'mission_plan.cmp')
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
    currentWaypointType.value = maybeMission['settings']['currentWaypointType']
    currentWaypointAltitude.value = maybeMission['settings']['currentWaypointAltitude']
    currentWaypointAltitudeRefType.value = maybeMission['settings']['currentWaypointAltitudeRefType']
    defaultCruiseSpeed.value = maybeMission['settings']['defaultCruiseSpeed']
    maybeMission['waypoints'].forEach((w: Waypoint) => {
      addWaypoint(w.coordinates, w.altitude, w.type, w.altitudeReferenceType)
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

const surveyPathLayer = ref<L.Polyline | null>(null)
const surveyPolygonLayer = ref<L.Polygon | null>(null)

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
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
  surveyPolygonVertexesPositions.value = []
}

watch(isCreatingSurvey, (isCreatingNow) => {
  if (!isCreatingNow) clearSurveyPath()

  if (planningMap.value) {
    const mapContainer = planningMap.value.getContainer()
    if (isCreatingNow) {
      mapContainer.classList.add('survey-cursor')
    } else {
      mapContainer.classList.remove('survey-cursor')
    }
  }
})

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
          iconSize: [20, 20],
          iconAnchor: [10, 10],
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

  const polygonCoordinates: WaypointCoordinates[] = surveyPolygonVertexesPositions.value.map((latLng) => [
    latLng.lat,
    latLng.lng,
  ])

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
    type: currentWaypointType.value,
    altitudeReferenceType: currentWaypointAltitudeRefType.value,
  }))

  const insertionIndex = missionStore.currentPlanningWaypoints.length

  missionStore.currentPlanningWaypoints.splice(insertionIndex, 0, ...newSurveyWaypoints)

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

  clearSurveyPath()
  isCreatingSurvey.value = false
  reNumberWaypoints()

  showSnackbar({ variant: 'success', message: 'Waypoints generated from survey path.', duration: 1000 })
}

const reNumberWaypoints = (): void => {
  missionStore.currentPlanningWaypoints.forEach((wp, index) => {
    const marker = waypointMarkers.value[wp.id]
    if (marker) {
      marker.getTooltip()?.setContent(`${index + 1}`)
    }
  })
}

const regenerateSurveyWaypoints = (angle?: number): void => {
  if (!selectedSurveyId.value) {
    showSnackbar({ variant: 'error', message: 'No survey selected.', duration: 2000 })
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
      showSnackbar({
        message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
        closeButton: true,
        duration: 2000,
      })
      return
    }

    const newWaypoints: Waypoint[] = continuousPath.map((latLng: L.LatLng) => ({
      id: uuid(),
      coordinates: [latLng.lat, latLng.lng],
      altitude: currentWaypointAltitude.value,
      type: currentWaypointType.value,
      altitudeReferenceType: currentWaypointAltitudeRefType.value,
    }))

    const firstOldWaypointIndex = missionStore.currentPlanningWaypoints.findIndex(
      (wp) => wp.id === selectedSurvey.value!.waypoints[0].id
    )

    if (firstOldWaypointIndex === -1) {
      showSnackbar({ variant: 'error', message: 'Failed to find old waypoints.', duration: 2000 })
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

const addWaypointMarker = (waypoint: Waypoint): void => {
  if (!planningMap.value) return

  const newMarker = L.marker(waypoint.coordinates, { draggable: true })

  newMarker.on('drag', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypoint.id, [latlng.lat, latlng.lng])
  })

  newMarker.on('dragend', () => {
    const latlng = newMarker.getLatLng()
    missionStore.moveWaypoint(waypoint.id, [latlng.lat, latlng.lng])
  })

  newMarker.on('contextmenu', () => {
    removeWaypoint(waypoint)
  })

  const markerIcon = L.divIcon({
    className: 'marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

// Helper function to connect two waypoints with a polyline
const addWaypointConnection = (fromWaypoint: Waypoint, toWaypoint: Waypoint): void => {
  const polyline = L.polyline([fromWaypoint.coordinates, toWaypoint.coordinates], {
    color: '#3B82F6',
    weight: 3,
    opacity: 0.8,
    className: 'waypoint-connection',
  })
  planningMap.value?.addLayer(polyline)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

const onMapClick = (e: L.LeafletMouseEvent): void => {
  hideContextMenu()
  if (ignoreNextClick) {
    ignoreNextClick = false
    return
  }

  if (isCreatingSurvey.value) {
    addSurveyPoint(e.latlng)
  } else if (isCreatingSimpleMission.value) {
    addWaypoint(
      [e.latlng.lat, e.latlng.lng],
      currentWaypointAltitude.value,
      currentWaypointType.value,
      currentWaypointAltitudeRefType.value
    )
  }
}

onMounted(async () => {
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  })
  const esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri World Imagery' }
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

  planningMap.value.on('moveend', () => {
    if (planningMap.value === undefined) return
    let { lat, lng } = planningMap.value.getCenter()
    if (lat && lng) {
      mapCenter.value = [lat, lng]
    }
  })
  planningMap.value.on('zoomend', () => {
    if (planningMap.value === undefined) return
    zoom.value = planningMap.value?.getZoom() ?? mapCenter.value
  })

  await goHome()
  await nextTick()

  planningMap.value.on('contextmenu', showContextMenu)
  planningMap.value.on('drag', updateConfirmButtonPosition)
  planningMap.value.on('click', (e: L.LeafletMouseEvent) => {
    onMapClick(e)
  })

  const layerControl = L.control.layers(baseMaps)
  planningMap.value.addControl(layerControl)

  targetFollower.enableAutoUpdate()
})

onUnmounted(() => {
  targetFollower.disableAutoUpdate()
  missionStore.clearMission()
})

const vehiclePosition = computed((): [number, number] | undefined =>
  vehicleStore.coordinates.latitude
    ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude]
    : undefined
)

const vehicleMarker = ref<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  if (vehiclePosition.value === undefined) return

  if (vehicleMarker.value === undefined) {
    vehicleMarker.value = L.marker(vehiclePosition.value)
    const vehicleMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [16, 16], iconAnchor: [8, 8] })
    vehicleMarker.value.setIcon(vehicleMarkerIcon)
    const vehicleMarkerTooltip = L.tooltip({
      content: 'V',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    planningMap.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
})

const homeMarker = ref<L.Marker>()
watch(home, () => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  const position = home.value
  if (position === undefined) return

  if (homeMarker.value === undefined) {
    homeMarker.value = L.marker(position as LatLngTuple)
    const homeMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [16, 16], iconAnchor: [8, 8] })
    homeMarker.value.setIcon(homeMarkerIcon)
    const homeMarkerTooltip = L.tooltip({
      content: 'H',
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
      opacity: 1,
    })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    planningMap.value.addLayer(homeMarker.value)
  }
  homeMarker.value.setLatLng(home.value)
})

watch(planningMap, (newMap, oldMap) => {
  if (planningMap.value !== undefined && newMap?.options === undefined) {
    planningMap.value = oldMap
  }
})

const missionWaypointsPolyline = ref()
watch(missionStore.currentPlanningWaypoints, (newWaypoints) => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')
  if (missionWaypointsPolyline.value === undefined) {
    missionWaypointsPolyline.value = L.polyline(newWaypoints.map((w) => w.coordinates)).addTo(planningMap.value)
  }
  missionWaypointsPolyline.value.setLatLngs(newWaypoints.map((w) => w.coordinates))
})

// Try to update home position based on browser geolocation
navigator?.geolocation?.watchPosition(
  (position) => (home.value = [position.coords.latitude, position.coords.longitude]),
  (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
)

watch(
  () => interfaceStore.mainMenuCurrentStep,
  (step) => {
    if (step > 1) {
      isCreatingSimpleMission.value = false
      isCreatingSurvey.value = false
      return
    }
  }
)

// If home position is updated and map was not yet centered on it, center
let mapNotYetCenteredInHome = true
watch([home, planningMap], async () => {
  if (home.value === mapCenter.value || !planningMap.value || !mapNotYetCenteredInHome) return
  await goHome()
  mapNotYetCenteredInHome = false
})
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
.marker-icon {
  background-color: rgb(0, 110, 255);
  border-radius: 12px;
}
.waypoint-tooltip {
  background-color: transparent;
  border: 0;
  box-shadow: none;
  color: white;
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
</style>
