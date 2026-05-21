<template>
  <div class="flex flex-col w-full">
    <p v-if="!fenceStore.isFenceSupported" class="px-2 py-1 mx-2 text-xs rounded-md bg-[#FF8800AA] text-white">
      This vehicle does not advertise the GeoFence MAVLink service. Editing is allowed but uploads may be rejected.
    </p>

    <div class="flex flex-row items-center justify-end gap-x-2 mb-3 mt-1">
      <span class="text-sm font-medium mr-2">Add fence:</span>
      <div class="flex flex-row items-center gap-x-2">
        <v-tooltip location="top" :text="fenceStore.isDrawingPolygon ? 'Cancel polygon drawing' : 'Add polygon fence'">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :icon="fenceStore.isDrawingPolygon ? 'mdi-close' : 'mdi-vector-polygon'"
              variant="elevated"
              :color="fenceStore.isDrawingPolygon ? '#A8453B' : '#3B78A8'"
              size="x-small"
              class="rounded-md"
              :disabled="fenceStore.isDrawingCircle"
              @click="onAddPolygon"
            />
          </template>
        </v-tooltip>
        <v-tooltip location="top" :text="fenceStore.isDrawingCircle ? 'Cancel circle drawing' : 'Add circular fence'">
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :icon="fenceStore.isDrawingCircle ? 'mdi-close' : 'mdi-vector-circle-variant'"
              variant="elevated"
              :color="fenceStore.isDrawingCircle ? '#A8453B' : '#3B78A8'"
              size="x-small"
              class="rounded-md"
              :disabled="fenceStore.isDrawingPolygon"
              @click="onAddCircle"
            />
          </template>
        </v-tooltip>
      </div>
    </div>

    <div class="fence-expansible-wrapper -mx-2">
      <ExpansiblePanel
        compact
        invert-chevron
        hover-effect
        elevation-effect
        :is-expanded="fenceStore.polygons.length > 0"
        no-bottom-divider
        darken-content
      >
        <template #title>
          <div class="flex w-[90%] justify-between items-center text-[14px] -mb-3 font-normal ml-2">
            Polygons
            <v-badge
              :content="fenceStore.polygons.length"
              color="#3B78A8"
              rounded="md"
              class="ml-10 scale-75 opacity-90"
            />
          </div>
        </template>
        <template #content>
          <div class="flex flex-col items-center w-full px-1 py-1">
            <p v-if="fenceStore.polygons.length === 0" class="text-xs opacity-70 my-1">No polygon fences.</p>
            <div
              v-for="(polygon, idx) in fenceStore.polygons"
              :key="polygon.id"
              class="fence-card flex items-center justify-between w-full border-[1px] border-[#FFFFFF15] rounded-md my-[3px] px-2 py-[3px] pr-3 cursor-pointer elevation-1 transition-colors duration-150"
              :class="
                fenceStore.interactiveShapeId === polygon.id
                  ? 'bg-[#CBCBCB44] border-[#FFFFFF25]'
                  : 'bg-[#CBCBCB22] hover:bg-[#CBCBCB33]'
              "
              @click="onTogglePolygonInteractive(polygon.id)"
            >
              <v-icon icon="mdi-vector-polygon" class="mr-2 opacity-70 text-[18px]" />
              <v-divider vertical class="my-1" />
              <p class="ml-3 grow overflow-hidden text-xs text-ellipsis whitespace-nowrap">Polygon {{ idx + 1 }}</p>
              <span
                class="text-[10px] font-medium uppercase tracking-wide px-2 py-[1px] rounded-md mr-2 text-white cursor-pointer select-none transition-opacity duration-150 hover:opacity-80"
                :class="polygon.inclusion ? 'bg-[#3B78A8]' : 'bg-[#FF8800]'"
                @click.stop="fenceStore.togglePolygonInclusion(polygon.id)"
              >
                {{ polygon.inclusion ? 'Inclusion' : 'Exclusion' }}
              </span>
              <div class="flex justify-start items-center w-[65px]">
                <v-divider vertical class="my-1 mr-2" />
                <div
                  class="text-[17px] mdi mdi-trash-can cursor-pointer"
                  @click.stop="fenceStore.deletePolygon(polygon.id)"
                />
                <v-switch
                  :model-value="polygon.inclusion"
                  color="#3B78A8"
                  base-color="#FF8800B3"
                  density="compact"
                  hide-details
                  inset
                  class="fence-switch origin-right scale-50 -ml-3 elevation-2"
                  :class="{ 'fence-switch--exclusion': !polygon.inclusion }"
                  @click.stop
                  @update:model-value="fenceStore.updatePolygon(polygon.id, { inclusion: $event === true })"
                />
              </div>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
    </div>

    <div class="fence-expansible-wrapper -mx-2">
      <ExpansiblePanel
        compact
        invert-chevron
        hover-effect
        elevation-effect
        :is-expanded="fenceStore.circles.length > 0"
        darken-content
      >
        <template #title>
          <div class="flex w-[90%] justify-between items-center text-[14px] -mb-3 font-normal ml-2">
            Circles
            <v-badge
              :content="fenceStore.circles.length"
              color="#3B78A8"
              rounded="md"
              class="ml-10 scale-75 opacity-90"
            />
          </div>
        </template>
        <template #content>
          <div class="flex flex-col items-center w-full px-1 py-1">
            <p v-if="fenceStore.circles.length === 0" class="text-xs opacity-70 my-1">No circle fences.</p>
            <div
              v-for="(circle, idx) in fenceStore.circles"
              :key="circle.id"
              class="fence-card flex items-center justify-between w-full border-[1px] border-[#FFFFFF15] rounded-md my-[3px] px-2 pt-[3px] pb-[3px] pr-3 cursor-pointer elevation-1 transition-colors duration-150"
              :class="
                fenceStore.interactiveShapeId === circle.id
                  ? 'bg-[#CBCBCB44] border-[#FFFFFF25]'
                  : 'bg-[#CBCBCB22] hover:bg-[#CBCBCB33]'
              "
              @click="onToggleCircleInteractive(circle.id)"
            >
              <v-icon icon="mdi-vector-circle-variant" class="mr-2 opacity-70 text-[18px]" />
              <v-divider vertical class="my-1" />
              <p class="ml-3 grow overflow-hidden text-xs text-ellipsis whitespace-nowrap">Circle {{ idx + 1 }}</p>
              <span
                class="text-[10px] font-medium uppercase tracking-wide px-2 py-[1px] rounded-md mr-2 text-white cursor-pointer select-none transition-opacity duration-150 hover:opacity-80"
                :class="circle.inclusion ? 'bg-[#3B78A8]' : 'bg-[#FF8800]'"
                @click.stop="fenceStore.toggleCircleInclusion(circle.id)"
              >
                {{ circle.inclusion ? 'Inclusion' : 'Exclusion' }}
              </span>
              <div class="flex justify-start items-center w-[65px]">
                <v-divider vertical class="my-1 mr-2" />
                <div
                  class="text-[17px] mdi mdi-trash-can cursor-pointer"
                  @click.stop="fenceStore.deleteCircle(circle.id)"
                />
                <v-switch
                  :model-value="circle.inclusion"
                  color="#3B78A8"
                  base-color="#FF8800B3"
                  density="compact"
                  hide-details
                  inset
                  class="fence-switch origin-right scale-50 -ml-3"
                  :class="{ 'fence-switch--exclusion': !circle.inclusion }"
                  @click.stop
                  @update:model-value="fenceStore.updateCircle(circle.id, { inclusion: $event === true })"
                />
              </div>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
    </div>

    <div class="flex flex-col ma-2 py-2 px-4 border-[1px] border-[#FFFFFF22] bg-[#00000022] rounded-md p-2">
      <div v-if="fenceStore.isArduPilot" class="flex items-center justify-between gap-x-2 fence-autoenable-row">
        <p class="text-xs">Auto enable fence on takeoff</p>
        <v-switch
          :model-value="(fenceStore.fenceAutoEnableMode ?? 1) > 0"
          color="#3B78A8"
          density="compact"
          hide-details
          inset
          class="origin-right scale-[0.6] elevation-2 fence-autoenable-switch"
          :disabled="!vehicleStore.isVehicleOnline || fenceAutoEnableBusy"
          @update:model-value="onToggleFenceAutoEnable"
        />
      </div>
      <v-divider class="opacity-10 my-1 mx-12" />
      <div v-if="fenceStore.breachReturn" class="flex items-center justify-between gap-x-2">
        <p class="text-xs">Breach return altitude</p>
        <div class="flex items-center gap-x-1">
          <v-tooltip
            location="left"
            max-width="320"
            :open-on-hover="false"
            open-on-click
            :model-value="breachAltTooltipOpen"
            @update:model-value="(v) => (breachAltTooltipOpen = v)"
          >
            <template #activator="{ props: tooltipProps }">
              <v-icon
                v-bind="tooltipProps"
                size="14"
                class="text-slate-400 cursor-pointer opacity-70 hover:opacity-100"
              >
                mdi-information-outline
              </v-icon>
            </template>
            <div class="text-xs whitespace-pre-line pa-1 leading-snug">
              Altitude in meters (relative to the home position) the vehicle targets when returning to the breach point.
              On a fence breach the autopilot navigates to the rally location and climbs or descends to this altitude
              before holding or continuing the configured fence action (FENCE_ACTION on ArduPilot, GF_ACTION on PX4).
              Set it safely above local terrain and obstacles.
            </div>
          </v-tooltip>
          <input
            type="number"
            step="1"
            class="p-1 bg-[#FFFFFF11] w-[70px] text-xs text-right rounded-sm"
            :value="fenceStore.breachReturn.altitude"
            @change="onBreachReturnAltInput(($event.target as HTMLInputElement).value)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="x-small"
            class="-mr-2"
            @click="fenceStore.setBreachReturn(undefined)"
          />
        </div>
      </div>
      <div v-if="!fenceStore.breachReturn" class="flex flex-row items-center gap-x-2 mt-1">
        <button
          class="flex-1 h-auto py-1 px-2 text-xs rounded-md elevation-1 bg-[#FFFFFF22] hover:bg-[#FFFFFF33] transition-colors duration-200"
          @click="onAddBreachReturn"
        >
          ADD BREACH RETURN POINT
        </button>
        <v-tooltip location="left" max-width="320">
          <template #activator="{ props: tooltipProps }">
            <v-icon v-bind="tooltipProps" class="text-slate-400 text-sm cursor-help">mdi-information-outline</v-icon>
          </template>
          <div class="text-sm pa-1">
            <p class="mb-1 text-center"><strong>Breach return point</strong></p>
            <p class="mb-[3px]">
              Optional rally location the autopilot returns to when the vehicle breaches the geofence.
            </p>
            <p class="mb-[3px]">
              Click <em>Add breach return point</em> to seed it at the map center, then drag the orange
              <strong>B</strong> marker to fine-tune the location and edit the altitude (relative to home) inline.
            </p>
            <p>
              Behavior on breach is governed by the autopilot fence parameters (<code>FENCE_ACTION</code> on ArduPilot,
              <code>GF_ACTION</code> on PX4) — typically set them to <em>RTL</em> or <em>Land</em> for the rally point
              to be honored.
            </p>
          </div>
        </v-tooltip>
      </div>
    </div>

    <p
      v-if="fenceStore.isArduPilotPlane && fenceStore.polygons.length === 0"
      class="px-2 py-1 mx-2 text-[11px] rounded-md bg-[#33333366]"
    >
      ArduPilot Plane: a polygon must be drawn for any fence parameter to take effect.
    </p>
    <p
      v-if="fenceStore.isPx4 && fenceStore.inclusionPolygonCount > 1"
      class="px-2 py-1 mx-2 mt-1 text-[11px] rounded-md bg-[#33333366]"
    >
      PX4: multiple inclusion polygons are AND-ed (intersection), not OR-ed.
    </p>

    <GeoFenceParametersPanel />

    <div class="flex w-full justify-between my-2 px-4 pt-1">
      <v-tooltip location="top" text="Save fence to file">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-content-save"
            variant="text"
            :disabled="!fenceStore.hasItems"
            size="24"
            class="text-[12px]"
            @click="onSaveCfp"
          />
        </template>
      </v-tooltip>
      <v-divider vertical />
      <v-tooltip location="top" text="Load fence from file (.cfp / .plan)">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-upload"
            variant="text"
            size="24"
            class="text-[12px]"
            @click="onPickFile"
          />
        </template>
      </v-tooltip>
      <v-divider vertical />
      <v-tooltip location="top" text="Export `.plan` (mission + fence)">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-download-network"
            variant="text"
            size="24"
            class="text-[12px]"
            @click="onExportMavlinkPlan"
          />
        </template>
      </v-tooltip>
      <v-divider vertical />
      <v-tooltip location="top" text="Clear fence on vehicle">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-delete"
            :disabled="fenceStore.syncInProgress || !vehicleStore.isVehicleOnline"
            variant="text"
            size="24"
            class="text-[12px]"
            @click="onClearOnVehicle"
          />
        </template>
      </v-tooltip>
    </div>

    <button
      :disabled="!fenceStore.hasItems || !vehicleStore.isVehicleOnline || fenceStore.syncInProgress"
      :class="{
        'bg-[#FFFFFF11] hover:bg-[#FFFFFF11] text-[#FFFFFF22] elevation-0':
          !fenceStore.hasItems || !vehicleStore.isVehicleOnline || fenceStore.syncInProgress,
      }"
      class="h-auto py-2 px-2 m-2 mt-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
      @click="onUpload"
    >
      UPLOAD FENCE TO VEHICLE
    </button>
    <button
      v-if="fenceStore.hasItems"
      class="h-auto py-1 px-1 m-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
      @click="onClearLocal"
    >
      CLEAR CURRENT FENCE
    </button>
    <button
      :disabled="fenceStore.syncInProgress || !vehicleStore.isVehicleOnline"
      class="h-auto py-2 px-2 m-2 text-sm rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
      :class="{ 'cursor-not-allowed opacity-50 text-[#FFFFFF44]': !vehicleStore.isVehicleOnline }"
      @click="onDownload"
    >
      DOWNLOAD FENCE FROM VEHICLE
    </button>

    <input ref="fileInput" type="file" accept=".cfp,.plan,application/json" class="hidden" @change="onFilePicked" />

    <v-progress-linear v-if="fenceStore.syncInProgress" :model-value="syncProgress" height="4" color="white" />
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GeoFenceParametersPanel from '@/components/mission-planning/GeoFenceParametersPanel.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import {
  type CockpitFencePlanFile,
  type GeoFencePlan,
  type MavlinkPlanFile,
  instanceOfCockpitFencePlanFile,
  instanceOfMavlinkPlanFile,
} from '@/types/geofence'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{
  /**
   * Map center used to seed new polygons / circles around the user's view.
   */
  mapCenter: [number, number]
}>()

