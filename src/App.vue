<template>
  <v-app>
    <v-main>
      <div v-if="!showMainMenu && interfaceStore.mainMenuStyleTrigger === 'center-left'">
        <div
          id="menu-trigger"
          class="menu-trigger flex items-center justify-center w-[30px] px-0 py-2 cursor-pointer overflow-hidden rounded-r-lg rounded-br-lg -ml-[1px]"
          :style="interfaceStore.globalGlassMenuStyles"
          @click="toggleMainMenu"
        >
          <v-icon class="text-white text-[46px] opacity-80">mdi-menu-right</v-icon>
        </div>
      </div>
      <transition name="slide-in-left">
        <div
          v-if="showMainMenu"
          ref="mainMenu"
          class="left-menu slide-in"
          :style="[
            glassMenuStyles,
            simplifiedMainMenu ? { width: '45px', borderRadius: '0 10px 10px 0' } : mainMenuWidth,
          ]"
        >
          <v-window v-model="mainMenuStep" class="h-full w-full">
            <v-window-item :value="1" class="h-full">
              <div
                class="relative flex flex-col h-full justify-between align-center items-center select-none"
                :class="
                  interfaceStore.isOnSmallScreen
                    ? 'gap-y-2 pt-2 pb-3 sm:gap-y-1 sm:py-0 sm:-ml-[3px] xs:gap-y-1 xs:py-0 xs:-ml-[3px]'
                    : 'lg:gap-y-3 xl:gap-y-4 gap-y-5 py-5'
                "
              >
                <GlassButton
                  v-if="route.name === 'widgets-view'"
                  :label="simplifiedMainMenu ? '' : 'Edit Interface'"
                  :selected="widgetStore.editingMode"
                  :label-class="[menuLabelSize, '-mb-0.5']"
                  icon="mdi-pencil"
                  :icon-class="interfaceStore.isOnSmallScreen ? 'scale-[90%] -mr-[2px]' : 'scale-[90%] -mr-[3px]'"
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? 'Edit Mode' : undefined"
                  :width="buttonSize"
                  @click="
                    () => {
                      widgetStore.editingMode = !widgetStore.editingMode
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  v-if="route.name !== 'widgets-view'"
                  :label="simplifiedMainMenu ? '' : 'Flight'"
                  :label-class="menuLabelSize"
                  icon="mdi-send"
                  :icon-class="
                    interfaceStore.isOnSmallScreen ? '-mb-[1px] -mr-[3px] scale-90' : '-mb-[1px] -mr-[5px] scale-90'
                  "
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? 'Flight' : undefined"
                  :width="buttonSize"
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
                  :label="simplifiedMainMenu ? '' : 'Mission Planning'"
                  :label-class="menuLabelSize"
                  icon="mdi-map-marker-radius-outline"
                  :icon-class="
                    interfaceStore.isOnSmallScreen
                      ? 'scale-[95%] -mr-[2px] -mb-[1px]'
                      : 'scale-[95%] ml-[2px] lg:-mr-[2px]'
                  "
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? 'Mission Planning' : undefined"
                  :width="buttonSize"
                  :selected="$route.name === 'Mission planning'"
                  @click="
                    () => {
                      $router.push('/mission-planning')
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  :label="simplifiedMainMenu ? '' : 'Settings'"
                  :label-class="[menuLabelSize, '-mb-1']"
                  icon="mdi-cog"
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :icon-class="
                    interfaceStore.isOnSmallScreen
                      ? 'scale-[100%] -mb-[1px] md:ml-[2px]'
                      : 'scale-[97%]  lg:ml-[1px] -mr-[2px] xl:-mb-[4px]'
                  "
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? 'Configuration' : undefined"
                  :width="buttonSize"
                  :selected="showConfigurationMenu"
                  class="mb-2"
                  @click="mainMenuStep = 2"
                />
                <GlassButton
                  :label="simplifiedMainMenu ? '' : isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
                  :label-class="menuLabelSize"
                  :icon="fullScreenToggleIcon"
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :icon-class="
                    interfaceStore.isOnSmallScreen
                      ? '-mb-[1px] scale-90 -mr-[2px] md:ml-[1px] md:-mb-[2px]'
                      : '2xl:-mb-[2px] xl:-mb-[2px] -mb-[1px] scale-90 -mr-[3px]'
                  "
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? (isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen') : undefined"
                  :button-class="simplifiedMainMenu ? '-mb-2' : ''"
                  :width="buttonSize"
                  :selected="false"
                  @click="
                    () => {
                      toggleFullscreen()
                      closeMainMenu()
                    }
                  "
                />
                <GlassButton
                  :label="simplifiedMainMenu ? '' : 'About'"
                  :label-class="[menuLabelSize, '-mb-1']"
                  icon="mdi-information-outline"
                  :icon-size="simplifiedMainMenu ? 25 : undefined"
                  :icon-class="
                    interfaceStore.isOnSmallScreen
                      ? 'scale-[100%] -mb-[1px] md:ml-[2px]'
                      : 'scale-[95%] -mb-[2px] lg:-mr-[1px] -mr-[2px] xl:-mb-[2px]'
                  "
                  :variant="simplifiedMainMenu ? 'uncontained' : 'round'"
                  :tooltip="simplifiedMainMenu ? 'About' : undefined"
                  :button-class="!simplifiedMainMenu ? '-mt-[5px]' : undefined"
                  :width="buttonSize"
                  :selected="showConfigurationMenu"
                  @click="openAboutDialog"
                />
              </div>
            </v-window-item>
            <v-window-item :value="2" class="h-full w-full">
              <div
                class="flex flex-col w-full h-full justify-between"
                :class="simplifiedMainMenu ? 'py-0 gap-y-0' : 'py-2 gap-y-1'"
              >
                <GlassButton
                  v-for="menuitem in configMenu"
                  :key="menuitem.title"
                  :label="interfaceStore.isOnSmallScreen ? undefined : menuitem.title"
                  :label-class="menuLabelSize"
                  :button-class="interfaceStore.isOnSmallScreen ? '-ml-[2px]' : ''"
                  :icon="menuitem.icon"
                  :selected="currentConfigMenuComponent === menuitem.component"
                  variant="uncontained"
                  :height="buttonSize * 0.45"
                  :icon-size="buttonSize * 0.5"
                  @click="toggleConfigComponent(menuitem.component)"
                  ><template #content
                    ><div v-if="currentConfigMenuComponent === menuitem.component" class="arrow-left"></div></template
                ></GlassButton>
                <div class="flex flex-col justify-center align-center">
                  <v-divider width="70%" class="mb-3" />
                  <GlassButton
                    :label-class="menuLabelSize"
                    icon="mdi-arrow-left"
                    :icon-class="interfaceStore.isOnSmallScreen ? '' : '-mb-[1px]'"
                    :button-class="interfaceStore.isOnSmallScreen ? (simplifiedMainMenu ? '-mt-1' : 'mt-1') : undefined"
                    variant="round"
                    :width="buttonSize / 2.4"
                    :selected="false"
                    @click="
                      () => {
                        mainMenuStep = 1
                        currentConfigMenuComponent = null
                      }
                    "
                  />
                </div>
              </div>
            </v-window-item>
          </v-window>
        </div>
      </transition>

      <teleport to="body">
        <GlassModal
          :is-visible="currentConfigMenuComponent !== null && mainMenuStep !== 1"
          position="menuitem"
          @close-modal="currentConfigMenuComponent = null"
        >
          <component :is="currentConfigMenuComponent"></component>
        </GlassModal>
      </teleport>

      <div ref="routerSection" class="router-view">
        <div class="main-view" :class="{ 'edit-mode': widgetStore.editingMode }">
          <div
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
  <About v-if="showAboutDialog" />
</template>

<script setup lang="ts">
import { onClickOutside, useDebounceFn, useFullscreen, useWindowSize } from '@vueuse/core'
import { computed, DefineComponent, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import GlassModal from '@/components/GlassModal.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'

import About from './components/About.vue'
import AltitudeSlider from './components/AltitudeSlider.vue'
import EditMenu from './components/EditMenu.vue'
import GlassButton from './components/GlassButton.vue'
import MiniWidgetContainer from './components/MiniWidgetContainer.vue'
import SlideToConfirm from './components/SlideToConfirm.vue'
import { datalogger } from './libs/sensors-logging'
import { useAppInterfaceStore } from './stores/appInterface'
import { useMainVehicleStore } from './stores/mainVehicle'
import { useWidgetManagerStore } from './stores/widgetManager'
import ConfigurationAlertsView from './views/ConfigurationAlertsView.vue'
import ConfigurationDevelopmentView from './views/ConfigurationDevelopmentView.vue'
import ConfigurationGeneralView from './views/ConfigurationGeneralView.vue'
import ConfigurationJoystickView from './views/ConfigurationJoystickView.vue'
import ConfigurationTelemetryView from './views/ConfigurationLogsView.vue'
import ConfigurationMissionView from './views/ConfigurationMissionView.vue'
import ConfigurationUIView from './views/ConfigurationUIView.vue'
import ConfigurationVideoView from './views/ConfigurationVideoView.vue'

const { showDialog, closeDialog } = useInteractionDialog()

const widgetStore = useWidgetManagerStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()

const showAboutDialog = ref(false)
const showConfigurationMenu = ref(false)
type ConfigComponent = DefineComponent<Record<string, never>, Record<string, never>, unknown> | null
const currentConfigMenuComponent = ref<ConfigComponent>(null)

// Main menu
const showMainMenu = ref(false)
const isMenuOpen = ref(false)
const isSlidingOut = ref(false)
const mainMenuStep = ref(1)
const simplifiedMainMenu = ref(false)
const windowHeight = ref(window.innerHeight)

const configMenu = [
  {
    icon: 'mdi-view-dashboard-variant',
    title: 'General',
    component: markRaw(ConfigurationGeneralView) as ConfigComponent,
  },
  {
    icon: 'mdi-monitor-cellphone',
    title: 'Interface',
    component: markRaw(ConfigurationUIView) as ConfigComponent,
  },
  {
    icon: 'mdi-controller',
    title: 'Joystick',
    component: markRaw(ConfigurationJoystickView) as ConfigComponent,
  },
  {
    icon: 'mdi-video',
    title: 'Video',
    component: markRaw(ConfigurationVideoView) as ConfigComponent,
  },
  {
    icon: 'mdi-subtitles-outline',
    title: 'Telemetry',
    component: markRaw(ConfigurationTelemetryView) as ConfigComponent,
  },
  {
    icon: 'mdi-alert-rhombus-outline',
    title: 'Alerts',
    component: markRaw(ConfigurationAlertsView) as ConfigComponent,
  },
  {
    icon: 'mdi-dev-to',
    title: 'Dev',
    component: markRaw(ConfigurationDevelopmentView) as ConfigComponent,
  },
  {
    icon: 'mdi-map-marker-path',
    title: 'Mission',
    component: markRaw(ConfigurationMissionView) as ConfigComponent,
  },
]

const toggleConfigComponent = (component: ConfigComponent): void => {
  if (currentConfigMenuComponent.value === null) {
    currentConfigMenuComponent.value = component
    interfaceStore.setConfigModalVisibility(true)
    return
  }
  if (currentConfigMenuComponent.value === component) {
    currentConfigMenuComponent.value = null
    interfaceStore.setConfigModalVisibility(false)
    return
  }
  currentConfigMenuComponent.value = component
  interfaceStore.setConfigModalVisibility(true)
}

const isConfigModalVisible = computed(() => interfaceStore.isConfigModalVisible)

watch(isConfigModalVisible, (newVal) => {
  if (newVal === false) {
    currentConfigMenuComponent.value = null
  }
})

watch(
  () => windowHeight.value < 450,
  (isSmall: boolean) => {
    simplifiedMainMenu.value = isSmall
  }
)

const updateWindowHeight = (): void => {
  windowHeight.value = window.innerHeight
}

onMounted(() => {
  window.addEventListener('resize', updateWindowHeight)
  if (windowHeight.value < 450) {
    simplifiedMainMenu.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowHeight)
})

const mainMenuWidth = computed(() => {
  const width =
    interfaceStore.isOnSmallScreen && mainMenuStep.value === 2 ? '60px' : `${interfaceStore.mainMenuWidth}px`
  return { width }
})

const toggleMainMenu = (): void => {
  if (isMenuOpen.value === true) {
    closeMainMenu()
  } else {
    openMainMenu()
  }
}

const openMainMenu = (): void => {
  if (vehicleStore.isArmed) {
    showDialog({
      title: 'Be careful',
      maxWidth: '650px',
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
    currentConfigMenuComponent.value = null
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
  if (interfaceStore.is2xl) return 60
  if (interfaceStore.isXl) return 55
  if (interfaceStore.isLg) return 50
  if (interfaceStore.isMd) return 45
  if (interfaceStore.isSm && windowHeight.value > 700) return 50
  if (interfaceStore.isSm && windowHeight.value < 700) return 40
  if (interfaceStore.isXs && windowHeight.value >= 700) return 50
  return 40
})

const menuLabelSize = computed(() => {
  if (interfaceStore.is2xl) return 'text-[15px]'
  if (interfaceStore.isXl) return 'text-[14px]'
  if (interfaceStore.isLg) return 'text-[13px]'
  if (interfaceStore.isMd) return 'text-[12px]'
  if (interfaceStore.isSm) return 'text-[10px]'
  if (interfaceStore.isXs && windowHeight.value >= 700) return 'text-[12px]'
  return 'text-[10px]'
})

const mainMenu = ref()
onClickOutside(mainMenu, () => {
  if (mainMenuStep.value === 1) {
    closeMainMenu()
  }
  if (mainMenuStep.value === 2 && currentConfigMenuComponent.value === null) {
    closeMainMenu()
  }
})

const glassMenuStyles = computed(() => ({
  backgroundColor: interfaceStore.UIGlassEffect.bgColor,
  color: interfaceStore.UIGlassEffect.fontColor,
  backdropFilter: `blur(${interfaceStore.UIGlassEffect.blur}px)`,
}))

const openAboutDialog = (): void => {
  showAboutDialog.value = true
  closeMainMenu()
}

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

const currentSelectedViewName = computed(() => widgetStore.currentView.name)

const { width: windowWidth } = useWindowSize()

const originalBarWidth = 1800

const topBarScaleStyle = computed(() => {
  const scale = windowWidth.value / originalBarWidth
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${originalBarWidth}px`,
  }
})

const bottomBarScaleStyle = computed(() => {
  const scale = windowWidth.value / originalBarWidth
  return {
    transform: `scale(${scale})`,
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
const debouncedToggleBottomBar = useDebounceFn(() => (showBottomBarNow.value = !showBottomBarNow.value), 25)
const bottomBarToggleCallbackId = registerActionCallback(
  availableCockpitActions.toggle_bottom_bar,
  debouncedToggleBottomBar
)
const debouncedToggleTopBar = useDebounceFn(() => (showTopBarNow.value = !showTopBarNow.value), 25)
const topBarToggleCallbackId = registerActionCallback(availableCockpitActions.toggle_top_bar, debouncedToggleTopBar)
onBeforeUnmount(() => {
  unregisterActionCallback(bottomBarToggleCallbackId)
  unregisterActionCallback(topBarToggleCallbackId)
})

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
  border-radius: 0 20px 20px 0;
  border: 1px #cbcbcb22 solid;
  border-left: none;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15);
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
  top: 50%;
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
