<template>
  <v-app>
    <v-main>
      <div
        v-if="
          !widgetStore.editingMode &&
          !interfaceStore.isMainMenuVisible &&
          interfaceStore.mainMenuStyleTrigger === 'center-left'
        "
      >
        <div
          id="menu-trigger"
          class="menu-trigger border-4 flex items-center justify-center w-[30px] px-0 py-2 cursor-pointer overflow-hidden rounded-r-lg rounded-br-lg -ml-[1px]"
          :class="[interfaceStore.isOnSmallScreen ? 'top-[20%] scale-75 -ml-[3px]' : 'top-[50%]']"
          :style="
            interfaceStore.highlightedComponent === 'menu-trigger'
              ? interfaceStore.globalGlassMenuHighlightStyles
              : interfaceStore.globalGlassMenuStyles
          "
          @click="toggleMainMenu"
        >
          <v-icon class="text-white text-[46px] opacity-80">mdi-menu-right</v-icon>
        </div>
      </div>
      <MainMenu
        v-model:currentSubMenuComponent="currentSubMenuComponent"
        @close-main-menu="closeMainMenu"
        @open-about-dialog="handleShowAboutDialog"
      />

      <teleport to="body">
        <GlassModal
          :is-visible="
            currentSubMenuComponent !== null &&
            interfaceStore.mainMenuCurrentStep === 2 &&
            interfaceStore.isMainMenuVisible
          "
          position="menuitem"
          :class="interfaceStore.isVideoLibraryVisible ? 'opacity-0' : 'opacity-100'"
          @close-modal="currentSubMenuComponent = null"
        >
          <component :is="currentSubMenuComponent"></component>
        </GlassModal>
      </teleport>

      <div ref="routerSection" class="router-view">
        <div class="main-view" :class="{ 'edit-mode': widgetStore.editingMode }" :style="connectionStatusFeedback">
          <div
            v-show="showTopBarNow"
            id="mainTopBar"
            class="bar top-bar"
            :style="[
              interfaceStore.globalGlassMenuStyles,
              interfaceStore.isOnSmallScreen && interfaceStore.isOnSmallScreen ? topBarScaleStyle : undefined,
            ]"
          >
            <button
              v-if="interfaceStore.mainMenuStyleTrigger === 'burger'"
              class="flex items-center justify-center h-full mr-2 aspect-square top-bar-hamburger"
              @click="toggleMainMenu"
            >
              <span class="text-3xl transition-all mdi mdi-menu text-slate-300 hover:text-slate-50" />
            </button>
            <div class="flex-1">
              <MiniWidgetContainer
                :container="widgetStore.currentMiniWidgetsProfile.containers[0]"
                :allow-editing="widgetStore.editingMode"
                align="start"
              />
            </div>
            <div class="grow" />
            <div class="flex-1">
              <MiniWidgetContainer
                :container="widgetStore.currentMiniWidgetsProfile.containers[1]"
                :allow-editing="widgetStore.editingMode"
                align="center"
              />
            </div>
            <div class="grow" />
            <div class="flex-1">
              <MiniWidgetContainer
                :container="widgetStore.currentMiniWidgetsProfile.containers[2]"
                :allow-editing="widgetStore.editingMode"
                align="end"
              />
            </div>
          </div>
          <AltitudeSlider />
          <div class="bottom-container">
            <SlideToConfirm />
          </div>
          <div v-for="view in widgetStore.viewsToShow" :key="view.name">
            <Transition name="fade">
              <div
                v-show="view.name === currentSelectedViewName && showBottomBarNow"
                class="bar bottom-bar"
                :style="[
                  interfaceStore.globalGlassMenuStyles,
                  interfaceStore.isOnSmallScreen ? bottomBarScaleStyle : undefined,
                ]"
              >
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
  <About v-if="showAboutDialog" @update:show-about-dialog="showAboutDialog = $event" />
  <Tutorial v-if="interfaceStore.isTutorialVisible" />
  <VideoLibraryModal v-if="interfaceStore.isVideoLibraryVisible" />
  <VehicleDiscoveryDialog v-model="showDiscoveryDialog" show-auto-search-option />
  <ActionDiscoveryModal auto-check-on-mount />
  <UpdateNotification v-if="isElectron()" />
  <SnackbarContainer />
  <SkullAnimation
    :is-visible="interfaceStore.showSkullAnimation"
    @animation-complete="interfaceStore.hideSkullAnimation"
  />
  <Transition
    leave-active-class="transition-opacity duration-500 ease-in-out"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <SplashScreen v-if="interfaceStore.showSplashScreen" />
  </Transition>
