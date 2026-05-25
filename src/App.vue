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
        <div class="main-view" :class="{ 'edit-mode': widgetStore.editingMode }">
          <WidgetBar
            v-show="showTopBarNow"
            id="mainTopBar"
            position="top"
            :containers="widgetStore.currentMiniWidgetsProfile.containers"
          >
            <template #prepend>
              <button
                v-if="interfaceStore.mainMenuStyleTrigger === 'burger'"
                class="flex items-center justify-center h-full mr-2 aspect-square top-bar-hamburger"
                @click="toggleMainMenu"
              >
                <span class="text-3xl transition-all mdi mdi-menu text-slate-300 hover:text-slate-50" />
              </button>
            </template>
          </WidgetBar>
          <AltitudeSlider />
          <div class="bottom-container">
            <SlideToConfirm />
          </div>
          <div v-for="view in widgetStore.viewsToShow" :key="view.name">
            <Transition name="fade">
              <WidgetBar
                v-show="view.name === currentSelectedViewName && showBottomBarNow"
                position="bottom"
                :containers="view.miniWidgetContainers"
              />
            </Transition>
          </div>
          <router-view />
        </div>
        <EditMenu v-model:edit-mode="widgetStore.editingMode" />
      </div>
    </v-main>
  </v-app>
  <div
    class="vehicle-connection-overlay"
    :class="{
      'is-disconnected': vehicleStore.isVehicleConnectionLost,
      'is-reconnected': showReconnectedFeedback,
    }"
    aria-hidden="true"
  />
  <About v-if="showAboutDialog" @update:show-about-dialog="showAboutDialog = $event" />
  <DataPrivacyModal />
  <Tutorial v-if="interfaceStore.isTutorialVisible" />
  <VideoLibraryModal v-if="interfaceStore.isVideoLibraryVisible" />
  <VehicleDiscoveryDialog v-model="showDiscoveryDialog" show-auto-search-option />
  <CameraReplacementDialog />
  <ExternalFeaturesDiscoveryModal auto-check-on-mount />
  <VehicleDefaultsAutoImportModal />
  <VehicleDefaultsViewsImportModal />
  <VehicleDefaultsJoystickImportModal />
  <UpdateNotification v-if="isElectron()" />
  <ArchitectureWarning v-if="isElectron()" />
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
import { useStorage } from '@vueuse/core'
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ArchitectureWarning from '@/components/ArchitectureWarning.vue'
import CameraReplacementDialog from '@/components/CameraReplacementDialog.vue'
import DataPrivacyModal from '@/components/DataPrivacyModal.vue'
import ExternalFeaturesDiscoveryModal from '@/components/ExternalFeaturesDiscoveryModal.vue'
import GlassModal from '@/components/GlassModal.vue'
import SkullAnimation from '@/components/SkullAnimation.vue'
import SnackbarContainer from '@/components/SnackbarContainer.vue'
import Tutorial from '@/components/Tutorial.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import VehicleDefaultsAutoImportModal from '@/components/vehicle-defaults/VehicleDefaultsAutoImportModal.vue'
import VehicleDefaultsJoystickImportModal from '@/components/vehicle-defaults/VehicleDefaultsJoystickImportModal.vue'
import VehicleDefaultsViewsImportModal from '@/components/vehicle-defaults/VehicleDefaultsViewsImportModal.vue'
import VehicleDiscoveryDialog from '@/components/VehicleDiscoveryDialog.vue'
import VideoLibraryModal from '@/components/VideoLibraryModal.vue'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { isElectron, sleep } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'

import About from './components/About.vue'
import AltitudeSlider from './components/AltitudeSlider.vue'
import EditMenu from './components/EditMenu.vue'
import MainMenu from './components/MainMenu.vue'
import SlideToConfirm from './components/SlideToConfirm.vue'
import SplashScreen from './components/SplashScreen.vue'
import WidgetBar from './components/WidgetBar.vue'
import { openMainMenuIfSafeOrDesired } from './composables/armSafetyDialog'
import { useSnackbar } from './composables/snackbar'
import { useVehicleDefaultsAutoImport } from './composables/vehicleDefaults/vehicleDefaultsAutoImport'
import { checkBlueOsUserDataSimilarity } from './libs/blueos'
import { useAppInterfaceStore } from './stores/appInterface'
import { useDevelopmentStore } from './stores/development'
import { useMainVehicleStore } from './stores/mainVehicle'
import { useWidgetManagerStore } from './stores/widgetManager'
import { SubMenuComponent } from './types/general'
const { openSnackbar } = useSnackbar()
import { useSnapshotStore } from './stores/snapshot'

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const devStore = useDevelopmentStore()
const missionStore = useMissionStore()

// Initialize the snapshot store to register action callbacks
useSnapshotStore()

