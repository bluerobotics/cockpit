<template>
  <div
    v-if="library.datasets.value.length > 0"
    class="grid gap-4 flex-1 min-h-0 overflow-y-auto w-full pt-4 px-6 pb-4 content-start"
    style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))"
  >
    <div v-for="dataset in library.datasets.value" :key="dataset.id" class="relative group">
      <div
        class="relative w-full aspect-square overflow-hidden border-4 border-white rounded-md transition duration-75 ease-in border-opacity-10 group-hover:border-opacity-30 bg-[#1f2a37] flex items-center justify-center"
      >
        <v-icon size="48" class="text-white/30">{{ isMarine(dataset) ? 'mdi-waves' : 'mdi-terrain' }}</v-icon>
        <div class="absolute top-1 right-1 flex flex-col gap-1">
          <v-btn
            v-for="action in actionsFor(dataset)"
            :key="action.label"
            icon
            variant="text"
            size="24"
            :aria-label="action.label"
            :disabled="library.busy.value"
            class="!bg-[#00000055] hover:!bg-[#000000aa] !rounded-md"
            @click="action.run"
          >
            <v-tooltip activator="parent" location="left" open-delay="500">{{ action.label }}</v-tooltip>
            <v-icon size="16" class="text-white">{{ action.icon }}</v-icon>
          </v-btn>
        </div>
        <div class="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1">
          <span class="info-pill">
            <v-icon size="12" class="mr-1">mdi-dots-grid</v-icon>
            {{ dataset.pointCount }}
          </span>
          <span class="info-pill">
            <v-icon size="12" class="mr-1">
              {{ isMarine(dataset) ? 'mdi-arrow-expand-down' : 'mdi-image-filter-hdr' }}
            </v-icon>
            {{ rangeLabel(dataset) }}
          </span>
          <span v-if="dataset.modelOffsetM !== null" class="info-pill">
            <v-icon size="12" class="mr-1">mdi-delta</v-icon>
            {{ offsetLabel(dataset) }}
          </span>
          <span class="info-pill">{{ CLASS_LABELS[dataset.vehicleClass] }}</span>
        </div>
      </div>
      <div class="flex flex-col justify-center mt-1 text-xs text-white/80">
        <p class="truncate text-center font-medium">{{ dataset.name }}</p>
        <p class="truncate text-center text-[10px] text-white/50">{{ formatDate(dataset.createdAt) }}</p>
      </div>
    </div>
  </div>

  <div v-else class="flex flex-1 min-h-0 pt-6 items-center justify-center text-center px-6">
    <div class="max-w-md mx-auto">
      <v-icon size="60" class="text-white/30 mb-4">mdi-terrain</v-icon>
      <h4 class="text-lg font-medium text-white mb-2">{{ t`No terrain saved` }}</h4>
      <p class="text-white/70 text-sm">
        {{
          t`Record the ground or bottom under the vehicle, then keep the measurements of a mission here, or import a GeoJSON file measured elsewhere.`
        }}
      </p>
    </div>
  </div>

  <div class="shrink-0 h-14 flex justify-between items-center px-4" style="border-top: 1px solid #ffffff0d">
    <span class="text-sm text-white/70">
      {{ totalLabel }}
    </span>
    <div class="flex items-center gap-2">
      <span>
        <v-tooltip activator="parent" location="top" open-delay="500">{{ saveHint }}</v-tooltip>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-content-save-plus"
          :disabled="library.missionCellCount.value === 0 || library.busy.value"
          @click="onSave"
        >
          {{ t`Save measured terrain` }}
        </v-btn>
      </span>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-upload"
        :disabled="library.busy.value"
        @click="importInput?.click()"
      >
        {{ t`Import` }}
      </v-btn>
      <span>
        <v-tooltip activator="parent" location="top" open-delay="500">{{ saveHint }}</v-tooltip>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-export"
          :disabled="library.missionCellCount.value === 0 || library.busy.value"
          @click="onExport"
        >
          {{ t`Export` }}
        </v-btn>
      </span>
      <input
        ref="importInput"
        type="file"
        accept=".geojson,.json,application/geo+json"
        class="hidden"
        @change="onFileSelected"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { msgid, ngettext, t } from 'ttag'
import { computed, onMounted, ref } from 'vue'

