<template>
  <transition name="slide-in-left" @after-enter="attachScrollListener">
    <div
      v-if="interfaceStore.isMainMenuVisible"
      ref="mainMenu"
      class="left-menu slide-in"
      :style="[glassMenuStyles, simplifiedMainMenu ? { width: '45px', borderRadius: '0 10px 10px 0' } : mainMenuWidth]"
    >
      <v-window v-model="interfaceStore.mainMenuCurrentStep" class="h-full w-full">
        <v-window-item :value="1" class="h-full">
          <div
            ref="scrollContainerRef"
            class="relative flex flex-col max-h-[95vh] w-full overflow-y-auto scrollbar-hide"
          >
            <div
              class="h-full justify-between align-center items-center select-none"
              :class="
                interfaceStore.isOnSmallScreen
                  ? 'gap-y-0 pt-2 pb-3 sm:sm:py-0 sm:-ml-[3px] xs:xs:py-0 xs:-ml-[3px]'
                  : 'lg:gap-y-2 xl:gap-y-3 gap-y-4 py-4'
              "
            >
              <GlassButton
                v-if="route.name === 'widgets-view'"
                :label="simplifiedMainMenu ? '' : 'Edit Interface'"
                :selected="widgetStore.editingMode"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-pencil' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'Edit Mode' : undefined"
                :width="buttonSize"
                @click="
                  () => {
                    widgetStore.editingMode = !widgetStore.editingMode
                    handleCloseMainMenu()
                  }
                "
                ><img v-if="!simplifiedMainMenu" :src="EditModeIcon" alt="Edit Mode Icon" />
              </GlassButton>
              <GlassButton
                v-if="route.name !== 'widgets-view'"
                :label="simplifiedMainMenu ? '' : 'Flight'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-send' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'Flight' : undefined"
                :width="buttonSize"
                :selected="$route.name === 'Flight'"
                @click="
                  () => {
                    $router.push('/')
                    handleCloseMainMenu()
                  }
                "
                ><img v-if="!simplifiedMainMenu" :src="FlightIcon" alt="Flight Icon" />
              </GlassButton>
              <GlassButton
                v-if="route.name !== 'Mission planning'"
                :label="simplifiedMainMenu ? '' : 'Mission Planning'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-map-marker-radius-outline' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'Mission Planning' : undefined"
                :width="buttonSize"
                :selected="$route.name === 'Mission planning'"
                @click="
                  () => {
                    $router.push('/mission-planning')
                    handleCloseMainMenu()
                  }
                "
                ><img v-if="!simplifiedMainMenu" :src="MissionPlanningIcon" alt="MissionPlanning Icon" />
              </GlassButton>
              <GlassButton
                :label="simplifiedMainMenu ? '' : 'Settings'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-cog' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'Configuration' : undefined"
                :width="buttonSize"
                :selected="showSubMenu"
                class="mb-1"
                :style="
                  interfaceStore.highlightedComponent === 'settings-menu-item' && {
                    animation: 'highlightBackground 0.5s alternate 20',
                    borderRadius: '10px',
                  }
                "
                @click="selectSubMenu(SubMenuName.settings)"
                ><img v-if="!simplifiedMainMenu" :src="SettingsIcon" alt="Settings Icon" />
              </GlassButton>
              <GlassButton
                :label="simplifiedMainMenu ? '' : 'Tools'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-tools' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'Tools' : undefined"
                :width="buttonSize"
                :selected="showSubMenu"
                class="mb-1"
                @click="selectSubMenu(SubMenuName.tools)"
                ><img v-if="!simplifiedMainMenu" :src="ToolsIcon" alt="Tools Icon" />
              </GlassButton>
              <GlassButton
                :label="simplifiedMainMenu ? '' : isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? fullScreenToggleIcon : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? (isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen') : undefined"
                :button-class="simplifiedMainMenu ? '-mb-2' : ''"
                :width="buttonSize"
                :selected="false"
                @click="
                  () => {
                    toggleFullscreen()
                    handleCloseMainMenu()
                  }
                "
                ><img
                  v-if="!simplifiedMainMenu"
                  :src="isFullscreen ? ExitFullScreenIcon : FullScreenIcon"
                  alt="Fullscreen Icon"
                />
              </GlassButton>
              <GlassButton
                :label="simplifiedMainMenu ? '' : 'About'"
                :label-class="[menuLabelSize, '-mb-0.5 mt-6']"
                :icon="simplifiedMainMenu ? 'mdi-information-outline' : undefined"
                :icon-size="simplifiedMainMenu ? 25 : undefined"
                variant="uncontained"
                :tooltip="simplifiedMainMenu ? 'About' : undefined"
                :button-class="!simplifiedMainMenu ? '-mt-[5px]' : undefined"
                :width="buttonSize"
                :selected="showSubMenu"
                @click="openAboutDialog"
                ><img v-if="!simplifiedMainMenu" :src="InfoIcon" alt="Info Icon" />
              </GlassButton>
            </div>
          </div>
        </v-window-item>
        <v-window-item :value="2" class="h-full w-full">
          <div
            ref="subMenuScrollContainerRef"
            class="flex flex-col w-full max-h-[95vh] justify-between overflow-y-auto scrollbar-hide"
          >
            <GlassButton
              v-for="menuitem in currentSubMenu"
              :key="menuitem.title"
              :label="simplifiedMainMenu ? undefined : menuitem.title"
              :label-class="menuLabelSize"
              :button-class="interfaceStore.isOnSmallScreen ? '-ml-[2px]' : ''"
              :icon="menuitem.icon"
              :selected="interfaceStore.currentSubMenuComponentName === menuitem.componentName"
              variant="uncontained"
              :height="buttonSize * 0.45"
              :icon-size="buttonSize * 0.5"
              :style="
                interfaceStore.highlightedComponent === menuitem.title && {
                  animation: 'highlightBackground 0.5s alternate 50',
                  borderRadius: '4px',
                }
              "
              @click="toggleSubMenuComponent(menuitem.component)"
              ><template #content>
                <div v-if="currentSubMenuComponent === menuitem.component" class="arrow-left"></div>
              </template>
            </GlassButton>
            <div class="flex flex-col justify-center align-center pb-1">
              <v-divider width="70%" />
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
                    interfaceStore.mainMenuCurrentStep = 1
                    currentSubMenuComponentRef = null
                  }
                "
              />
            </div>
          </div>
        </v-window-item>
      </v-window>
      <div v-if="hasOverflow" class="overflow-indicator">
        <v-icon class="overflow-icon -mt-[11px]" :style="{ opacity: isScrolledToTop ? 0 : 1 }">
          mdi-arrow-up-bold
        </v-icon>
        <v-icon class="overflow-icon -mb-[11px]" :style="{ opacity: isScrolledToBottom ? 0 : 1 }">
          mdi-arrow-down-bold
        </v-icon>
      </div>
    </div>
  </transition>
