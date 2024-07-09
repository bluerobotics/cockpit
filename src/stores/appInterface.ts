import { useWindowSize } from '@vueuse/core'
import { defineStore } from 'pinia'
import { watch } from 'vue'

const { width: windowWidth } = useWindowSize()

export const useAppInterfaceStore = defineStore('responsive', {
  state: () => ({
    width: windowWidth.value,
    configModalVisibility: false,
  }),
  actions: {
    updateWidth() {
      this.width = windowWidth.value
    },
    setConfigModalVisibility(value: boolean) {
      this.configModalVisibility = value
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
    currentWindowSize: (state) => `${state.width} x ${window.innerHeight}`,
    isOnSmallScreen: (state) => state.width < 1280,
    isOnPhoneScreen: (state) => state.width < 600,
    mainMenuWidth: (state) => {
      if (state.width < 720) return 78
      if (state.width >= 720 && state.width < 980) return 95
      if (state.width >= 980 && state.width < 1280) return 95
      if (state.width >= 1280 && state.width < 1600) return 102
      if (state.width >= 1600 && state.width < 1920) return 121
      return 130
    },
    isConfigModalVisible: (state) => state.configModalVisibility,
  },
})

watch(windowWidth, (newWidth) => {
  const store = useAppInterfaceStore()
  store.width = newWidth
})