import { useTerrainLibrary } from '@/composables/terrain/useTerrainLibrary'
import { MISSION_AREA_MARGIN_M } from '@/libs/terrain/measured-terrain-geojson'
import type { TerrainVehicleClass } from '@/libs/terrain/mission-profile'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { TerrainDatasetMeta } from '@/types/terrain'

/**
 * One of the actions a dataset card offers.
 */
interface DatasetAction {
  /**
   * What the action does, used as both the tooltip and the accessible name.
   */
  label: string
  /**
   * Material Design icon naming the action.
   */
  icon: string
  /**
   * Runs the action.
   */
  run: () => void
}

const CLASS_LABELS: Record<TerrainVehicleClass, string> = {
  air: t`Aircraft`,
  surface: t`Vessel`,
  underwater: t`Submersible`,
  ground: t`Ground`,
}

const emit = defineEmits<{
  /**
   * Asks the library to close, so the map it centered is in view.
   */
  (event: 'close'): void
}>()

const library = useTerrainLibrary()
const missionStore = useMissionStore()
const terrainStore = useTerrainStore()
const importInput = ref<HTMLInputElement | null>(null)

const saveHint = computed(() =>
  library.missionCellCount.value === 0
    ? t`No measurement falls within ${MISSION_AREA_MARGIN_M} m of the mission on the planner`
    : t`${library.missionCellCount.value} measured cells over the mission on the planner`
)

const totalLabel = computed(() => {
  const count = library.datasets.value.length
  return ngettext(msgid`${count} item total`, `${count} items total`, count)
})

const isMarine = (dataset: TerrainDatasetMeta): boolean =>
  dataset.vehicleClass === 'surface' || dataset.vehicleClass === 'underwater'

const formatDate = (atMs: number): string => format(new Date(atMs), 'LLL dd, yyyy HH:mm')

// A vessel's or submarine's dataset reads as depths under the water, the way the terrain panels report it.
const rangeLabel = (dataset: TerrainDatasetMeta): string => {
  const lowestM = dataset.minHeightM.toFixed(0)
  const highestM = dataset.maxHeightM.toFixed(0)
  if (!isMarine(dataset)) return t`${lowestM} to ${highestM} m`
  const water = terrainStore.settings.waterLevelOffsetM
  const shallow = Math.max(0, water - dataset.maxHeightM)
  const deep = Math.max(0, water - dataset.minHeightM)
  const shallowM = shallow.toFixed(1)
  const deepM = deep.toFixed(1)
  return t`${shallowM} to ${deepM} m deep`
}

const offsetLabel = (dataset: TerrainDatasetMeta): string => {
  const offset = dataset.modelOffsetM ?? 0
  const distanceM = Math.abs(offset).toFixed(1)
  return offset >= 0 ? t`${distanceM} m above model` : t`${distanceM} m below model`
}

const actionsFor = (dataset: TerrainDatasetMeta): DatasetAction[] => {
  const shown = library.shownIds.value.includes(dataset.id)
  return [
    {
      label: t`Show on the map and center it here`,
      icon: 'mdi-crosshairs-gps',
      run: () => onFocus(dataset.id),
    },
    {
      label: shown ? t`Hide from the map` : t`Show on the map`,
      icon: shown ? 'mdi-eye-off' : 'mdi-eye',
      run: () => void library.toggleOnMap(dataset.id),
    },
    {
      label: t`Use as measured terrain`,
      icon: 'mdi-check-decagram-outline',
      run: () => void library.useAsMeasured(dataset.id),
    },
    { label: t`Export as GeoJSON`, icon: 'mdi-export', run: () => void library.exportDataset(dataset.id) },
    { label: t`Delete dataset`, icon: 'mdi-delete', run: () => void library.removeDataset(dataset.id) },
  ]
}

// Closed right away, since the point of the action is to look at the map underneath.
const onFocus = (id: string): void => {
  void library.focusOnMap(id)
  emit('close')
}

const onSave = (): void => {
  const name = missionStore.missionName || `Terrain ${format(new Date(), 'LLL dd, yyyy HH:mm')}`
  void library.saveMissionTerrain(name)
}

const onExport = (): void => void library.exportMissionTerrain()

const onFileSelected = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  library.importFile(file).finally(() => (input.value = ''))
}

onMounted(library.refreshMissionCells)
</script>
