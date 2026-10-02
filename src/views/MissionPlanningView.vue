<template>
  <div
    class="mission-planning"
    :class="{ 'mission-planning--fence-mode': planningMode === 'geofence' }"
    :style="glassMenuCssVars"
  >
    <div id="planningMap" ref="planningMapElement" class="relative" />
    <MapLayerControl
      ref="layerControlRef"
      :base-layers="tileSelection.baseLayers.value"
      :overlays="[...tileSelection.overlays.value, ...mapOverlays.selectorEntries.value]"
      @select-base="tileSelection.selectBaseLayer"
      @toggle-overlay="onToggleOverlay"
    />
    <MeasureExtentInput
      v-for="box in extentBoxes"
      :key="box.id"
      :label="box.label"
      :left="box.left"
      :top="box.top"
      :value="box.value"
      :live-value="box.liveValue"
      :cleared="box.cleared"
      :autofocus="box.autofocus"
      :focus-ticket="box.focusTicket"
      @update:value="(value) => setExtentValue(box.id, value)"
      @apply="applyExtent(box.id)"
      @close="closeExtentInputs"
    />
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      text="Generate waypoints"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute text-[22px] -ml-[10px] -mt-[10px] bg-transparent rounded-full cursor-pointer elevation-4"
          variant="text"
          @click="generateWaypointsFromSurvey"
        >
          <v-icon color="green" class="border-2 rounded-full bg-white">mdi-check-circle</v-icon>
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      :text="`Scan spacing (${distanceUnit})`"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[46px] ml-[10px] rounded-lg elevation-4"
          variant="text"
        >
          <input
            v-model.number="displayedDistanceBetweenSurveyLines"
            class="rounded-lg bg-[#333333EE] text-white w-12 pl-2 pa-0"
            type="number"
            :min="metersToDisplayBound(1)"
          />
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      :text="`Turnaround distance (${distanceUnit})`"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[76px] ml-[10px] rounded-lg elevation-4"
          variant="text"
        >
          <input
            v-model.number="displayedTurnaroundDistance"
            class="rounded-lg bg-[#333333EE] text-white w-12 pl-2 pa-0"
            type="number"
          />
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      :text="`Cruise speed (${speedUnit})`"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[106px] ml-[10px] rounded-lg elevation-4"
          variant="text"
        >
          <input
            v-model.number="displayedCruiseSpeed"
            class="rounded-lg bg-[#333333EE] text-white w-12 pl-2 pa-0"
            type="number"
            :min="metersPerSecondToDisplayBound(1)"
            step="0.5"
          />
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      text="Rotate the survey entry point to the next corner"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[24px] -ml-[165px] bg-transparent cursor-pointer elevation-4"
          variant="text"
          @click="rotateDraftSurveyEntryPoint"
        >
          <div class="flex items-center justify-center w-8 h-8 border-2 rounded-full bg-[#333333EE]">
            <v-icon color="white" size="16">mdi-rotate-right</v-icon>
          </div>
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      :text="surveyCrosshatch ? 'Disable 90° crosshatch re-fly' : 'Enable 90° crosshatch re-fly'"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[72px] -ml-[165px] bg-transparent cursor-pointer elevation-4"
          variant="text"
          @click="setSurveyCrosshatch(!surveyCrosshatch)"
        >
          <div
            class="flex items-center justify-center w-8 h-8 border-2 rounded-full"
            :class="surveyCrosshatch ? 'bg-[#A855F7]' : 'bg-[#333333EE]'"
          >
            <v-icon color="white" size="16">mdi-grid</v-icon>
          </div>
        </div>
      </template>
    </v-tooltip>
    <v-tooltip
      v-if="isCreatingSurvey && surveyCrosshatch && surveyPolygonVertexesPositions.length >= 3"
      location="top"
      :text="`Crosshatch scan spacing (${distanceUnit})`"
    >
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute mt-[120px] -ml-[160px] rounded-lg elevation-4"
          variant="text"
        >
          <input
            v-model.number="displayedCrosshatchDistanceBetweenLines"
            class="rounded-lg bg-[#333333EE] text-white w-12 pl-2 pa-0"
            type="number"
            :min="metersToDisplayBound(1)"
          />
        </div>
      </template>
    </v-tooltip>
    <v-tooltip v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3" location="top" text="Clear survey">
      <template #activator="{ props }">
        <div
          v-bind="props"
          :style="confirmButtonStyle"
          class="absolute text-[14px] mt-[150px] -ml-[7px] bg-transparent rounded-full cursor-pointer elevation-4"
          variant="text"
          @click="clearSurveyCreation"
        >
          <div color="white" class="border-2 rounded-full bg-red text-[18px] pa-1">
            <svg width="16" height="16" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
                stroke="white"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
      </template>
    </v-tooltip>
    <div
      v-if="isCreatingSurvey && surveyPolygonVertexesPositions.length >= 3"
      :style="confirmButtonStyle"
      class="absolute central-element flex justify-start items-start mt-12 -ml-[100px]"
    >
      <ScanDirectionDial
        v-model:angle="surveyLinesAngle"
        polygon-state
        @survey-lines-angle="onSurveyLinesAngleChange"
        @regenerate-survey-waypoints="regenerateSurveyWaypoints"
      />
    </div>
    <MissionPlacementToolbar
      v-if="isPlacingMission"
      v-model:scale-x-percent="placementScaleXPercent"
      v-model:scale-y-percent="placementScaleYPercent"
      v-model:rotation-deg="placementRotationDeg"
      :position-style="placementToolbarStyle"
      :limits="PLACEMENT_LIMITS"
      @clamp-scale-x="clampPlacementScaleX"
      @clamp-scale-y="clampPlacementScaleY"
      @clamp-rotation="clampPlacementRotation"
      @confirm="onConfirmPlacement"
      @reset="onResetPlacement"
      @cancel="cancelFreePlacement()"
    />
    <GeoFenceDrawingActionButtons
      :polygon-vertexes="fencePolygonVertexesPositions"
      @finish="onFinishFencePolygonDrawing"
    />
    <MissionPlanningSidebar
      ref="missionToolboxSidebarRef"
      v-model:planning-mode="planningMode"
      :map-center="mapCenter"
      :calculated-height="calculatedHeight"
      :top-offset="missionToolboxTop"
    >
      <template #mission>
        <div
          v-if="!isCreatingSurvey && !isCreatingSimplePath && !vehicleStore.isVehicleOnline"
          class="flex flex-col mx-4 my-2 gap-y-1"
        >
          <div class="flex flex-row justify-between items-center">
            <p class="text-sm">Planning for</p>
            <v-tooltip
              location="top"
              text="No vehicle connected. Pick the vehicle type so vehicle-specific planning features show up."
            >
              <template #activator="{ props: tooltipProps }">
                <v-icon v-bind="tooltipProps" size="14" class="opacity-70">mdi-information-outline</v-icon>
              </template>
            </v-tooltip>
          </div>
          <v-select
            v-model="missionStore.plannedVehicleType"
            :items="plannedVehicleTypeItems"
            item-title="label"
            item-value="value"
            hide-details
            density="compact"
            theme="dark"
            variant="outlined"
            class="text-sm"
            @update:model-value="onPlannedVehicleTypeChange"
          />
        </div>
        <div
          v-if="!isCreatingSurvey && !isCreatingSimplePath"
          class="flex flex-row items-center justify-between m-2 gap-x-2"
        >
          <div class="flex flex-row items-center gap-x-1 w-[130px] -ml-1">
            <p class="text-xs">Cruise speed</p>
            <input
              v-model.number="displayedCruiseSpeed"
              class="w-[55px] px-1 py-0 rounded-sm bg-[#FFFFFF22] text-sm"
              type="number"
              min="0"
              step="0.5"
              @change="cruiseSpeedTouched = true"
            />
            <p class="text-xs">{{ speedUnit }}</p>
          </div>
          <v-divider vertical class="opacity-30 mx-1 h-5 self-center" />
          <div class="flex flex-row items-center gap-x-2">
            <span class="text-sm font-medium mr-1">
              {{ missionStore.currentPlanningWaypoints.length > 0 ? 'Add:' : 'New:' }}
            </span>
            <v-tooltip
              location="top"
              :text="missionStore.currentPlanningWaypoints.length > 0 ? 'Add survey area' : 'Create survey area'"
            >
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  icon="mdi-grid"
                  variant="elevated"
                  color="#3B78A8"
                  size="x-small"
                  class="rounded-md"
                  @click="toggleSurvey"
                />
              </template>
            </v-tooltip>
            <v-tooltip
              location="top"
              :text="missionStore.currentPlanningWaypoints.length > 0 ? 'Add simple path' : 'Create simple path'"
            >
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  icon="mdi-vector-polyline"
                  variant="elevated"
                  color="#3B78A8"
                  size="x-small"
                  class="rounded-md"
                  @click="toggleSimplePath"
                />
              </template>
            </v-tooltip>
          </div>
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
              Set mission home
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
            <v-icon v-if="cruiseSpeedStatus === 'invalid'" class="text-sm mr-4 text-red-500">mdi-close-circle</v-icon>
            <v-icon v-else-if="cruiseSpeedStatus === 'unchanged'" class="text-sm mr-4 text-[#d38d32]"
              >mdi-alert-circle</v-icon
            >
            <v-icon v-else class="text-sm mr-4 text-green-500">mdi-check-circle</v-icon>
            <p class="mr-2">Set cruise speed</p>

            <v-tooltip v-if="isSurfaceBoat" location="right">
              <template #activator="{ props }">
                <v-icon v-bind="props" class="ml-4 text-slate-400 text-sm cursor-help">mdi-information-outline</v-icon>
              </template>
              <div class="text-sm pa-1">
                <p class="mb-1 text-center"><strong>Tested BlueBoat speeds:</strong></p>
                <p class="mb-[3px]">Safe: {{ testedSpeed(1) }} to {{ testedSpeed(1.5) }} {{ speedUnit }}</p>
                <p class="mb-[3px]">Average: {{ testedSpeed(2) }} {{ speedUnit }}</p>
                <p>Max: {{ testedSpeed(3) }} {{ speedUnit }} (heavily depends on wind, waves and stream)</p>
              </div>
            </v-tooltip>
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
          v-if="home === undefined && !isSettingHomeWaypoint && !isCreatingSurvey && !isCreatingSimplePath"
          class="flex justify-end ma-2"
          @click="handleAddHomeWaypointByClick"
          @dragstart="handleAddHomeWaypointByClick"
        >
          <p
            class="text-sm flex justify-start items-center bg-[#1e498f] rounded-full pl-3 pr-1 py-1 border-[1px] border-[#FFFFFF44] elevation-2 cursor-pointer"
          >
            <span>Set mission home</span>
            <v-icon class="text-md ml-2">mdi-home-circle</v-icon>
          </p>
        </div>
        <v-divider v-if="!isCreatingSimplePath && !isCreatingSurvey" class="my-2" />
        <div v-if="isCreatingSurvey" class="flex flex-col">
          <p class="m-1 overflow-visible text-sm text-slate-200">Distance between lines ({{ distanceUnit }})</p>
          <input
            v-model.number="displayedDistanceBetweenSurveyLines"
            class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
            :min="metersToDisplayBound(1)"
          />
          <p class="m-1 overflow-visible text-sm text-slate-200">Lines angle (degrees)</p>
          <input
            v-model.number="surveyLinesAngleDisplay"
            class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
            min="0"
            max="359"
          />
          <p class="m-1 overflow-visible text-sm text-slate-200">Turnaround distance ({{ distanceUnit }})</p>
          <input
            v-model.number="displayedTurnaroundDistance"
            class="px-2 py-1 mt-1 mb-2 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
          />
          <div class="flex items-center mx-4">
            <v-checkbox
              :model-value="surveyCrosshatch"
              label="Re-fly at 90° (crosshatch)"
              theme="dark"
              density="compact"
              hide-details
              @update:model-value="setSurveyCrosshatch"
            />
            <v-tooltip
              location="top"
              max-width="260"
              text="Flies the area again at 90° for better photogrammetry coverage (≈doubles flight time)."
            >
              <template #activator="{ props: crosshatchInfoProps }">
                <v-icon v-bind="crosshatchInfoProps" size="18" class="ml-1 text-slate-300 cursor-help">
                  mdi-information-outline
                </v-icon>
              </template>
            </v-tooltip>
          </div>
          <template v-if="surveyCrosshatch">
            <p class="m-1 overflow-visible text-sm text-slate-200">
              Crosshatch distance between lines ({{ distanceUnit }})
            </p>
            <input
              v-model.number="displayedCrosshatchDistanceBetweenLines"
              class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
              type="number"
              :min="metersToDisplayBound(1)"
            />
          </template>
          <div class="flex items-center justify-between mx-5 my-2">
            <p class="overflow-visible text-sm text-slate-200">Entry point</p>
            <v-btn
              size="small"
              variant="tonal"
              theme="dark"
              prepend-icon="mdi-rotate-right"
              @click="rotateDraftSurveyEntryPoint"
            >
              Rotate
            </v-btn>
          </div>
          <v-divider class="mb-1 mt-2" />
          <p class="m-1 overflow-visible text-sm text-slate-200">Altitude ({{ altitudeUnit }})</p>
          <input
            v-model.number="displayedWaypointAltitude"
            class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
            type="number"
          />
          <p class="m-1 overflow-visible text-sm text-slate-200">Altitude type:</p>
          <v-select
            v-model="currentWaypointAltitudeRefType"
            :items="availableFrames"
            item-title="name"
            item-value="value"
            hide-details
            attach
            density="compact"
            theme="dark"
            variant="outlined"
            class="mx-5 my-1 text-sm"
          />
          <v-divider class="mb-1 mt-2" />
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
              @click="clearSurveyPathByUser"
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
        <div v-if="isCreatingSimplePath" class="flex flex-col w-full h-full p-2 -mt-[5px]">
          <p class="overflow-visible my-1 text-sm text-slate-200">Altitude ({{ altitudeUnit }})</p>
          <input v-model.number="displayedWaypointAltitude" class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]" />
          <p class="overflow-visible mt-2 text-sm text-slate-200">Altitude type:</p>
          <v-select
            v-model="currentWaypointAltitudeRefType"
            :items="availableFrames"
            item-title="name"
            item-value="value"
            hide-details
            attach
            density="compact"
            theme="dark"
            variant="outlined"
            class="mx-5 my-1 text-sm"
          />
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
          <div class="flex w-full justify-between my-2 px-3">
            <v-tooltip location="top" text="Undo (Ctrl+Z / Cmd+Z)">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-undo"
                  variant="text"
                  size="24"
                  :disabled="!missionStore.canUndo"
                  class="text-[12px]"
                  @click="performUndo"
                />
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Redo (Ctrl+Y / Cmd+Y)">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-redo"
                  variant="text"
                  size="24"
                  :disabled="!missionStore.canRedo"
                  class="text-[12px]"
                  @click="performRedo"
                />
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Mission library">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-bookshelf"
                  variant="text"
                  size="24"
                  class="text-[12px]"
                  @click="openMissionLibrary()"
                />
              </template>
            </v-tooltip>
            <v-divider vertical />
            <v-tooltip location="top" text="Clear mission on vehicle">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  :disabled="loading || !vehicleStore.isVehicleOnline"
                  variant="text"
                  size="24"
                  class="text-[12px]"
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
                  class="text-[12px]"
                  @click="handleOpenMissionSettings"
                />
              </template>
            </v-tooltip>
          </div>
        </div>
        <div
          v-if="!isCreatingSimplePath && !isCreatingSurvey && missionStore.currentPlanningWaypoints.length > 0"
          class="flex flex-row items-stretch gap-2 m-2 mt-2"
        >
          <button
            :disabled="missionStore.currentPlanningWaypoints.length < 2 || !vehicleStore.isVehicleOnline"
            :class="{
              'bg-[#FFFFFF11] hover:bg-[#FFFFFF11] text-[#FFFFFF22] elevation-0':
                missionStore.currentPlanningWaypoints.length < 2 || !vehicleStore.isVehicleOnline,
            }"
            class="flex-1 min-w-0 h-[40px] py-2 px-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
            @click="uploadMissionToVehicle"
          >
            UPLOAD MISSION TO VEHICLE
          </button>
          <v-tooltip
            location="top"
            :text="missionActionsMenuExpanded ? 'Hide mission actions' : 'Show mission actions'"
          >
            <template #activator="{ props }">
              <button
                v-bind="props"
                :aria-label="missionActionsMenuExpanded ? 'Hide mission actions' : 'Show mission actions'"
                class="relative flex items-center justify-center h-[40px] py-2 px-1 rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
                @click="toggleMissionActionsMenu"
              >
                <span
                  v-if="hasLastUploadedMission && !missionActionsMenuExpanded"
                  class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#3B78A8]"
                />
                <v-icon
                  size="28"
                  class="text-white transition-transform duration-200"
                  :class="{ 'rotate-180': missionActionsMenuExpanded }"
                >
                  mdi-menu-down
                </v-icon>
              </button>
            </template>
          </v-tooltip>
        </div>
        <v-expand-transition
          v-if="!isCreatingSimplePath && !isCreatingSurvey && missionStore.currentPlanningWaypoints.length > 0"
        >
          <div v-if="missionActionsMenuExpanded" class="flex flex-col">
            <v-divider class="mx-2 my-1 opacity-5" />
            <button
              :disabled="loading"
              class="h-auto py-1 px-1 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
              @click="openCLearMissionDialog"
            >
              <v-progress-circular v-if="loading" size="20" class="py-4" />
              <p v-else>CLEAR CURRENT MISSION</p>
            </button>
            <button
              :disabled="loading || !vehicleStore.isVehicleOnline"
              class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
              :class="{ 'cursor-not-allowed opacity-50 text-[#FFFFFF44]': !vehicleStore.isVehicleOnline }"
              @click="downloadMissionFromVehicle"
            >
              <v-progress-circular v-if="loading" size="20" class="py-4" />
              <p v-else>DOWNLOAD MISSION FROM VEHICLE</p>
            </button>
            <button
              v-if="hasLastUploadedMission"
              :disabled="loading"
              class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
              @click="restoreLastUploadedMission"
            >
              RESTORE LAST UPLOADED MISSION
            </button>
          </div>
        </v-expand-transition>
        <div v-else-if="!isCreatingSimplePath && !isCreatingSurvey" class="flex flex-col gap-2 m-2 mt-2">
          <button
            :disabled="loading || !vehicleStore.isVehicleOnline"
            class="h-auto py-2 px-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
            :class="{ 'cursor-not-allowed opacity-50 text-[#FFFFFF44]': !vehicleStore.isVehicleOnline }"
            @click="downloadMissionFromVehicle"
          >
            <v-progress-circular v-if="loading" size="20" class="py-4" />
            <p v-else>DOWNLOAD MISSION FROM VEHICLE</p>
          </button>
          <button
            v-if="hasLastUploadedMission"
            :disabled="loading"
            class="h-auto py-2 px-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
            @click="restoreLastUploadedMission"
          >
            RESTORE LAST UPLOADED MISSION
          </button>
        </div>
      </template>
    </MissionPlanningSidebar>
    <v-tooltip location="top" text="Switch to Flight mode">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          class="absolute right-[180px] w-[140px] m-3 mb-[13px] bottom-12 bg-slate-50 text-[12px] font-bold"
          elevation="8"
          text="Flight mode"
          append-icon="mdi-send"
          :style="interfaceStore.globalGlassMenuStyles"
          hide-details
          size="small"
          @click.stop="goToFlightView"
        />
      </template>
    </v-tooltip>
    <v-tooltip location="top center" text="Download map tiles">
      <template #activator="{ props: tooltipProps }">
        <v-menu v-model="downloadMenuOpen" :close-on-content-click="false" location="top end">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="{ ...menuProps, ...tooltipProps }"
              class="absolute m-3 rounded-sm shadow-sm bottom-12 bg-slate-50 right-[88px] text-[14px]"
              :style="interfaceStore.globalGlassMenuStyles"
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
    <v-tooltip
      location="top center"
      :text="
        missionStore.alwaysShowWaypointNumbers
          ? 'Hide waypoint numbers when zoomed out'
          : 'Always show waypoint numbers'
      "
    >
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          class="absolute m-3 rounded-sm shadow-sm bottom-12 bg-slate-50 right-[132px] text-[14px]"
          :style="interfaceStore.globalGlassMenuStyles"
          :color="missionStore.alwaysShowWaypointNumbers ? 'primary' : ''"
          size="x-small"
          icon="mdi-numeric-1-circle-outline"
          @click="missionStore.toggleAlwaysShowWaypointNumbers()"
        />
      </template>
    </v-tooltip>
    <MapCenterControl
      v-model:open="speedDialOpen"
      :target-follower="targetFollower"
      :follower-target="followerTarget"
      :home="home"
      :vehicle-position="vehiclePosition"
      :is-vehicle-online="vehicleStore.isVehicleOnline"
      :has-mission-waypoints="hasMissionWaypoints"
      :activator-style="{ bottom: '3rem' }"
      @center-on-mission="centerOnMission"
    />
    <MapNorthIndicator class="north-indicator" />
    <v-progress-linear
      v-if="uploadingMission"
      :model-value="missionUploadProgress"
      absolute
      bottom
      height="10"
      color="white"
      :style="`top: ${widgetStore.currentTopBarHeightPixelsScaled}px`"
    />
    <p
      v-if="uploadingMission"
      class="fixed left-[7px] flex text-md font-bold text-white z-30 drop-shadow-md"
      :style="`top: ${widgetStore.currentTopBarHeightPixelsScaled + 10}px`"
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
    :can-save-current="canSaveCurrentMissionToLibrary"
    :nearest-segment-index="contextMenuNearestSegmentIndex"
    @set-home-position="setHomePositionFromContextMenu"
    @close="hideContextMenu"
    @delete-selected-survey="deleteSelectedSurvey"
    @rotate-survey-entry-point="rotateSurveyEntryPoint"
    @toggle-survey="addSurveyFromContextMenu"
    @toggle-simple-path="addSimplePathFromContextMenu"
    @undo-generated-waypoints="undoGenerateWaypoints"
    @regenerate-survey-waypoints="regenerateSurveyWaypoints"
    @toggle-crosshatch="toggleSurveyCrosshatch"
    @survey-lines-angle="onSurveyLinesAngleChange"
    @remove-waypoint="removeSelectedWaypoint"
    @place-point-of-interest="openPoiDialog"
    @add-waypoint-at-cursor="addWaypointFromContextMenu"
    @open-segment-radial-menu="openSegmentRadialMenuFromContextMenu"
    @clear-vehicle-path-history="clearVehiclePathHistory"
    @open-map-overlays="overlaysDialogOpen = true"
    @place-base-station="placeBaseStationFromContextMenu"
    @configure-base-station="baseStationStore.configPanelOpen = true"
    @remove-base-station="confirmRemoveBaseStation(showDialog, closeDialog)"
    @toggle-base-station-signal-visibility="baseStationStore.toggleSignalVisibility()"
    @add-mission-from-library="addMissionFromLibraryContextMenu"
    @save-mission-to-library="openMissionLibraryWithSaveDialog"
  />
  <MapOverlaysDialog v-model="overlaysDialogOpen" :loading-ids="overlayLoadingIds" />
  <Teleport to="#planningMap">
    <RadialMenu
      :visible="segmentRadialMenuVisible"
      :x="segmentRadialMenuPosition.x"
      :y="segmentRadialMenuPosition.y"
      :items="segmentRadialMenuItems"
      @select="onSegmentRadialMenuSelect"
      @dismiss="dismissSegmentRadialMenu"
    />
  </Teleport>
  <SideConfigPanel
    v-if="isCreatingSurvey || selectedWaypoint"
    position="right"
    :reopen-label="isCreatingSurvey ? 'Vertexes' : undefined"
    style="z-index: 600; pointer-events: auto"
    class="w-[320px]"
  >
    <SurveyVertexList
      v-if="isCreatingSurvey"
      :vertexes="surveyPolygonVertexesPositions"
      @update-vertex="onUpdateSurveyVertex"
      @remove-vertex="onRemoveSurveyVertex"
    />
    <WaypointConfigPanel
      v-else-if="selectedWaypoint"
      :selected-waypoint="selectedWaypoint"
      @remove-waypoint="removeSelectedWaypoint"
      @should-update-waypoints="handleShouldUpdateWaypoints"
    />
  </SideConfigPanel>
  <HomePositionSettingHelp v-model="showHomePositionNotSetDialog" />
  <PoiManager ref="poiManagerRef" />
  <Teleport to="#planningMap">
    <PoiMapArrows
      :map-ready="mapReady"
      :force-full-screen="true"
      :show-poi-arrows="true"
      :show-home-arrow="true"
      :show-vehicle-arrow="true"
      :show-base-station-arrow="baseStationStore.config.enabled"
      :vehicle-position="vehiclePosition"
      :home="home"
      :base-station="baseStationStore.activePosition"
      :base-station-color="baseStationStore.config.coverageColor"
      :map-center="mapCenter"
      :zoom="zoom"
      :target-follower="targetFollower"
    />
  </Teleport>
  <GeoFenceMapLayer :readonly="planningMode !== 'geofence'" />

  <v-progress-linear
    v-if="fetchingMission"
    :model-value="missionFetchProgress"
    height="10"
    absolute
    bottom
    color="white"
    :style="`top: ${widgetStore.currentTopBarHeightPixelsScaled}px`"
  />
  <p
    v-if="fetchingMission"
    :style="`top: ${widgetStore.currentTopBarHeightPixelsScaled}px`"
    class="absolute left-[7px] mt-4 flex text-md font-bold text-white z-30 drop-shadow-md"
  >
    Loading mission...
  </p>
  <div
    v-if="isSavingOfflineTiles"
    class="absolute top-14 left-2 flex justify-start items-center text-white text-md py-2 px-4 rounded-lg"
    :style="interfaceStore.globalGlassMenuStyles"
  >
    <p>
      Saving offline map content
      <span v-if="savingLayerName">({{ savingLayerName }})</span>:&nbsp; {{ savePercentage }}%
      <span v-if="estimatedDownloadedMB && estimatedTotalMB">
        (~{{ estimatedDownloadedMB }} / {{ estimatedTotalMB }} MB)
      </span>
    </p>
  </div>
  <MissionEstimatesPanel v-if="!speedDialOpen" v-model="missionStore.showMissionEstimates" />
  <MissionLibraryModal
    v-if="interfaceStore.isMissionLibraryVisible"
    :current-mission-snapshot="currentMissionSnapshot"
    :current-mission-estimates="currentMissionEstimatesSnapshot"
    :effective-vehicle-type="missionStore.effectiveVehicleType"
    :open-save-on-mount="missionLibraryOpenSaveOnMount"
    @load-mission="handleLoadMissionFromLibrary"
  />
