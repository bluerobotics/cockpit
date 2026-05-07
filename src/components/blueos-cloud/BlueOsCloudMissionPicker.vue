<template>
  <v-dialog
    :model-value="modelValue"
    width="560"
    persistent
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card class="pa-4 text-white rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="flex justify-between items-center">
        <span class="text-lg font-medium">{{ title }}</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="closeDialog" />
      </v-card-title>
      <v-divider class="opacity-20 mx-4" />
      <v-card-text class="px-2 py-4">
        <p v-if="description" class="text-sm mb-3 opacity-90">{{ description }}</p>

        <div v-if="cloudStore.isLoadingMissions" class="flex justify-center py-6">
          <v-progress-circular indeterminate color="white" />
        </div>
        <div v-else>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wider opacity-70">Missions</span>
            <v-btn variant="text" size="x-small" @click="loadMissions">
              <v-icon size="14" class="mr-1">mdi-refresh</v-icon>Refresh
            </v-btn>
          </div>
          <div
            v-if="cloudStore.missions.length === 0"
            class="text-sm opacity-70 text-center py-6 border border-dashed border-white/20 rounded"
          >
            No missions yet on your BlueOS Cloud account.
          </div>
          <div v-else class="max-h-[260px] overflow-y-auto pr-1">
            <button
              v-for="mission in cloudStore.missions"
              :key="mission.id"
              class="w-full text-left px-3 py-2 rounded mb-1 transition-colors"
              :class="
                selectedMissionId === mission.id
                  ? 'bg-[#FFFFFF22] border border-white/30'
                  : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF1A]'
              "
              @click="selectedMissionId = mission.id"
            >
              <div class="font-medium truncate">{{ mission.title || 'Untitled mission' }}</div>
              <div class="text-xs opacity-70 truncate">
                {{ formatMissionMeta(mission) }}
              </div>
            </button>
          </div>
        </div>

        <div v-if="cloudStore.lastError" class="text-sm text-red-300 mt-3">{{ cloudStore.lastError }}</div>

        <v-divider class="opacity-20 my-4" />
        <div class="text-xs uppercase tracking-wider opacity-70 mb-2">Or create a new mission</div>
        <div class="flex items-center gap-2">
          <v-text-field
            v-model="newMissionName"
            placeholder="New mission name"
            density="compact"
            variant="filled"
            hide-details
            @keyup.enter="createNewMission"
          />
          <v-btn
            class="bg-[#FFFFFF22]"
            variant="flat"
            :loading="isCreatingMission"
            :disabled="!newMissionName.trim()"
            @click="createNewMission"
          >
            Create
          </v-btn>
        </div>
      </v-card-text>
      <v-divider class="opacity-20 mx-4" />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
        <v-btn
          color="white"
          variant="flat"
          class="bg-[#FFFFFF22]"
          :disabled="!selectedMission"
          @click="confirmSelection"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
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
    /**
     * Label of the confirmation button.
     */
    confirmLabel?: string
    /**
     * Initial mission name suggested when the user opens the picker (used for the create-new field).
     */
    suggestedMissionName?: string
  }>(),
  {
    title: 'Select a BlueOS Cloud mission',
    description: '',
    confirmLabel: 'Select',
    suggestedMissionName: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'selected', mission: BlueOsCloudMission): void
}>()

const interfaceStore = useAppInterfaceStore()
const cloudStore = useBlueOsCloudStore()
const { openSnackbar } = useSnackbar()

const selectedMissionId = ref<string | null>(null)
const newMissionName = ref('')
const isCreatingMission = ref(false)

const selectedMission = computed(
  () => cloudStore.missions.find((mission) => mission.id === selectedMissionId.value) ?? null
)

const formatMissionMeta = (mission: BlueOsCloudMission): string => {
  const parts: string[] = []
  if (mission.start_time) parts.push(new Date(mission.start_time).toLocaleString())
  if (mission.start_latitude && mission.start_longitude) {
    parts.push(`${parseFloat(mission.start_latitude).toFixed(4)}, ${parseFloat(mission.start_longitude).toFixed(4)}`)
  }
  return parts.join(' • ') || 'No metadata'
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

const createNewMission = async (): Promise<void> => {
  const name = newMissionName.value.trim()
  if (!name) return
  isCreatingMission.value = true
  try {
    const created = await cloudStore.createCloudMission({ name })
    selectedMissionId.value = created.id
    newMissionName.value = ''
    openSnackbar({
      message: `Mission "${created.title}" created on BlueOS Cloud.`,
      variant: 'success',
      duration: 3000,
      closeButton: true,
    })
  } catch (error) {
    openSnackbar({
      message: `Failed to create mission: ${(error as Error).message}`,
      variant: 'error',
      duration: 4000,
      closeButton: true,
    })
  } finally {
    isCreatingMission.value = false
  }
}

const confirmSelection = (): void => {
  if (!selectedMission.value) return
  emit('selected', selectedMission.value)
  emit('update:modelValue', false)
}

const closeDialog = (): void => emit('update:modelValue', false)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedMissionId.value = null
    newMissionName.value = props.suggestedMissionName
    if (cloudStore.isAuthenticated) loadMissions()
  },
  { immediate: true }
)
</script>