</template>

<script setup lang="ts">
import { useStorage, useWindowSize } from '@vueuse/core'
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ActionDiscoveryModal from '@/components/ActionDiscoveryModal.vue'
import GlassModal from '@/components/GlassModal.vue'
import SkullAnimation from '@/components/SkullAnimation.vue'
import SnackbarContainer from '@/components/SnackbarContainer.vue'
import Tutorial from '@/components/Tutorial.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import VehicleDiscoveryDialog from '@/components/VehicleDiscoveryDialog.vue'
import VideoLibraryModal from '@/components/VideoLibraryModal.vue'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { isElectron, sleep } from '@/libs/utils'

import About from './components/About.vue'
import AltitudeSlider from './components/AltitudeSlider.vue'
import EditMenu from './components/EditMenu.vue'
import MainMenu from './components/MainMenu.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import SlideToConfirm from './components/SlideToConfirm.vue'
import SplashScreen from './components/SplashScreen.vue'
import { openMainMenuIfSafeOrDesired } from './composables/armSafetyDialog'
import { useSnackbar } from './composables/snackbar'
import { checkBlueOsUserDataSimilarity } from './libs/blueos'
import { useAppInterfaceStore } from './stores/appInterface'
import { useDevelopmentStore } from './stores/development'
import { useMainVehicleStore } from './stores/mainVehicle'
import { useWidgetManagerStore } from './stores/widgetManager'
import { SubMenuComponent } from './types/general'
const { openSnackbar } = useSnackbar()

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const devStore = useDevelopmentStore()

const showAboutDialog = ref(false)
const currentSubMenuComponent = ref<SubMenuComponent>(null)

const handleShowAboutDialog = (): void => {
  showAboutDialog.value = true
}

// Main menu
const isSlidingOut = ref(false)

const { width: windowWidth } = useWindowSize()

const isConfigModalVisible = computed(() => interfaceStore.isConfigModalVisible)

// Check if the user data in browser storage is the same as on blueOS; if not, keep the splash screen open for a maximum of 20 seconds.
onBeforeMount(async () => {
  if (!devStore.showSplashScreenOnStartup) {
    interfaceStore.showSplashScreen = false
    return
  }
  const minSplashDuration = 5000
  const maxSplashDuration = 15000
  const startTime = Date.now()
  let isBlueOSUserDataSimilar = false

  // Close splash screen no matter what, after 15 seconds
  setTimeout(() => {
    interfaceStore.showSplashScreen = false
  }, maxSplashDuration)

  while (!isBlueOSUserDataSimilar) {
    isBlueOSUserDataSimilar = await checkBlueOsUserDataSimilarity(vehicleStore.globalAddress)
    if (!isBlueOSUserDataSimilar) await sleep(1000)
  }

  const elapsed = Date.now() - startTime
  if (elapsed < minSplashDuration) await sleep(minSplashDuration - elapsed)

  interfaceStore.showSplashScreen = false
})

watch(isConfigModalVisible, (newVal) => {
  if (newVal === false) {
    currentSubMenuComponent.value = null
  }
})

const topBottomBarScale = computed(() => {
  return windowWidth.value / originalBarWidth
})

const toggleMainMenu = (): void => {
  if (interfaceStore.isMainMenuVisible) {
    closeMainMenu()
  } else {
    openMainMenuIfSafeOrDesired()
  }
}

