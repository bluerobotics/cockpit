<template>
  <v-app>
    <v-main>
      <transition name="slide-in-left">
        <div v-if="showMainMenu" ref="mainMenu" class="left-menu slide-in">
          <v-window v-model="mainMenuStep" class="h-full w-full">
            <v-window-item :value="1" class="h-full">
              <div class="flex flex-col pt-5 pb-6 h-full justify-between align-center gap-y-10">
                <GlassButton
                  v-if="route.name === 'widgets-view'"
                  label="Edit Mode"
                  :selected="widgetStore.editingMode"
                  :label-class="menuLabelSize"
                  variant="round"
                  :width="buttonSize"
                  icon="mdi-pencil"
                  :disabled="false"
                  @click="
                    () => {
                      widgetStore.editingMode = !widgetStore.editingMode
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  v-if="route.name !== 'widgets-view'"
                  label="Flight"
                  :label-class="menuLabelSize"
                  variant="round"
                  :width="buttonSize"
                  icon="mdi-send"
                  :disabled="false"
                  :selected="$route.name === 'Flight'"
                  @click="
                    () => {
                      $router.push('/')
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  v-if="route.name !== 'Mission planning'"
                  label="Mission Planning"
                  :label-class="menuLabelSize"
                  variant="round"
                  icon="mdi-map-marker-radius"
                  :width="buttonSize"
                  :disabled="false"
                  :selected="$route.name === 'Mission planning'"
                  @click="
                    () => {
                      $router.push('/mission-planning')
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  label="Configuration"
                  :label-class="menuLabelSize"
                  icon="mdi-cog"
                  variant="round"
                  button-class="-mt-1"
                  :width="buttonSize"
                  :disabled="false"
                  :selected="showConfigurationMenu"
                  @click="mainMenuStep = 2"
                />
                <GlassButton
                  :label="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
                  :label-class="menuLabelSize"
                  :icon="fullScreenToggleIcon"
                  variant="round"
                  :width="buttonSize"
                  :disabled="false"
                  :selected="false"
                  @click="
                    () => {
                      toggleFullscreen()
                      closeMainMenu()
                    }
                  "
                />
              </div>
            </v-window-item>
            <v-window-item :value="2" class="h-full w-full">
              <div class="flex flex-col pt-1 pb-2 w-full h-full justify-between gap-y-1">
                <GlassButton
                  label="General"
                  :label-class="menuLabelSize"
                  icon="mdi-view-dashboard-variant"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Joystick"
                  :label-class="menuLabelSize"
                  icon="mdi-controller"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Video"
                  :label-class="menuLabelSize"
                  icon="mdi-video"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Telemetry"
                  :label-class="menuLabelSize"
                  icon="mdi-subtitles-outline"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Alerts"
                  :label-class="menuLabelSize"
                  icon="mdi-alert-rhombus-outline"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Dev"
                  :label-class="menuLabelSize"
                  icon="mdi-dev-to"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <GlassButton
                  label="Mission"
                  :label-class="menuLabelSize"
                  icon="mdi-map-marker-path"
                  variant="uncontained"
                  no-glass
                  :height="buttonSize * 0.5"
                  :icon-size="buttonSize * 0.6"
                  :disabled="false"
                />
                <div class="flex flex-col justify-center align-center">
                  <v-divider width="70%" class="mb-4" />
                  <GlassButton
                    :label-class="menuLabelSize"
                    icon="mdi-arrow-left"
                    variant="round"
                    :width="buttonSize / 2.4"
                    :disabled="false"
                    :selected="false"
                    @click="mainMenuStep = 1"
                  />
                </div>
              </div>
            </v-window-item>
          </v-window>
        </div>
      </transition>

      <teleport to="body">
        <GlassModal :is-visible="showConfigurationMenu"><ConfigurationGeneralView /></GlassModal>
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
          <div id="mainTopBar" class="bar top-bar">
            <button
              class="flex items-center justify-center h-full aspect-square top-bar-hamburger"
              @click="toggleMainMenu"
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
          <div v-for="view in widgetStore.viewsToShow" :key="view.name">
            <Transition name="fade">
              <div v-show="view.name === currentSelectedViewName" class="bar bottom-bar">
                <MiniWidgetContainer
                  :container="view.miniWidgetContainers[0]"
                  :allow-editing="widgetStore.editingMode"
                  align="start"
                />
                <div />
                <MiniWidgetContainer
                  :container="view.miniWidgetContainers[1]"
                  :allow-editing="widgetStore.editingMode"
                  align="center"
                />
                <div />
                <MiniWidgetContainer
                  :container="view.miniWidgetContainers[2]"
                  :allow-editing="widgetStore.editingMode"
                  align="end"
                />
              </div>
            </Transition>
          </div>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { coolMissionNames } from '@/libs/funny-name/words'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { useMissionStore } from '@/stores/mission'

import AltitudeSlider from './components/AltitudeSlider.vue'
import EditMenu from './components/EditMenu.vue'
import GlassButton from './components/GlassButton.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import SlideToConfirm from './components/SlideToConfirm.vue'
import Alerter from './components/widgets/Alerter.vue'
import { datalogger } from './libs/sensors-logging'
import { useAppInterfaceStore } from './stores/appInterface'
import { useMainVehicleStore } from './stores/mainVehicle'
import { useWidgetManagerStore } from './stores/widgetManager'
const { showDialog, closeDialog } = useInteractionDialog()

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const responsiveStore = useAppInterfaceStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = ref(false)
const isMenuOpen = ref(false)
const isSlidingOut = ref(false)
const mainMenuStep = ref(1)

let requestDisarmConfirmationPopup = false

const toggleMainMenu = (): void => {
  if (isMenuOpen.value === true) {
    closeMainMenu()
  } else {
    openMainMenu()
  }
}

// When a isVehicleArmed change its value a watcher call Swal.close, this flag is
// used to avoid closing others Swal instances instead of the one intended
const openMainMenu = (): void => {
  if (vehicleStore.isArmed) {
    showDialog({
      title: 'Be careful',
      maxWidth: 650,
      message: 'The vehicle is currently armed and it is not recommended to open the main menu.',
      actions: [
        {
          text: 'Continue anyway',
          action: () => {
            showMainMenu.value = true
            isMenuOpen.value = true
            closeDialog()
          },
        },
        {
          text: 'Disarm vehicle',
          action: () => {
            disarmVehicle()
          },
        },
      ],
      variant: 'warning',
    }).then((result) => {
      if (result.isConfirmed && vehicleStore.isArmed) {
        vehicleStore.disarm().then(() => {
          showMainMenu.value = true
          isMenuOpen.value = true
        })
      } else {
        showMainMenu.value = true
        isMenuOpen.value = true
      }
      requestDisarmConfirmationPopup = false
    })
  } else {
    showMainMenu.value = true
    isMenuOpen.value = true
  }
}

// Close Main Menu Logic
const closeMainMenu = (): void => {
  isSlidingOut.value = true
  setTimeout(() => {
    showMainMenu.value = false
    isSlidingOut.value = false
    isMenuOpen.value = false
    mainMenuStep.value = 1
  }, 20)
}

const disarmVehicle = (): void => {
  vehicleStore.disarm().then(() => {
    showMainMenu.value = true
  })
  closeDialog()
}

const handleEscKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && showMainMenu.value) {
    closeMainMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscKey)
})