/**
 * Events:
 * - `mission-loaded` — emitted when a fence file load also brings in mission
 *   waypoints (e.g. the mission section of a `.plan` file) so the host view
 *   can re-render them.
 */
const emit = defineEmits(['mission-loaded'])

const fenceStore = useGeoFenceStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()

const fileInput = ref<HTMLInputElement | null>(null)
const syncProgress = ref(0)
const breachAltTooltipOpen = ref(false)

const onTogglePolygonInteractive = (id: string): void => {
  fenceStore.setInteractive(fenceStore.interactiveShapeId === id ? undefined : id)
}

const onToggleCircleInteractive = (id: string): void => {
  fenceStore.setInteractive(fenceStore.interactiveShapeId === id ? undefined : id)
}

const onAddPolygon = (): void => {
  if (fenceStore.isDrawingPolygon) {
    fenceStore.cancelDrawingPolygon()
    return
  }
  fenceStore.startDrawingPolygon(true)
  openSnackbar({
    variant: 'info',
    message: 'Click the map to add vertices.',
    duration: 5000,
    closeButton: true,
  })
}

const onAddCircle = (): void => {
  if (fenceStore.isDrawingCircle) {
    fenceStore.cancelDrawingCircle()
    return
  }
  fenceStore.startDrawingCircle(true)
  openSnackbar({
    variant: 'info',
    message: 'Click the map to set the circle center, then click again to set the radius.',
    duration: 5000,
    closeButton: true,
  })
}