</template>
<script setup lang="ts">
import { onClickOutside, useDebounceFn, useFullscreen, useResizeObserver, useWindowSize } from '@vueuse/core'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import EditModeIcon from '@/assets/icons/edit-mode.svg'
import ExitFullScreenIcon from '@/assets/icons/exit-full-screen.svg'
import FlightIcon from '@/assets/icons/flight.svg'
import FullScreenIcon from '@/assets/icons/full-screen.svg'
import InfoIcon from '@/assets/icons/info.svg'
import MissionPlanningIcon from '@/assets/icons/mission-planning.svg'
import SettingsIcon from '@/assets/icons/settings.svg'
import ToolsIcon from '@/assets/icons/tools.svg'
import GlassButton from '@/components/GlassButton.vue'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { SubMenuComponentName, SubMenuName, useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { SubMenuComponent } from '@/types/general'
import ConfigurationActionsView from '@/views/ConfigurationActionsView.vue'
import ConfigurationAlertsView from '@/views/ConfigurationAlertsView.vue'
import ConfigurationDevelopmentView from '@/views/ConfigurationDevelopmentView.vue'
import ConfigurationGeneralView from '@/views/ConfigurationGeneralView.vue'
import ConfigurationJoystickView from '@/views/ConfigurationJoystickView.vue'
import ConfigurationTelemetryView from '@/views/ConfigurationLogsView.vue'
import ConfigurationMAVLinkView from '@/views/ConfigurationMAVLinkView.vue'
import ConfigurationMissionView from '@/views/ConfigurationMissionView.vue'
import ConfigurationUIView from '@/views/ConfigurationUIView.vue'
import ConfigurationVideoView from '@/views/ConfigurationVideoView.vue'
import ToolsDataLakeView from '@/views/ToolsDataLakeView.vue'
import ToolsMAVLinkView from '@/views/ToolsMAVLinkView.vue'

const route = useRoute()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const { width: windowWidth, height: windowHeight } = useWindowSize()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

/**
 * Main menu component
 */
interface Props {
  /**
   * The current sub-menu component to be displayed.
   */
  currentSubMenuComponent: SubMenuComponent | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:currentSubMenuComponent', value: SubMenuComponent | null): void
  (event: 'closeMainMenu'): void
  (event: 'openAboutDialog'): void
}>()

const currentSubMenuComponentRef = computed({
  get: () => props.currentSubMenuComponent,
  set: (val: SubMenuComponent | null) => emit('update:currentSubMenuComponent', val),
})

const showSubMenu = ref(false)
const mainMenu = ref<HTMLElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
const subMenuScrollContainerRef = ref<HTMLElement | null>(null)

const containerRectMain = ref({ width: 0, height: 0 })
const containerRectSub = ref({ width: 0, height: 0 })
const isScrolledToTop = ref(true)
const isScrolledToBottom = ref(false)

const originalBarWidth = 1800
const LOWER_RATIO = 1.4
const UPPER_RATIO = 1.2

const simplifiedMainMenu = ref(false)

const mainMenuHasOverflow = computed(() => {
  let height
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  height = windowHeight.value
  if (scrollContainerRef.value) {
    return scrollContainerRef.value.scrollHeight > scrollContainerRef.value.clientHeight
  }
  return false
})

const subMenuHasOverflow = computed(() => {
  let height
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  height = windowHeight.value
  if (subMenuScrollContainerRef.value) {
    return subMenuScrollContainerRef.value.scrollHeight > subMenuScrollContainerRef.value.clientHeight
  }
  return false
})

const hasOverflow = computed(() => {
  return interfaceStore.mainMenuCurrentStep === 1 ? mainMenuHasOverflow.value : subMenuHasOverflow.value
})

useResizeObserver(scrollContainerRef, (entries) => {
  if (entries.length) {
    containerRectMain.value = {
      width: entries[0].contentRect.width,
      height: entries[0].contentRect.height,
    }
  }
})

useResizeObserver(subMenuScrollContainerRef, (entries) => {
  if (entries.length) {
    containerRectSub.value = {
      width: entries[0].contentRect.width,
      height: entries[0].contentRect.height,
    }
  }
})

const activeContainerRect = computed(() => {
  return interfaceStore.mainMenuCurrentStep === 1 ? containerRectMain.value : containerRectSub.value
})

const topBottomBarScale = computed(() => {
  return windowWidth.value / originalBarWidth
})

const maxScreenHeightPixelsThatFitsLargeMenu = computed(() => {
  const heightTopBar = widgetStore.currentTopBarHeightPixels * topBottomBarScale.value
  const heightBottomBar = widgetStore.currentBottomBarHeightPixels * topBottomBarScale.value
  const visibleAreaHeight = windowHeight.value - heightTopBar - heightBottomBar
  return visibleAreaHeight
})

const shouldSimplifyMainMEnu = computed(() => {
  return maxScreenHeightPixelsThatFitsLargeMenu.value > activeContainerRect.value.height
})

watchEffect(() => {
  const ratio = (activeContainerRect.value.height * 2) / maxScreenHeightPixelsThatFitsLargeMenu.value
  if (!shouldSimplifyMainMEnu.value && ratio > LOWER_RATIO) {
    simplifiedMainMenu.value = true
  } else if (shouldSimplifyMainMEnu.value && ratio * 0.8 < UPPER_RATIO) {
    simplifiedMainMenu.value = false
  }
})

const configMenu = computed(() => {
  const menusToShow = [
    {
      icon: 'mdi-view-dashboard-variant',
      title: 'General',
      componentName: SubMenuComponentName.SettingsGeneral,
      component: markRaw(ConfigurationGeneralView) as SubMenuComponent,
    },
    {
      icon: 'mdi-monitor-cellphone',
      title: 'Interface',
      componentName: SubMenuComponentName.SettingsInterface,
      component: markRaw(ConfigurationUIView) as SubMenuComponent,
    },
    {
      icon: 'mdi-controller',
      title: 'Joystick',
      componentName: SubMenuComponentName.SettingsJoystick,
      component: markRaw(ConfigurationJoystickView) as SubMenuComponent,
    },
    {
      icon: 'mdi-video',
      title: 'Video',
      componentName: SubMenuComponentName.SettingsVideo,
      component: markRaw(ConfigurationVideoView) as SubMenuComponent,
    },
    {
      icon: 'mdi-subtitles-outline',
      title: 'Telemetry',
      componentName: SubMenuComponentName.SettingsTelemetry,
      component: markRaw(ConfigurationTelemetryView) as SubMenuComponent,
    },
    {
      icon: 'mdi-alert-rhombus-outline',
      title: 'Alerts',
      componentName: SubMenuComponentName.SettingsAlerts,
      component: markRaw(ConfigurationAlertsView) as SubMenuComponent,
    },
    {
      icon: 'mdi-dev-to',
      title: 'Dev',
      componentName: SubMenuComponentName.SettingsDev,
      component: markRaw(ConfigurationDevelopmentView) as SubMenuComponent,
    },
    {
      icon: 'mdi-map-marker-path',
      title: 'Mission',
      componentName: SubMenuComponentName.SettingsMission,
      component: markRaw(ConfigurationMissionView) as SubMenuComponent,
    },
    {
      icon: 'mdi-run-fast',
      title: 'Actions',
      componentName: SubMenuComponentName.SettingsActions,
      component: markRaw(ConfigurationActionsView) as SubMenuComponent,
    },
  ]

  if (interfaceStore.pirateMode) {
    menusToShow.push({
      icon: 'mdi-protocol',
      title: 'MAVLink',
      componentName: SubMenuComponentName.SettingsMAVLink,
      component: markRaw(ConfigurationMAVLinkView) as SubMenuComponent,
    })
  }
  return menusToShow
})

const toolsMenu = computed(() => {
  const menusToShow = [
    {
      icon: 'mdi-protocol',
      title: 'MAVLink',
      componentName: SubMenuComponentName.ToolsMAVLink,
      component: markRaw(ToolsMAVLinkView) as SubMenuComponent,
    },
    {
      icon: 'mdi-database-outline',
      title: 'Data-lake',
      componentName: SubMenuComponentName.ToolsDataLake,
      component: markRaw(ToolsDataLakeView) as SubMenuComponent,
    },
  ]

  if (interfaceStore.pirateMode) {
    // Add pirate-mode specific tools here
  }

  return menusToShow
})

const selectSubMenu = (subMenuName: SubMenuName): void => {
  interfaceStore.currentSubMenuName = subMenuName
  interfaceStore.mainMenuCurrentStep = 2
}

const toggleSubMenuComponent = (component: SubMenuComponent): void => {
  if (currentSubMenuComponentRef.value === null) {
    currentSubMenuComponentRef.value = component
    interfaceStore.configModalVisibility = true
    return
  }
  if (currentSubMenuComponentRef.value === component) {
    currentSubMenuComponentRef.value = null
    interfaceStore.configModalVisibility = false
    return
  }
  currentSubMenuComponentRef.value = component
  interfaceStore.configModalVisibility = true
}

const mainMenuWidth = computed(() => {
  const width =
    interfaceStore.isOnSmallScreen && interfaceStore.mainMenuCurrentStep === 2
      ? '60px'
      : `${interfaceStore.mainMenuWidth}px`
  return { width }
})

const buttonSize = computed(() => {
  if (interfaceStore.is2xl) return 72
  if (interfaceStore.isXl) return 66
  if (interfaceStore.isLg) return 60
  if (interfaceStore.isMd) return 54
  if (interfaceStore.isSm && windowHeight.value > 700) return 60
  if (interfaceStore.isSm && windowHeight.value < 700) return 48
  if (interfaceStore.isXs && windowHeight.value >= 700) return 60
  return 48
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

const glassMenuStyles = computed(() => ({
  backgroundColor: interfaceStore.UIGlassEffect.bgColor,
  color: interfaceStore.UIGlassEffect.fontColor,
  backdropFilter: `blur(${interfaceStore.UIGlassEffect.blur}px)`,
}))

const handleScroll = (): void => {
  const scrollContainer =
    interfaceStore.mainMenuCurrentStep === 1 ? scrollContainerRef.value : subMenuScrollContainerRef.value
  if (scrollContainer) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer
    isScrolledToTop.value = scrollTop === 0
    isScrolledToBottom.value = scrollTop + clientHeight >= scrollHeight
  }
}

const attachScrollListener = (): void => {
  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.removeEventListener('scroll', handleScroll)
    }
    if (subMenuScrollContainerRef.value) {
      subMenuScrollContainerRef.value.removeEventListener('scroll', handleScroll)
    }
    const activeContainer =
      interfaceStore.mainMenuCurrentStep === 1 ? scrollContainerRef.value : subMenuScrollContainerRef.value
    if (activeContainer) {
      activeContainer.addEventListener('scroll', handleScroll)
      handleScroll()
    }
  })
}