</template>
<script setup lang="ts">
import { useDebounceFn, useElementSize, useWindowSize, watchDebounced } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { type InstanceType, computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw, watch } from 'vue'

import blueboatMarkerImage from '@/assets/blueboat-marker.avif'
import brov2MarkerImage from '@/assets/brov2-marker.avif'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.avif'
import GeoFenceDrawingActionButtons from '@/components/geofence/GeoFenceDrawingActionButtons.vue'
import GeoFenceMapLayer from '@/components/geofence/GeoFenceMapLayer.vue'
import MapLayerControl from '@/components/map/MapLayerControl.vue'
import MapNorthIndicator from '@/components/map/MapNorthIndicator.vue'
import MapOverlaysDialog from '@/components/map/MapOverlaysDialog.vue'
import MapCenterControl from '@/components/MapCenterControl.vue'
import ContextMenu from '@/components/mission-planning/ContextMenu.vue'
import HomePositionSettingHelp from '@/components/mission-planning/HomePositionSettingHelp.vue'
import MeasureExtentInput from '@/components/mission-planning/MeasureExtentInput.vue'
import MissionEstimatesPanel from '@/components/mission-planning/MissionEstimates.vue'
import MissionPlacementToolbar, {
  PLACEMENT_TOOLBAR_FOOTPRINT,
} from '@/components/mission-planning/MissionPlacementToolbar.vue'
import MissionPlanningSidebar from '@/components/mission-planning/MissionPlanningSidebar.vue'
import ScanDirectionDial from '@/components/mission-planning/ScanDirectionDial.vue'
import SurveyVertexList from '@/components/mission-planning/SurveyVertexList.vue'
import WaypointConfigPanel from '@/components/mission-planning/WaypointConfigPanel.vue'
import MissionLibraryModal from '@/components/MissionLibraryModal.vue'
import PoiManager from '@/components/poi/PoiManager.vue'
import PoiMapArrows from '@/components/poi/PoiMapArrows.vue'
import RadialMenu, { type RadialMenuItem } from '@/components/RadialMenu.vue'
import SideConfigPanel from '@/components/SideConfigPanel.vue'
import { confirmRemoveBaseStation, useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useBaseStationOverlay } from '@/composables/baseStation/useBaseStationOverlay'
import { useMissionPathSignalOverlay } from '@/composables/baseStation/useMissionPathSignalOverlay'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useDragMeasureOverlay } from '@/composables/map/useDragMeasureOverlay'
import { useFenceDrawing } from '@/composables/map/useFenceDrawing'
import { useLiveMeasureOverlay } from '@/composables/map/useLiveMeasureOverlay'
import { useMapAutoResize } from '@/composables/map/useMapAutoResize'
import { useMapBoxZoom } from '@/composables/map/useMapBoxZoom'
import { useMapCenterFromUserLocation } from '@/composables/map/useMapCenterFromUserLocation'
import { provideMapContext } from '@/composables/map/useMapContext'
import { useMapMissionLayer } from '@/composables/map/useMapMissionLayer'
import { useMapOverlays } from '@/composables/map/useMapOverlays'
import { useMapPoiMarkers } from '@/composables/map/useMapPoiMarkers'
import { useMapTileLayers } from '@/composables/map/useMapTileLayers'
import { useMapTileLayerSelection } from '@/composables/map/useMapTileLayerSelection'
import { useMapVehicleMarker } from '@/composables/map/useMapVehicleMarker'
import { useMapVehiclePathLayer } from '@/composables/map/useMapVehiclePathLayer'
import { useMeasureExtentInput } from '@/composables/map/useMeasureExtentInput'
import { useMissionInsertion } from '@/composables/map/useMissionInsertion'
import { useMissionPlacement } from '@/composables/map/useMissionPlacement'
import { type SurveyPreview, useSurveyArrowOverlay } from '@/composables/map/useSurveyArrowOverlay'
import { useSurveyEdgeDragging } from '@/composables/map/useSurveyEdgeDragging'
import { useTouchDrawing } from '@/composables/map/useTouchDrawing'
import { useVertexAngleOverlay } from '@/composables/map/useVertexAngleOverlay'
import { useWaypointMarkerSize } from '@/composables/map/useWaypointMarkerSize'
import { goToMenuPage } from '@/composables/menuRouting'
import { useFenceMapInteraction } from '@/composables/mission-planning/useFenceMapInteraction'
import { useSnackbar } from '@/composables/snackbar'
import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import {
  clearAllSurveyAreas,
  removeSurveyAreaSquareMeters,
  setSurveyAreaSquareMeters,
  useMissionEstimates,
} from '@/composables/useMissionEstimates'
import { useMissionOperations } from '@/composables/useMissionOperations'
import { useOfflineTiles } from '@/composables/useOfflineTiles'
import { useUnitConversion, useUnitInput } from '@/composables/useUnitInput'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { scaleControl, zoomControl } from '@/libs/map/cesium-controls'
import { type CockpitMap, type MapPointerEvent, createMap } from '@/libs/map/cesium-map'
import { type MapMarker, type MarkerTooltip, bindTooltip, divIconMarker, setDivIcon } from '@/libs/map/cesium-marker'
import {
  type DrawnLine,
  type LineStyle,
  type VectorFeature,
  lineFeature,
  pointFeature,
  polygonFeature,
} from '@/libs/map/cesium-vectors'
import { dimNonFenceLayers } from '@/libs/map/fence-layers'
import type { NoiseTileOptions } from '@/libs/map/map-tile-fallback'
import { positionPanelNearBounds, screenBounds } from '@/libs/map/screen-placement'
import { applyLiveWaypointCoordinates } from '@/libs/map/survey-arrows'
import { type ScreenPoint, closestPointOnSegment, isOverSurveyHandle } from '@/libs/map/survey-polygon-edges'
import {
  applyFollowZoomMode,
  createGridOverlay,
  fitMapToWaypoints,
  mapPointerPositionFromClient,
  persistLiveMapView,
  recenterMapOnFollowTarget,
  removeGridOverlay,
  TargetFollower,
  WhoToFollow,
} from '@/libs/map/utils-map'
import { orderedSurveyPath, surveyEndpointEdgeBearing, surveyEntryCornerCount } from '@/libs/map/utils-map'
import type { VehicleTooltipState } from '@/libs/map/vehicle-tooltip'
import { vehicleTooltipContent } from '@/libs/map/vehicle-tooltip'
import {
  bearingBetween,
  calculateHaversineDistance,
  centroidLatLng,
  polygonAreaSquareMeters,
} from '@/libs/mission/general-estimates'
import { PLANNABLE_VEHICLE_TYPES, vehicleTypeLabel } from '@/libs/mission/library'
import { endpointSplicePosition } from '@/libs/mission/planning-endpoints'
import { hasLivePlanningMission } from '@/libs/mission/planning-state'
import { degrees, messageFromError, toPlain } from '@/libs/utils'
import router from '@/router'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { SubMenuComponentName } from '@/types/general'
import {
  type CockpitMission,
  type MissionEstimatesSnapshot,
  type SavedMission,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  ClosestSegmentInfo,
  ContextMenuTypes,
  IconDimensions,
  instanceOfCockpitMission,
  MarkerSizes,
  MissionCommand,
  MissionCommandType,
  Survey,
  SurveyPath,
} from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const baseStationStore = useBaseStation()
const fenceStore = useGeoFenceStore()
const fenceDraft = useGeoFenceEditorDraft()
const missionEstimates = useMissionEstimates()
const angleOverlay = useVertexAngleOverlay()
const dragMeasureOverlay = useDragMeasureOverlay(angleOverlay)
const surveyArrowOverlay = useSurveyArrowOverlay({
  surveys: () => surveysWithLiveWaypoints.value,
  previewPath: () => surveyPreviewPath.value,
  missionWaypoints: () => missionStore.currentPlanningWaypoints,
})

const { height: windowHeight } = useWindowSize()

const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()
const {
  isSavingOfflineTiles,
  savingLayerName,
  estimatedTotalMB,
  estimatedDownloadedMB,
  savePercentage,
  saveVisibleTiles,
} = useOfflineTiles({ showDialog, closeDialog, openSnackbar })

const clearMissionOnVehicle = (): void => {
  logUserAction('Cleared mission on vehicle')
  vehicleStore.clearMissions()
}

