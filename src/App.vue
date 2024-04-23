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
          <div id="mainTopBar" class="z-[60] w-full bg-slate-600/50 absolute flex backdrop-blur-[2px] top-bar">
            <button
              class="flex items-center justify-center h-full aspect-square top-bar-hamburger"
              @click="openMainMenu()"
            >
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
          <AltitudeSlider />
          <div class="bottom-container">
            <SlideToConfirm />
          </div>
          <Transition name="fade">
            <div v-if="showBottomBarNow" class="bottom-container bottom-bar">
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
import Swal from 'sweetalert2'
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

import AltitudeSlider from './components/AltitudeSlider.vue'
import Dialog from './components/Dialog.vue'
import EditMenu from './components/EditMenu.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import SlideToConfirm from './components/SlideToConfirm.vue'
import Alerter from './components/widgets/Alerter.vue'
import { datalogger } from './libs/sensors-logging'
import { useMainVehicleStore } from './stores/mainVehicle'
import { useWidgetManagerStore } from './stores/widgetManager'

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = ref(false)

// When a isVehicleArmed change its value a watcher call Swal.close, this flag is
// used to avoid closing others Swal instances instead of the one intended
let requestDisarmConfirmationPopup = false
const openMainMenu = (): void => {
  if (!vehicleStore.isArmed) {
    showMainMenu.value = true
    return
  }

  requestDisarmConfirmationPopup = true
  Swal.fire({
    title: 'Be careful',
    text: 'The vehicle is currently armed, it is not recommended to open the main menu.',
    icon: 'warning',
    showCancelButton: true,
    showConfirmButton: true,
    cancelButtonText: 'Continue anyway',
    confirmButtonText: 'Disarm vehicle',
  }).then((result) => {
    // Opens the main menu only after disarming by the slider is confirmed
    if (result.isConfirmed && vehicleStore.isArmed) {
      vehicleStore.disarm().then(() => {
        showMainMenu.value = true
      })
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      showMainMenu.value = true
    }
    requestDisarmConfirmationPopup = false
  })
}

const isVehicleArmed = computed(() => vehicleStore.isArmed)
watch(isVehicleArmed, (isArmed) => {
  if (requestDisarmConfirmationPopup && !isArmed) {
    Swal.close()
  }
})

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

// Dynamic styles

const currentTopBarHeightPixels = computed(() => `${widgetStore.currentTopBarHeightPixels}px`)
const currentBottomBarHeightPixels = computed(() => `${widgetStore.currentBottomBarHeightPixels}px`)
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
.bottom-container {
  position: absolute;
  bottom: v-bind('currentBottomBarHeightPixels');
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 60; /* Adjust z-index as needed */
}

.bottom-bar {
  width: 100%;
  background: rgba(108, 117, 125, 0.5);
  display: flex;
  justify-content: space-between;
  height: v-bind('currentBottomBarHeightPixels');
}

.top-bar {
  height: v-bind('currentTopBarHeightPixels');
}

.top-bar-hamburger {
  outline: none;
}
</style>