const buttonSize = computed(() => {
  if (responsiveStore.is2xl) return 60
  if (responsiveStore.isXl) return 55
  if (responsiveStore.isLg) return 50
  if (responsiveStore.isMd) return 45
  if (responsiveStore.isSm) return 30
  return 25
})

const menuLabelSize = computed(() => {
  if (responsiveStore.is2xl) return 'text-[16px]'
  if (responsiveStore.isXl) return 'text-[15px]'
  if (responsiveStore.isLg) return 'text-[13px]'
  if (responsiveStore.isMd) return 'text-[12px]'
  if (responsiveStore.isSm) return 'text-[10px]'
  return 'text-[10px]'
})

const isVehicleArmed = computed(() => vehicleStore.isArmed)
watch(isVehicleArmed, (isArmed) => {
  if (requestDisarmConfirmationPopup && !isArmed) {
    Swal.close()
  }
})

const mainMenu = ref()
onClickOutside(mainMenu, () => {
  closeMainMenu()
})

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
const currentSelectedViewName = computed(() => widgetStore.currentView.name)

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

.left-menu {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  @apply 2xl:w-[130px] 2xl:h-auto xl:w-[121px] xl:h-auto lg:w-[102px] lg:h-auto md:w-[95px] md:h-auto sm:w-[78px] sm:h-auto;
  padding-top: 5px;
  border-radius: 0 20px 20px 0;
  border: 1px #cbcbcb33 solid;
  border-left: none;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  background-color: #4f4f4f33;
  backdrop-filter: blur(15px);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%) translateY(-50%);
  }
  to {
    transform: translateX(0) translateY(-50%);
  }
}

@keyframes slideOutLeft {
  from {
    transform: translateX(0) translateY(-50%);
  }
  to {
    transform: translateX(-100%) translateY(-50%);
  }
}

.slide-in-left-enter-active {
  animation: slideInLeft 300ms ease forwards;
}

.slide-in-left-leave-active {
  animation: slideOutLeft 300ms ease forwards;
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
  z-index: 60;
}

.bar {
  width: 100%;
  background: rgba(108, 117, 125, 0.5);
  display: flex;
  justify-content: space-between;
  z-index: 60;
  position: absolute;
  @apply backdrop-blur-[2px];
}

.bottom-bar {
  bottom: 0;
  height: v-bind('currentBottomBarHeightPixels');
}

.top-bar {
  top: 0;
  height: v-bind('currentTopBarHeightPixels');
}

.top-bar-hamburger {
  outline: none;
}
</style>
