<template>
  <div
    class="flex items-center justify-start h-full px-4 mr-1 transition-all cursor-pointer hover:bg-slate-200/30 min-w-[20%] select-none"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = true"
  >
    <div class="flex items-center overflow-hidden text-lg font-medium text-white whitespace-nowrap">
      <p v-if="store.missionName" class="overflow-x-hidden text-ellipsis">{{ store.missionName }}</p>
      <p v-else class="overflow-x-hidden text-ellipsis">
        {{ randomMissionName }}
        <FontAwesomeIcon icon="fa-pen-to-square" size="1x" class="ml-2 text-slate-200/30" />
      </p>
    </div>
  </div>

  <teleport to="body">
    <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="50%">
      <v-card class="pa-2 bg-[#20202022] backdrop-blur-2xl text-white rounded-lg">
        <v-card-title class="flex justify-between">
          <div />
          <div>Mission configuration</div>
          <v-btn
            icon
            :width="38"
            :height="34"
            variant="text"
            class="bg-transparent -mt-1 -mr-3"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <v-icon
              :size="interfaceStore.isOnSmallScreen ? 22 : 26"
              :class="interfaceStore.isOnSmallScreen ? '-mr-[10px] -mt-[10px]' : '-mr-[2px]'"
              >mdi-close</v-icon
            >
          </v-btn>
        </v-card-title>
        <v-card-text>
          <div class="flex flex-col gap-y-3">
            <div>
              <p>Mission Name</p>
              <v-text-field
                v-model="store.missionName"
                append-inner-icon="mdi-restore"
                class="mt-1"
                @click:append-inner="store.missionName = store.lastMissionName"
              />
            </div>
            <v-divider class="opacity-20" />
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-sm font-medium">BlueOS Cloud mission</span>
                  <span v-if="!cloudStore.isIntegrationEnabled" class="text-xs opacity-70">
                    Enable BlueOS Cloud integration in the General settings to use this feature.
                  </span>
                  <span v-else-if="!cloudStore.isAuthenticated" class="text-xs opacity-70">
                    Sign in to BlueOS Cloud to create missions.
                  </span>
                  <span v-else-if="linkedCloudMission" class="text-xs opacity-80">
                    Linked: {{ linkedCloudMission.title }}
                  </span>
                  <span v-else class="text-xs opacity-70">
                    Create a mission on BlueOS Cloud to log this session there.
                  </span>
                </div>
                <v-btn
                  v-if="cloudStore.isAuthenticated"
                  size="small"
                  variant="flat"
                  class="bg-[#FFFFFF22]"
                  :loading="isCreatingCloudMission"
                  :disabled="!canCreateCloudMission"
                  @click="createMissionOnCloud"
                >
                  {{ linkedCloudMission ? 'Recreate on cloud' : 'Create on BlueOS Cloud' }}
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, toRefs } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { coolMissionNames } from '@/libs/funny-name/words'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

/**
 * Props for the BatteryIndicator component
 */
const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const store = useMissionStore()
const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const cloudStore = useBlueOsCloudStore()
const { openSnackbar } = useSnackbar()

const randomMissionName = coolMissionNames.random()
const isCreatingCloudMission = ref(false)
const linkedCloudMissionId = ref<string | null>(null)

const linkedCloudMission = computed(
  () => cloudStore.missions.find((mission) => mission.id === linkedCloudMissionId.value) ?? null
)

const canCreateCloudMission = computed(
  () => cloudStore.isAuthenticated && !!store.missionName.trim() && !isCreatingCloudMission.value
)

const createMissionOnCloud = async (): Promise<void> => {
  const name = store.missionName.trim()
  if (!name) {
    openSnackbar({
      message: 'Please set a mission name before creating it on BlueOS Cloud.',
      variant: 'warning',
      duration: 3000,
      closeButton: true,
    })
    return
  }
  isCreatingCloudMission.value = true
  try {
    const created = await cloudStore.createCloudMission({ name })
    linkedCloudMissionId.value = created.id
    openSnackbar({
      message: `Mission "${created.title}" created on BlueOS Cloud.`,
      variant: 'success',
      duration: 3000,
      closeButton: true,
    })
  } catch (error) {
    openSnackbar({
      message: `Failed to create mission on BlueOS Cloud: ${(error as Error).message}`,
      variant: 'error',
      duration: 4000,
      closeButton: true,
    })
  } finally {
    isCreatingCloudMission.value = false
  }
}
</script>
