<template>
  <BaseConfigurationView>
    <template #title>Map</template>
    <template #content>
      <div class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Points of Interest</template>
          <template #info>
            <li>View, edit and remove the points of interest shown on the map.</li>
            <li>Static POIs have fixed coordinates, while live POIs follow data-lake variables.</li>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 pr-4 mb-8 mt-2 w-full">
              <v-data-table
                :items="pois"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg mb-8"
                theme="dark"
                :headers="headers"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center gap-3 mx-1 w-[240px]">
                        <div class="poi-marker-container" :style="{ opacity: getPoiMarkerOpacity(item) }">
                          <div
                            class="poi-marker-background"
                            :style="{ backgroundColor: `${getPoiMarkerColor(item)}80` }"
                          />
                          <v-icon :icon="item.icon" size="18" class="poi-marker-glyph" />
                        </div>
                        <div class="flex flex-col min-w-0">
                          <p class="whitespace-nowrap overflow-hidden truncate">{{ item.name }}</p>
                          <p
                            v-if="item.description"
                            class="text-xs opacity-60 whitespace-nowrap overflow-hidden truncate"
                          >
                            {{ item.description }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center mx-1 w-[110px]">
                        <v-chip
                          size="small"
                          :color="poiStatusColor(item)"
                          variant="flat"
                          label
                          class="text-white text-xs font-medium"
                        >
                          {{ poiStatusLabel(item) }}
                        </v-chip>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center mx-1 w-[200px]">
                        <p class="whitespace-nowrap overflow-hidden truncate font-mono text-xs">
                          {{ poiCoordinatesText(item) }}
                        </p>
                      </div>
                    </td>
                    <td class="w-[160px] text-right">
                      <div class="flex items-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-crosshairs-gps"
                          size="x-small"
                          @click="centerOnPoi(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editPoi(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-trash-can-outline"
                          size="x-small"
                          @click="removePoi(item)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr class="w-full">
                    <td colspan="4" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                      <v-btn variant="outlined" class="rounded-lg" @click="openNewPoiDialog">
                        <v-icon start>mdi-plus</v-icon>
                        Add point of interest
                      </v-btn>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="4" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] w-full">No points of interest found</p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>

  <PoiManager ref="poiManagerRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import PoiManager from '@/components/poi/PoiManager.vue'
import { usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { getPoiMarkerColor, getPoiMarkerOpacity } from '@/libs/utils-poi'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { ResolvedPointOfInterest } from '@/types/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { resolvedPointsOfInterest: pois, removePointOfInterest } = usePointsOfInterest()

const poiManagerRef = ref<InstanceType<typeof PoiManager> | null>(null)

const headers = [
  { title: 'Name', key: 'name', align: 'start', sortable: true },
  { title: 'Status', key: 'status', align: 'center', sortable: false },
  { title: 'Coordinates', key: 'coordinates', align: 'center', sortable: false },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
] as const

const poiStatusLabel = (poi: ResolvedPointOfInterest): string => {
  if (!poi.isLiveTracked) return 'Static'
  return poi.hasValidPosition ? 'Live' : 'No data'
}

const poiStatusColor = (poi: ResolvedPointOfInterest): string => {
  if (!poi.isLiveTracked) return '#607d8b'
  return poi.hasValidPosition ? '#4caf50' : '#ff9800'
}

const poiCoordinatesText = (poi: ResolvedPointOfInterest): string => {
  if (poi.isLiveTracked && !poi.hasValidPosition) return 'Coordinates unknown'
  return `${poi.coordinates[0].toFixed(7)}, ${poi.coordinates[1].toFixed(7)}`
}

const centerOnPoi = (poi: ResolvedPointOfInterest): void => {
  logUserAction(`Centered the map on the "${poi.name}" point of interest`)
  missionStore.requestMapCenterOn(poi.coordinates)
  // Close the submenu panel so the centered map is visible, but keep the main menu drawer open.
  interfaceStore.configModalVisibility = false
  interfaceStore.currentSubMenuComponentName = null
}

const editPoi = (poi: ResolvedPointOfInterest): void => {
  poiManagerRef.value?.openDialog(undefined, poi)
}

const removePoi = (poi: ResolvedPointOfInterest): void => {
  logUserAction(`Removed the "${poi.name}" point of interest`)
  removePointOfInterest(poi.id)
}

const openNewPoiDialog = (): void => {
  poiManagerRef.value?.openDialog()
}
</script>

<style scoped>
.v-data-table :deep(tbody tr:hover) {
  background-color: rgba(0, 0, 0, 0.1) !important;
}

.poi-marker-container {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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

.poi-marker-glyph {
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  z-index: 2;
}
</style>
