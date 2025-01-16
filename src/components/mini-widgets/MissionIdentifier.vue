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
          <div class="flex flex-col">
            <p>Mission Name</p>
            <v-text-field
              v-model="store.missionName"
              append-inner-icon="mdi-restore"
              class="mt-1"
              @click:append-inner="store.missionName = store.lastMissionName"
            />
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import { coolMissionNames } from '@/libs/funny-name/words'
import { useAppInterfaceStore } from '@/stores/appInterface'
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

const randomMissionName = coolMissionNames.random()
</script>
