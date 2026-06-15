<template>
  <v-dialog v-model="isVisible" class="dialog">
    <div class="flex">
      <div class="mission-modal" :style="interfaceStore.globalGlassMenuStyles">
        <div class="modal-content">
          <!-- Left Vertical Menu -->
          <div class="flex flex-col justify-between h-full px-5 py-3 align-center">
            <div class="flex flex-col justify-between pt-2 align-center gap-y-8">
              <button class="flex flex-col justify-center align-center">
                <div class="mb-1 text-2xl rounded-full frosted-button w-[46px] h-[46px]">
                  <v-icon size="30">mdi-map-marker-path</v-icon>
                </div>
                <div class="text-sm">Missions</div>
              </button>
            </div>
            <div>
              <v-divider class="opacity-[0.03] ml-[-5px] w-[120%]"></v-divider>
              <button class="flex flex-col justify-center py-2 mt-4 align-center" @click="closeModal">
                <div
                  class="frosted-button flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-1"
                >
                  <v-icon class="text-[18px]">mdi-close</v-icon>
                </div>
                <div class="text-sm">Close</div>
              </button>
            </div>
          </div>

          <v-divider vertical class="h-[92%] mt-4 opacity-[0.03]"></v-divider>

          <!-- Right Content -->
          <div class="flex flex-col flex-1 min-h-0 min-w-0 h-full">
            <!-- Header -->
            <div class="flex justify-between items-center px-6 pt-4 pb-2 shrink-0">
              <h3 class="text-lg font-medium">Mission Library</h3>
            </div>

            <!-- Cards Grid -->
            <div
              v-if="missionStore.savedMissions.length > 0"
              class="grid gap-4 flex-1 min-h-0 overflow-y-auto w-full pt-4 px-6 pb-4 content-start"
              style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
            >
              <div
                v-for="mission in missionStore.savedMissions"
                :key="mission.id"
                class="relative cursor-pointer group"
                @click="openDetail(mission)"
              >
                <div
                  class="relative w-full aspect-square overflow-hidden border-4 border-white rounded-md transition duration-75 ease-in border-opacity-10 group-hover:border-opacity-30"
                >
                  <img
                    v-if="thumbnailFor(mission)"
                    :src="thumbnailFor(mission)"
                    class="w-full h-full object-cover bg-[#1f2a37]"
                    alt="Mission thumbnail"
                  />
                  <div v-else class="w-full h-full flex justify-center items-center bg-[#1f2a37]">
                    <v-icon size="48" class="text-white/30">mdi-map-marker-path</v-icon>
                  </div>
                  <div class="absolute top-1 right-1 flex flex-col gap-1">
                    <div class="card-action-button" @click.stop="onLoadClick(mission)">
                      <v-tooltip activator="parent" location="left" open-delay="500">Place mission on map</v-tooltip>
                      <v-icon size="16" class="text-white">mdi-map-plus</v-icon>
                    </div>
                    <div class="card-action-button" @click.stop="onDeleteClick(mission)">
                      <v-tooltip activator="parent" location="left" open-delay="500">Delete mission</v-tooltip>
                      <v-icon size="16" class="text-white">mdi-delete</v-icon>
                    </div>
                  </div>
                  <div class="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1">
                    <span class="info-pill">
                      <v-icon size="12" class="mr-1">mdi-map-marker</v-icon>
                      {{ mission.waypoints.length }}
                    </span>
                    <span v-if="mission.surveys?.length" class="info-pill">
                      <v-icon size="12" class="mr-1">mdi-grid</v-icon>
                      {{ mission.surveys.length }}
                    </span>
                    <span v-if="mission.estimates?.length && mission.estimates.length !== '—'" class="info-pill">
                      <v-icon size="12" class="mr-1">mdi-map-marker-distance</v-icon>
                      {{ mission.estimates.length }}
                    </span>
                    <span v-if="mission.estimates?.duration && mission.estimates.duration !== '—'" class="info-pill">
                      <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>
                      {{ mission.estimates.duration }}
                    </span>
                    <span v-if="mission.vehicleType" class="info-pill">
                      {{ vehicleTypeLabel(mission.vehicleType) }}
                    </span>
                  </div>
                </div>
                <div class="flex flex-col justify-center mt-1 text-xs text-white/80">
                  <p class="truncate text-center font-medium">{{ mission.name }}</p>
                  <p class="truncate text-center text-[10px] text-white/50">
                    {{ formatDate(new Date(mission.updatedAt)) }}
                  </p>
                </div>
              </div>
            </div>

            <div v-else class="flex flex-1 min-h-0 pt-6 items-center justify-center text-center px-6">
              <div class="max-w-md mx-auto">
                <v-icon size="60" class="text-white/30 mb-4">mdi-map-marker-path</v-icon>
                <h4 class="text-lg font-medium text-white mb-2">No missions saved</h4>
                <p class="text-white/70 text-sm">
                  Plan a mission and use “Save current mission” to add it to your library.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="shrink-0 h-14 flex justify-between items-center px-4" style="border-top: 1px solid #ffffff0d">
              <span class="text-sm text-white/70">
                {{ missionStore.savedMissions.length }}
                {{ missionStore.savedMissions.length === 1 ? 'item' : 'items' }} total
              </span>
              <div class="flex items-center gap-2">
                <v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-content-save-plus"
                  :disabled="!canSaveCurrent"
                  @click="openSaveDialog"
                >
                  Save current mission
                </v-btn>
                <v-btn variant="text" size="small" prepend-icon="mdi-upload" @click="triggerImportFile">
                  Import file
                </v-btn>
                <input
                  ref="importInput"
                  type="file"
                  accept=".cmp,application/json"
                  class="hidden"
                  @change="onImportFileSelected"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>

  <!-- Mission detail dialog -->
  <v-dialog v-if="detailMission" v-model="showDetail" max-width="640px">
    <v-card :style="interfaceStore.globalGlassMenuStyles" class="text-white">
      <v-icon icon="mdi-close" class="absolute top-3 right-3 cursor-pointer z-10" @click="showDetail = false" />
      <div class="flex flex-col md:flex-row">
        <div class="md:w-1/2 w-full p-4 flex items-center justify-center bg-[#1f2a37]">
          <img
            v-if="thumbnailFor(detailMission)"
            :src="thumbnailFor(detailMission)"
            class="rounded-md w-full max-h-[300px] object-contain"
            alt="Mission thumbnail"
          />
          <div v-else class="flex items-center justify-center h-[200px]">
            <v-icon size="80" class="text-white/30">mdi-map-marker-path</v-icon>
          </div>
        </div>
        <div class="md:w-1/2 w-full py-4 px-[21px] flex flex-col gap-2 shadow-[inset_0_5px_7px_-5px_rgba(0,0,0,0.5)]">
          <div class="flex justify-between items-start gap-2">
            <h2 class="text-xl font-semibold break-words">{{ detailMission.name }}</h2>
            <span v-if="detailMission.vehicleType" class="info-pill shrink-0 text-[11px] py-1 px-3">
              {{ vehicleTypeLabel(detailMission.vehicleType) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <p v-if="detailMission.description" class="text-sm text-white/80 break-words flex-1">
              {{ detailMission.description }}
            </p>
            <div class="flex shrink-0 gap-1 ml-auto">
              <v-btn
                variant="text"
                prepend-icon="mdi-export"
                color="white"
                size="small"
                @click="onExportClick(detailMission)"
              >
                Export
              </v-btn>
              <v-btn
                variant="text"
                prepend-icon="mdi-delete"
                color="white"
                size="small"
                @click="onDeleteClick(detailMission)"
              >
                Delete
              </v-btn>
            </div>
          </div>
          <v-divider class="my-0 opacity-[0.09]" />
          <div class="text-sm flex flex-col gap-1">
            <div class="flex justify-between">
              <span class="text-white/60">Waypoints</span>
              <span>{{ detailMission.waypoints.length }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/60">Surveys</span>
              <span>{{ detailMission.surveys?.length ?? 0 }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/60">Vehicle type</span>
              <span>{{ vehicleTypeLabel(detailMission.vehicleType) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/60">Cruise speed</span>
              <span>{{ detailMission.settings.defaultCruiseSpeed }} m/s</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/60">Created</span>
              <span>{{ formatDate(new Date(detailMission.createdAt)) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/60">Updated</span>
              <span>{{ formatDate(new Date(detailMission.updatedAt)) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-white/60">Location</span>
              <div class="flex items-center gap-2">
                <a
                  :href="googleEarthUrl(detailLocation)"
                  target="_blank"
                  rel="noopener"
                  class="text-blue-300 hover:text-blue-200 inline-flex mr-2"
                >
                  <v-tooltip activator="parent" location="top" open-delay="500">Open in Google Earth</v-tooltip>
                  <v-icon size="18">mdi-google-earth</v-icon>
                </a>
                <span>{{ detailLocation[0].toFixed(6) }}, {{ detailLocation[1].toFixed(6) }}</span>
              </div>
            </div>
          </div>
          <v-divider v-if="detailMission.estimates" class="my-2 opacity-[0.09]" />
          <div v-if="detailMission.estimates" class="text-sm">
            <p class="text-white/60 mb-1">Mission estimates</p>
            <div class="flex flex-col gap-1">
              <div class="flex justify-between">
                <span class="text-white/60">Length</span>
                <span>{{ detailMission.estimates.length }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-white/60">ETA</span>
                <span>{{ detailMission.estimates.duration }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-white/60">Energy</span>
                <span>{{ detailMission.estimates.energy }}</span>
              </div>
              <div v-if="detailMission.estimates.totalSurveyCoverage !== '—'" class="flex justify-between">
                <span class="text-white/60">Total survey coverage</span>
                <span>{{ detailMission.estimates.totalSurveyCoverage }}</span>
              </div>
              <div v-if="detailMission.estimates.missionCoverageArea !== '—'" class="flex justify-between">
                <span class="text-white/60">Mission area (≈)</span>
                <span>{{ detailMission.estimates.missionCoverageArea }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <v-divider class="opacity-[0.09]" />
      <v-card-actions>
        <div class="flex justify-between w-full pa-1">
          <v-btn variant="text" color="white" @click="showDetail = false">Close</v-btn>
          <v-btn color="white" prepend-icon="mdi-map-plus" @click="onLoadClick(detailMission)">
            Place mission on map
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Save current mission dialog -->
  <v-dialog v-model="showSaveDialog" max-width="500px" persistent>
    <v-card :style="interfaceStore.globalGlassMenuStyles" class="text-white">
      <v-card-title class="text-lg font-semibold text-center">Save mission to library</v-card-title>
      <v-icon icon="mdi-close" class="absolute top-3 right-3 cursor-pointer" @click="showSaveDialog = false" />
      <form @submit.prevent="confirmSaveMission">
        <v-card-text>
          <div class="flex flex-col gap-y-5">
            <div class="flex flex-col gap-y-1">
              <label for="save-mission-name" class="text-sm text-white/80">Mission name</label>
              <input
                id="save-mission-name"
                v-model="saveForm.name"
                type="text"
                class="rounded-md bg-[#FFFFFF11] border border-[#FFFFFF33] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#FFFFFF77]"
              />
            </div>
            <div class="flex flex-col gap-y-1">
              <label for="save-mission-description" class="text-sm text-white/80">Description (optional)</label>
              <textarea
                id="save-mission-description"
                v-model="saveForm.description"
                rows="3"
                class="rounded-md bg-[#FFFFFF11] border border-[#FFFFFF33] text-white text-sm px-3 py-2 resize-y focus:outline-none focus:border-[#FFFFFF77]"
              />
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <div class="flex justify-between gap-2 w-full pa-1 pt-2" style="border-top: 1px solid #ffffff0d">
            <v-btn type="button" variant="text" color="white" @click="showSaveDialog = false">Cancel</v-btn>
            <v-btn type="submit" color="white" :disabled="!saveForm.name.trim()">Save</v-btn>
          </div>
        </v-card-actions>
      </form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { computeMissionLocation, isSavedMission } from '@/libs/mission/library'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import {
  CockpitMission,
  instanceOfCockpitMission,
  MissionEstimatesSnapshot,
  SavedMission,
  WaypointCoordinates,
} from '@/types/mission'

const props = defineProps<{
  /**
   * Snapshot of the mission currently being edited in the planner.
   */
  currentMissionSnapshot: CockpitMission | null
  /**
   * Live mission estimates captured at save time alongside the mission.
   */
  currentMissionEstimates?: MissionEstimatesSnapshot
  /**
   * Vehicle type to associate with newly saved missions (connected or planned fallback).
   */
  effectiveVehicleType?: MavType
  /**
   * When true, the "Save current mission" dialog is opened automatically on mount.
   */
  openSaveOnMount?: boolean
}>()

const emit = defineEmits<{
  (e: 'load-mission', mission: SavedMission): void
}>()

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()

const isVisible = ref(true)
const showDetail = ref(false)
const detailMission = ref<SavedMission | null>(null)
const showSaveDialog = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

const saveForm = ref({
  name: '',
  description: '',
  id: undefined as string | undefined,
})

const canSaveCurrent = computed(() =>
  Boolean(
    props.currentMissionSnapshot &&
      ((props.currentMissionSnapshot.waypoints?.length ?? 0) > 0 ||
        (props.currentMissionSnapshot.surveys?.length ?? 0) > 0)
  )
)

const detailLocation = ref<WaypointCoordinates>([0, 0])

const closeModal = (): void => {
  isVisible.value = false
  interfaceStore.missionLibraryVisibility = false
}

watch(isVisible, (visible) => {
  if (!visible) interfaceStore.missionLibraryVisibility = false
})

const formatDate = (date: Date): string => format(date, 'LLL dd, yyyy HH:mm')

const vehicleTypeLabel = (type?: MavType): string => {
  if (!type) return 'Any'
  // Friendly names match the planner's vehicle-type selector; other MavType values fall through
  // to a humanised label so legacy missions still display something readable.
  const friendly: Partial<Record<MavType, string>> = {
    [MavType.MAV_TYPE_SURFACE_BOAT]: 'Surface Boat',
    [MavType.MAV_TYPE_SUBMARINE]: 'Submarine',
    [MavType.MAV_TYPE_QUADROTOR]: 'UAV',
    [MavType.MAV_TYPE_GROUND_ROVER]: 'Ground Rover',
  }
  if (friendly[type]) return friendly[type] as string
  return String(type)
    .replace('MAV_TYPE_', '')
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_m, _p1, c) => ` ${c.toUpperCase()}`)
    .trim()
}

const googleEarthUrl = (coords: WaypointCoordinates): string =>
  `https://earth.google.com/web/@${coords[0]},${coords[1]},500a,1000d`

const thumbnailFor = (mission: SavedMission): string | undefined => missionStore.savedMissionThumbnails[mission.id]

const openDetail = (mission: SavedMission): void => {
  detailMission.value = mission
  detailLocation.value = computeMissionLocation(mission)
  showDetail.value = true
}

// Delay clearing detailMission until after the v-dialog close transition to avoid flashing the
// previous entry when reopening the modal with a different mission.
let detailClearTimer: ReturnType<typeof setTimeout> | null = null
watch(showDetail, (visible) => {
  if (visible) {
    if (detailClearTimer) {
      clearTimeout(detailClearTimer)
      detailClearTimer = null
    }
    return
  }
  if (detailClearTimer) clearTimeout(detailClearTimer)
  detailClearTimer = setTimeout(() => {
    detailMission.value = null
    detailClearTimer = null
  }, 250)
})

const openSaveDialog = (): void => {
  if (!props.currentMissionSnapshot) return
  saveForm.value = {
    name: missionStore.missionName || `Mission ${format(new Date(), 'LLL dd, yyyy HH:mm')}`,
    description: '',
    id: undefined,
  }
  showSaveDialog.value = true
}

onMounted(() => {
  if (props.openSaveOnMount && canSaveCurrent.value) openSaveDialog()
})

const confirmSaveMission = (): void => {
  if (!props.currentMissionSnapshot) return
  const trimmedName = saveForm.value.name.trim()
  if (!trimmedName) return
  missionStore.saveMissionToLibrary({
    name: trimmedName,
    description: saveForm.value.description.trim(),
    mission: props.currentMissionSnapshot,
    vehicleType: props.effectiveVehicleType,
    estimates: props.currentMissionEstimates ? { ...props.currentMissionEstimates } : undefined,
    id: saveForm.value.id,
  })
  showSaveDialog.value = false
  openSnackbar({ variant: 'success', message: 'Mission saved to library.', duration: 2500 })
}

const onLoadClick = (mission: SavedMission): void => {
  emit('load-mission', mission)
  showDetail.value = false
  closeModal()
}

const onDeleteClick = (mission: SavedMission): void => {
  showDialog({
    variant: 'warning',
    title: 'Delete mission',
    message: `Delete "${mission.name}" from your library? This cannot be undone.`,
    actions: [
      { text: 'Cancel', action: closeDialog },
      {
        text: 'Delete',
        action: () => {
          missionStore.deleteSavedMission(mission.id)
          if (detailMission.value?.id === mission.id) {
            detailMission.value = null
            showDetail.value = false
          }
          closeDialog()
          openSnackbar({ variant: 'info', message: 'Mission deleted from library.', duration: 2500 })
        },
      },
    ],
  })
}

const onExportClick = (mission: SavedMission): void => {
  // Strip the runtime-only `id` from the exported file; it's regenerated on import, and an `id`
  // collision across machines would silently overwrite an unrelated local entry.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...exportable } = mission
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' })
  const sanitizedName = mission.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'mission'
  const date = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
  saveAs(blob, `${sanitizedName}_${date}.cmp`)
  openSnackbar({ variant: 'success', message: 'Mission exported.', duration: 2000 })
}

const triggerImportFile = (): void => {
  importInput.value?.click()
}

const onImportFileSelected = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (loadEvent: ProgressEvent<FileReader>) => {
    try {
      const contents = String(loadEvent.target?.result ?? '')
      const parsed = JSON.parse(contents)
      if (isSavedMission(parsed)) {
        missionStore.saveMissionToLibrary({
          name: parsed.name,
          description: parsed.description ?? '',
          mission: {
            version: parsed.version,
            settings: parsed.settings,
            waypoints: parsed.waypoints,
            surveys: parsed.surveys,
          },
          vehicleType: parsed.vehicleType,
          estimates: parsed.estimates,
        })
      } else if (instanceOfCockpitMission(parsed)) {
        const fallbackName = file.name.replace(/\.[^.]+$/, '') || 'Imported mission'
        missionStore.saveMissionToLibrary({
          name: fallbackName,
          description: '',
          mission: parsed,
          vehicleType: props.effectiveVehicleType,
        })
      } else {
        openSnackbar({ variant: 'error', message: 'Invalid mission file.', duration: 3000 })
        return
      }
      openSnackbar({ variant: 'success', message: 'Mission imported into library.', duration: 2500 })
    } catch (err) {
      openSnackbar({ variant: 'error', message: `Failed to import mission: ${err}`, duration: 3500 })
    } finally {
      if (input) input.value = ''
    }
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  --v-overlay-opacity: 0.1;
  z-index: 100;
}

.mission-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 860px;
  height: 650px;
  min-width: 600px;
  max-width: 90%;
  border: 1px solid #cbcbcb33;
  border-radius: 12px;
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
  z-index: 100;
}

.modal-content {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  height: 100%;
  color: #ffffff;
  z-index: 200;
}

.frosted-button {
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(203, 203, 203, 0.3);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s ease;
}

.frosted-button:hover {
  background: rgba(203, 203, 203, 0.5);
}

.card-action-button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #00000055;
  cursor: pointer;
  opacity: 0.85;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.card-action-button:hover {
  background: #000000aa;
  opacity: 1;
}

.info-pill {
  display: inline-flex;
  align-items: center;
  background: #00000066;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  font-size: 10px;
  border-radius: 999px;
  padding: 2px 8px;
}

.hidden {
  display: none;
}
</style>