const onAddBreachReturn = (): void => {
  fenceStore.setBreachReturn({ coordinates: [props.mapCenter[0], props.mapCenter[1]], altitude: 50 })
}

const onBreachReturnAltInput = (value: string): void => {
  if (!fenceStore.breachReturn) return
  const altitude = Number(value)
  if (!Number.isFinite(altitude)) return
  fenceStore.setBreachReturn({ coordinates: fenceStore.breachReturn.coordinates, altitude })
}

const fenceAutoEnableBusy = ref(false)

const onToggleFenceAutoEnable = async (value: boolean | null): Promise<void> => {
  if (fenceAutoEnableBusy.value) return
  const target = value ? 1 : 0
  fenceAutoEnableBusy.value = true
  try {
    await fenceStore.setFenceAutoEnable(target)
  } catch (error) {
    showDialog({
      variant: 'error',
      title: target ? 'Failed to enable auto fence' : 'Failed to disable auto fence',
      message: error instanceof Error ? error.message : String(error),
      timer: 4000,
    })
  } finally {
    fenceAutoEnableBusy.value = false
  }
}

const confirmPx4MultipleInclusionsIfNeeded = async (): Promise<boolean> => {
  if (!fenceStore.isPx4) return true
  if (fenceStore.inclusionPolygonCount <= 1) return true
  let confirmed = false
  await new Promise<void>((resolve) => {
    showDialog({
      variant: 'warning',
      title: 'PX4 multiple inclusion polygons',
      message:
        'PX4 currently treats multiple inclusion polygons as AND (intersection), not OR. Continue with the upload?',
      persistent: false,
      maxWidth: '520px',
      actions: [
        {
          text: 'Cancel',
          color: 'white',
          action: () => {
            closeDialog()
            resolve()
          },
        },
        {
          text: 'Upload anyway',
          color: 'white',
          action: () => {
            confirmed = true
            closeDialog()
            resolve()
          },
        },
      ],
    })
  })
  return confirmed
}

