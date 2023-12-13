<template>
  <v-app>
    <v-main>
      <Dialog v-model:show="showMainMenu">
        <div class="flex flex-col items-center justify-around">
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
              <div class="flex">
                <v-text-field
                  v-model="store.missionName"
                  label="Mission name"
                  append-inner-icon="mdi-restore"
                  @click:append-inner="store.missionName = store.lastMissionName"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-dialog>
      </teleport>

      <div ref="routerSection" class="router-view">
        <div class="main-view" :class="{ 'edit-mode': widgetStore.editingMode }">
          <div id="mainTopBar" class="z-[60] w-full h-12 bg-slate-600/50 absolute flex backdrop-blur-[2px]">
            <button class="flex items-center justify-center h-full aspect-square" @click="showMainMenu = true">
              <span class="text-3xl transition-all mdi mdi-menu text-slate-300 hover:text-slate-50" />
            </button>
            <div
              class="flex items-center justify-start h-full px-4 ml-3 mr-1 transition-all cursor-pointer hover:bg-slate-200/30 min-w-[20%] select-none"
              @click="showMissionOptionsDialog = true"
            >
              <div class="flex items-center overflow-hidden text-lg font-medium text-white whitespace-nowrap">
                <p v-if="store.missionName" class="overflow-x-hidden text-ellipsis">{{ store.missionName }}</p>
                <p v-else class="overflow-x-hidden text-ellipsis">
                  {{ randomMissionName }}
                  <FontAwesomeIcon icon="fa-pen-to-square" size="1x" class="ml-2 text-slate-200/30" />
                </p>
              </div>
            </div>
            <div class="grow" />
            <Alerter class="max-w-sm min-w-fit" />
            <div class="grow" />
            <div class="flex-1">
              <MiniWidgetContainer
                :container="widgetStore.currentMiniWidgetsProfile.containers[0]"
                :allow-editing="widgetStore.editingMode"
                align="end"
              />
            </div>
            <div
              class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[80px]"
            >
              {{ format(timeNow, 'E LLL do HH:mm') }}
            </div>
          </div>
          <Transition name="fade">
            <div
              v-if="showBottomBarNow"
              class="z-[60] w-full h-12 bg-slate-600/50 absolute flex bottom-0 backdrop-blur-[2px] justify-between"
            >
              <MiniWidgetContainer
                :container="widgetStore.currentView.miniWidgetContainers[0]"
                :allow-editing="widgetStore.editingMode"
                align="start"
              />
              <div />
              <MiniWidgetContainer
                :container="widgetStore.currentView.miniWidgetContainers[1]"
                :allow-editing="widgetStore.editingMode"
                align="center"
              />
              <div />
              <MiniWidgetContainer
                :container="widgetStore.currentView.miniWidgetContainers[2]"
                :allow-editing="widgetStore.editingMode"
                align="end"
              />
            </div>
          </Transition>
          <router-view />
        </div>
        <EditMenu v-model:edit-mode="widgetStore.editingMode" />
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
  watch,
} from 'vue'
import { useRoute } from 'vue-router'

import ConfigurationMenu from '@/components/ConfigurationMenu.vue'
import { coolMissionNames } from '@/libs/funny-name/words'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { useMissionStore } from '@/stores/mission'

import Dialog from './components/Dialog.vue'
import EditMenu from './components/EditMenu.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import Alerter from './components/widgets/Alerter.vue'
import { datalogger } from './libs/sensors-logging'
import { useWidgetManagerStore } from './stores/widgetManager'

const widgetStore = useWidgetManagerStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = ref(false)

const mainMenu = ref()
onClickOutside(mainMenu, () => (showMainMenu.value = false))

const route = useRoute()
const routerSection = ref()

// Full screen toggling
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const debouncedToggleFullScreen = useDebounceFn(() => toggleFullscreen(), 10)
const fullScreenCallbackId = registerActionCallback(
  availableCockpitActions.toggle_full_screen,
  debouncedToggleFullScreen
)
onBeforeUnmount(() => unregisterActionCallback(fullScreenCallbackId))

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-overscan'))

// Mission identification
const store = useMissionStore()
const showMissionOptionsDialog = ref(false)
const randomMissionName = coolMissionNames.random()

// Clock
const timeNow = useTimestamp({ interval: 1000 })

// Control showing mouse
let hideMouseTimeoutId: ReturnType<typeof setInterval>

const hideMouse = (): void => {
  document.body.classList.add('hide-cursor')
}

const resetHideMouseTimeout = (): void => {
  clearTimeout(hideMouseTimeoutId)
  document.body.classList.remove('hide-cursor')
  hideMouseTimeoutId = setTimeout(hideMouse, 5000)
}

document.addEventListener('mousemove', resetHideMouseTimeout)

// Control bottom bar momentary hiding
const showBottomBarNow = ref(widgetStore.currentView.showBottomBarOnBoot)
watch([() => widgetStore.currentView, () => widgetStore.currentView.showBottomBarOnBoot], () => {
  showBottomBarNow.value = widgetStore.currentView.showBottomBarOnBoot
})
const debouncedToggleBottomBar = useDebounceFn(() => (showBottomBarNow.value = !showBottomBarNow.value), 25)
const bottomBarToggleCallbackId = registerActionCallback(
  availableCockpitActions.toggle_bottom_bar,
  debouncedToggleBottomBar
)
onBeforeUnmount(() => unregisterActionCallback(bottomBarToggleCallbackId))

// Start datalogging
datalogger.startLogging()
</script>

<style>
html,
body {
  /* Removes the scrollbar */
  overflow: hidden !important;
}
body.hide-cursor {
  cursor: none;
}
.router-view {
  width: 100%;
  height: 100%;
  position: relative;
}
.main-view {
  transition: all 0.2s;
  width: 100%;
  height: 100%;
  position: absolute;
  right: 0%;
  top: 0%;
}
.main-view.edit-mode {
  transform: scale(0.8);
  right: -10%;
  top: -10%;
}
.swal2-container {
  z-index: 10000;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(0, 100px);
}
</style>