onMounted(() => {
  attachScrollListener()
})

watch(windowHeight, () => {
  nextTick(() => {
    handleScroll()
  })
})

watch(
  () => interfaceStore.mainMenuCurrentStep,
  () => {
    attachScrollListener()
  }
)

const handleCloseMainMenu = (): void => {
  emit('closeMainMenu')
}

const openAboutDialog = (): void => {
  emit('closeMainMenu')
  emit('openAboutDialog')
}

const debouncedToggleFullScreen = useDebounceFn(() => toggleFullscreen(), 10)

const fullScreenCallbackId = registerActionCallback(
  availableCockpitActions.toggle_full_screen,
  debouncedToggleFullScreen
)

const availableSubMenus = computed(() => {
  return {
    settings: configMenu.value,
    tools: toolsMenu.value,
  }
})

const currentSubMenu = computed(() => {
  if (interfaceStore.currentSubMenuName === null) return []
  return availableSubMenus.value[interfaceStore.currentSubMenuName]
})

onClickOutside(mainMenu, () => {
  if (interfaceStore.mainMenuCurrentStep === 1 && !interfaceStore.isTutorialVisible) {
    emit('closeMainMenu')
  }
  if (
    interfaceStore.mainMenuCurrentStep === 2 &&
    currentSubMenuComponentRef.value === null &&
    !interfaceStore.isTutorialVisible
  ) {
    emit('closeMainMenu')
  }
})

watch(
  () => interfaceStore.currentSubMenuComponentName,
  (subMenuComponentName) => {
    currentSubMenuComponentRef.value =
      currentSubMenu.value.find((item) => item.componentName === subMenuComponentName)?.component || null
  }
)

onBeforeUnmount(() => {
  unregisterActionCallback(fullScreenCallbackId)
  if (scrollContainerRef.value) {
    scrollContainerRef.value.removeEventListener('scroll', handleScroll)
  }
  if (subMenuScrollContainerRef.value) {
    subMenuScrollContainerRef.value.removeEventListener('scroll', handleScroll)
  }
})

onMounted(() => {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.addEventListener('scroll', handleScroll)
    handleScroll()
  }
  if (subMenuScrollContainerRef.value) {
    subMenuScrollContainerRef.value.addEventListener('scroll', handleScroll)
    handleScroll()
  }
})

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-overscan'))
</script>
<style scoped>
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

.overflow-indicator {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 1px;
  bottom: 0;
  opacity: 0.9;
  z-index: 9999;
  margin-left: 40px;
}

.overflow-icon {
  color: white;
  font-size: 18px;
  margin-left: -30px;
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
</style>