const onUpload = async (): Promise<void> => {
  syncProgress.value = 0
  if (!(await confirmPx4MultipleInclusionsIfNeeded())) return
  try {
    await fenceStore.uploadToVehicle(async (p: number) => {
      syncProgress.value = p
    })
  } catch (error) {
    showDialog({
      variant: 'error',
      title: 'Geofence upload failed',
      message: error instanceof Error ? error.message : String(error),
      timer: 5000,
    })
  }
}

const onDownload = async (): Promise<void> => {
  syncProgress.value = 0
  try {
    await fenceStore.downloadFromVehicle(async (p: number) => {
      syncProgress.value = p
    })
  } catch (error) {
    showDialog({
      variant: 'error',
      title: 'Geofence download failed',
      message: error instanceof Error ? error.message : String(error),
      timer: 5000,
    })
  }
}

const onClearOnVehicle = async (): Promise<void> => {
  try {
    await fenceStore.clearOnVehicle()
  } catch (error) {
    showDialog({
      variant: 'error',
      title: 'Geofence clear failed',
      message: error instanceof Error ? error.message : String(error),
      timer: 5000,
    })
  }
}

const onClearLocal = (): void => {
  fenceStore.clearAll()
}

const onSaveCfp = (): void => {
  const file: CockpitFencePlanFile = { version: 0, fileType: 'CockpitFencePlan', plan: fenceStore.exportPlan() }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const date = format(new Date(), 'LLL_dd_yyyy_HH_mm_ss')
  saveAs(blob, `cockpit_fence_plan_${date}.cfp`)
}