// Close Main Menu Logic
const closeMainMenu = (): void => {
  isSlidingOut.value = true
  setTimeout(() => {
    interfaceStore.isMainMenuVisible = false
    isSlidingOut.value = false
    interfaceStore.mainMenuCurrentStep = 1
    currentSubMenuComponent.value = null
  }, 20)
}

const handleEscKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && interfaceStore.isMainMenuVisible) {
    closeMainMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscKey)
})

/* eslint-disable jsdoc/require-jsdoc  */
const connectionStatusFeedback = ref<{ border: string; transition?: string }>({ border: '0px' })

const resetConnectionStatusFeedback = (): void => {
  setTimeout(() => {
    connectionStatusFeedback.value = {
      border: '0px solid transparent',
      transition: 'border 4s ease-out',
    }
  }, 4000)
}

// Connection monitoring and visual feedback
watch(
  () => vehicleStore.isVehicleOnline,
  (isOnline) => {
    if (!isOnline) {
      openSnackbar({
        message: 'Vehicle connection lost: reestablishing',
        variant: 'error',
        duration: 3000,
        closeButton: false,
      })
      connectionStatusFeedback.value = { border: '3px solid red' }

      resetConnectionStatusFeedback()
      return
    }

    openSnackbar({ message: 'Vehicle connected', variant: 'success', duration: 3000, closeButton: false })
    connectionStatusFeedback.value = { border: '3px solid green' }

    resetConnectionStatusFeedback()
  }
)

const routerSection = ref()
const currentSelectedViewName = computed(() => widgetStore.currentView.name)
const originalBarWidth = 1800

const topBarScaleStyle = computed(() => {
  return {
    transform: `scale(${topBottomBarScale.value})`,
    transformOrigin: 'top left',
    width: `${originalBarWidth}px`,
  }
})

const bottomBarScaleStyle = computed(() => {
  return {
    transform: `scale(${topBottomBarScale.value})`,
    transformOrigin: 'bottom left',
    width: `${originalBarWidth}px`,
  }
})

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

// Control top/bottom bar momentary hiding
const showBottomBarNow = ref(widgetStore.currentView.showBottomBarOnBoot)
const showTopBarNow = ref(true)
watch([() => widgetStore.currentView, () => widgetStore.currentView.showBottomBarOnBoot], () => {
  showBottomBarNow.value = widgetStore.currentView.showBottomBarOnBoot
})
const bottomBarToggleCallbackId = registerActionCallback(
  availableCockpitActions.toggle_bottom_bar,
  () => (showBottomBarNow.value = !showBottomBarNow.value)
)
const topBarToggleCallbackId = registerActionCallback(
  availableCockpitActions.toggle_top_bar,
  () => (showTopBarNow.value = !showTopBarNow.value)
)
onBeforeUnmount(() => {
  unregisterActionCallback(bottomBarToggleCallbackId)
  unregisterActionCallback(topBarToggleCallbackId)
})

// Dynamic styles
const currentTopBarHeightPixels = computed(() => `${widgetStore.currentTopBarHeightPixels}px`)
const currentBottomBarHeightPixels = computed(() => `${widgetStore.currentBottomBarHeightPixels}px`)

const showDiscoveryDialog = ref(false)
const preventAutoSearch = useStorage('cockpit-prevent-auto-vehicle-discovery-dialog', false)

onMounted(() => {
  if (isElectron() && !preventAutoSearch.value) {
    // Wait 5 seconds to check if we're connected to a vehicle
    setTimeout(() => {
      if (vehicleStore.isVehicleOnline) return
      showDiscoveryDialog.value = true
    }, 5000)
  }

  if (!interfaceStore.userHasSeenTutorial) {
    setTimeout(() => {
      interfaceStore.isTutorialVisible = true
    }, 6000)
  }
})
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
  transform: scale(0.78);
  right: -11%;
  top: -11%;
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
  display: flex;
  justify-content: space-between;
  z-index: 60;
  position: absolute;
}

.menu-trigger {
  position: fixed;
  left: 0;
  transform: translateY(-50%);
  z-index: 1050;
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
