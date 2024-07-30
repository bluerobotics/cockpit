import { useWindowSize } from '@vueuse/core'
import { defineStore } from 'pinia'
import { watch } from 'vue'

import { defaultDisplayUnitPreferences } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'

const { width: windowWidth, height: windowHeight } = useWindowSize()

export const useAppInterfaceStore = defineStore('responsive', {
  state: () => ({
    width: windowWidth.value,
    height: windowHeight.value,
    configModalVisibility: false,
    UIGlassEffect: useBlueOsStorage('cockpit-ui-glass-effect', {
      opacity: 0.8,
      bgColor: '#4F4F4F1A',
      fontColor: '#FFFFFF',
      blur: 25,
    }),
    displayUnitPreferences: useBlueOsStorage('cockpit-display-unit-preferences', defaultDisplayUnitPreferences),
  }),
  actions: {
    updateWidth() {
      this.width = windowWidth.value
    },
    setConfigModalVisibility(value: boolean) {
      this.configModalVisibility = value
    },
    setUIGlassEffect(opacity: number, bgColor: string, fontColor: string, blur: number) {
      this.UIGlassEffect.opacity = opacity
      this.UIGlassEffect.bgColor = bgColor
      this.UIGlassEffect.fontColor = fontColor
      this.UIGlassEffect.blur = blur
    },
    setBgOpacity(opacity: number) {
      this.UIGlassEffect.opacity = opacity
      const hex = this.UIGlassEffect.bgColor.replace(/^#/, '').substring(0, 6)
      const alphaHex = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')
      this.UIGlassEffect.bgColor = `#${hex}${alphaHex}`
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
    getUIGlassEffect: (state) => {
      state.UIGlassEffect
    },
    globalGlassMenuStyles: (state) => ({
      backgroundColor: state.UIGlassEffect.bgColor,
      color: state.UIGlassEffect.fontColor,
      backdropFilter: `blur(${state.UIGlassEffect.blur}px)`,
      border: '1px solid rgba(255, 255, 255, 0.06)',
      boxShadow: '0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026',
    }),
  },
})

watch(windowWidth, () => {
  const store = useAppInterfaceStore()
  store.updateWidth()
})
