<template>
  <v-app>
    <v-main>
      <div id="mainTopBar" class="z-[60] w-full h-12 bg-slate-600/50 absolute flex backdrop-blur-[2px]">
        <button class="flex items-center justify-center h-full aspect-square" @click="showMainMenu = true">
          <img class="main-menu-button-image" src="@/assets/blue-robotics-logo.svg" />
        </button>
        <div class="flex flex-col items-center justify-center h-full ml-3 mr-1">
          <p
            class="overflow-hidden text-lg font-medium leading-none text-white cursor-pointer select-none max-h-9"
            @click="showMissionOptionsDialog = true"
          >
            {{ store.missionName }}
          </p>
        </div>
        <div class="grow" />
        <Alerter class="max-w-sm min-w-fit" />
        <div class="flex-1">
          <MiniWidgetContainer :container="miniWidgetsStore.currentMiniWidgetsProfile.containers[0]" />
        </div>
        <div
          class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[80px]"
        >
          {{ format(timeNow, 'E LLL do HH:mm') }}
        </div>
      </div>
      <div class="z-[60] w-full h-12 bg-slate-600/50 absolute flex bottom-0 backdrop-blur-[2px] justify-between">
        <MiniWidgetContainer :container="miniWidgetsStore.currentMiniWidgetsProfile.containers[1]" class="flex-1" />
        <div />
        <MiniWidgetContainer :container="miniWidgetsStore.currentMiniWidgetsProfile.containers[2]" class="flex-1" />
        <div />
        <MiniWidgetContainer :container="miniWidgetsStore.currentMiniWidgetsProfile.containers[3]" class="flex-1" />
      </div>
      <Dialog v-model:show="showMainMenu">
        <div class="flex flex-col items-center justify-around p-5">
          <v-btn
            v-if="route.name === 'widgets-view'"
            prepend-icon="mdi-pencil"
            class="w-full m-1 text-white action-button bg-slate-500 hover:bg-slate-400"
            @click="widgetStore.editingMode = !widgetStore.editingMode"
          >
            Edit mode
          </v-btn>
          <v-btn
            v-if="route.name !== 'widgets-view'"
            prepend-icon="mdi-send"
            class="w-full m-1 text-white action-button bg-slate-500 hover:bg-slate-400"
            to="/"
          >
            Flight
          </v-btn>
          <v-btn
            v-if="route.name !== 'Mission planning'"
            prepend-icon="mdi-map-marker-radius"
            class="w-full m-1 text-white action-button bg-slate-500 hover:bg-slate-400"
            to="/mission-planning"
          >
            Mission planning
          </v-btn>
          <v-btn
            prepend-icon="mdi-cog"
            class="w-full m-1 text-white action-button bg-slate-500 hover:bg-slate-400"
            @click="showConfigurationMenu = true"
          >
            Configuration
          </v-btn>
          <v-btn
            :prepend-icon="fullScreenToggleIcon"
            class="w-full m-1 text-white action-button bg-slate-500 hover:bg-slate-400"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen' }}
          </v-btn>
        </div>
      </Dialog>
      <teleport to="body">
        <v-dialog v-model="showConfigurationMenu" transition="dialog-bottom-transition" width="100%" height="100%">
          <ConfigurationMenu />
        </v-dialog>
      </teleport>

      <teleport to="body">
        <v-dialog v-model="showMissionOptionsDialog" width="50%">
          <v-card class="pa-2">
            <v-card-title>Mission configuration</v-card-title>
            <v-card-text>
              <v-text-field v-model="store.missionName" hide-details="auto" label="Mission name" />
            </v-card-text>
          </v-card>
        </v-dialog>
      </teleport>

      <div ref="routerSection">
        <router-view />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onClickOutside, useDebounceFn, useFullscreen, useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'
import {
  // type AsyncComponentLoader,
  computed,
  onBeforeUnmount,
  // defineAsyncComponent,
  ref,
} from 'vue'
import { useRoute } from 'vue-router'

import ConfigurationMenu from '@/components/ConfigurationMenu.vue'
import { CockpitAction, registerActionCallback, unregisterActionCallback } from '@/libs/joystick/protocols'
import { useMiniWidgetsManagerStore } from '@/stores/miniWidgetsManager'
import { useMissionStore } from '@/stores/mission'

import Dialog from './components/Dialog.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import Alerter from './components/widgets/Alerter.vue'
import { useWidgetManagerStore } from './stores/widgetManager'

const widgetStore = useWidgetManagerStore()
const miniWidgetsStore = useMiniWidgetsManagerStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = ref(false)

const mainMenu = ref()
onClickOutside(mainMenu, () => (showMainMenu.value = false))

const route = useRoute()
const routerSection = ref()

// Full screen toggling
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const debouncedToggleFullScreen = useDebounceFn(() => toggleFullscreen(), 500)
const fullScreenCallbackId = registerActionCallback(CockpitAction.TOGGLE_FULL_SCREEN, debouncedToggleFullScreen)
onBeforeUnmount(() => unregisterActionCallback(fullScreenCallbackId))

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-overscan'))

// Mission identification
const store = useMissionStore()
const showMissionOptionsDialog = ref(false)

// Clock
const timeNow = useTimestamp({ interval: 1000 })
</script>

<style>
html,
body {
  /* Removes the scrollbar */
  overflow: hidden !important;
}
.main-menu-button-image {
  width: 80%;
  height: 80%;
  filter: invert(100%) sepia(0%) saturate(100%) hue-rotate(0deg) brightness(100%) contrast(100%);
}
.main-menu-button-image:hover {
  filter: invert(100%) sepia(0%) saturate(100%) hue-rotate(0deg) brightness(100%) contrast(90%);
}
</style>