const onExportMavlinkPlan = (): void => {
  const plan = fenceStore.exportPlan()
  const planFile: MavlinkPlanFile = {
    fileType: 'Plan',
    version: 1,
    groundStation: 'Cockpit',
    mission: { version: 2, items: [], plannedHomePosition: [props.mapCenter[0], props.mapCenter[1], 0] },
    geoFence: {
      version: 2,
      polygons: plan.polygons.map((p) => ({
        version: 1,
        inclusion: p.inclusion,
        polygon: p.vertices.map((v): [number, number] => [v[0], v[1]]),
      })),
      circles: plan.circles.map((c) => ({
        version: 1,
        inclusion: c.inclusion,
        circle: { center: [c.center[0], c.center[1]], radius: c.radius },
      })),
      breachReturn: plan.breachReturn
        ? [plan.breachReturn.coordinates[0], plan.breachReturn.coordinates[1], plan.breachReturn.altitude]
        : undefined,
    },
    rallyPoints: { version: 2, points: [] },
  }
  const blob = new Blob([JSON.stringify(planFile, null, 2)], { type: 'application/json' })
  const date = format(new Date(), 'LLL_dd_yyyy_HH_mm_ss')
  saveAs(blob, `cockpit_fence_${date}.plan`)
}

const onPickFile = (): void => {
  fileInput.value?.click()
}