// Listen for `vehicle-sync-complete` events to auto-import vehicle-type defaults or open the
// VehicleDefaultsAutoImportModal when the user still needs to make a decision.
useVehicleDefaultsAutoImport()

const showAboutDialog = ref(false)
const currentSubMenuComponent = ref<SubMenuComponent>(null)

const handleShowAboutDialog = (): void => {
  showAboutDialog.value = true
}

// Main menu
const isSlidingOut = ref(false)

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
    isBlueOSUserDataSimilar = await checkBlueOsUserDataSimilarity(vehicleStore.globalAddress, missionStore.username)
    if (!isBlueOSUserDataSimilar) await sleep(1000)
  }

  const elapsed = Date.now() - startTime
  if (elapsed < minSplashDuration) await sleep(minSplashDuration - elapsed)

  interfaceStore.showSplashScreen = false
})

watch(
  () => interfaceStore.isConfigModalVisible,
  (isVisible) => {
    if (!isVisible) {
      currentSubMenuComponent.value = null
    }
  }
)

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
// Drives the brief green flash on reconnect. The red border pulse (when connection was lost) is CSS-only
// on the overlay; the overlay uses isVehicleConnectionLost so idle sessions without a link stay neutral.
const showReconnectedFeedback = ref(false)
let reconnectedFeedbackTimeout: ReturnType<typeof setTimeout> | undefined

// Connection monitoring and visual feedback
watch(
  () => vehicleStore.isVehicleOnline,
  (isOnline) => {
    if (reconnectedFeedbackTimeout) clearTimeout(reconnectedFeedbackTimeout)

    if (!isOnline) {
      showReconnectedFeedback.value = false
      if (!vehicleStore.isVehicleConnectionLost) return
      openSnackbar({
        message: 'Vehicle connection lost: reestablishing',
        variant: 'error',
        duration: 3000,
        closeButton: false,
      })
      return
    }

    openSnackbar({ message: 'Vehicle connected', variant: 'success', duration: 3000, closeButton: false })
    showReconnectedFeedback.value = true
    reconnectedFeedbackTimeout = setTimeout(() => (showReconnectedFeedback.value = false), 4000)
  }
)

const routerSection = ref()
const currentSelectedViewName = computed(() => widgetStore.currentView.name)

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
const currentBottomBarHeightPixels = computed(() => `${widgetStore.currentBottomBarHeightPixels}px`)

const showDiscoveryDialog = ref(false)
const discoveryDialogAutoOpened = ref(false)
const preventAutoSearch = useStorage('cockpit-prevent-auto-vehicle-discovery-dialog', false)

onMounted(() => {
  if (isElectron() && !preventAutoSearch.value) {
    // Wait 5 seconds to check if we're connected to a vehicle
    setTimeout(() => {
      if (vehicleStore.isVehicleOnline) return
      showDiscoveryDialog.value = true
      discoveryDialogAutoOpened.value = true
    }, 5000)
  }

  if (!interfaceStore.userHasSeenTutorial) {
    setTimeout(() => {
      interfaceStore.isTutorialVisible = true
    }, 6000)
  }
})

watch(showDiscoveryDialog, (isOpen) => {
  if (!isOpen) discoveryDialogAutoOpened.value = false
})

// Auto-close the discovery dialog if the vehicle comes online while it's open, but only when the
// dialog was opened automatically (not when the user explicitly opened it). Handles cases where the
// first heartbeat arrives late (e.g. slow mDNS resolution of `blueos-avahi.local`), so the dialog
// gets auto-opened even though the configured address would have connected on its own.
watch(
  () => vehicleStore.isVehicleOnline,
  (isOnline) => {
    if (isOnline && showDiscoveryDialog.value && discoveryDialogAutoOpened.value) {
      showDiscoveryDialog.value = false
    }
  }
)
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

.vehicle-connection-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  /* Matches the rounded corners of the OS window so the border is not clipped at the vertices. */
  border-radius: 0 0 12px 12px;
  box-shadow: inset 0 0 0 0 transparent;
  transition: box-shadow 1s ease-out;
}

.vehicle-connection-overlay.is-disconnected {
  animation: vehicle-disconnected-pulse 1.6s ease-in-out infinite;
}

.vehicle-connection-overlay.is-reconnected {
  box-shadow: inset 0 0 0 3px rgb(34, 197, 94), inset 0 0 24px 4px rgba(34, 197, 94, 0.45);
}

@keyframes vehicle-disconnected-pulse {
  0%,
  100% {
    box-shadow: inset 0 0 0 3px rgba(239, 68, 68, 0), inset 0 0 0 0 rgba(239, 68, 68, 0);
  }
  50% {
    box-shadow: inset 0 0 0 3px rgb(239, 68, 68), inset 0 0 32px 6px rgba(239, 68, 68, 0.65);
  }
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

.menu-trigger {
  position: fixed;
  left: 0;
  transform: translateY(-50%);
  z-index: 1050;
}
</style>