const MISSION_TOOLBOX_BAR_GAP_PX = 20
const calculatedHeight = computed(() => {
  const barsHeight = widgetStore.currentBottomBarHeightPixels + widgetStore.currentTopBarHeightPixels
  return `${windowHeight.value - barsHeight - 2 * MISSION_TOOLBOX_BAR_GAP_PX}px`
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

/**
 * Inspects the mission waypoints against the active geofence (the editor
 * draft when present, falling back to the plan currently uploaded to the
 * vehicle). When at least one waypoint breaches the fence, prompts the user
 * with a "Back to mission planning" / "Upload to vehicle anyway" choice and
 * resolves to whether the upload should continue. No-op (returns true) when
 * there's no fence to check against or no breach is detected.
 * @returns { Promise<boolean> } True when the upload should proceed.
 */
const confirmMissionFenceBreachIfNeeded = async (): Promise<boolean> => {
  const report = fenceStore.detectMissionBreaches(missionStore.currentPlanningWaypoints)
  if (!report.hasBreaches) return true

  let confirmed = false
  try {
    // Awaiting the dialog's own promise is what keeps Escape and backdrop
    // clicks from stranding the upload: those reject rather than press a button.
    await showDialog({
      variant: 'text-only',
      title: 'Mission breaches geofence',
      message:
        `${report.breachedIndices.length} of ${report.totalChecked} waypoints fall outside an inclusion fence ` +
        'or inside an exclusion fence. Uploading anyway may trigger an in-flight fence breach action ' +
        '(RTL / Land / Brake, depending on the autopilot configuration).',
      persistent: false,
      maxWidth: '720px',
      actions: [
        { text: 'Back to mission planning', action: () => undefined },
        {
          text: 'Upload to vehicle anyway',
          class: 'bg-[#FFFFFF33]',
          action: () => {
            confirmed = true
          },
        },
      ],
    })
  } catch {
    return false
  } finally {
    closeDialog()
  }
  return confirmed
}

const uploadMissionToVehicle = async (): Promise<void> => {
  if (!home.value) {
    showHomePositionNotSetDialog.value = true
    return
  }

  if (!(await confirmMissionFenceBreachIfNeeded())) return

  logUserAction('Uploaded mission to vehicle')
  uploadingMission.value = true
  missionUploadProgress.value = 0
  const missionItemsToUpload = toPlain(missionStore.currentPlanningWaypoints)

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

  // Commit the local cruise speed back to the store so the chosen value persists across sessions and mission restarts.
  missionStore.defaultCruiseSpeed = localCruiseSpeed.value
  missionStore.cruiseSpeed = localCruiseSpeed.value

  if (localCruiseSpeed.value > 0 && missionItemsToUpload.length > 1) {
    const firstMissionItem = missionItemsToUpload[1]
    const existing = Array.isArray(firstMissionItem.commands) ? firstMissionItem.commands : []

    firstMissionItem.commands = [
      ...existing.filter((cmd) => cmd.command !== MavCmd.MAV_CMD_DO_CHANGE_SPEED),
      {
        type: MissionCommandType.MAVLINK_NAV_COMMAND,
        command: MavCmd.MAV_CMD_DO_CHANGE_SPEED,
        param1: 1,
        param2: localCruiseSpeed.value,
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
    // The vehicle takes its home from the mission's first item, so read it back to learn what it now holds. Not
    // awaited, as the upload is done either way and the map only needs the answer whenever it arrives.
    vehicleStore.fetchHomeWaypoint({ fresh: true }).catch(() => undefined)
    // Keep the uploaded mission on the planner (draft) and store a restorable snapshot so quick edits
    // don't require re-downloading it from the vehicle.
    missionStore.setLastUploadedMission(buildCurrentMissionSnapshot())
    const message = 'Go to Flight Mode and click the “play” button to start the mission.'

    if (missionStore.alwaysSwitchToFlightMode) {
      router.push('/')
      missionStore.bumpVehicleMissionRevision(missionItemsToUpload)
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
  } catch (error) {
    showDialog({
      variant: 'error',
      title: 'Mission upload failed',
      message: messageFromError(error),
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
  logUserAction('Downloaded mission from vehicle')
  missionStore.pushUndoSnapshot()
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
      }
      if (index > 0) {
        missionStore.currentPlanningWaypoints.push(wp)
        addWaypointMarker(wp)
      }
    })
    updateWaypointMarkers()

    openSnackbar({ variant: 'success', message: 'Mission download succeeded!', duration: 3000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: messageFromError(error), timer: 5000 })
  } finally {
    loading.value = false
    fetchingMission.value = false
  }
}

// Published once the map's style has loaded, which is when layers can be added to it.
const planningMap = shallowRef<CockpitMap | undefined>()
// Held from creation, so teardown reaches a map whose style never finished loading.
let planningMapInstance: CockpitMap | undefined
const mapContext = provideMapContext()
const { mapReady } = mapContext
const { observe: observeMapResize } = useMapAutoResize()

// Syncs user-loaded GeoTIFF overlays (sonar/bathymetry surveys) onto the planning map
const mapOverlays = useMapOverlays()
const overlayLoadingIds = mapOverlays.loadingIds
const overlaysDialogOpen = ref(false)

// Frame the map on a GeoTIFF overlay when requested from the configuration panel
watch(
  () => missionStore.mapOverlayFocusRequest.revision,
  () => mapOverlays.zoomToOverlay(missionStore.mapOverlayFocusRequest.id)
)

useBaseStationOverlay(planningMap, mapReady)

const mapCenter = ref<WaypointCoordinates>(missionStore.userLastMapCenter ?? missionStore.defaultMapCenter)
const zoom = ref(missionStore.userLastMapZoom ?? missionStore.defaultMapZoom)
const followerTarget = ref<string | undefined>(undefined)
const currentWaypointAltitude = ref(0)
const currentWaypointAltitudeRefType = ref<AltitudeReferenceType>(AltitudeReferenceType.RELATIVE_TO_HOME)
const availableFrames = Object.values(AltitudeReferenceType).map((value: AltitudeReferenceType) => ({
  name: value,
  value,
}))
const plannedVehicleTypeItems = PLANNABLE_VEHICLE_TYPES

const onPlannedVehicleTypeChange = (value?: MavType): void => {
  logUserAction(`Selected "${vehicleTypeLabel(value)}" as the planning vehicle type`)
}
const waypointMarkers = shallowRef<{ [id: string]: MapMarker }>({})
// The permanent number label on each waypoint marker, keyed like the markers.
const waypointTooltips: { [id: string]: MarkerTooltip } = {}
const planningMode = ref<'mission' | 'geofence'>('mission')

watch(
  () => fenceDraft.isDrawingPolygon,
  (drawing) => {
    if (!drawing) {
      clearFencePolygonDrawingArtifacts()
      clearLiveMeasure()
    }
    setMapCursor()
  }
)

watch(
  () => fenceDraft.isDrawingCircle,
  (drawing) => {
    if (!drawing) {
      clearPendingFenceCircleArtifacts()
      clearLiveMeasure()
    }
    setMapCursor()
  }
)
const isCreatingSimplePath = ref(false)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuNearestSegmentIndex = ref<number | null>(null)
const currentCursorGeoCoordinates = ref<[number, number] | null>(null)
const confirmButtonStyle = ref<Record<string, string>>({})
const surveyPolygonVertexesPositions = ref<WaypointCoordinates[]>([])
const isCreatingSurvey = ref(false)
const isDrawingSurveyPolygon = ref(false)
const selectedSurveyId = ref<string>('')
// Ids of the committed surveys drawn on the map, whose polygons share one source.
const drawnSurveyIds = ref<string[]>([])
const lastSelectedSurveyId = ref('')
const surveys = computed(() => missionStore.currentPlanningSurveys)

const surveysWithLiveWaypoints = computed<Survey[]>(() =>
  applyLiveWaypointCoordinates(surveys.value, missionStore.currentPlanningWaypoints)
)
const undoIsInProgress = ref(false)
const undoWaypointInsertIndex = ref<number | null>(null)
const undoSurveyInsertIndex = ref<number | null>(null)
let dragStartLatLng: WaypointCoordinates | null = null
let polygonLatLngsAtDragStart: WaypointCoordinates[] = []
const surveyPolygonUndoStack: WaypointCoordinates[][] = []
const surveyPolygonRedoStack: WaypointCoordinates[][] = []
let undoLimitShown = false
let redoLimitShown = false

// Fence drawing helpers live in the dedicated composable. The exposed
// `fencePolygonVertexesPositions` ref is what the template guards and the
// confirm-button repositioning watch react to; the rest of the API drives
// the click handlers, the confirm button and the cleanup paths below.
const {
  polygonVertexesPositions: fencePolygonVertexesPositions,
  addPolygonPoint: addFencePolygonPoint,
  finishPolygonDrawing: onFinishFencePolygonDrawing,
  clearPolygonDrawingArtifacts: clearFencePolygonDrawingArtifacts,
  setPendingCircleCenter: setPendingFenceCircleCenter,
  updatePendingCircleLayer: updatePendingFenceCircleLayer,
  clearPendingCircleArtifacts: clearPendingFenceCircleArtifacts,
} = useFenceDrawing({
  map: planningMap,
  formatArea: (m2) => missionEstimates.formatArea(m2),
  makeAreaMarker: (at, text) => makeAreaMarker(at, text),
  addAreaToMeasureLayer: (m) => addAreaToMeasureLayer(m),
})

const { handleFenceKeyDown, onFenceMapClick } = useFenceMapInteraction({
  planningMode,
  addFencePolygonPoint,
  setPendingFenceCircleCenter,
  clearLiveMeasure: () => clearLiveMeasure(),
})

const pushSurveyPolygonSnapshot = (): void => {
  surveyPolygonUndoStack.push(surveyPolygonVertexesPositions.value.map((ll): WaypointCoordinates => [ll[0], ll[1]]))
  surveyPolygonRedoStack.length = 0
}

const clearSurveyPolygonUndoStack = (): void => {
  surveyPolygonUndoStack.length = 0
  surveyPolygonRedoStack.length = 0
}

const extentInput = useMeasureExtentInput({
  shortcutFocus: () => (currentMeasureAnchor() ? 'segment' : null),
  onOpened: () => refreshLiveMeasureOnMapMove(),
})
const {
  extentBoxes,
  extentInputsOpen,
  openExtentInputs,
  focusExtentInput,
  closeExtentInputs,
  clearExtentValues,
  setExtentTarget,
  setExtentValue,
  applyExtent,
  isExtentCleared,
  projectToLockedExtent,
  initExtentInputs,
} = extentInput

const {
  isEdgePressed: isPressingSurveyEdge,
  isDraggingEdge: isDraggingSurveyEdge,
  initEdgeDragging,
  destroyEdgeDragging,
} = useSurveyEdgeDragging({
  vertices: surveyPolygonVertexesPositions,
  markers: () => surveyPolygonVertexesMarkers.value,
  isEditable: () => isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length >= 3,
  onDragStart: pushSurveyPolygonSnapshot,
  onEdgeMoved: () => {
    updatePolygon()
    createSurveyPath()
    updateConfirmButtonPosition()
  },
  onDragEnd: (moved) => {
    if (!moved) return
    ignoreNextClick = true
    createSurveyPath()
  },
})

// A press that is already dragging one of the map's own handles belongs to that drag, so every gesture bound to the
// planning map has to stay out of it.
const isDraggingMapHandle = (): boolean =>
  isPressingSurveyEdge.value || isDraggingMarker.value || isDraggingSurveyVertex.value

const {
  pendingPoint: pendingDrawnPoint,
  clearPendingPoint,
  swallowsClick: touchDrawingSwallowsClick,
  initTouchDrawing,
  destroyTouchDrawing,
} = useTouchDrawing({
  // An area is drawn with the finger from its very first corner, a path only once it has a waypoint to draw from.
  drawsWithOneFinger: () =>
    (isCreatingSurvey.value && isDrawingSurveyPolygon.value) ||
    (isCreatingSimplePath.value && currentMeasureAnchor() !== null),
  hasAnchor: () => currentMeasureAnchor() !== null,
  isBlocked: isDraggingMapHandle,
  placePoint: (latlng) => placeDrawnPoint(latlng),
})

const { initMapBoxZoom } = useMapBoxZoom({
  onBoxStart: () => {
    targetFollower.setBoxPress(true)
    if (contextMenuVisible.value) hideContextMenu()
  },
  onBoxEnd: () => {
    targetFollower.setBoxPress(false)
  },
  onBoxCommit: () => targetFollower.unFollow(),
  isBlocked: () =>
    isDraggingMapHandle() ||
    isCreatingSimplePath.value ||
    isCreatingSurvey.value ||
    isPlacingMission.value ||
    isDraggingPolygon.value ||
    contextMenuVisible.value,
})

let ignoreNextClick = false
const selectedWaypoint = ref<Waypoint | undefined>(undefined)
const contextMenuType = ref<ContextMenuTypes>('map')
const cursorCoordinates = ref<[number, number] | null>(null)
const accessingSurveyContextMenu = ref(false)
const isDraggingPolygon = ref(false)
const isDraggingMarker = ref(false)
const isDraggingSurveyVertex = ref(false)

// The live preview is rebuilt on every pointer move of a reshape, so a polygon that is momentarily too thin for
// its line spacing must not raise the no-valid-path warning until the gesture is released.
const isReshapingSurveyPolygon = computed(
  () => isDraggingSurveyVertex.value || isDraggingPolygon.value || isDraggingSurveyEdge.value
)

const showHomePositionNotSetDialog = ref(false)
const fetchingMission = ref(false)
const missionFetchProgress = ref(0)
const loading = ref(false)
const showMissionCreationTips = ref(missionStore.showMissionCreationTips)
const countdownToHideTips = ref<number | undefined>(undefined)
const isSurfaceBoat = computed(() => vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT)

// The waypoint/survey panel and the base station panel both occupy the right edge, so the
// last one opened takes it.
const rightPanelShowsMissionConfig = computed(
  () => interfaceStore.configPanelVisible && (isCreatingSurvey.value || selectedWaypoint.value !== undefined)
)
watch(
  () => baseStationStore.configPanelOpen,
  (isOpen) => {
    if (isOpen && rightPanelShowsMissionConfig.value) interfaceStore.configPanelVisible = false
  }
)
watch(rightPanelShowsMissionConfig, (showsMissionConfig) => {
  if (showsMissionConfig) baseStationStore.configPanelOpen = false
})

const localCruiseSpeed = ref<number>(Number(missionStore.defaultCruiseSpeed))
watch(
  () => missionStore.defaultCruiseSpeed,
  (newVal) => {
    const num = Number(newVal)
    if (Number.isFinite(num) && num !== localCruiseSpeed.value) {
      localCruiseSpeed.value = num
    }
  }
)

const cruiseSpeedTouched = ref(false)
const cruiseSpeedStatus = computed<'invalid' | 'unchanged' | 'valid'>(() => {
  const value = localCruiseSpeed.value
  if (!Number.isFinite(value) || value <= 0 || value > 3) return 'invalid'
  if (value === Number(missionStore.defaultCruiseSpeed) && !cruiseSpeedTouched.value) return 'unchanged'
  return 'valid'
})
const isSettingHomeWaypoint = ref(false)
const downloadMenuOpen = ref(false)
const speedDialOpen = ref(false)
const nearMissionPathTolerance = 16 // in pixels
const waypointPickToleranceInPixels = 10
// Area pills and other measure tags, taken off together whenever the measure is cleared.
const measureMarkers = new Set<MapMarker>()

/** A pointer position on the planning map, as the measure follows it. */
type MeasureCursor = {
  /** The coordinate under the pointer. */
  latlng: WaypointCoordinates
  /** The pointer position in container pixels. */
  containerPoint: ScreenPoint
  /** The DOM event that moved the pointer there, when there was one. */
  originalEvent?: MouseEvent
}

const toMeasureCursor = (event: MapPointerEvent): MeasureCursor => ({
  latlng: event.latLng,
  containerPoint: event.point,
  originalEvent: event.originalEvent,
})

// Last cursor event kept so the live measure can be re-rendered while the map pans (no mousemove fires then)
let lastMeasureCursor: MeasureCursor | null = null
const surveyAreaMarkers = shallowRef<Record<string, MapMarker>>({})
const liveSurveyAreaMarker = shallowRef<MapMarker | null>(null)

const home = computed({
  get: () => missionStore.plannedHomePosition,
  set: (value: WaypointCoordinates | undefined) => {
    missionStore.plannedHomePosition = value
  },
})

const glassMenuCssVars = computed(() => ({
  '--glass-background': interfaceStore.globalGlassMenuStyles.backgroundColor,
  '--glass-filter': interfaceStore.globalGlassMenuStyles.backdropFilter,
  '--glass-border': interfaceStore.globalGlassMenuStyles.border,
  '--glass-color': interfaceStore.globalGlassMenuStyles.color,
  '--glass-box-shadow': interfaceStore.globalGlassMenuStyles.boxShadow,
}))

const {
  initLiveMeasure,
  renderLiveMeasure,
  clearLiveMeasure: clearMeasureOverlay,
  setLiveMeasureAnchor,
  setLiveMeasureTyping,
  refreshLiveMeasureOnMapMove,
  destroyLiveMeasure,
} = useLiveMeasureOverlay({
  redraw: (latlng, containerPoint) => {
    if (lastMeasureCursor) handleMapMouseMove({ ...lastMeasureCursor, latlng, containerPoint })
  },
  cursorPosition: () => ({ x: cursorLivePositionX.value, y: cursorLivePositionY.value }),
  heldPoint: () => pendingDrawnPoint.value,
  onTagPressed: () => {
    if (extentInputsOpen.value) {
      focusExtentInput('segment')
      return
    }
    logUserAction('Opened the distance field from the measure tag')
    openExtentInputs('segment')
    // A touch never moves a cursor, so the field is placed against the measure the tag is already showing.
    refreshLiveMeasureOnMapMove()
  },
  onTagTapped: () => focusExtentInput('segment'),
})

watch(extentInputsOpen, (open) => setLiveMeasureTyping(open))
// A point left waiting is what stands the tag clear of the pointer, so the tag is redrawn as it comes and goes.
watch(pendingDrawnPoint, () => refreshLiveMeasureOnMapMove())

const clearLiveMeasure = (): void => {
  clearMeasureOverlay()
  angleOverlay.clearVertexAngles()
  clearPendingPoint()
  // An extent typed for the segment just drawn does not carry over to the next one, which starts free again.
  setExtentTarget('segment', null)
  clearExtentValues()
  lastMeasureCursor = null
}

const currentMeasureAnchor = (): WaypointCoordinates | null => {
  if (!planningMap.value) return null
  if (isCreatingSimplePath.value && missionStore.currentPlanningWaypoints.length > 0) {
    // Anchor at index 0 when the session was started near the start endpoint, so subsequent
    // inserts extend the path outward from whichever waypoint sits at the start of the array.
    const wps = missionStore.currentPlanningWaypoints
    const anchor = pendingSimplePathInsertIndex.value !== null ? wps[0] : wps[wps.length - 1]
    if (!anchor) return null
    return [anchor.coordinates[0], anchor.coordinates[1]]
  }
  if (isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length > 0) {
    const last = surveyPolygonVertexesPositions.value[surveyPolygonVertexesPositions.value.length - 1]
    return [last[0], last[1]]
  }
  if (fenceDraft.isDrawingPolygon && fencePolygonVertexesPositions.value.length > 0) {
    const last = fencePolygonVertexesPositions.value[fencePolygonVertexesPositions.value.length - 1]
    return [last[0], last[1]]
  }
  if (fenceDraft.isDrawingCircle && fenceDraft.pendingCircleCenter) {
    return [fenceDraft.pendingCircleCenter[0], fenceDraft.pendingCircleCenter[1]]
  }

  return null
}

// Point before the measure anchor, used to measure the angle the segment being drawn makes with the previous one.
const currentMeasurePrevAnchor = (): WaypointCoordinates | null => {
  if (!planningMap.value) return null
  if (isCreatingSimplePath.value && missionStore.currentPlanningWaypoints.length > 1) {
    const wp = missionStore.currentPlanningWaypoints[missionStore.currentPlanningWaypoints.length - 2]
    return [wp.coordinates[0], wp.coordinates[1]]
  }
  if (isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length > 1) {
    const vertex = surveyPolygonVertexesPositions.value[surveyPolygonVertexesPositions.value.length - 2]
    return [vertex[0], vertex[1]]
  }

  return null
}

const placeSurveyPolygonPoint = (latlng: WaypointCoordinates): void => {
  addSurveyPoint(latlng)
  clearLiveMeasure()
}

// The waypoint a click at this spot picks up instead of adding to, if any.
const waypointMarkerNear = (latlng: WaypointCoordinates): MapMarker | undefined => {
  const map = planningMap.value
  if (!map) return undefined

  const point = map.project(latlng)
  return Object.values(waypointMarkers.value).find((marker) => {
    const markerPoint = map.project(marker.getLatLng())
    return Math.hypot(markerPoint.x - point.x, markerPoint.y - point.y) < waypointPickToleranceInPixels
  })
}

// A waypoint only goes down where a click would put one, whichever gesture asked for it: not on top of an
// existing waypoint, and not while a context menu or the waypoint panel is taking the interaction.
const canAddWaypointAt = (latlng: WaypointCoordinates): boolean =>
  !waypointMarkerNear(latlng) && !contextMenuVisible.value && !interfaceStore.configPanelVisible

// Lays a point down wherever the drawing is: a corner of the survey area, or the next waypoint of the path.
const placeDrawnPoint = (latlng: WaypointCoordinates): boolean => {
  if (isCreatingSurvey.value && isDrawingSurveyPolygon.value) {
    placeSurveyPolygonPoint(latlng)
    return true
  }
  if (isCreatingSimplePath.value && canAddWaypointAt(latlng)) {
    const insertIndex = pendingSimplePathInsertIndex.value
    addWaypoint(
      [latlng[0], latlng[1]],
      currentWaypointAltitude.value,
      currentWaypointAltitudeRefType.value,
      undefined,
      insertIndex ?? undefined
    )
    updateWaypointMarkers()
    clearLiveMeasure()
    return true
  }

  return false
}

// Enter takes the typed distance as the point itself, so a segment can be laid down without aiming a click at it.
const applyTypedSegment = (latlng: WaypointCoordinates): void => {
  const cursorBeforePlacing = lastMeasureCursor
  if (!placeDrawnPoint(latlng)) return

  // A key press leaves the pointer where it was, so the cursor the measure was following is handed back and the
  // next segment is drawn from the point just laid rather than waiting for the mouse to move.
  lastMeasureCursor = cursorBeforePlacing
  refreshLiveMeasureOnMapMove()
}

const isMeasuringSegment = (): boolean => {
  const draggingExistingNode = isDraggingMarker.value || isDraggingPolygon.value || isDraggingSurveyEdge.value
  if (draggingExistingNode) return false

  return (
    isCreatingSimplePath.value ||
    (isCreatingSurvey.value && isDrawingSurveyPolygon.value) ||
    fenceDraft.isDrawingPolygon ||
    (fenceDraft.isDrawingCircle && !!fenceDraft.pendingCircleCenter)
  )
}

// `evt` is optional so callers triggered without a mousemove (e.g. right after a context-menu
// action) can still draw the line; hover hit-testing (against survey handles or the last
// waypoint) is skipped in that case.
const renderMeasureOverlay = (cursorLatLng: WaypointCoordinates, evt: MeasureCursor | null): void => {
  if (!planningMap.value) return

  if (evt) lastMeasureCursor = evt

  const anchor = currentMeasureAnchor()
  if (!anchor || !isMeasuringSegment()) {
    clearMeasureOverlay()
    angleOverlay.clearVertexAngles()
    // No segment is being drawn, so there is nothing left for a typed distance to apply to.
    closeExtentInputs()
    return
  }

  // A typed distance holds the segment's length, so only its direction is still read off the cursor.
  const cursor = projectToLockedExtent('segment', anchor, cursorLatLng)
  // Measured the way the panel and the estimates measure, so a typed extent reads back as the number that was
  // typed instead of the map's 0.1% smaller earth.
  const dist = calculateHaversineDistance(anchor, cursor)

  const hidePill =
    (evt && (isOverSurveyHandle(evt.originalEvent?.target ?? null) || isOverLastWaypointMarker(evt))) || dist < 1 // hide if closer than 1 meter to last wp on the array

  renderLiveMeasure({
    from: anchor,
    to: cursor,
    distanceInMeters: dist,
    bearingInDegrees: bearingBetween(anchor, cursor),
    hidesTag: hidePill,
    clearsLength: isExtentCleared('segment'),
    // Only a point already dragged out and left waiting has the tag standing clear of the pointer that drew it.
    tagTakesPresses: pendingDrawnPoint.value !== null,
  })

  setExtentTarget('segment', {
    label: 'distance',
    from: anchor,
    to: cursor,
    liveValue: dist,
    refresh: refreshLiveMeasureOnMapMove,
    apply: () => applyTypedSegment(cursor),
  })

  const prevAnchor = currentMeasurePrevAnchor()
  if (prevAnchor && !hidePill) {
    angleOverlay.renderVertexAngle(prevAnchor, anchor, cursor)
  } else {
    angleOverlay.clearVertexAngles()
  }

  if (fenceDraft.isDrawingCircle && fenceDraft.pendingCircleCenter) {
    fenceDraft.setPendingCircleRadius(dist)
    updatePendingFenceCircleLayer()
  }
}

const handleMapMouseMove = (e: MeasureCursor): void => {
  renderMeasureOverlay(e.latlng, e)
}

// A tap on the tag is echoed by a mouse move the browser raises over it, which would aim the line at the tag
// and take the tag itself out from under the finger before the tap is through.
const onMapMouseMove = (e: MapPointerEvent): void => {
  const movedOver = e.originalEvent?.target as HTMLElement | null
  if (movedOver?.closest?.('.live-measure-pill')) return

  handleMapMouseMove(toMeasureCursor(e))
}

const saveEsri = (): void => {
  logUserAction('Saved visible Esri map tiles')
  if (planningMap.value) saveVisibleTiles(planningMap.value, esriLayer, 'Esri', 19)
  downloadMenuOpen.value = false
}
const saveOSM = (): void => {
  logUserAction('Saved visible OSM map tiles')
  if (planningMap.value) saveVisibleTiles(planningMap.value, osmLayer, 'OSM', 19)
  downloadMenuOpen.value = false
}

// Grid overlay functions for mission planning view
const createGridOverlayLocal = (): void => {
  if (!planningMap.value) return

  try {
    createGridOverlay(planningMap.value)
  } catch (error) {
    console.error('Failed to create grid overlay:', error)
  }
}

const removeGridOverlayLocal = (): void => {
  removeGridOverlay(planningMap.value)
}

// Creates an overlay on the map so elements can be added without interfering with the main map components and events
let mapActionsOverlayEl: HTMLDivElement | null = null
let mapActionsKnobEl: HTMLDivElement | null = null
let mapActionsKnobSegmentIndex: number | null = null
let knobShowTimer: number | null = null
let knobFadeOutTimer: number | null = null
let lastHoverSegmentIndex: number | null = null
let knobPendingShow = false
const segmentRadialMenuVisible = ref(false)
const segmentRadialMenuPosition = ref({ x: 0, y: 0 })
const segmentRadialMenuItems: RadialMenuItem[] = [
  { icon: 'mdi-vector-polyline', tooltip: 'Add waypoint' },
  { icon: 'mdi-transit-connection-variant', tooltip: 'Insert survey here' },
  { icon: 'mdi-bookshelf', tooltip: 'Insert mission from library here' },
]
const segmentSurveyInsertIndex = ref<number | null>(null)
const pendingSegmentInsertIndex = ref<number | null>(null)
// Non-null when simple-path mode was started from the context menu near the start endpoint.
// While set, every click inserts at this index (typically `0`) so the path extends outward from
// the start. Reset to null when leaving simple-path mode.
const pendingSimplePathInsertIndex = ref<number | null>(null)

const isCtrlDown = ref(false)
const isShiftDown = ref(false)
const cursorLivePositionX = ref(0)
const cursorLivePositionY = ref(0)
const cursorSymbol = computed(() => (isCtrlDown.value ? '+' : isShiftDown.value ? '−' : ''))
const showCursorDeco = computed(() => isCtrlDown.value || isShiftDown.value)

let cursorDecoEl: HTMLDivElement | null = null
let setHomeOnFirstClick: ((e: MapPointerEvent) => void) | null = null

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
  logUserAction('Dismissed mission creation tips permanently')
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
  logUserAction('Started setting the mission home')
  isSettingHomeWaypoint.value = true
  openSnackbar({
    variant: 'info',
    message: 'Click anywhere on the map to set the mission home',
    duration: 5000,
  })
}

const goToFlightView = (): void => {
  logUserAction('Navigated to Flight view')
  router.push('/')
}

const handleOpenMissionSettings = (): void => {
  logUserAction('Opened mission settings')
  goToMenuPage(SubMenuComponentName.SettingsMission)
}

const poiManagerRef = ref<InstanceType<typeof PoiManager> | null>(null)
useMapPoiMarkers(planningMap, {
  iconClassName: 'poi-marker-icon',
  tooltipClassName: 'poi-tooltip',
  onClick: (poi) => poiManagerRef.value?.openDialog(undefined, poi),
})

const clearCurrentMission = (options?: {
  /**
   * Whether to assign a new automatic name and reset the mission start time. Defaults to true.
   */
  startNewMission?: boolean
}): void => {
  missionStore.clearMission(options)
  missionStore.clearUndoStack()
  Object.keys(waypointMarkers.value).forEach(removeWaypointMarker)
  waypointMarkers.value = {}
  removeMissionPathSignalLayer()
  clearSurveyPath()
  selectedSurveyId.value = ''
  lastSelectedSurveyId.value = ''
  undoWaypointInsertIndex.value = null
  undoSurveyInsertIndex.value = null
  segmentSurveyInsertIndex.value = null
  clearSurveyPolygonUndoStack()
  interfaceStore.configPanelVisible = false
  clearLiveMeasure()
  clearAllSurveyAreas()
}

const openCLearMissionDialog = (): void => {
  logUserAction('Opened clear-mission dialog')
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
          logUserAction('Cleared current mission')
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
  return surveys.value.some((s) => s.id === selectedSurveyId.value)
})

const selectedSurvey = computed(() => {
  return surveys.value.find((survey) => survey.id === selectedSurveyId.value)
})

// Entrance and exit waypoints of every survey, coloured green in their marker markup so the state survives
// any icon re-render instead of being patched onto the DOM after the fact.
const surveyEntryExitWaypointIds = computed(() => {
  const ids = new Set<string>()
  surveys.value.forEach((survey) => {
    const first = survey.waypoints[0]
    const last = survey.waypoints.at(-1)
    if (first) ids.add(first.id)
    if (last) ids.add(last.id)
  })
  return ids
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

// Footprint of the survey-confirm controls strip, plus the two hand-tuned offsets it has always
// carried on top of the shared placement maths.
const SURVEY_CONFIRM_LAYOUT = {
  footprint: {
    anchorLeftPx: 100,
    anchorRightPx: 60,
    anchorTopPx: 10,
    anchorBottomPx: 185,
    gapPx: 20,
    marginPx: 8,
  },
  extraRightGapPx: 100,
  extraLeftOffsetPx: 40,
} as const

const updateConfirmButtonPosition = (): void => {
  if (!planningMap.value) return

  if (isCreatingSurvey.value && surveyPolygonVertexesPositions.value.length >= 3) {
    const map = planningMap.value
    const container = map.getContainer()
    const pts = surveyPolygonVertexesPositions.value.map((ll) => map.project(ll))
    const pos = positionPanelNearBounds(
      screenBounds(pts),
      SURVEY_CONFIRM_LAYOUT.footprint,
      container.clientWidth,
      container.clientHeight,
      SURVEY_CONFIRM_LAYOUT.extraRightGapPx
    )

    confirmButtonStyle.value = {
      left: `${pos.x + SURVEY_CONFIRM_LAYOUT.footprint.anchorLeftPx + SURVEY_CONFIRM_LAYOUT.extraLeftOffsetPx}px`,
      top: `${pos.y + SURVEY_CONFIRM_LAYOUT.footprint.anchorTopPx}px`,
    }
  } else {
    confirmButtonStyle.value = { display: 'none' }
  }
}

// The canvas container is where the map sets its own cursors, so the view's cursor has to go there to show.
const setMapCursor = (): void => {
  const el = planningMap.value?.getCanvasContainer()
  if (!el) return

  // when setting home, keep the special cursor
  if (isSettingHomeWaypoint.value) return

  if (isCtrlDown.value || isShiftDown.value) {
    el.style.cursor = 'pointer'
    return
  }
  if (
    isCreatingSurvey.value ||
    isCreatingSimplePath.value ||
    fenceDraft.isDrawingPolygon ||
    fenceDraft.isDrawingCircle
  ) {
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

const ensureMapActionsOverlay = (map: CockpitMap): void => {
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
const showSegmentAddKnobAt = (midpoint: WaypointCoordinates, segmentIndex: number): void => {
  if (!planningMap.value) return
  ensureMapActionsOverlay(planningMap.value)
  const pt = planningMap.value.project(midpoint)

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
        showSegmentRadialMenu()
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
  if (segmentRadialMenuVisible.value) return
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

let radialMenuSegmentIndex: number | null = null

const showSegmentRadialMenu = (): void => {
  if (!mapActionsKnobEl) return
  logUserAction('Opened mission segment radial menu')
  radialMenuSegmentIndex = mapActionsKnobSegmentIndex
  segmentRadialMenuPosition.value = {
    x: parseInt(mapActionsKnobEl.style.left),
    y: parseInt(mapActionsKnobEl.style.top),
  }
  segmentRadialMenuVisible.value = true
}

const openSegmentRadialMenuFromContextMenu = (segmentIndex: number): void => {
  const map = planningMap.value
  const wps = missionStore.currentPlanningWaypoints
  if (!map || segmentIndex < 0 || segmentIndex + 1 >= wps.length) return
  logUserAction('Opened mission segment radial menu from the map context menu')
  const a = wps[segmentIndex].coordinates
  const b = wps[segmentIndex + 1].coordinates
  const pt = map.project([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  radialMenuSegmentIndex = segmentIndex
  segmentRadialMenuPosition.value = { x: pt.x, y: pt.y }
  segmentRadialMenuVisible.value = true
}

const dismissSegmentRadialMenu = (): void => {
  if (segmentRadialMenuVisible.value) {
    segmentRadialMenuVisible.value = false
    hideSegmentAddKnob()
  }
}

const onSegmentRadialMenuSelect = (index: number): void => {
  logUserAction(`Selected mission segment radial menu option ${index}`)
  if (index === 0) {
    if (radialMenuSegmentIndex !== null) insertWaypointAtSegmentMidpoint(radialMenuSegmentIndex)
  } else if (index === 1) {
    if (radialMenuSegmentIndex !== null) {
      segmentSurveyInsertIndex.value = radialMenuSegmentIndex + 1
    }
    dismissSegmentRadialMenu()
    toggleSurvey()
    return
  } else if (index === 2) {
    if (radialMenuSegmentIndex !== null) {
      openMissionLibrary({ segmentInsertIndex: radialMenuSegmentIndex })
    }
    dismissSegmentRadialMenu()
    return
  }
  dismissSegmentRadialMenu()
}

const getClosestMissionPathSegmentInfo = (
  segmentLatLngs: WaypointCoordinates[],
  mouseLatLng: WaypointCoordinates
): ClosestSegmentInfo => {
  const map = planningMap.value!
  const mousePoint = map.project(mouseLatLng)
  let bestIndex = -1
  let bestDistance = Infinity
  let bestProjectedPoint: ScreenPoint = mousePoint

  for (let i = 0; i < segmentLatLngs.length - 1; i++) {
    const a = map.project(segmentLatLngs[i])
    const b = map.project(segmentLatLngs[i + 1])
    const projected = closestPointOnSegment(mousePoint, a, b)
    const dist = Math.hypot(mousePoint.x - projected.x, mousePoint.y - projected.y)
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

  missionStore.pushUndoSnapshot()

  const a = missionStore.currentPlanningWaypoints[segmentIndex].coordinates
  const b = missionStore.currentPlanningWaypoints[segmentIndex + 1].coordinates

  const prev = missionStore.currentPlanningWaypoints[segmentIndex]
  const newWp: Waypoint = {
    id: uuid(),
    coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    altitude: prev.altitude,
    altitudeReferenceType: prev.altitudeReferenceType,
    commands: makeDefaultNavCommands(),
  }

  missionStore.currentPlanningWaypoints.splice(segmentIndex + 1, 0, newWp)
  addWaypointMarker(newWp)
  updateWaypointMarkers()
}

const handleMapMouseMoveNearMissionPath = (event: MapPointerEvent): void => {
  if (!planningMap.value || missionStore.currentPlanningWaypoints.length < 2) {
    hideSegmentAddKnob()
    return
  }

  if (isCreatingSurvey.value || isDraggingMarker.value || isDraggingPolygon.value) {
    hideSegmentAddKnob()
    return
  }

  const latlngs = missionStore.currentPlanningWaypoints.map((w) => w.coordinates)
  const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, event.latLng)
  if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
    const A = latlngs[segmentIndex]
    const B = latlngs[segmentIndex + 1]
    showSegmentAddKnobAt([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], segmentIndex)
  } else {
    hideSegmentAddKnob()
  }
}

const handleMissionPathDoubleClick = (event: MapPointerEvent): void => {
  if (!planningMap.value || missionStore.currentPlanningWaypoints.length < 2) return
  const latlngs = missionStore.currentPlanningWaypoints.map((w) => w.coordinates)
  const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, event.latLng)
  if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
    insertWaypointAtSegmentMidpoint(segmentIndex)
  }
}

const addWaypointFromClick = (latlng: WaypointCoordinates): void => {
  if (!planningMap.value) return

  if (missionStore.currentPlanningWaypoints.length >= 2) {
    const latlngs = missionStore.currentPlanningWaypoints.map((w) => w.coordinates)
    const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, latlng)
    if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
      insertWaypointAtSegmentMidpoint(segmentIndex)
      return
    }
  }

  addWaypoint([latlng[0], latlng[1]], currentWaypointAltitude.value, currentWaypointAltitudeRefType.value)
  updateWaypointMarkers()
}

const addWaypointFromContextMenu = (): void => {
  if (!currentCursorGeoCoordinates.value) return
  logUserAction('Added a waypoint from the map context menu')
  const coordinates = currentCursorGeoCoordinates.value

  const insertIndex = endpointSplicePosition(coordinates, missionStore.currentPlanningWaypoints) ?? undefined
  addWaypoint(coordinates, currentWaypointAltitude.value, currentWaypointAltitudeRefType.value, undefined, insertIndex)
  updateWaypointMarkers()
}

const getContextMenuEndpointSplicePosition = (): number | null =>
  currentCursorGeoCoordinates.value
    ? endpointSplicePosition(currentCursorGeoCoordinates.value, missionStore.currentPlanningWaypoints)
    : null

const addSimplePathFromContextMenu = (): void => {
  // The same menu entry closes the tool while it is active, and toggleSimplePath logs that.
  if (!isCreatingSimplePath.value) {
    logUserAction('Started a simple path from the map context menu')
    const insertIndex = getContextMenuEndpointSplicePosition()
    if (insertIndex !== null) pendingSimplePathInsertIndex.value = insertIndex
  }
  toggleSimplePath()
  // Draw the live measure line right away using the live cursor position (not the menu-open
  // coords), so it has visible length even when the menu was opened next to the anchor waypoint.
  if (isCreatingSimplePath.value && planningMap.value) {
    const { latlng } = mapPointerPositionFromClient(
      planningMap.value,
      cursorLivePositionX.value,
      cursorLivePositionY.value
    )
    nextTick(() => renderMeasureOverlay(latlng, null))
  }
}

const addSurveyFromContextMenu = (): void => {
  if (!isCreatingSurvey.value) {
    logUserAction('Started a survey from the map context menu')
    const insertIndex = getContextMenuEndpointSplicePosition()
    if (insertIndex !== null) segmentSurveyInsertIndex.value = insertIndex
  }
  toggleSurvey()
}

const addMissionFromLibraryContextMenu = (): void => {
  // Prepend (segment -1) when the click sits closer to the mission's start endpoint; otherwise let
  // the placement flow append. The intent is passed in the same call that opens the library.
  const insertIndex = getContextMenuEndpointSplicePosition()
  openMissionLibrary({ segmentInsertIndex: insertIndex === 0 ? -1 : undefined })
}

// Measure tags stack above the waypoint markers and never take the pointer, as their own pane had them.
const measureTagZIndex = '640'

const makeAreaMarker = (at: WaypointCoordinates, text: string): MapMarker => {
  const marker = divIconMarker({
    className: 'measure-area-icon',
    html: `<div class="measure-area-pill">${text}</div>`,
    size: [12, 12],
  })
  Object.assign(marker.getElement().style, { pointerEvents: 'none', zIndex: measureTagZIndex })
  return marker.setLatLng(at)
}

const addAreaToMeasureLayer = (m: MapMarker): void => {
  if (!planningMap.value) return
  m.addTo(planningMap.value)
  measureMarkers.add(m)
}

const updateLiveSurveyAreaLabel = (coords: WaypointCoordinates[]): void => {
  if (!coords.length) return

  const m2 = polygonAreaSquareMeters(coords)
  const label = missionEstimates.formatArea(m2)

  const centerTuple = centroidLatLng(coords)
  if (!Number.isFinite(centerTuple[0]) || !Number.isFinite(centerTuple[1])) return

  if (!liveSurveyAreaMarker.value) {
    liveSurveyAreaMarker.value = makeAreaMarker(centerTuple, label)
    addAreaToMeasureLayer(liveSurveyAreaMarker.value)
  } else {
    liveSurveyAreaMarker.value.setLatLng(centerTuple)
    liveSurveyAreaMarker.value.getElement().querySelector('.measure-area-pill')!.textContent = label
  }
}

const createSurveyAreaLabel = (surveyId: string, coords: [number, number][]): void => {
  const m2 = polygonAreaSquareMeters(coords)
  const label = missionEstimates.formatArea(m2)
  const marker = makeAreaMarker(centroidLatLng(coords), label)
  addAreaToMeasureLayer(marker)
  surveyAreaMarkers.value[surveyId] = marker
  setSurveyAreaSquareMeters(surveyId, m2)
}

const isOverLastWaypointMarker = (event: MeasureCursor): boolean => {
  const el = event.originalEvent?.target as HTMLElement | null
  if (!el) return false
  const waypoints = missionStore.currentPlanningWaypoints
  if (!Array.isArray(waypoints) || waypoints.length === 0) return false
  const lastWp = waypoints[waypoints.length - 1]
  const lastMarker = waypointMarkers.value[lastWp.id]
  const lastElement = lastMarker?.getElement?.()
  return !!lastElement && (lastElement === el || lastElement.contains(el))
}

// The survey draft can be dragged as a whole, which claims the press from map panning.
const onPolygonMouseDown = (event: MapPointerEvent): void => {
  // A press that landed on an edge is reshaping that edge, so the whole polygon must not follow the pointer too.
  if (isPressingSurveyEdge.value) return

  event.preventDefault()
  isDraggingPolygon.value = true
  dragStartLatLng = event.latLng
  pushSurveyPolygonSnapshot()
  polygonLatLngsAtDragStart = surveyPolygonVertexesPositions.value.map((latlng): WaypointCoordinates => [...latlng])
  planningMap.value?.dragPan.disable()

  planningMap.value?.on('mousemove', onPolygonMouseMove)
  planningMap.value?.on('mouseup', onPolygonMouseUp)
}

const onPolygonMouseUp = (event: MapPointerEvent): void => {
  const releasedAt = event.latLng
  const moved = !!dragStartLatLng && (releasedAt[0] !== dragStartLatLng[0] || releasedAt[1] !== dragStartLatLng[1])

  isDraggingPolygon.value = false
  dragStartLatLng = null
  polygonLatLngsAtDragStart = []
  planningMap.value?.dragPan.enable()

  planningMap.value?.off('mousemove', onPolygonMouseMove)
  planningMap.value?.off('mouseup', onPolygonMouseUp)

  ignoreNextClick = true
  // Every build during the drag was suppressed, so the polygon at rest is the one allowed to warn.
  if (moved) createSurveyPath()
}

const onPolygonMouseMove = (event: MapPointerEvent): void => {
  if (!isDraggingPolygon.value || !dragStartLatLng) return

  if (surveyDraftPolygonDrawn.value && surveyPolygonVertexesPositions.value.length >= 3) {
    updateLiveSurveyAreaLabel(surveyPolygonVertexesPositions.value)
  }

  const pointer = event.latLng
  const latDiff = pointer[0] - dragStartLatLng[0]
  const lngDiff = pointer[1] - dragStartLatLng[1]

  surveyPolygonVertexesPositions.value = polygonLatLngsAtDragStart.map(
    (latlng): WaypointCoordinates => [latlng[0] + latDiff, latlng[1] + lngDiff]
  )

  drawSurveyDraftPolygon()
  surveyPolygonVertexesMarkers.value.forEach((marker, index) => {
    marker.setLatLng(surveyPolygonVertexesPositions.value[index])
  })

  updateSurveyEdgeAddMarkers()
  createSurveyPath()
  updateConfirmButtonPosition()
}

const showContextMenu = (latlng: WaypointCoordinates, originalEvent: MouseEvent): void => {
  cursorCoordinates.value = latlng
  originalEvent.preventDefault()

  contextMenuNearestSegmentIndex.value = null
  if (contextMenuType.value === 'map' && missionStore.currentPlanningWaypoints.length >= 2) {
    const latlngs = missionStore.currentPlanningWaypoints.map((w) => w.coordinates)
    const { segmentIndex, distanceInPixels } = getClosestMissionPathSegmentInfo(latlngs, latlng)
    if (segmentIndex >= 0 && distanceInPixels <= nearMissionPathTolerance) {
      contextMenuNearestSegmentIndex.value = segmentIndex
    }
  }

  let x = originalEvent.clientX
  let y = originalEvent.clientY

  if (contextMenuType.value === 'survey' && planningMap.value && selectedSurvey.value) {
    const map = toRaw(planningMap.value)!
    const container = map.getContainer()
    const vw = container.clientWidth
    const vh = container.clientHeight
    const menuSize = 210
    const gap = 40

    const screenPoints = selectedSurvey.value.polygonCoordinates.map((coordinates) => map.project(coordinates))
    const minX = Math.min(...screenPoints.map((p) => p.x))
    const maxX = Math.max(...screenPoints.map((p) => p.x))
    const minY = Math.min(...screenPoints.map((p) => p.y))
    const maxY = Math.max(...screenPoints.map((p) => p.y))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Prefer the right side, 40px clear of the survey; only fall back to another side when it doesn't fit.
    const placement =
      vw - maxX >= menuSize + gap
        ? { x: maxX + gap, y: centerY - menuSize / 2 }
        : [
            { freeSpace: minX, x: minX - gap - menuSize, y: centerY - menuSize / 2 },
            { freeSpace: minY, x: centerX - menuSize / 2, y: minY - gap - menuSize },
            { freeSpace: vh - maxY, x: centerX - menuSize / 2, y: maxY + gap },
          ]
            .filter((candidate) => candidate.freeSpace >= menuSize + gap)
            .sort((a, b) => b.freeSpace - a.freeSpace)[0]

    if (placement) {
      x = placement.x
      y = placement.y
    } else {
      // Survey fills most of the viewport: drop the menu into the emptiest horizontal corner.
      x = vw - maxX > minX ? maxX + gap : minX - gap - menuSize
      y = 0
    }

    x = Math.max(gap, Math.min(x, vw - menuSize - gap))
    y = Math.max(gap, Math.min(y, vh - menuSize - gap))
  }

  contextMenuPosition.value = { x, y }
  contextMenuVisible.value = true
}

const hideContextMenu = (): void => {
  contextMenuVisible.value = false
  contextMenuNearestSegmentIndex.value = null
  selectedSurveyId.value = ''
}

const clearVehiclePathHistory = (): void => {
  logUserAction('Cleared vehicle path history')
  missionStore.clearVehicleHistory()
  openSnackbar({ message: 'Vehicle path history cleared', variant: 'success' })
}

const setHomePositionFromContextMenu = (): void => {
  logUserAction('Set mission home position from context menu')
  setHomePosition()
}

const placeBaseStationFromContextMenu = (): void => {
  if (!currentCursorGeoCoordinates.value) {
    openSnackbar({
      variant: 'error',
      message: 'No map position under the cursor. Right-click on the map where the base station should go.',
      duration: 4000,
    })
    return
  }
  baseStationStore.setPosition(currentCursorGeoCoordinates.value)
  baseStationStore.configPanelOpen = true
  logUserAction('Placed the base station via the mission-planning context menu')
}

// Planning never commands the vehicle. The home point reaches it as the mission's first item on upload.
const setHomePosition = (): void => {
  if (!currentCursorGeoCoordinates.value) return
  const newHome: [number, number] = [currentCursorGeoCoordinates.value[0], currentCursorGeoCoordinates.value[1]]
  home.value = newHome
  const coordinates = `${newHome[0].toFixed(5)}, ${newHome[1].toFixed(5)}`
  openSnackbar({
    variant: 'success',
    message: `Mission home set to ${coordinates}. Upload the mission for the change to take effect.`,
  })
}

const toggleSimplePath = (): void => {
  if (isCreatingSimplePath.value) {
    logUserAction('Disabled mission simple-path tool')
    isCreatingSimplePath.value = false
    pendingSimplePathInsertIndex.value = null
    return
  }
  logUserAction('Enabled mission simple-path tool')
  isCreatingSimplePath.value = true
}

const toggleSurvey = (): void => {
  if (isCreatingSimplePath.value) {
    isCreatingSimplePath.value = false
    pendingSimplePathInsertIndex.value = null
  }
  if (isCreatingSurvey.value) {
    logUserAction('Disabled mission survey tool')
    isCreatingSurvey.value = false
    isDrawingSurveyPolygon.value = false
    segmentSurveyInsertIndex.value = null
    return
  }
  logUserAction('Enabled mission survey tool')
  surveyDraftEntryCorner.value = 0
  isCreatingSurvey.value = true
  isDrawingSurveyPolygon.value = true
  hideContextMenu()
}

const targetFollower = new TargetFollower(
  (newTarget: string | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (mapCenter.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)
targetFollower.setTrackableTarget(WhoToFollow.BASE_STATION, () => baseStationStore.activePosition)

const committedSurveysId = 'survey-area::committed-surveys'

// An area filled as the survey areas are, with the blue outline the stylesheet always kept on them.
const surveyAreaFeatures = (ring: WaypointCoordinates[], fillColor: string, id?: string): VectorFeature[] => [
  polygonFeature(ring, { color: fillColor, opacity: 0.2 }, { id }),
  lineFeature([...ring, ring[0]], surveyPolygonOutline, { id }),
]

// Draws every committed survey area in one layer, the selected one filled gold.
const drawCommittedSurveys = (): void => {
  const map = planningMap.value
  if (!map) return
  const firstDraw = !map.hasVectors(committedSurveysId)
  map.setVectors(
    committedSurveysId,
    'survey-area',
    surveys.value.flatMap((survey) =>
      surveyAreaFeatures(
        survey.polygonCoordinates,
        survey.id === selectedSurveyId.value ? '#FFD700' : '#60A5FA',
        survey.id
      )
    )
  )
  drawnSurveyIds.value = surveys.value.map((survey) => survey.id)
  if (!firstDraw) return
  map.onLayer('click', committedSurveysId, onCommittedSurveyClick)
  map.onLayer('contextmenu', committedSurveysId, onCommittedSurveyContextMenu)
  map.onLayer('mouseenter', committedSurveysId, setSurveyHoverCursor)
  map.onLayer('mouseleave', committedSurveysId, setMapCursor)
}

const surveyPolygonOutline: LineStyle = { color: '#3b82f6', width: 2 }

const surveyIdAt = (event: MapPointerEvent): string | undefined => {
  const id = event.feature?.properties.id
  return typeof id === 'string' ? id : undefined
}

// The survey areas take the pointer like the drawn polygons do, with a crosshair over them.
const setSurveyHoverCursor = (): void => {
  const el = planningMap.value?.getCanvasContainer()
  if (el && !isSettingHomeWaypoint.value) el.style.cursor = 'crosshair'
}

// Selecting a survey claims the click, so the map does not also take it as a click on the map.
const onCommittedSurveyClick = (event: MapPointerEvent): void => {
  const surveyId = surveyIdAt(event)
  if (!surveyId) return
  event.preventDefault()
  if (isCreatingSimplePath.value) return
  accessingSurveyContextMenu.value = false
  selectedSurveyId.value = surveyId
  lastSelectedSurveyId.value = surveyId
  selectedWaypoint.value = undefined
}

const onCommittedSurveyContextMenu = (event: MapPointerEvent): void => {
  const surveyId = surveyIdAt(event)
  if (!surveyId) return
  event.preventDefault()
  event.originalEvent.stopPropagation()

  accessingSurveyContextMenu.value = true
  contextMenuType.value = 'survey'
  if (selectedSurveyId.value !== surveyId && !isCreatingSimplePath.value) {
    selectedWaypoint.value = undefined
    selectedSurveyId.value = surveyId
    lastSelectedSurveyId.value = surveyId
  }

  currentCursorGeoCoordinates.value = event.latLng
  showContextMenu(event.latLng, event.originalEvent)
}

const removeSurveyAreaMarker = (surveyId: string): void => {
  const areaMarker = surveyAreaMarkers.value[surveyId]
  if (!areaMarker) return
  areaMarker.remove()
  measureMarkers.delete(areaMarker)
  delete surveyAreaMarkers.value[surveyId]
}

const clearSurveyVertexMarkers = (): void => {
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
}

const rebuildSurveyPolygonFromPositions = (): void => {
  surveyPolygonVertexesMarkers.value.forEach((m) => m.remove())
  surveyPolygonVertexesMarkers.value = []
  surveyEdgeAddMarkers.forEach((m) => m.remove())
  surveyEdgeAddMarkers.length = 0

  removeSurveyDraftPolygon()
  removeSurveyPathLayers()

  surveyPolygonVertexesPositions.value.forEach((latLng) => {
    const newMarker = createSurveyVertexMarker(
      latLng,
      (marker) => {
        const idx = surveyPolygonVertexesMarkers.value.indexOf(marker)
        if (idx !== -1) onRemoveSurveyVertex(idx)
      },
      () => {
        updatePolygon()
        createSurveyPath()
      }
    ).addTo(planningMap.value!)
    surveyPolygonVertexesMarkers.value = [...surveyPolygonVertexesMarkers.value, newMarker]
  })

  if (surveyPolygonVertexesPositions.value.length >= 3) drawSurveyDraftPolygon()

  updateSurveyEdgeAddMarkers()
  createSurveyPath()
  updateConfirmButtonPosition()
}

const performSurveyPolygonUndo = (): boolean => {
  if (!isCreatingSurvey.value) return false

  logUserAction('Undid survey polygon edit')
  const snapshot = surveyPolygonUndoStack.pop()
  if (!snapshot) {
    clearSurveyCreation()
    return true
  }

  surveyPolygonRedoStack.push(surveyPolygonVertexesPositions.value.map((ll): WaypointCoordinates => [...ll]))

  if (snapshot.length === 0) {
    surveyPolygonVertexesPositions.value = []
    rebuildSurveyPolygonFromPositions()
    clearSurveyCreation()
    return true
  }

  surveyPolygonVertexesPositions.value = snapshot
  isDrawingSurveyPolygon.value = snapshot.length < 3
  rebuildSurveyPolygonFromPositions()
  return true
}

const performSurveyPolygonRedo = (): boolean => {
  if (!isCreatingSurvey.value) return false

  logUserAction('Redid survey polygon edit')
  const snapshot = surveyPolygonRedoStack.pop()
  if (!snapshot) return false

  surveyPolygonUndoStack.push(surveyPolygonVertexesPositions.value.map((ll): WaypointCoordinates => [...ll]))

  surveyPolygonVertexesPositions.value = snapshot
  isDrawingSurveyPolygon.value = snapshot.length < 3
  rebuildSurveyPolygonFromPositions()
  return true
}

const performUndo = (): void => {
  logUserAction('Triggered mission edit undo')
  const snapshot = missionStore.popUndoSnapshot()
  if (!snapshot) {
    if (!undoLimitShown) {
      openSnackbar({ variant: 'error', message: 'No more steps to undo.', duration: 2000 })
      undoLimitShown = true
    }
    return
  }
  redoLimitShown = false

  const snapshotSurveyIds = new Set(snapshot.surveys.map((s) => s.id))
  const removedSurvey = missionStore.currentPlanningSurveys.find((s) => !snapshotSurveyIds.has(s.id))

  if (removedSurvey) {
    const surveyWpIds = new Set(removedSurvey.waypoints.map((w) => w.id))
    for (let i = missionStore.currentPlanningWaypoints.length - 1; i >= 0; i--) {
      if (surveyWpIds.has(missionStore.currentPlanningWaypoints[i].id)) {
        removeWaypointMarker(missionStore.currentPlanningWaypoints[i].id)
        missionStore.currentPlanningWaypoints.splice(i, 1)
      }
    }

    const surveyIdx = missionStore.currentPlanningSurveys.findIndex((s) => s.id === removedSurvey.id)
    if (surveyIdx !== -1) missionStore.currentPlanningSurveys.splice(surveyIdx, 1)

    if (surveyAreaMarkers.value[removedSurvey.id]) {
      removeSurveyAreaMarker(removedSurvey.id)
      removeSurveyAreaSquareMeters(removedSurvey.id)
    }

    surveyPolygonVertexesPositions.value = removedSurvey.polygonCoordinates.map((c): WaypointCoordinates => [...c])
    distanceBetweenSurveyLines.value = removedSurvey.distanceBetweenLines
    surveyLinesAngle.value = removedSurvey.surveyLinesAngle
    surveyCrosshatch.value = removedSurvey.crosshatch ?? false
    crosshatchDistanceBetweenLines.value =
      removedSurvey.crosshatchDistanceBetweenLines ?? removedSurvey.distanceBetweenLines
    surveyDraftEntryCorner.value = removedSurvey.entryCorner ?? 0

    clearSurveyPolygonUndoStack()
    const coords = removedSurvey.polygonCoordinates
    for (let i = 0; i <= coords.length; i++) {
      surveyPolygonUndoStack.push(coords.slice(0, i).map((c): WaypointCoordinates => [...c]))
    }

    isCreatingSurvey.value = true
    isDrawingSurveyPolygon.value = false
    rebuildSurveyPolygonFromPositions()

    selectedWaypoint.value = undefined
    selectedSurveyId.value = ''
    interfaceStore.configPanelVisible = false
    updateWaypointMarkers()
    return
  }

  Object.keys(waypointMarkers.value).forEach(removeWaypointMarker)
  waypointMarkers.value = {}

  missionStore.currentPlanningWaypoints.splice(0, missionStore.currentPlanningWaypoints.length, ...snapshot.waypoints)
  missionStore.currentPlanningSurveys.splice(0, missionStore.currentPlanningSurveys.length, ...snapshot.surveys)

  missionStore.currentPlanningWaypoints.forEach((wp) => addWaypointMarker(wp))
  updateWaypointMarkers()

  selectedWaypoint.value = undefined
  selectedSurveyId.value = ''
  interfaceStore.configPanelVisible = false

  const anchor = currentMeasureAnchor()
  if (!anchor || !setLiveMeasureAnchor(anchor)) clearLiveMeasure()
}

const performRedo = (): void => {
  logUserAction('Triggered mission edit redo')
  const snapshot = missionStore.popRedoSnapshot()
  if (!snapshot) {
    if (!redoLimitShown) {
      openSnackbar({ variant: 'error', message: 'No more steps to redo.', duration: 2000 })
      redoLimitShown = true
    }
    return
  }
  undoLimitShown = false

  if (isCreatingSurvey.value) {
    clearSurveyCreation()
    clearSurveyVertexMarkers()
  }

  Object.keys(waypointMarkers.value).forEach(removeWaypointMarker)
  waypointMarkers.value = {}

  missionStore.currentPlanningWaypoints.splice(0, missionStore.currentPlanningWaypoints.length, ...snapshot.waypoints)
  missionStore.currentPlanningSurveys.splice(0, missionStore.currentPlanningSurveys.length, ...snapshot.surveys)

  missionStore.currentPlanningWaypoints.forEach((wp) => addWaypointMarker(wp))
  updateWaypointMarkers()

  selectedWaypoint.value = undefined
  selectedSurveyId.value = ''
  interfaceStore.configPanelVisible = false

  const anchor = currentMeasureAnchor()
  if (!anchor || !setLiveMeasureAnchor(anchor)) clearLiveMeasure()
}

const handleKeyDown = (event: KeyboardEvent): void => {
  // Placement owns the whole map while it is live, so Escape backs out of it and the edit
  // shortcuts below stay off the mission sitting underneath the preview.
  if (isPlacingMission.value) {
    if (event.key === 'Escape') cancelFreePlacement()
    return
  }
  if (event.key === 'Escape') {
    if (isCreatingSurvey.value) {
      if (isDrawingSurveyPolygon.value) {
        isDrawingSurveyPolygon.value = false
      }
    }
    if (isCreatingSimplePath.value) {
      isCreatingSimplePath.value = false
      pendingSimplePathInsertIndex.value = null
    }
  }
  handleFenceKeyDown(event)
  if (event.key === 'Enter' && isCreatingSurvey.value) {
    generateWaypointsFromSurvey()
  }
  if (event.key === 'Delete' && !interfaceStore.configPanelVisible && !baseStationStore.configPanelOpen) {
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    if (!performSurveyPolygonUndo()) {
      performUndo()
    }
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y')
  ) {
    event.preventDefault()
    if (!performSurveyPolygonRedo()) {
      performRedo()
    }
  }
}

const clearSurveyCreation = (): void => {
  logUserAction('Cancelled survey creation')
  clearSurveyPath()
  isCreatingSurvey.value = false
  isDrawingSurveyPolygon.value = false
  segmentSurveyInsertIndex.value = null
  clearSurveyPolygonUndoStack()
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

  logUserAction('Deleted selected survey')
  missionStore.pushUndoSnapshot()

  clearSurveyVertexMarkers()

  const waypointsToRemove = surveys.value[surveyIndex].waypoints
  waypointsToRemove.forEach((waypoint) => {
    const waypointIndex = missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === waypoint.id)
    if (waypointIndex !== -1) {
      missionStore.currentPlanningWaypoints.splice(waypointIndex, 1)
    }
    removeWaypointMarker(waypoint.id)
  })

  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.length = 0

  surveys.value.splice(surveyIndex, 1)

  if (selectedSurveyId.value === surveyId) {
    selectedSurveyId.value = surveys.value.length > 0 ? surveys.value[0].id : ''
  }

  if (surveyAreaMarkers.value[surveyId]) {
    removeSurveyAreaMarker(surveyId)
    removeSurveyAreaSquareMeters(surveyId)
  }

  openSnackbar({ variant: 'success', message: 'Survey deleted.', duration: 2000 })
  hideContextMenu()
  updateWaypointMarkers()
}

const rotateSurveyEntryPoint = (): void => {
  const survey = selectedSurvey.value
  if (!survey || survey.waypoints.length < 2) return

  const nextCorner = ((survey.entryCorner ?? 0) + 1) % surveyEntryCornerCount(survey.crosshatch)
  logUserAction(`Rotated survey entry point to corner ${nextCorner + 1}`)
  missionStore.pushUndoSnapshot()

  survey.entryCorner = nextCorner
  regenerateSelectedSurveyWaypoints()
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
  const mapContainer = planningMap.value.getCanvasContainer()

  if (active) {
    mapContainer.style.cursor = homeWaypointCursor
    setHomeOnFirstClick = (evt: MapPointerEvent): void => {
      currentCursorGeoCoordinates.value = evt.latLng
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
watch(selectedSurveyId, () => drawCommittedSurveys())

// Responsible for updating the survey polygons and their area labels
watch(
  () => surveys.value.slice(),
  (newSurveys) => {
    Object.keys(surveyAreaMarkers.value).forEach(removeSurveyAreaMarker)
    drawCommittedSurveys()
    if (!planningMap.value) return
    newSurveys.forEach((survey) => createSurveyAreaLabel(survey.id, survey.polygonCoordinates))
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

watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  if (!planningMap.value) return
  recenterMapOnFollowTarget(planningMap.value, zoom.value, targetFollower.currentCoordinates())
})

const addWaypoint = (
  coordinates: WaypointCoordinates,
  altitude: number,
  altitudeReferenceType: AltitudeReferenceType,
  commands?: MissionCommand[],
  insertIndex?: number
): void => {
  if (planningMap.value === undefined) throw new Error('Map not yet defined')

  missionStore.pushUndoSnapshot()

  const waypointId = uuid()
  const waypoint: Waypoint = {
    id: waypointId,
    coordinates,
    altitude,
    altitudeReferenceType,
    commands: cloneCommands(commands),
  }

  logUserAction(`Added mission waypoint at ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`)
  if (insertIndex !== undefined) {
    missionStore.currentPlanningWaypoints.splice(insertIndex, 0, waypoint)
  } else {
    missionStore.currentPlanningWaypoints.push(waypoint)
  }

  // A waypoint drawn here does not select on click, unlike one loaded into the planner, as it never has.
  createPlanningWaypointMarker(waypoint, { selectsOnClick: false, contextMenuClearsSurvey: false })

  // Update waypoint numbering to account for command counts
  updateWaypointMarkers()
}

const removeSelectedWaypoint = (): void => {
  const waypoint = selectedWaypoint.value
  if (!waypoint) return

  logUserAction(`Removed mission waypoint ${waypoint.id}`)
  missionStore.pushUndoSnapshot()

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

  if (waypointMarkers.value[waypoint.id]) {
    removeWaypointMarker(waypoint.id)
  } else {
    console.warn(`No marker found for waypoint id: ${waypoint.id}`)
  }

  updateWaypointMarkers()
  hideContextMenu()
}

const handleShouldUpdateWaypoints = (): void => {
  updateWaypointMarkers()
}

const drawMissionOnTheMap = (waypoints: Waypoint[]): void => {
  waypoints
    .map((wp) => ({
      ...wp,
      id: wp.id ?? uuid(),
      commands: cloneCommands(wp.commands),
    }))
    .forEach((wp) => {
      missionStore.currentPlanningWaypoints.push(wp)
      addWaypointMarker(wp)
    })

  updateWaypointMarkers()
}

// When true, the next mount of `MissionLibraryModal` opens its "Save current mission" dialog.
const missionLibraryOpenSaveOnMount = ref(false)

const canSaveCurrentMissionToLibrary = computed(() =>
  hasLivePlanningMission(missionStore.currentPlanningWaypoints, missionStore.currentPlanningSurveys)
)

const openMissionLibraryWithSaveDialog = (): void => {
  if (!canSaveCurrentMissionToLibrary.value) return
  openMissionLibrary({ openSaveDialog: true })
}

// Merges a placed/loaded library mission into the current planning (append, segment-insert, or
// fresh load). The insert-segment intent is carried on `placementInsertSegmentIndex` so both
// placement outcomes ("Reposition" and "Keep original") route to the requested segment.
const { insertSegmentIndex: placementInsertSegmentIndex, finalizeMissionPlacement } = useMissionInsertion({
  cloneCommands: (commands) => cloneCommands(commands),
  addWaypointMarker: (waypoint) => addWaypointMarker(waypoint),
  updateWaypointMarkers: () => updateWaypointMarkers(),
  loadDraftMission: (mission, opts) => loadDraftMission(mission, opts),
})

// --- Mission free placement (drag/scale/rotate before committing) ---
const {
  isPlacingMission,
  placementScaleXPercent,
  placementScaleYPercent,
  placementRotationDeg,
  PLACEMENT_LIMITS,
  clampPlacementScaleX,
  clampPlacementScaleY,
  clampPlacementRotation,
  resetPlacementTransform,
  startFreePlacement,
  cancelFreePlacement: cancelPlacementInternal,
  confirmFreePlacement,
  placementToolbarStyle,
} = useMissionPlacement(planningMap, {
  onConfirm: (placedMission) => finalizeMissionPlacement(placedMission, { wasRepositioned: true }),
  toolbarFootprint: PLACEMENT_TOOLBAR_FOOTPRINT,
})

// Wrap the composable's cancel so the view-owned segment-insert routing intent is also dropped
// when the user actively cancels via the toolbar button.
const cancelFreePlacement = (): void => {
  logUserAction('Cancelled mission placement')
  cancelPlacementInternal()
  placementInsertSegmentIndex.value = null
}

const onConfirmPlacement = (): void => {
  logUserAction('Confirmed mission placement on the map')
  confirmFreePlacement()
}

const onResetPlacement = (): void => {
  logUserAction('Reset the mission placement scale and rotation')
  resetPlacementTransform()
}

const surveyPolygonVertexesMarkers = shallowRef<MapMarker[]>([])
const rawDistanceBetweenSurveyLines = ref(10)
const rawCrosshatchDistanceBetweenLines = ref(10)
const rawSurveyLinesAngle = ref(0)
const rawTurnaroundDistance = ref(0)
const surveyCrosshatch = ref(false)
const surveyDraftEntryCorner = ref(0)
const existingWaypoints = ref<Waypoint[]>([])
const surveyWaypoints = ref<Waypoint[]>([])

// Distance between lines in the survey path
const distanceBetweenSurveyLines = computed({
  get: () => Math.max(1, rawDistanceBetweenSurveyLines.value),
  set: (value) => (rawDistanceBetweenSurveyLines.value = Math.max(1, value)), // Ensure the distance is at least 1
})

// Distance between lines in the crosshatch second pass
const crosshatchDistanceBetweenLines = computed({
  get: () => Math.max(1, rawCrosshatchDistanceBetweenLines.value),
  set: (value) => (rawCrosshatchDistanceBetweenLines.value = Math.max(1, value)),
})

const turnaroundDistance = computed({
  get: () => rawTurnaroundDistance.value,
  set: (value) => (rawTurnaroundDistance.value = value),
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

// The survey, the waypoints and the speed command are all built in meters and m/s, so only the fields showing them
// follow the unit the user reads.
const { toDisplayBound: metersToDisplayBound, unit: distanceUnit } = useUnitConversion('m')
const { displayedValue: displayedDistanceBetweenSurveyLines } = useUnitInput(distanceBetweenSurveyLines, 'm')
const { displayedValue: displayedCrosshatchDistanceBetweenLines } = useUnitInput(crosshatchDistanceBetweenLines, 'm')
const { displayedValue: displayedTurnaroundDistance } = useUnitInput(turnaroundDistance, 'm')
const { displayedValue: displayedWaypointAltitude, unit: altitudeUnit } = useUnitInput(
  currentWaypointAltitude,
  'm',
  'altitude'
)
const {
  displayedValue: displayedCruiseSpeed,
  toDisplayBound: metersPerSecondToDisplayBound,
  unit: speedUnit,
} = useUnitInput(localCruiseSpeed, 'm/s')

// The tested speeds are quoted in m/s, so they are read out in whatever the cruise-speed field beside them takes.
const testedSpeed = (metersPerSecond: number): number => metersPerSecondToDisplayBound(metersPerSecond, 1)

const onSurveyLinesAngleChange = (angle: number): void => {
  surveyLinesAngle.value = angle
}

// The survey preview's lines, handed to the signal overlay so it can recolor them in place.
const surveyPathLayer = shallowRef<DrawnLine | null>(null)
const surveyCrosshatchPathLayer = shallowRef<DrawnLine | null>(null)
const surveyTurnaroundLayers = shallowRef<DrawnLine[]>([])
const surveyPreviewPath = shallowRef<SurveyPreview | null>(null)
const surveyEndpointMarkers = shallowRef<MapMarker[]>([])

const surveyPathId = 'survey::survey-path'
const surveyCrosshatchPathId = 'survey::survey-path-crosshatch'
const surveyTurnaroundsId = 'survey::survey-turnarounds'
const surveyEndpointsId = 'survey::survey-endpoints'
const surveyDraftId = 'survey-area::survey-draft'

// The stylesheet drew the survey path 2px wide, whatever width it was created with, with 16px dashes.
const surveyPathStyle: LineStyle = { color: '#2563eb', width: 2, opacity: 0.8, dashPattern: [16, 16] }
const surveyCrosshatchPathStyle: LineStyle = { color: '#A855F7', width: 1.5, opacity: 0.8 }
const surveyTurnaroundStyle: LineStyle = { color: '#F97316', width: 5, opacity: 0.6 }

// The survey path's dashes march along it while it is drawn, as its CSS animation had them do.
let surveyPathDashFrame: number | null = null
const surveyPathDashSpeedInPixelsPerSecond = 60
const marchSurveyPathDashes = (now: number): void => {
  const map = planningMap.value
  if (!map?.hasVectors(surveyPathId)) {
    surveyPathDashFrame = null
    return
  }
  map.marchVectorDashes(surveyPathId, (now / 1000) * surveyPathDashSpeedInPixelsPerSecond)
  surveyPathDashFrame = requestAnimationFrame(marchSurveyPathDashes)
}

const removeSurveyEndpointMarkers = (): void => {
  surveyEndpointMarkers.value.forEach((marker) => marker.remove())
  surveyEndpointMarkers.value = []
  planningMap.value?.removeVectors(surveyEndpointsId)
}

const removeSurveyPathLayers = (): void => {
  planningMap.value?.removeVectors(surveyPathId)
  surveyPathLayer.value = null
  removeSurveyCrosshatchPathLayer()
  removeSurveyEndpointMarkers()
  planningMap.value?.removeVectors(surveyTurnaroundsId)
  surveyTurnaroundLayers.value = []
}

// The survey area being drawn. It can be dragged as a whole, and shows the crosshair the drawn areas always had.
const surveyDraftPolygonDrawn = ref(false)
const drawSurveyDraftPolygon = (): void => {
  const map = planningMap.value
  if (!map || surveyPolygonVertexesPositions.value.length < 3) return
  const firstDraw = !map.hasVectors(surveyDraftId)
  map.setVectors(surveyDraftId, 'survey-area', surveyAreaFeatures(surveyPolygonVertexesPositions.value, '#60A5FA'))
  surveyDraftPolygonDrawn.value = true
  if (!firstDraw) return
  map.onLayer('mousedown', surveyDraftId, onPolygonMouseDown)
  map.onLayer('mouseenter', surveyDraftId, setSurveyHoverCursor)
  map.onLayer('mouseleave', surveyDraftId, setMapCursor)
}

const removeSurveyDraftPolygon = (): void => {
  const map = planningMap.value
  if (map) {
    map.offLayer('mousedown', surveyDraftId, onPolygonMouseDown)
    map.offLayer('mouseenter', surveyDraftId, setSurveyHoverCursor)
    map.offLayer('mouseleave', surveyDraftId, setMapCursor)
    map.removeVectors(surveyDraftId)
  }
  surveyDraftPolygonDrawn.value = false
}

// Small green chevron marking a survey entrance/exit, oriented perpendicular to the polygon edge it sits on:
// it sits just outside the boundary and points inward for the entrance, outward for the exit.
const createSurveyEndpointChevron = (position: WaypointCoordinates, isEntrance: boolean): MapMarker => {
  const outwardBearing = surveyEndpointEdgeBearing(surveyPolygonVertexesPositions.value, position)
  // The endpoint sits at the box center (12, 20); the glyph sits above it (outward side) with its nearest edge
  // 8px out, clearing the 5px circle by 3px. The entrance points down (inward), the exit up (outward).
  const chevronPath = isEntrance ? 'M6 7 L12 12 L18 7' : 'M6 12 L12 7 L18 12'
  const html =
    `<div style="transform: rotate(${outwardBearing}deg);">` +
    '<svg width="24" height="40" viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="${chevronPath}" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${chevronPath}" stroke="#034103" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    '</svg></div>'
  const marker = divIconMarker({ className: 'survey-endpoint-chevron', html, size: [24, 40] })
  marker.getElement().style.pointerEvents = 'none'
  return marker.setLatLng(position)
}

const removeSurveyCrosshatchPathLayer = (): void => {
  planningMap.value?.removeVectors(surveyCrosshatchPathId)
  surveyCrosshatchPathLayer.value = null
}

const clearSurveyPathByUser = (): void => {
  logUserAction('Cleared survey path')
  clearSurveyPath()
  // Clearing the draft is how the user starts over, so vertex adding comes back on even when it had been
  // switched off.
  if (isCreatingSurvey.value) isDrawingSurveyPolygon.value = true
}

const clearSurveyPath = (): void => {
  surveyPreviewPath.value = null
  removeSurveyPathLayers()
  removeSurveyDraftPolygon()
  if (liveSurveyAreaMarker.value) {
    liveSurveyAreaMarker.value.remove()
    measureMarkers.delete(liveSurveyAreaMarker.value)
    liveSurveyAreaMarker.value = null
  }
  surveyPolygonVertexesMarkers.value.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyPolygonVertexesMarkers.value = []
  surveyPolygonVertexesPositions.value = []
  renderMissionPathSignal()
}

watch([isCreatingSurvey, isCreatingSimplePath], (isCreatingNow) => {
  if (!isCreatingNow) clearSurveyPath()
  clearLiveMeasure()

  if (planningMap.value) {
    const mapContainer = planningMap.value.getCanvasContainer()
    mapContainer.style.cursor = 'crosshair'
    if (isCreatingNow) {
      mapContainer.classList.add('survey-cursor')
    } else {
      mapContainer.classList.remove('survey-cursor')
    }
  }
})

// While a path or an area is being drawn, pressing grabs and releasing goes back to the drawing crosshair. Bound once
// for the map's lifetime, rather than on every mode change.
const isDrawingMissionShape = (): boolean => isCreatingSurvey.value || isCreatingSimplePath.value
const onDrawingCursorPress = (): void => {
  const container = planningMap.value?.getCanvasContainer()
  if (container && isDrawingMissionShape()) container.style.cursor = 'grabbing'
}
const onDrawingCursorRelease = (): void => {
  const container = planningMap.value?.getCanvasContainer()
  if (container && isDrawingMissionShape()) container.style.cursor = 'crosshair'
}

// Watches for outside WP coordinate changes
watch(
  () => missionStore.currentPlanningWaypoints,
  (newWaypoints) => {
    newWaypoints.forEach((wp) => {
      const marker = waypointMarkers.value[wp.id]
      if (!marker) return

      const currentLatLng = marker.getLatLng()
      if (
        Math.abs(currentLatLng[0] - wp.coordinates[0]) > 1e-8 ||
        Math.abs(currentLatLng[1] - wp.coordinates[1]) > 1e-8
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
  if (surveyDraftPolygonDrawn.value || surveyPolygonVertexesPositions.value.length >= 3) drawSurveyDraftPolygon()
  if (surveyDraftPolygonDrawn.value && surveyPolygonVertexesPositions.value.length >= 3) {
    updateLiveSurveyAreaLabel(surveyPolygonVertexesPositions.value)
  }
  updateSurveyMarkersPositions()
}

const checkAndRemoveSurveyPath = (): void => {
  if (surveyPolygonVertexesPositions.value.length >= 4 || !surveyPathLayer.value) return
  surveyPreviewPath.value = null
  removeSurveyPathLayers()
  renderMissionPathSignal()
}

const createSurveyPath = (): void => {
  if (surveyPolygonVertexesPositions.value.length < 4) {
    checkAndRemoveSurveyPath()
    return
  }

  try {
    const adjustedAngle = 90 - surveyLinesAngle.value
    const result: SurveyPath = orderedSurveyPath(
      {
        polygonPoints: surveyPolygonVertexesPositions.value,
        distanceBetweenLines: distanceBetweenSurveyLines.value,
        linesAngle: adjustedAngle,
        turnaroundDistance: turnaroundDistance.value,
        crosshatch: surveyCrosshatch.value,
        crosshatchDistanceBetweenLines: crosshatchDistanceBetweenLines.value,
      },
      surveyDraftEntryCorner.value
    )

    if (result.path.length === 0) {
      surveyPreviewPath.value = null
      if (!isReshapingSurveyPolygon.value) {
        showDialog({
          variant: 'error',
          message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
          timer: 5000,
        })
      }
      return
    }

    const map = planningMap.value!
    removeSurveyCrosshatchPathLayer()
    removeSurveyEndpointMarkers()

    const crosshatchStart = result.crosshatchStartIndex
    const firstPassPath = crosshatchStart !== undefined ? result.path.slice(0, crosshatchStart) : result.path
    // Include the last point of the first pass so the transit leg into the second pass is drawn.
    const crosshatchPath = crosshatchStart !== undefined ? result.path.slice(Math.max(0, crosshatchStart - 1)) : []

    surveyPreviewPath.value = {
      firstPass: firstPassPath,
      crosshatch: crosshatchPath,
    }

    map.setVectors(surveyPathId, 'survey', [lineFeature(firstPassPath, surveyPathStyle)])
    surveyPathLayer.value = { layerId: surveyPathId, coordinates: () => firstPassPath, style: surveyPathStyle }
    if (surveyPathDashFrame === null) surveyPathDashFrame = requestAnimationFrame(marchSurveyPathDashes)

    if (crosshatchStart !== undefined) {
      map.setVectors(surveyCrosshatchPathId, 'survey', [lineFeature(crosshatchPath, surveyCrosshatchPathStyle)])
      surveyCrosshatchPathLayer.value = {
        layerId: surveyCrosshatchPathId,
        coordinates: () => crosshatchPath,
        style: surveyCrosshatchPathStyle,
      }
    }

    const turnarounds = result.turnaroundSegments
    map.setVectors(
      surveyTurnaroundsId,
      'survey',
      turnarounds.map((segment) => lineFeature(segment, surveyTurnaroundStyle))
    )
    surveyTurnaroundLayers.value = turnarounds.map((segment) => ({
      layerId: surveyTurnaroundsId,
      coordinates: () => segment,
      style: surveyTurnaroundStyle,
    }))

    // Mark the entrance (first point) and exit (last point) of the ordered path so the operator can
    // see where the vehicle enters and leaves the survey while still editing it.
    const entrance = result.path[0]
    const exit = result.path[result.path.length - 1]
    // Drawn as the circle markers were, with the 2px stroke centered on their 5px radius.
    const endpointDot = { radius: 4, fillColor: '#034103', color: '#ffffff', opacity: 0.6, weight: 2 }
    map.setVectors(
      surveyEndpointsId,
      'survey',
      [entrance, exit].map((point) => pointFeature(point, endpointDot))
    )
    surveyEndpointMarkers.value = [
      createSurveyEndpointChevron(entrance, true).addTo(map),
      createSurveyEndpointChevron(exit, false).addTo(map),
    ]

    renderMissionPathSignal()
  } catch (error) {
    surveyPreviewPath.value = null
    showDialog({
      variant: 'error',
      message: `Failed to generate survey path: ${(error as Error).message}`,
      timer: 5000,
    })
  }
}

watch(
  () => interfaceStore.configPanelVisible,
  async (isVisible, wasVisible) => {
    if (!isVisible || wasVisible) return

    await nextTick()

    const currentId = selectedWaypoint.value?.id
    if (currentId) applySelectedWaypointMarkerVisual(currentId, undefined)
  }
)

// Watch for changes in distanceBetweenSurveyLines, surveyLinesAngle, and turnaroundDistance
watch(
  [
    distanceBetweenSurveyLines,
    surveyLinesAngle,
    turnaroundDistance,
    surveyCrosshatch,
    crosshatchDistanceBetweenLines,
    surveyDraftEntryCorner,
  ],
  () => createSurveyPath()
)

const surveyEdgeAddMarkers: MapMarker[] = []

const updateSurveyEdgeAddMarkers = (): void => {
  // Remove existing edge markers
  surveyEdgeAddMarkers.forEach((marker) => marker.remove())
  surveyEdgeAddMarkers.length = 0

  // Add new edge markers
  if (surveyPolygonVertexesPositions.value.length >= 3) {
    for (let i = 0; i < surveyPolygonVertexesPositions.value.length; i++) {
      const start = surveyPolygonVertexesPositions.value[i]
      const end = surveyPolygonVertexesPositions.value[(i + 1) % surveyPolygonVertexesPositions.value.length]
      const middle: WaypointCoordinates = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]

      const surveyEdgeAddMarker = divIconMarker({
        html: `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <circle cx="10" cy="10" r="9" fill="white" stroke="#3B82F6" stroke-width="2"/>
              <path d="M10 5V15M5 10H15" stroke="#3B82F6" stroke-width="2"/>
            </svg>
          `,
        className: 'edge-marker',
        size: [24, 24],
      })

      // The new vertex lands on the "+", where a click on a marker always placed it.
      surveyEdgeAddMarker.getElement().addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation()
        addSurveyPoint(middle, i)
      })
      surveyEdgeAddMarker.setLatLng(middle).addTo(toRaw(planningMap.value)!)
      surveyEdgeAddMarkers.push(surveyEdgeAddMarker)
    }
  }
}

const onUpdateSurveyVertex = (index: number, latlng: WaypointCoordinates): void => {
  const marker = surveyPolygonVertexesMarkers.value[index]
  if (marker) {
    marker.setLatLng(latlng)
    updatePolygon()
    createSurveyPath()
  }
}

const onRemoveSurveyVertex = (index: number): void => {
  const marker = surveyPolygonVertexesMarkers.value[index]
  if (marker) {
    logUserAction('Removed survey polygon vertex')
    pushSurveyPolygonSnapshot()
    surveyPolygonVertexesPositions.value.splice(index, 1)
    surveyPolygonVertexesMarkers.value = surveyPolygonVertexesMarkers.value.filter((_, i) => i !== index)
    marker.remove()
    updatePolygon()
    updateSurveyEdgeAddMarkers()
    checkAndRemoveSurveyPath()
    createSurveyPath()
  }
}

const addSurveyPoint = (latlng: WaypointCoordinates, edgeIndex: number | undefined = undefined): void => {
  if (!isCreatingSurvey.value) return

  logUserAction('Added survey polygon vertex')
  pushSurveyPolygonSnapshot()

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
        onRemoveSurveyVertex(index)
      }
    },
    // onDrag callback
    () => {
      updatePolygon()
      createSurveyPath()
    }
  ).addTo(toRaw(planningMap.value)!)

  const markers = [...surveyPolygonVertexesMarkers.value]
  markers.splice(edgeIndex === undefined ? markers.length : edgeIndex + 1, 0, newMarker)
  surveyPolygonVertexesMarkers.value = markers

  updatePolygon()
  updateSurveyEdgeAddMarkers()
  createSurveyPath()
}

watch(isCreatingSurvey, (isCreatingNow) => {
  if (isCreatingNow) {
    existingWaypoints.value = [...missionStore.currentPlanningWaypoints]
    surveyWaypoints.value = []
    // The vertex list stays folded away behind its own arrow, since the map is what the area is drawn on.
    interfaceStore.configPanelVisible = false
  } else {
    clearSurveyPath()
  }
})

const generateWaypointsFromSurvey = (): void => {
  if (!surveyPathLayer.value) {
    showDialog({ variant: 'error', message: 'No survey path to generate waypoints from.', timer: 2000 })
    return
  }

  logUserAction('Generated waypoints from survey')

  missionStore.pushUndoSnapshot()

  const newSurveyId = uuid()

  const polygonCoordinates: WaypointCoordinates[] = surveyPolygonVertexesPositions.value.map((latLng) => [
    latLng[0],
    latLng[1],
  ])

  const adjustedAngle = 90 - surveyLinesAngle.value
  const { path: continuousPath } = orderedSurveyPath(
    {
      polygonPoints: polygonCoordinates,
      distanceBetweenLines: distanceBetweenSurveyLines.value,
      linesAngle: adjustedAngle,
      turnaroundDistance: turnaroundDistance.value,
      crosshatch: surveyCrosshatch.value,
      crosshatchDistanceBetweenLines: crosshatchDistanceBetweenLines.value,
    },
    surveyDraftEntryCorner.value
  )

  if (!continuousPath.length) {
    showDialog({
      variant: 'error',
      message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
      timer: 3000,
    })
    return
  }

  const newSurveyWaypoints: Waypoint[] = continuousPath.map((coordinates) => ({
    id: uuid(),
    coordinates,
    altitude: currentWaypointAltitude.value,
    altitudeReferenceType: currentWaypointAltitudeRefType.value,
    commands: makeDefaultNavCommands(),
  }))

  const segInsertIdx = segmentSurveyInsertIndex.value
  const waypointInsertIdx = undoWaypointInsertIndex.value
  const surveyInsertIdx = undoSurveyInsertIndex.value
  segmentSurveyInsertIndex.value = null
  undoWaypointInsertIndex.value = null
  undoSurveyInsertIndex.value = null

  const effectiveInsertIdx = segInsertIdx ?? waypointInsertIdx
  if (effectiveInsertIdx !== null) {
    missionStore.currentPlanningWaypoints.splice(effectiveInsertIdx, 0, ...newSurveyWaypoints)
  } else {
    missionStore.currentPlanningWaypoints.push(...newSurveyWaypoints)
  }

  const newSurvey: Survey = {
    id: newSurveyId,
    polygonCoordinates: polygonCoordinates,
    distanceBetweenLines: distanceBetweenSurveyLines.value,
    surveyLinesAngle: surveyLinesAngle.value,
    turnaroundDistance: turnaroundDistance.value,
    crosshatch: surveyCrosshatch.value,
    crosshatchDistanceBetweenLines: crosshatchDistanceBetweenLines.value,
    entryCorner: surveyDraftEntryCorner.value,
    waypoints: newSurveyWaypoints,
  }

  if (surveyInsertIdx !== null) {
    surveys.value.splice(surveyInsertIdx, 0, newSurvey)
  } else {
    addSurvey(newSurvey)
  }
  selectedSurveyId.value = newSurvey.id
  newSurveyWaypoints.forEach((waypoint) => addWaypointMarker(waypoint))
  clearSurveyPath()
  isCreatingSurvey.value = false
  isDrawingSurveyPolygon.value = false
  updateWaypointMarkers()

  openSnackbar({ variant: 'success', message: 'Waypoints generated from survey path.', duration: 1000 })
}

// Helper function to create waypoint marker HTML with command count indicator
const createWaypointMarkerHtml = (
  commandCount: number,
  isSelected = false,
  isEntryExit = false,
  isEndpoint = false
): string => {
  const baseClass = isSelected ? 'selected-marker' : 'marker-icon'
  const size = getEffectiveMarkerSize(zoom.value)
  const markerSizeClass = `wp-marker-${size}`
  const showSmallCommandCount = size !== 'md' && commandCount > 1
  const showCommandCount = size === 'md' && commandCount > 1
  const entryExitClass = isEntryExit ? ' green-marker' : ''
  const endpointClass = isEndpoint ? ' endpoint-marker' : ''

  return `
    <div class="${markerSizeClass}">
      <div class="${baseClass} waypoint-main-marker${entryExitClass}${endpointClass}"></div>
      ${showCommandCount ? `<div class="command-count-indicator">${commandCount}</div>` : ''}
      ${showSmallCommandCount ? `<div class="command-count-indicator small">${commandCount}</div>` : ''}
    </div>
  `
}

const isEndpointWaypoint = (waypointId: string): boolean => {
  const wps = missionStore.currentPlanningWaypoints
  if (wps.length === 0) return false
  return waypointId === wps[0].id || waypointId === wps[wps.length - 1].id
}

const updateWaypointMarkers = (): void => {
  let cumulativeCommandCount = 1 // Start numbering from 1
  if (!planningMap.value) return

  const currentZoom = zoom.value
  const markerSize = getEffectiveMarkerSize(currentZoom)

  const wps = missionStore.currentPlanningWaypoints
  wps.forEach((wp, idx) => {
    const marker = waypointMarkers.value[wp.id]
    if (marker) {
      // Update marker icon to show command count
      const isSelected = selectedWaypoint.value?.id === wp.id
      const isEndpoint = idx === 0 || idx === wps.length - 1
      const dimensions = getIconDimensionsFromMarkerSize(markerSize)

      setDivIcon(marker, {
        html: createWaypointMarkerHtml(
          wp.commands.length,
          isSelected,
          surveyEntryExitWaypointIds.value.has(wp.id),
          isEndpoint
        ),
        size: dimensions.iconSize,
      })

      // Update tooltip visibility and content based on size
      const tooltip = waypointTooltips[wp.id]
      if (tooltip) {
        const showNumber = markerSize === 'md'
        tooltip.setContent(showNumber ? `${cumulativeCommandCount}` : '')
        tooltip.setOpacity(showNumber ? 1 : 0)
      }

      cumulativeCommandCount += wp.commands.length
    }
  })
}

// Toggles the crosshatch option while drawing a new survey. Bound to the button and checkbox so the
// programmatic resets (undo / survey load) that also set surveyCrosshatch are not logged as user actions.
const setSurveyCrosshatch = (value: boolean | null): void => {
  const enabled = Boolean(value)
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} 90° crosshatch re-fly for survey`)
  surveyCrosshatch.value = enabled
  // A crosshatch survey exposes 8 entry corners, a plain one only 4: keep the draft corner in range.
  surveyDraftEntryCorner.value = surveyDraftEntryCorner.value % surveyEntryCornerCount(enabled)
}

const rotateDraftSurveyEntryPoint = (): void => {
  const nextCorner = (surveyDraftEntryCorner.value + 1) % surveyEntryCornerCount(surveyCrosshatch.value)
  logUserAction(`Rotated draft survey entry point to corner ${nextCorner + 1}`)
  surveyDraftEntryCorner.value = nextCorner
}

const toggleSurveyCrosshatch = (): void => {
  if (!selectedSurvey.value) {
    openSnackbar({ variant: 'error', message: 'No survey selected.', duration: 2000 })
    return
  }
  logUserAction(`${selectedSurvey.value.crosshatch ? 'Disabled' : 'Enabled'} 90° crosshatch on survey`)
  missionStore.pushUndoSnapshot()
  selectedSurvey.value.crosshatch = !selectedSurvey.value.crosshatch
  // Keep the entry corner in range: a crosshatch survey exposes 8 corners, a plain one only 4.
  selectedSurvey.value.entryCorner =
    (selectedSurvey.value.entryCorner ?? 0) % surveyEntryCornerCount(selectedSurvey.value.crosshatch)
  regenerateSurveyWaypoints()
}

const regenerateSurveyWaypoints = (angle?: number): void => {
  if (!selectedSurveyId.value) {
    openSnackbar({ variant: 'error', message: 'No survey selected.', duration: 2000 })
    return
  }

  logUserAction('Regenerated survey waypoints')
  regenerateSelectedSurveyWaypoints(angle)
}

// Rebuilds the selected survey's waypoints from its polygon and current settings. Kept separate from the
// logged handler so entry-point rotation can reuse it without logging a spurious "regenerated" action.
const regenerateSelectedSurveyWaypoints = (angle?: number): void => {
  if (selectedSurvey.value) {
    selectedSurvey.value?.waypoints.forEach((waypoint) => removeWaypointMarker(waypoint.id))

    const adjustedAngle = 90 - (angle || selectedSurvey.value.surveyLinesAngle)
    const { path: continuousPath } = orderedSurveyPath(
      {
        polygonPoints: selectedSurvey.value.polygonCoordinates,
        distanceBetweenLines: selectedSurvey.value.distanceBetweenLines,
        linesAngle: adjustedAngle,
        turnaroundDistance: selectedSurvey.value.turnaroundDistance,
        crosshatch: selectedSurvey.value.crosshatch,
        crosshatchDistanceBetweenLines:
          selectedSurvey.value.crosshatchDistanceBetweenLines ?? selectedSurvey.value.distanceBetweenLines,
      },
      selectedSurvey.value.entryCorner ?? 0
    )

    if (!continuousPath.length) {
      openSnackbar({
        message: 'No valid path could be generated. Try adjusting the angle or distance between lines.',
        variant: 'error',
        duration: 2000,
      })
      return
    }

    const existingWaypoint = selectedSurvey.value.waypoints[0]
    const surveyAltitude = existingWaypoint?.altitude ?? currentWaypointAltitude.value
    const surveyAltitudeRefType = existingWaypoint?.altitudeReferenceType ?? currentWaypointAltitudeRefType.value

    const newWaypoints: Waypoint[] = continuousPath.map((coordinates) => ({
      id: uuid(),
      coordinates,
      altitude: surveyAltitude,
      altitudeReferenceType: surveyAltitudeRefType,
      commands: makeDefaultNavCommands(),
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
    updateWaypointMarkers()
  }
}

const createSurveyVertexMarker = (
  latlng: WaypointCoordinates,
  onClick: (marker: MapMarker) => void,
  onDrag: () => void
): MapMarker => {
  let justCreated = true
  let justDragged = false

  const marker = divIconMarker({
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
    size: [24, 24],
    draggable: true,
  }).setLatLng(latlng)

  marker.on('dragstart', () => {
    isDraggingSurveyVertex.value = true
    pushSurveyPolygonSnapshot()
  })
  marker.on('drag', () => {
    justDragged = true
    onDrag()
  })
  marker.on('dragend', () => {
    isDraggingSurveyVertex.value = false
    onDrag()
    setTimeout(() => (justDragged = false), 0)
  })

  const element = marker.getElement()
  const popup = element.querySelector('.delete-popup') as HTMLDivElement | null
  element.addEventListener('mouseenter', () => {
    if (justCreated) {
      justCreated = false
      return
    }
    if (popup) popup.style.display = 'block'
  })
  element.addEventListener('mouseleave', () => {
    if (popup) popup.style.display = 'none'
  })
  // A drag ends with a click on the vertex, which must not delete it.
  element.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation()
    if (!justDragged) onClick(marker)
  })
  return marker
}

const undoGenerateWaypoints = (): void => {
  if (undoIsInProgress.value) return
  logUserAction('Undid generated survey waypoints')
  contextMenuVisible.value = false
  undoIsInProgress.value = true

  missionStore.pushUndoSnapshot()

  const surveyId = selectedSurveyId.value

  const survey = surveys.value.find((s) => s.id === surveyId)
  if (!surveyId || !survey) {
    openSnackbar({ variant: 'error', message: 'Nothing to undo.', duration: 2000 })
    undoIsInProgress.value = false
    return
  }

  const firstWp = survey.waypoints[0]
  const waypointIdx = firstWp
    ? missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === firstWp.id)
    : missionStore.currentPlanningWaypoints.length
  const surveyIdx = surveys.value.findIndex((s) => s.id === surveyId)

  undoWaypointInsertIndex.value = waypointIdx !== -1 ? waypointIdx : null
  undoSurveyInsertIndex.value = surveyIdx !== -1 ? surveyIdx : null

  survey.waypoints.forEach((waypoint) => {
    const index = missionStore.currentPlanningWaypoints.findIndex((wp) => wp.id === waypoint.id)
    if (index !== -1) {
      missionStore.currentPlanningWaypoints.splice(index, 1)
    }
    removeWaypointMarker(waypoint.id)
  })

  if (surveyIdx !== -1) {
    surveys.value.splice(surveyIdx, 1)
  }
  selectedSurveyId.value = ''

  surveyPolygonVertexesPositions.value = survey.polygonCoordinates.map((c): WaypointCoordinates => [...c])
  distanceBetweenSurveyLines.value = survey.distanceBetweenLines
  surveyLinesAngle.value = survey.surveyLinesAngle
  surveyCrosshatch.value = survey.crosshatch ?? false
  crosshatchDistanceBetweenLines.value = survey.crosshatchDistanceBetweenLines ?? survey.distanceBetweenLines
  surveyDraftEntryCorner.value = survey.entryCorner ?? 0

  isCreatingSurvey.value = true
  isDrawingSurveyPolygon.value = false

  rebuildSurveyPolygonFromPositions()
  clearSurveyPolygonUndoStack()
  updateWaypointMarkers()
  openSnackbar({ variant: 'success', message: 'Undo successful.', duration: 1000 })
  undoIsInProgress.value = false
  removeSurveyAreaSquareMeters(surveyId)
}

/** How a waypoint marker answers the pointer, which differs between waypoints drawn here and ones loaded in. */
type WaypointMarkerBehavior = {
  /** Whether a click selects it (or deletes it with Shift) and opens its panel. */
  selectsOnClick: boolean
  /** Whether its context menu also drops the survey selection and closes the panel. */
  contextMenuClearsSurvey: boolean
}

const waypointMarkerIcon = (
  waypointId: string,
  commandCount: number,
  isSelected: boolean
): {
  /**
))))) *
)))))
   */
  html: string
  /**
hhhhhhhhhhhhhh *
hhhhhhhhhhhhhh
   */
  size: [number, number]
} => ({
  html: createWaypointMarkerHtml(
    commandCount,
    isSelected,
    surveyEntryExitWaypointIds.value.has(waypointId),
    isEndpointWaypoint(waypointId)
  ),
  size: getIconDimensionsFromMarkerSize(getEffectiveMarkerSize(zoom.value)).iconSize,
})

const createPlanningWaypointMarker = (waypoint: Waypoint, behavior: WaypointMarkerBehavior): void => {
  const map = planningMap.value
  if (!map) return

  const newMarker = divIconMarker({
    ...waypointMarkerIcon(waypoint.id, waypoint.commands.length, false),
    className: 'waypoint-marker-icon',
    draggable: true,
  })
    .setLatLng(waypoint.coordinates)
    .addTo(map)

  // A drag ends with a click on the marker, which must neither select nor delete it.
  let justDragged = false
  newMarker.on('dragstart', () => missionStore.pushUndoSnapshot())
  newMarker.on('drag', () => {
    justDragged = true
    missionStore.moveWaypoint(waypoint.id, newMarker.getLatLng())
    isDraggingMarker.value = true
    dragMeasureOverlay.renderDragMeasurePills(waypoint.id)
  })

  newMarker.on('dragend', () => {
    missionStore.moveWaypoint(waypoint.id, newMarker.getLatLng())
    isDraggingMarker.value = false
    dragMeasureOverlay.destroyDragMeasureOverlay()
    setTimeout(() => (justDragged = false), 0)
  })

  const element = newMarker.getElement()
  element.addEventListener('contextmenu', (event: MouseEvent) => {
    event.stopPropagation()
    contextMenuType.value = 'waypoint'
    const oldId = selectedWaypoint.value?.id
    selectedWaypoint.value = waypoint
    applySelectedWaypointMarkerVisual(waypoint.id, oldId)
    if (behavior.contextMenuClearsSurvey) {
      selectedSurveyId.value = ''
      interfaceStore.configPanelVisible = false
    }
    currentCursorGeoCoordinates.value = newMarker.getLatLng()
    showContextMenu(newMarker.getLatLng(), event)
  })

  // A click on a waypoint never reaches the map, whether or not the waypoint answers it.
  element.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    if (!behavior.selectsOnClick || justDragged) return

    if (event.shiftKey) {
      const oldId = selectedWaypoint.value?.id
      selectedWaypoint.value = waypoint
      applySelectedWaypointMarkerVisual(waypoint.id, oldId)
      removeSelectedWaypoint()
      return
    }

    // Default: open config panel
    const oldId = selectedWaypoint.value?.id
    selectedWaypoint.value = waypoint
    applySelectedWaypointMarkerVisual(waypoint.id, oldId)
    selectedSurveyId.value = ''
    hideContextMenu()
    interfaceStore.configPanelVisible = true
  })

  waypointTooltips[waypoint.id] = bindTooltip(map, newMarker, '', {
    permanent: true,
    direction: 'center',
    className: 'waypoint-tooltip',
    opacity: getEffectiveMarkerSize(zoom.value) === 'md' ? 1 : 0,
  })
  waypointMarkers.value[waypoint.id] = newMarker
}

const addWaypointMarker = (waypoint: Waypoint): void =>
  createPlanningWaypointMarker(waypoint, { selectsOnClick: true, contextMenuClearsSurvey: true })

const removeWaypointMarker = (waypointId: string): void => {
  waypointTooltips[waypointId]?.remove()
  delete waypointTooltips[waypointId]
  waypointMarkers.value[waypointId]?.remove()
  delete waypointMarkers.value[waypointId]
}

const { getEffectiveMarkerSize } = useWaypointMarkerSize(() => {
  if (planningMap.value) updateWaypointMarkers()
})

const getIconDimensionsFromMarkerSize = (size: MarkerSizes): IconDimensions => {
  if (size === 'xs') {
    return { iconSize: [6, 6], iconAnchor: [3, 3] }
  }
  if (size === 'sm') {
    return { iconSize: [12, 12], iconAnchor: [6, 6] }
  }
  return { iconSize: [26, 26], iconAnchor: [13, 13] } // md size
}

// single source of truth for selected-marker visuals
const applySelectedWaypointMarkerVisual = (newWaypointId?: string, oldWaypointId?: string): void => {
  const restyle = (waypointId: string, isSelected: boolean): void => {
    const marker = waypointMarkers.value[waypointId]
    const waypoint = missionStore.currentPlanningWaypoints.find((w) => w.id === waypointId)
    if (!marker) return
    setDivIcon(marker, waypointMarkerIcon(waypointId, waypoint?.commands.length ?? 0, isSelected))
  }

  if (oldWaypointId) restyle(oldWaypointId, false)
  if (newWaypointId) restyle(newWaypointId, true)
}

const loadDraftMission = async (
  mission: CockpitMission,
  options?: {
    /** Keep the host map's current center/zoom instead of restoring the saved-mission settings. */
    preserveMapView?: boolean
    /**
     * Whether to assign a new automatic name and reset the mission start time. Defaults to true.
     */
    startNewMission?: boolean
  }
): Promise<void> => {
  clearCurrentMission({ startNewMission: options?.startNewMission })

  try {
    if (!options?.preserveMapView) {
      mapCenter.value = mission.settings.mapCenter
      zoom.value = mission.settings.zoom
    }
    currentWaypointAltitude.value = mission.settings.currentWaypointAltitude
    currentWaypointAltitudeRefType.value = mission.settings.currentWaypointAltitudeRefType
    missionStore.defaultCruiseSpeed = mission.settings.defaultCruiseSpeed

    drawMissionOnTheMap(mission.waypoints)

    if (mission.surveys?.length) {
      missionStore.currentPlanningSurveys.push(...mission.surveys)
    }

    openSnackbar({ variant: 'success', message: 'Draft mission loaded.', duration: 2000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: `Failed to load draft mission: ${error}`, duration: 3000 })
  }
}

// Backed by a debounced watcher so the deep clone runs at most once per change burst, instead of
// firing on every reactive read of the prop while the library modal is open.
const buildCurrentMissionSnapshot = (): CockpitMission =>
  toPlain({
    version: 0,
    settings: {
      mapCenter: mapCenter.value,
      zoom: zoom.value,
      currentWaypointAltitude: currentWaypointAltitude.value,
      currentWaypointAltitudeRefType: currentWaypointAltitudeRefType.value,
      // Use the local (in-input) cruise speed so library saves capture pending changes the user
      // typed but hasn't committed back to the store yet (e.g. by uploading the mission).
      defaultCruiseSpeed: localCruiseSpeed.value,
    },
    waypoints: missionStore.currentPlanningWaypoints,
    surveys: missionStore.currentPlanningSurveys,
  })

const currentMissionSnapshot = ref<CockpitMission>(buildCurrentMissionSnapshot())

watchDebounced(
  [
    () => missionStore.currentPlanningWaypoints,
    () => missionStore.currentPlanningSurveys,
    mapCenter,
    zoom,
    currentWaypointAltitude,
    currentWaypointAltitudeRefType,
    localCruiseSpeed,
  ],
  () => {
    currentMissionSnapshot.value = buildCurrentMissionSnapshot()
  },
  { debounce: 100, deep: true }
)

const currentMissionEstimatesSnapshot = computed<MissionEstimatesSnapshot>(() => ({
  pathLength: missionEstimates.totalMissionLength.value,
  duration: missionEstimates.totalMissionDuration.value,
  energy: missionEstimates.totalMissionEnergy.value,
  totalSurveyCoverage: missionEstimates.totalSurveyCoverage.value,
  missionCoverageArea: missionEstimates.missionCoverageAreaSquareMeters.value,
}))

const openMissionLibrary = (
  options: {
    /** Segment index to splice the loaded mission into; omit for a normal placement. */
    segmentInsertIndex?: number | null
    /** Open the library straight into the "save current mission" form. */
    openSaveDialog?: boolean
  } = {}
): void => {
  // Set the segment-insert / save intent in the same call that opens the library, so callers never
  // have to poke `pendingSegmentInsertIndex` around the open; a plain toolbar open clears it.
  pendingSegmentInsertIndex.value = options.segmentInsertIndex ?? null
  missionLibraryOpenSaveOnMount.value = options.openSaveDialog ?? false
  const insertIndex = options.segmentInsertIndex
  logUserAction(
    options.openSaveDialog
      ? 'Opened the mission library to save the current mission'
      : insertIndex == null
      ? 'Opened the mission library'
      : insertIndex < 0
      ? 'Opened the mission library to prepend a mission before the first waypoint'
      : 'Opened the mission library to insert a mission into a segment'
  )
  interfaceStore.missionLibraryVisibility = true
}

const { hasLastUploadedMission, restoreLastUploadedMission } = useMissionOperations({
  loadDraftMission,
  showDialog,
  closeDialog,
  openSnackbar,
})

const missionToolboxSidebarRef = ref<InstanceType<typeof MissionPlanningSidebar> | null>(null)
const missionToolboxRef = computed<HTMLElement | null>(() => missionToolboxSidebarRef.value?.rootEl ?? null)
const missionActionsMenuExpanded = ref(false)
const missionToolboxPinnedTop = ref<number | null>(null)
const { height: missionToolboxHeight } = useElementSize(missionToolboxRef, undefined, { box: 'border-box' })

// Centered against the window band between the bars, rather than left to the flex container, whose box
// can be taller than the window and then leaves a tall toolbox running under the bottom bar.
const missionToolboxTop = computed<number>(() => {
  const topBound = widgetStore.currentTopBarHeightPixels + MISSION_TOOLBOX_BAR_GAP_PX
  const bottomBound = windowHeight.value - widgetStore.currentBottomBarHeightPixels - MISSION_TOOLBOX_BAR_GAP_PX

  // The top is held while the actions menu is open, so the frames of its expand transition grow the box
  // downward instead of re-centering it and sliding the chevron out from under the pointer.
  if (missionToolboxPinnedTop.value !== null) {
    const bottomOverflow = missionToolboxPinnedTop.value + missionToolboxHeight.value - bottomBound
    if (bottomOverflow <= 0) return missionToolboxPinnedTop.value
    return Math.max(topBound, missionToolboxPinnedTop.value - bottomOverflow)
  }

  return Math.max(topBound, topBound + (bottomBound - topBound - missionToolboxHeight.value) / 2)
})

const toggleMissionActionsMenu = (): void => {
  const willOpen = !missionActionsMenuExpanded.value
  logUserAction(`${willOpen ? 'Opened' : 'Closed'} the mission actions menu`)
  missionToolboxPinnedTop.value = willOpen ? missionToolboxTop.value : null
  missionActionsMenuExpanded.value = willOpen
}
const handleLoadMissionFromLibrary = (mission: SavedMission): void => {
  if (mission.vehicleType && !vehicleStore.isVehicleOnline) {
    missionStore.plannedVehicleType = mission.vehicleType
  }

  // Move the pending intent into a placement-scoped tracker so it survives the dialog/flow.
  placementInsertSegmentIndex.value = pendingSegmentInsertIndex.value
  pendingSegmentInsertIndex.value = null
  const isInserting = placementInsertSegmentIndex.value !== null
  // Anything already on the planner is merged with rather than replaced, so the labels have to say
  // "add" instead of "load" and the message has to name what happens to the existing work.
  const isMerging = isInserting || canSaveCurrentMissionToLibrary.value

  showDialog({
    variant: 'info',
    title: isInserting ? 'Insert mission' : isMerging ? 'Add mission' : 'Load mission',
    message: isMerging
      ? `"${mission.name}" will be added to the mission you are already planning. Where should it go?`
      : `Where should "${mission.name}" be placed?`,
    persistent: false,
    maxWidth: 620,
    actions: [
      {
        text: 'Cancel',
        action: () => {
          placementInsertSegmentIndex.value = null
          closeDialog()
        },
      },
      {
        text: isMerging ? 'At its original location' : 'Keep original location',
        action: () => {
          closeDialog()
          logUserAction(`Loaded mission "${mission.name}" at its original location`)
          finalizeMissionPlacement(mission)
        },
      },
      {
        text: 'Reposition on map',
        class: 'bg-[#FFFFFF33]',
        action: () => {
          closeDialog()
          logUserAction(`Started repositioning mission "${mission.name}" on the map`)
          startFreePlacement(mission)
        },
      },
    ],
  })
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const onMapClick = (e: MapPointerEvent): void => {
  // A shape on the map already took this click (selecting a survey or a fence), so the map does not take it too.
  if (e.defaultPrevented) return
  // Swallow map clicks during placement; confirm/cancel happen via the dedicated overlay buttons.
  if (isPlacingMission.value) return
  hideContextMenu()

  // The dedicated home-setting handler owns this click; bail so we don't also drop a survey vertex or waypoint here.
  if (isSettingHomeWaypoint.value) return

  // A drag that aimed the line has already said where the point goes, so a click the browser raises out of that
  // same gesture is not another point.
  if (touchDrawingSwallowsClick()) return

  if (onFenceMapClick(e)) return

  const oldWaypoint = selectedWaypoint.value
  if (oldWaypoint) {
    const oldMarker = waypointMarkers.value[oldWaypoint.id]
    if (oldMarker) setDivIcon(oldMarker, waypointMarkerIcon(oldWaypoint.id, oldWaypoint.commands.length, false))
  }

  if (interfaceStore.configPanelVisible && !isCreatingSurvey.value) {
    selectedWaypoint.value = undefined
    interfaceStore.configPanelVisible = false
  }

  if (ignoreNextClick) {
    ignoreNextClick = false
    return
  }

  const mouse = e.originalEvent
  const clickedAt = e.latLng
  if (!isCreatingSurvey.value && (mouse.ctrlKey || mouse.metaKey)) {
    addWaypointFromClick(clickedAt)
    return
  }

  if (mouse.shiftKey && planningMap.value) {
    const clickPoint = e.point
    let targetWpId: string | null = null
    for (const [id, marker] of Object.entries(waypointMarkers.value)) {
      const markerPoint = planningMap.value.project(marker.getLatLng())
      if (Math.hypot(markerPoint.x - clickPoint.x, markerPoint.y - clickPoint.y) <= nearMissionPathTolerance) {
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

  // A typed distance places the point at that exact distance from the last one, in the direction of the click.
  const measureAnchor = currentMeasureAnchor()
  const latlng = measureAnchor ? projectToLockedExtent('segment', measureAnchor, clickedAt) : clickedAt

  if (planningMap.value) {
    // Check if there is an existing waypoint near the click location
    const markerUnderMouse = waypointMarkerNear(clickedAt)
    if (markerUnderMouse) {
      const markerPosition = markerUnderMouse.getLatLng()
      selectedWaypoint.value = missionStore.currentPlanningWaypoints.find(
        (wp) => wp.coordinates[0] === markerPosition[0] && wp.coordinates[1] === markerPosition[1]
      )
      interfaceStore.configPanelVisible = true
    }

    placeDrawnPoint(latlng)
    clearLiveMeasure()
  }
}

let stopUnFollowOnUserDrag: (() => void) | undefined
let restoreFenceModeDimming: (() => void) | undefined

// Build the shared base maps, overlays and extra OSM overlay (tile-provider definitions live in useMapTileLayers)
const tileLayers = useMapTileLayers({ extraOsm: true, seamarks: true, marineProfile: true })
const { osm: osmLayer, esri: esriLayer } = tileLayers

// Replace failed tiles with a procedural noise background sampled by lat/lon, so
// operators retain a motion-trackable backdrop where imagery is unavailable.
const getTileFallbackOptions = (): NoiseTileOptions => ({
  baseColor: missionStore.mapFallbackBaseColor,
  seed: missionStore.mapFallbackSeed,
  intensity: missionStore.mapFallbackNoiseIntensity,
})

// Restore and persist the user's base-map and overlay selection, custom tile providers included
const tileSelection = useMapTileLayerSelection(tileLayers, getTileFallbackOptions)
const layerControlRef = ref<InstanceType<typeof MapLayerControl>>()
const planningMapElement = ref<HTMLElement>()

// The selector takes GeoTIFF rows next to the tile overlays, which only hide on this map.
const onToggleOverlay = (id: string, enabled: boolean): void => {
  if (mapOverlays.selectorEntries.value.some((entry) => entry.id === id)) mapOverlays.setOverlayShown(id, enabled)
  else tileSelection.setOverlayEnabled(id, enabled)
}

onMounted(() => {
  if (!planningMapElement.value) return
  const instance = createMap(planningMapElement.value, { center: mapCenter.value, zoom: zoom.value, attribution: true })
  planningMapInstance = instance
  observeMapResize(instance)
  // The map is published to everything that draws once its first frame is up, so layers never land on a map still being built.
  instance.once('load', () => void onPlanningMapLoaded(instance))
})

const onPlanningMapLoaded = async (instance: CockpitMap): Promise<void> => {
  if (planningMapInstance !== instance) return
  planningMap.value = instance

  // Expose the map instance to descendant components via the map context
  mapContext.map.value = instance
  mapContext.mapReady.value = true

  tileSelection.init(instance)

  angleOverlay.initAngleOverlay(instance)
  surveyArrowOverlay.initArrowOverlay(instance)
  dragMeasureOverlay.initDragMeasureOverlay(instance)
  initExtentInputs(instance)
  initLiveMeasure(instance)
  initEdgeDragging(instance)
  initTouchDrawing(instance)

  instance.on('moveend', () => {
    const center = instance.getCenter()
    if (!sameCoordinates(center, mapCenter.value)) mapCenter.value = center
  })
  instance.on('zoomstart', clearLiveMeasure)
  instance.on('zoomend', () => {
    zoom.value = instance.getZoom()
  })

  instance.on('mousemove', handleMapMouseMoveNearMissionPath)
  window.addEventListener('keydown', onGlobalKeyDown)
  window.addEventListener('keyup', onGlobalKeyUp)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('mousemove', onWindowMouseMove)

  instance.on('contextmenu', onPlanningMapContextMenu)
  // Moves the map makes on its own (following, keyboard panning) carry the overlays along too.
  instance.on('move', updateConfirmButtonPosition)
  instance.on('move', refreshLiveMeasureOnMapMove)
  instance.on('mousemove', onMapMouseMove)
  instance.on('click', onMapClick)
  instance.on('mousedown', onDrawingCursorPress)
  instance.on('mouseup', onDrawingCursorRelease)
  instance.on('mouseout', onDrawingCursorRelease)

  instance.addControl(zoomControl(instance).element, 'bottom-right')
  layerControlRef.value?.attachTo(instance)
  // Initialize scale control (always show)
  instance.addControl(scaleControl(instance).element, 'bottom-right')

  // Initialize grid overlay
  if (missionStore.showGridOnMissionPlanning) {
    createGridOverlayLocal()
  }

  targetFollower.enableAutoUpdate()
  stopUnFollowOnUserDrag = targetFollower.unFollowOnUserDrag(instance)
  initMapBoxZoom(instance)
  clearAllSurveyAreas()

  // Live Pinia arrays survive the route change; only an empty planner loads the BlueOS draft.
  if (hasLivePlanningMission(missionStore.currentPlanningWaypoints, missionStore.currentPlanningSurveys)) {
    const firstWaypoint = missionStore.currentPlanningWaypoints[0]
    if (firstWaypoint) {
      currentWaypointAltitude.value = firstWaypoint.altitude
      currentWaypointAltitudeRefType.value = firstWaypoint.altitudeReferenceType
    }
    missionStore.currentPlanningWaypoints.forEach((wp) => addWaypointMarker(wp))
    updateWaypointMarkers()
    drawCommittedSurveys()
    missionStore.currentPlanningSurveys.forEach((survey) => createSurveyAreaLabel(survey.id, survey.polygonCoordinates))
  } else if (instanceOfCockpitMission(missionStore.draftMission)) {
    loadDraftMission(missionStore.draftMission, { startNewMission: false })
  }

  missionStore.clearUndoStack()

  if (missionStore.followVehicleOnMap === true) {
    targetFollower.follow(WhoToFollow.VEHICLE)
  } else {
    targetFollower.unFollow()
  }
  applyFollowZoomMode(instance, !!followerTarget.value)
  if (planningMode.value === 'geofence') restoreFenceModeDimming = dimNonFenceLayers(instance, fenceModeDimming)

  // Render any user-loaded GeoTIFF overlays and keep them in sync with the stored metadata
  await mapOverlays.initOverlays(instance)
}

const onPlanningMapContextMenu = (e: MapPointerEvent): void => {
  // A survey area answering the menu itself has already opened it.
  if (e.defaultPrevented) return
  if (isCreatingSurvey.value) return
  if (isPlacingMission.value) return
  selectedWaypoint.value = undefined
  contextMenuType.value = selectedSurveyId.value === '' ? 'map' : contextMenuType.value
  currentCursorGeoCoordinates.value = e.latLng
  showContextMenu(e.latLng, e.originalEvent)
}

// Non-fence layers fade to this share of their opacity while the fences are being edited.
const fenceModeDimming = 0.45
watch(planningMode, (mode) => {
  restoreFenceModeDimming?.()
  restoreFenceModeDimming = undefined
  if (mode === 'geofence' && planningMap.value) {
    restoreFenceModeDimming = dimNonFenceLayers(planningMap.value, fenceModeDimming)
  }
})

// The map reports back the center it was moved to with float noise, so a center is only new past that noise.
const sameCoordinates = (a: WaypointCoordinates, b: WaypointCoordinates): boolean =>
  Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

watch(followerTarget, (newTarget) => {
  if (newTarget === WhoToFollow.VEHICLE) {
    missionStore.followVehicleOnMap = true
  } else {
    missionStore.followVehicleOnMap = false
  }
  if (planningMap.value) applyFollowZoomMode(planningMap.value, !!newTarget)
})

onUnmounted(() => {
  // Debounced saves may still be pending; write the live view now so Flight Mode mounts with it.
  persistLiveMapView(missionStore.saveLastMapPosition, planningMap.value, zoom.value, mapCenter.value)

  targetFollower.disableAutoUpdate()
  stopUnFollowOnUserDrag?.()
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('keyup', onGlobalKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('mousemove', onWindowMouseMove)
  if (surveyPathDashFrame !== null) cancelAnimationFrame(surveyPathDashFrame)
  surveyPathDashFrame = null
  clearLiveMeasure()
  dragMeasureOverlay.destroyDragMeasureOverlay()
  angleOverlay.destroyAngleOverlay()
  surveyArrowOverlay.destroyArrowOverlay()
  destroyLiveMeasure()
  destroyEdgeDragging()
  destroyTouchDrawing()

  mapOverlays.destroyOverlays()
  tileSelection.destroy()

  // Reset the map context so descendants stop reacting to the destroyed instance, then release the map: each one
  // holds a WebGL context, of which a browser only grants a few.
  mapContext.mapReady.value = false
  mapContext.map.value = undefined
  planningMap.value = undefined
  planningMapInstance?.remove()
  planningMapInstance = undefined
})

const vehiclePosition = computed((): [number, number] | undefined =>
  vehicleStore.coordinates.latitude
    ? [vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude]
    : undefined
)

// Calculate live vehicle heading
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw) : 0))

// Calculate time since last vehicle heartbeat
const timeAgoSeenText = computed(() => {
  const lastBeat = vehicleStore.lastHeartbeat
  return lastBeat ? `${formatDistanceToNow(lastBeat ?? 0, { includeSeconds: true })} ago` : 'never'
})

const planningVehicleIconUrl = computed(() => {
  if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) return blueboatMarkerImage
  if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) return brov2MarkerImage
  return genericVehicleMarkerImage
})

const vehicleTooltipState = computed<VehicleTooltipState>(() => ({
  coordinates: vehiclePosition.value,
  groundVelocityInMetersPerSecond: vehicleStore.velocity.ground,
  headingInDegrees: vehicleHeading.value,
  isArmed: vehicleStore.isArmed,
  timeAgoSeenText: timeAgoSeenText.value,
}))

// Create marker for the vehicle
const vehicleMarker = useMapVehicleMarker(planningMap, {
  position: () => vehiclePosition.value,
  iconUrl: () => planningVehicleIconUrl.value,
  tooltipContent: () => vehicleTooltipContent(vehicleTooltipState.value, interfaceStore.displayUnitPreferences),
  headingInDegrees: () => vehicleHeading.value,
  tooltipClassName: 'waypoint-tooltip',
})

const homeMarker = shallowRef<MapMarker>()

// Watches the map too, so a home already planned when the view mounts gets its marker once the map exists.
watch([home, planningMap], () => {
  const map = planningMap.value
  if (map === undefined) return

  const position = home.value
  if (position === undefined) return

  if (!homeMarker.value) {
    const marker = divIconMarker({ className: 'marker-icon', size: [24, 24], draggable: true })
    marker.setLatLng(position).addTo(map)
    bindTooltip(map, marker, '<i class="mdi mdi-home-map-marker text-[18px]"></i>', {
      permanent: true,
      direction: 'center',
      className: 'waypoint-tooltip',
    })
    marker.getElement().addEventListener('click', (event) => event.stopPropagation())
    marker.on('dragend', () => {
      currentCursorGeoCoordinates.value = marker.getLatLng()
      setHomePosition()
    })
    homeMarker.value = marker
  } else {
    homeMarker.value.setLatLng(position)
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

const saveLastMapPositionDebounced = useDebounceFn(
  () => {
    missionStore.saveLastMapPosition(zoom.value, mapCenter.value)
  },
  3000,
  { maxWait: 8000 }
)

// Watch for zoom/move changes to update the grid
watch([zoom, mapCenter], () => {
  if (missionStore.showGridOnMissionPlanning && planningMap.value) {
    createGridOverlayLocal()
  }
  saveLastMapPositionDebounced()
})

// Watch for zoom level changes to update waypoint marker sizes
watch(zoom, () => {
  if (planningMap.value) {
    updateWaypointMarkers()
  }
})

const surveyExtraPathLayers = computed(() => [
  ...(surveyCrosshatchPathLayer.value ? [surveyCrosshatchPathLayer.value] : []),
  ...surveyTurnaroundLayers.value,
])

const { polyline: missionWaypointsPolyline } = useMapMissionLayer(planningMap, {
  waypoints: () => missionStore.currentPlanningWaypoints,
  show: () => missionStore.currentPlanningWaypoints.length > 0,
  onDblClick: (event) => handleMissionPathDoubleClick(event),
  onRedraw: () => renderMissionPathSignal(),
})

const { renderMissionPathSignal, removeMissionPathSignalLayer } = useMissionPathSignalOverlay(
  planningMap,
  surveyPathLayer,
  missionWaypointsPolyline,
  surveyExtraPathLayers
)

useMapVehiclePathLayer(planningMap, {
  path: () => missionStore.vehiclePositionHistory,
  revision: () => missionStore.vehiclePositionHistoryRevision,
  show: () => vehicleMarker.value !== undefined,
})

watch([isCtrlDown, isShiftDown, isCreatingSurvey, isCreatingSimplePath, isSettingHomeWaypoint], () => setMapCursor())
watch(planningMap, () => setMapCursor())

useMapCenterFromUserLocation(mapCenter, () => Boolean(home.value || vehiclePosition.value))

watch(
  () => interfaceStore.mainMenuCurrentStep,
  (step) => {
    if (step > 1) {
      isCreatingSimplePath.value = false
      pendingSimplePathInsertIndex.value = null
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
      mapInstance.jumpTo(vehiclePos, zoom.value)
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
    if (oldCenter && sameCoordinates(newCenter, oldCenter)) return
    if (sameCoordinates(newCenter, planningMap.value.getCenter())) return

    planningMap.value.easeTo({ center: newCenter, duration: 250 })
  }
)

const missionFitCoordinates = computed<WaypointCoordinates[]>(() => {
  const waypointCoords = missionStore.currentPlanningWaypoints.map((wp) => wp.coordinates)
  const surveyCoords = missionStore.currentPlanningSurveys.flatMap((survey) => [
    ...survey.polygonCoordinates,
    ...survey.waypoints.map((wp) => wp.coordinates),
  ])
  return [...waypointCoords, ...surveyCoords]
})

const hasMissionWaypoints = computed(() => missionFitCoordinates.value.length > 0)

const centerOnMission = (): void => {
  if (!planningMap.value || !hasMissionWaypoints.value) return
  logUserAction('Centered map on mission')
  targetFollower.unFollow()
  fitMapToWaypoints(planningMap.value, missionFitCoordinates.value)
}

const openPoiDialog = (): void => {
  if (cursorCoordinates.value && poiManagerRef.value) {
    logUserAction('Opened point of interest dialog')
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
// React to "center on coordinates" requests (e.g. from the Map tools menu).
watch(
  () => missionStore.mapCenterOnRequest,
  (request) => {
    if (!request || !planningMap.value) return
    planningMap.value.easeTo({ center: request.coordinates, duration: 250 })
  }
)
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

.waypoint-main-marker {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  position: absolute;
}

.wp-marker-xs .waypoint-main-marker {
  width: 4px;
  height: 4px;
  top: 1px;
  left: 1px;
}

.wp-marker-xs .selected-marker {
  border: 1px solid #ffff0099;
  box-shadow: 0 0 2px 1px rgba(255, 235, 59, 0.2);
  filter: drop-shadow(0 0 2px rgba(255, 235, 59, 0.1));
  outline: none;
}

.wp-marker-sm .waypoint-main-marker {
  width: 10px;
  height: 10px;
  top: 1px;
  left: 1px;
}

.wp-marker-sm .selected-marker {
  border: 1.5px solid #ffff0099;
  box-shadow: 0 0 3px 1.5px rgba(255, 235, 59, 0.2), 0 0 9px 4px rgba(255, 193, 7, 0.12);
  filter: drop-shadow(0 0 3px rgba(255, 235, 59, 0.1));
  outline: 0.5px solid rgba(255, 235, 59, 0.1);
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
  box-shadow: 0 0 5px 2px rgba(255, 235, 59, 0.2), 0 0 18px 8px rgba(255, 193, 7, 0.12);
  filter: drop-shadow(0 0 6px rgba(255, 235, 59, 0.1));
  outline: 1px solid rgba(255, 235, 59, 0.1);
}

.green-marker {
  border-radius: 50%;
  border: 2px solid #ffffff99;
  background-color: #034103;
}

/* Carried on the ring rather than the fill so a waypoint that is both an endpoint and a survey
   entry/exit keeps the green of `.green-marker` underneath it. */
.endpoint-marker {
  border: 2px solid #ff9800;
  transform: scale(1.25);
  transform-origin: center;
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
.command-count-indicator.small {
  font-size: 2px;
  width: 5px;
  height: 5px;
  border: 1px solid white;
  top: -2px;
  right: -2px;
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
.live-measure-pill.typing {
  border-color: #3b82f6;
}
/* A tag is small for a finger, so it presses from a halo around it without looking any bigger. */
.live-measure-pill::before {
  content: '';
  position: absolute;
  inset: -10px;
}
/* A number typed away holds the room it had, so the tag does not collapse around the caret left behind. */
.measure-length:empty {
  display: inline-block;
  min-width: 3ch;
}
/* The field over the tag is invisible, so the tag carries the caret that says it is being typed into. */
.measure-caret {
  display: none;
  width: 1px;
  height: 14px;
  margin: 0 1px;
  vertical-align: -2px;
  background: #fff;
}
.live-measure-pill.typing .measure-caret {
  display: inline-block;
  animation: measure-caret-blink 1.1s step-end infinite;
}
@keyframes measure-caret-blink {
  50% {
    opacity: 0;
  }
}
.measure-area-icon {
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.measure-angle-tag {
  background: transparent;
  border: none;
}
.survey-arrow {
  background: transparent;
  border: none;
}
.measure-angle-pill {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 3px 8px;
  border-radius: 16px;
  background: #00000022;
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  white-space: nowrap;
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
.cockpit-map-ctrl-top-left,
.cockpit-map-ctrl-top-right {
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
/* Fence editing fades the markers that are not part of the fences; the map's vector layers are faded where fence
   mode is entered. Tooltips and measure tags are left alone. The map writes each marker's opacity inline, so only an
   important rule reaches it. */
.mission-planning--fence-mode
  :deep(
    .cockpit-map-marker:not(.cockpit-fence-marker):not(.cockpit-tooltip):not(.survey-arrow):not(.measure-angle-tag):not(
        .measure-area-icon
      ):not(.geotiff-overlay-spinner)
  ) {
  opacity: 0.45 !important;
  filter: saturate(0.5);
}

.speed-dial-group {
  display: flex;
  align-items: center;
  position: relative;
  margin: 0 4px;
}

.speed-dial-chevron {
  min-width: 14px !important;
  width: 14px !important;
  height: 20px !important;
  padding: 0 !important;
  margin-left: 6px;
  margin-right: -2px;
  opacity: 0.6;
}

.speed-dial-chevron:hover {
  opacity: 1;
}

.speed-dial-popover {
  display: flex;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.speed-dial-load-label {
  display: flex;
  cursor: pointer;
}

/* Static north reference, stacked just above the bottom-right zoom control. */
.north-indicator {
  position: absolute;
  right: 10px;
  bottom: 136px;
}
/* Style the scale control */
:deep(.cockpit-scale-control) {
  position: absolute;
  right: 338px; /* Position to the left of the buttons */
  bottom: 54px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
  padding: 6px 6px;
  background: var(--glass-background);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  border: var(--glass-border);
  font-weight: bolder;
}

/* Style the zoom control */
:deep(.cockpit-map-zoom) {
  position: relative;
  bottom: 33px;
  background: var(--glass-background);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-box-shadow);
  color: var(--glass-color);
  border: var(--glass-border);
}

:deep(.cockpit-map-zoom button) {
  background: transparent !important;
  border: none;
  color: var(--glass-color);
}

:deep(.cockpit-map-zoom button:hover),
:deep(.cockpit-map-zoom button:focus) {
  background: transparent !important;
}
</style>
