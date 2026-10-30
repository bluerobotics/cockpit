<template>
  <v-dialog
    :model-value="modelValue"
    width="560"
    persistent
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card class="relative text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{ title }}</v-card-title>
      <v-btn icon variant="text" size="small" aria-label="Close" class="absolute top-4 right-4" @click="closeDialog">
        <v-icon size="22">mdi-close</v-icon>
      </v-btn>
      <v-card-text class="px-8 flex flex-col gap-3">
        <p v-if="description" class="text-body-2 opacity-90 ma-0">{{ description }}</p>

        <div class="flex items-center gap-2">
          <v-text-field
            v-model="searchQuery"
            placeholder="Search by name, description, date or location"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            theme="dark"
            hide-details
            clearable
            class="flex-1"
          />
          <v-select
            v-model="sortKey"
            :items="sortOptions"
            variant="outlined"
            density="compact"
            theme="dark"
            hide-details
            class="w-[160px]"
            @update:model-value="onSortChange"
          />
          <v-btn icon variant="text" size="small" aria-label="Refresh the mission list" @click="onRefreshRequested">
            <v-tooltip activator="parent" location="top" open-delay="300">Refresh the mission list</v-tooltip>
            <v-icon size="20">mdi-refresh</v-icon>
          </v-btn>
        </div>

        <div v-if="cloudStore.isLoadingMissions" class="flex justify-center py-6">
          <v-progress-circular indeterminate color="white" />
        </div>
        <div v-else>
          <div v-if="visibleMissions.length === 0" class="flex flex-col items-center gap-2 py-6 opacity-70">
            <v-icon size="28">{{ cloudStore.missions.length === 0 ? 'mdi-cloud-off-outline' : 'mdi-magnify' }}</v-icon>
            <span class="text-body-2">{{ emptyListMessage }}</span>
          </div>
          <div v-else class="max-h-[40vh] overflow-y-auto pr-1">
            <template v-if="pinnedMission">
              <div
                :key="pinnedMission.id"
                class="w-full flex items-center gap-2 px-3 py-2 rounded mb-1 transition-colors cursor-pointer border"
                :class="getMissionRowClasses(pinnedMission.id)"
                @click="chooseMission(pinnedMission)"
              >
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate flex items-center gap-2">
                    {{ pinnedMission.title || 'Untitled mission' }}
                    <span
                      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-200 border border-sky-300/40"
                    >
                      Active
                    </span>
                  </div>
                  <div class="text-xs opacity-70 truncate">
                    {{ formatMissionMeta(pinnedMission) }}
                  </div>
                </div>
                <a
                  :href="buildBlueOsCloudMissionUrl(pinnedMission.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="opacity-70 hover:opacity-100"
                  @click.stop
                >
                  <v-tooltip activator="parent" location="top" open-delay="300">View on BlueOS Cloud</v-tooltip>
                  <v-icon size="16">mdi-open-in-new</v-icon>
                </a>
              </div>
              <div v-if="otherMissions.length > 0" class="flex items-center gap-2 my-2 px-1 opacity-60">
                <v-divider class="flex-1 opacity-40" />
                <span class="text-[10px] uppercase tracking-wider">Other missions</span>
                <v-divider class="flex-1 opacity-40" />
              </div>
            </template>
            <div
              v-for="mission in otherMissions"
              :key="mission.id"
              class="w-full flex items-center gap-2 px-3 py-2 rounded mb-1 transition-colors cursor-pointer border"
              :class="getMissionRowClasses(mission.id)"
              @click="chooseMission(mission)"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ mission.title || 'Untitled mission' }}</div>
                <div class="text-xs opacity-70 truncate">
                  {{ formatMissionMeta(mission) }}
                </div>
              </div>
              <a
                :href="buildBlueOsCloudMissionUrl(mission.id)"
                target="_blank"
                rel="noopener noreferrer"
                class="opacity-70 hover:opacity-100"
                @click.stop
              >
                <v-tooltip activator="parent" location="top" open-delay="300">View on BlueOS Cloud</v-tooltip>
                <v-icon size="16">mdi-open-in-new</v-icon>
              </a>
            </div>
          </div>
        </div>

        <p v-if="cloudStore.lastError" class="text-body-2 text-red-300 ma-0">{{ cloudStore.lastError }}</p>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { buildBlueOsCloudMissionUrl } from '@/libs/blueos-cloud/api'
import { type MissionSortKey, filterAndSortMissions, formatMissionMeta } from '@/libs/blueos-cloud/mission-list'
import { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

const props = withDefaults(
  defineProps<{
    /**
     * Controls dialog visibility.
     */
    modelValue: boolean
    /**
     * Dialog title shown in the header.
     */
    title?: string
    /**
     * Optional description displayed above the mission list.
     */
    description?: string
  }>(),
  {
    title: 'Select a BlueOS Cloud mission',
    description: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'selected', mission: BlueOsCloudMission): void
}>()

const interfaceStore = useAppInterfaceStore()
const cloudStore = useBlueOsCloudStore()
const { openSnackbar } = useSnackbar()

const sortOptions = [
  { title: 'Newest first', value: 'newest' },
  { title: 'Oldest first', value: 'oldest' },
  { title: 'Name (A-Z)', value: 'name' },
]

// Vuetify's clearable button writes `null` back into the model, so the query is nullable on purpose.
const searchQuery = ref<string | null>('')
const sortKey = ref<MissionSortKey>('newest')

const visibleMissions = computed(() =>
  filterAndSortMissions(cloudStore.missions, searchQuery.value ?? '', sortKey.value)
)

const pinnedMission = computed(
  () => visibleMissions.value.find((mission) => mission.id === cloudStore.linkedMissionId) ?? null
)

const otherMissions = computed(() =>
  visibleMissions.value.filter((mission) => mission.id !== cloudStore.linkedMissionId)
)

const emptyListMessage = computed(() =>
  cloudStore.missions.length === 0 ? 'No missions yet on your BlueOS Cloud account.' : 'No missions match your search.'
)

const onSortChange = (value: MissionSortKey): void => {
  logUserAction(`Sorted the BlueOS Cloud mission list by '${value}'`)
}

const getMissionRowClasses = (missionId: string): string => {
  const isActive = cloudStore.linkedMissionId === missionId
  if (isActive) return 'bg-sky-500/10 border-sky-300/40 hover:bg-sky-500/15'
  return 'bg-[#FFFFFF11] border-transparent hover:bg-[#FFFFFF1A]'
}

const loadMissions = async (): Promise<void> => {
  try {
    await cloudStore.refreshMissions()
  } catch (error) {
    openSnackbar({
      message: `Failed to load BlueOS Cloud missions: ${(error as Error).message}`,
      variant: 'error',
      duration: 4000,
      closeButton: true,
    })
  }
}

const onRefreshRequested = (): void => {
  logUserAction('Refreshed the BlueOS Cloud mission list')
  void loadMissions()
}

const chooseMission = (mission: BlueOsCloudMission): void => {
  logUserAction(`Selected BlueOS Cloud mission '${mission.title}'`)
  emit('selected', mission)
  emit('update:modelValue', false)
}

const closeDialog = (): void => {
  logUserAction('Closed the BlueOS Cloud mission picker without selecting')
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return
    if (cloudStore.isAuthenticated) await loadMissions()
  },
  { immediate: true }
)
</script>
