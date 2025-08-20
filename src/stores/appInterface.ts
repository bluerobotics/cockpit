import { useWindowSize } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { defaultDisplayUnitPreferences } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { setupPostPiniaConnection } from '@/libs/post-pinia-connections'

const { width: windowWidth, height: windowHeight } = useWindowSize()

/**
 * Available sub menus names
 */
export enum SubMenuName {
  settings = 'settings',
  tools = 'tools',
}

/**
 * Available sub menus names
 */
export enum SubMenuComponentName {
  SettingsGeneral = 'settings-general',
  SettingsInterface = 'settings-interface',
  SettingsJoystick = 'settings-joystick',
  SettingsVideo = 'settings-video',
  SettingsTelemetry = 'settings-telemetry',
  SettingsAlerts = 'settings-alerts',
  SettingsDev = 'settings-dev',
  SettingsMission = 'settings-mission',
  SettingsActions = 'settings-actions',
  SettingsDataLake = 'settings-datalake',
  SettingsMAVLink = 'settings-mavlink',
  ToolsMAVLink = 'tools-mavlink',
  ToolsDataLake = 'tools-datalake',
}

export const useAppInterfaceStore = defineStore('responsive', {
  state: () => ({
    pirateMode: useBlueOsStorage('cockpit-pirate-mode', false),
    showSkullAnimation: false,
    width: windowWidth.value,
    height: windowHeight.value,
    configModalVisibility: false,
    videoLibraryVisibility: false,
    videoLibraryMode: 'video',
    UIGlassEffect: useBlueOsStorage('cockpit-ui-glass-effect', {
      opacity: 0.9,
      bgColor: '#63636354',
      fontColor: '#FFFFFF',
      blur: 25,
    }),
    displayUnitPreferences: useBlueOsStorage('cockpit-display-unit-preferences', defaultDisplayUnitPreferences),
    mainMenuStyleTrigger: useBlueOsStorage('cockpit-main-menu-style', 'center-left'),
    componentToHighlight: 'none',
    isMainMenuVisible: false,
    mainMenuCurrentStep: 1,
    currentSubMenuName: ref<SubMenuName | null>(null),
    currentSubMenuComponentName: ref<SubMenuComponentName | null>(null),
    isGlassModalAlwaysOnTop: false,
    isTutorialVisible: false,
    isJoystickWizardVisible: false,
    userHasSeenTutorial: useBlueOsStorage('cockpit-has-seen-tutorial', false),
    configPanelVisible: false,
    showSplashScreen: true,
  }),
  actions: {
    updateWidth() {
      this.width = windowWidth.value
    },
    setBgOpacity(opacity: number) {
      this.UIGlassEffect.opacity = opacity
      const hex = this.UIGlassEffect.bgColor.replace(/^#/, '').substring(0, 6)
      const alphaHex = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')
      this.UIGlassEffect.bgColor = `#${hex}${alphaHex}`
    },
    triggerSkullAnimation() {
      this.showSkullAnimation = true
    },
    hideSkullAnimation() {
      this.showSkullAnimation = false
    },
  },
  getters: {
    isXs: (state) => state.width < 720, // Extra small devices (5-6" mobile screens in landscape)
    isSm: (state) => state.width >= 720 && state.width < 980, // Small devices (6-7" mobile screens in landscape)
    isMd: (state) => state.width >= 980 && state.width < 1280, // Medium devices (7-10" tablets in landscape)
    isLg: (state) => state.width >= 1280 && state.width < 1600, // Large devices (HD in landscape)
    isXl: (state) => state.width >= 1600 && state.width < 1920, // Extra large devices (HD+ desktop/laptop screens in landscape)
    is2xl: (state) => state.width >= 1920, // FullHD and above - Extra extra large devices
    currentWindowBreakpoint: (state) => {
      if (state.width < 720) return 'xs'
      if (state.width >= 720 && state.width < 980) return 'sm'
      if (state.width >= 980 && state.width < 1280) return 'md'
      if (state.width >= 1280 && state.width < 1600) return 'lg'
      if (state.width >= 1600 && state.width < 1920) return 'xl'
      if (state.width >= 1920) return '2xl'
    },
    currentWindowSize: (state) => `${state.width} x ${state.height}`,
    isOnSmallScreen: (state) => state.width < 1280,
    isOnPhoneScreen: (state) => state.width < 600,
    isOnVeryLargeScreen: (state) => state.width > 1920,
    mainMenuWidth: (state) => {
      if (state.width < 720) return 78
      if (state.width >= 720 && state.width < 980) return 95
      if (state.width >= 980 && state.width < 1280) return 95
      if (state.width >= 1280 && state.width < 1600) return 102
      if (state.width >= 1600 && state.width < 1920) return 121
      return 130
    },
    isConfigModalVisible: (state) => state.configModalVisibility,
    isVideoLibraryVisible: (state) => state.videoLibraryVisibility,
    getUIGlassEffect: (state) => {
      state.UIGlassEffect
    },
    globalGlassMenuStyles: (state) => ({
      backgroundColor: state.UIGlassEffect.bgColor,
      color: state.UIGlassEffect.fontColor,
      backdropFilter: `blur(${state.UIGlassEffect.blur}px)`,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0px 4px 4px 0px #00000033, 0px 8px 12px 6px #00000016',
    }),
    highlightedComponent: (state) => state.componentToHighlight,
    globalGlassMenuHighlightStyles: (state) => ({
      backgroundColor: state.UIGlassEffect.bgColor,
      color: state.UIGlassEffect.fontColor,
      backdropFilter: `blur(${state.UIGlassEffect.blur}px)`,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0px 4px 4px 0px #00000033, 0px 8px 12px 6px #00000016',
      animation: 'highlightBackground 0.5s alternate 20',
    }),
    isConfigPanelVisible: (state) => state.configPanelVisible,
  },
})

watch(windowWidth, () => {
  const store = useAppInterfaceStore()
  store.updateWidth()
})

// Watch for pirate mode changes and trigger skull animation
setupPostPiniaConnection(() => {
  const store = useAppInterfaceStore()
  watch(
    () => {
      return store.pirateMode
    },
    (newValue, oldValue) => {
      const pirateModeEnabled = newValue === true && oldValue === false
      // Only trigger animation when pirate mode changes from false to true
      if (pirateModeEnabled) {
        console.log('Pirate mode enabled.')
        store.triggerSkullAnimation()
      }
    }
  )
})