const importMavlinkPlan = (planFile: MavlinkPlanFile): void => {
  if (planFile.geoFence?.version !== 2) {
    openSnackbar({
      variant: 'warning',
      message: `Unsupported \`.plan\` geoFence version (${
        planFile.geoFence?.version ?? 'missing'
      }). Skipping fence section.`,
      duration: 4000,
    })
  } else {
    const plan: GeoFencePlan = {
      version: 2,
      polygons: (planFile.geoFence.polygons ?? []).map((p) => ({
        id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        inclusion: p.inclusion,
        vertices: p.polygon.map((v): [number, number] => [v[0], v[1]]),
      })),
      circles: (planFile.geoFence.circles ?? []).map((c) => ({
        id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        inclusion: c.inclusion,
        center: [c.circle.center[0], c.circle.center[1]],
        radius: c.circle.radius,
      })),
      breachReturn: planFile.geoFence.breachReturn
        ? {
            coordinates: [planFile.geoFence.breachReturn[0], planFile.geoFence.breachReturn[1]],
            altitude: planFile.geoFence.breachReturn[2],
          }
        : undefined,
    }
    fenceStore.loadFromPlan(plan)
  }

  // `.plan` files also include a mission section. We don't take ownership of
  // mission editing here, but we surface a hint so the user can switch back to
  // the mission layer to inspect it.
  if (planFile.mission && missionStore.currentPlanningWaypoints.length === 0) {
    emit('mission-loaded')
  }
}

const onFilePicked = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    showDialog({ variant: 'error', message: 'Invalid JSON file.', timer: 3000 })
    input.value = ''
    return
  }

  if (instanceOfCockpitFencePlanFile(parsed)) {
    fenceStore.loadFromPlan(parsed.plan)
    openSnackbar({ variant: 'success', message: 'Cockpit fence plan loaded.', duration: 3000 })
  } else if (instanceOfMavlinkPlanFile(parsed)) {
    importMavlinkPlan(parsed)
    openSnackbar({ variant: 'success', message: '`.plan` file loaded.', duration: 3000 })
  } else {
    showDialog({ variant: 'error', message: 'Unsupported file format.', timer: 3000 })
  }

  input.value = ''
}
</script>

<style scoped>
.fence-card :deep(.v-switch) {
  flex: 0 0 auto;
}
.fence-card :deep(.v-switch .v-input__control),
.fence-card :deep(.v-switch .v-selection-control),
.fence-card :deep(.v-switch .v-selection-control__wrapper) {
  min-height: 0;
  height: 16px;
}
.fence-card :deep(.fence-switch--exclusion .v-switch__track) {
  background-color: #ff8800 !important;
  opacity: 0.7 !important;
}
.fence-card :deep(.fence-switch--exclusion .v-switch__thumb) {
  background-color: #ffffff !important;
  color: #ff8800 !important;
}
.fence-expansible-wrapper :deep(.content-expand-collapse) {
  padding-left: 0;
  padding-right: 0;
}
.fence-autoenable-row :deep(.v-switch) {
  flex: 0 0 auto;
}
.fence-autoenable-row :deep(.v-switch .v-input__control),
.fence-autoenable-row :deep(.v-switch .v-selection-control),
.fence-autoenable-row :deep(.v-switch .v-selection-control__wrapper) {
  min-height: 0;
  height: 24px;
}
</style>
