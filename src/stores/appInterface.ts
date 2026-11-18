import { useWindowSize } from '@vueuse/core'
import { defineStore } from 'pinia'
import { watch } from 'vue'

import { defaultDisplayUnitPreferences, defaultUIGlassColor } from '@/assets/defaults'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { glassToneFilterId, glassToneTable } from '@/libs/glass-tone'
import { setupPostPiniaConnection } from '@/libs/post-pinia-connections'
import {
  type DisplayUnitPreferences,
  preferencesFromSingleDistance,
  unitAbbreviation,
  unitSystemFromPreferences,
} from '@/libs/units'

const { width: windowWidth, height: windowHeight } = useWindowSize()

// Chromium is the only engine that renders an SVG reference filter inside `backdrop-filter`
const adaptiveGlassSupported = /Chrome\//.test(navigator.userAgent)

// Settings stored before a glass field existed lack it, so every read goes through this merge
const withGlassDefaults = (effect: Partial<typeof defaultUIGlassColor>): typeof defaultUIGlassColor => ({
  ...defaultUIGlassColor,
  ...effect,
})

const isAdaptiveGlassActive = (effect: typeof defaultUIGlassColor): boolean =>
  adaptiveGlassSupported && effect.adaptiveColors

/**
 * Backdrop filter for glass surfaces. Adaptive glass caps how bright the scenery behind can show, per pixel and every
 * frame, so dark scenery stays see-through while bright scenery reads as a dark panel.
 * @param {typeof defaultUIGlassColor} effect The stored glass effect settings
 * @param {number} blurPx Blur radius, for surfaces that blur more or less than the glass setting
 * @returns {string} The CSS `backdrop-filter` value
 */
const glassBackdropFilter = (effect: typeof defaultUIGlassColor, blurPx = effect.blur): string => {
  const blur = `blur(${blurPx}px)`
  if (!isAdaptiveGlassActive(effect)) return blur
  return `${blur} url(#${glassToneFilterId(effect.adaptiveLevel, effect.adaptiveSensitivity)})`
}

// Adaptive glass does the darkening itself, so the tint drops to a light veil of the glass color
const glassBackground = (effect: typeof defaultUIGlassColor): string =>
  isAdaptiveGlassActive(effect) ? `${effect.bgColor.substring(0, 7)}14` : effect.bgColor

export const useAppInterfaceStore = defineStore('responsive', {
  state: () => ({
    pirateMode: useBlueOsStorage('cockpit-pirate-mode', false),
    showSkullAnimation: false,
    width: windowWidth.value,
    height: windowHeight.value,
    videoLibraryVisibility: false,
    videoLibraryMode: 'videos',
    missionLibraryVisibility: false,
    UIGlassEffect: useBlueOsStorage('cockpit-ui-glass-effect', {
      opacity: 0.9,
      bgColor: '#63636354',
      fontColor: '#FFFFFF',
      blur: 25,
      adaptiveColors: true,
      adaptiveLevel: 0.6,
      adaptiveSensitivity: 0.5,
    }),
    releasedDisplayUnitPreferences: useBlueOsStorage('cockpit-display-unit-preferences', {
      distance: defaultDisplayUnitPreferences.distance,
    } as Partial<DisplayUnitPreferences>),
    // Kept apart from the key released Cockpits read, which would fail on a distance in nautical miles.
    storedDisplayUnitPreferences: useBlueOsStorage(
      'cockpit-display-unit-preferences-v2',
      {} as Partial<DisplayUnitPreferences>
    ),
    mainMenuStyleTrigger: useBlueOsStorage('cockpit-main-menu-style', 'center-left'),
    componentToHighlight: 'none',
    isMainMenuVisible: false,
    isMainMenuSimplified: false,
    mainMenuCurrentStep: 1,
    isGlassModalAlwaysOnTop: false,
    isTutorialVisible: false,
    isExternalFeaturesModalVisible: false,
    isDataPrivacyModalVisible: false,
    isVehicleDefaultsAutoImportModalVisible: false,
    isVehicleDefaultsViewsImportModalVisible: false,
    isVehicleDefaultsJoystickImportModalVisible: false,
    isJoystickStickModeModalVisible: false,
    userHasSeenTutorial: useBlueOsStorage('cockpit-has-seen-tutorial', false),
    configPanelVisible: false,
    showSplashScreen: true,
    // One-shot request (consumed on mount) asking the Map tools view to expand its "Custom map providers"
    // panel, e.g. when reached via the map layer selector's "Add map provider" action.
    mapCustomProvidersExpandRequested: false,
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
    openVehicleDefaultsAutoImport(): void {
      this.isVehicleDefaultsAutoImportModalVisible = true
    },
    openVehicleDefaultsViewsImport(): void {
      this.isVehicleDefaultsViewsImportModalVisible = true
    },
    openVehicleDefaultsJoystickImport(): void {
      this.isVehicleDefaultsJoystickImportModalVisible = true
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
    isOnSmallScreen: (state) => state.width <= 1280,
    isOnPhoneScreen: (state) => state.width < 600,
    isOnVeryLargeScreen: (state) => state.width > 1920,
    // Mirrors the scale `WidgetBar` actually applies to the top/bottom bars on small screens, so overlays can
    // align with the rendered bar height (not the logical 48px) from a single source of truth.
    renderedBarScale: (state) => (state.width <= 1280 ? state.width / 1800 : 1),
    // Width the main menu actually renders, which narrows to icons with short labels when the buttons stop fitting
    // the visible height, and to a single column for the submenu.
    mainMenuRenderedWidth(state): number {
      if (state.isMainMenuSimplified) return 56
      if (state.mainMenuCurrentStep === 2) return 60
      return 79
    },
    isVideoLibraryVisible: (state) => state.videoLibraryVisibility,
    isMissionLibraryVisible: (state) => state.missionLibraryVisibility,
    getUIGlassEffect: (state) => {
      state.UIGlassEffect
    },
    isAdaptiveGlassSupported: () => adaptiveGlassSupported,
    glassEffect: (state) => withGlassDefaults(state.UIGlassEffect),
    isAdaptiveGlassActive: (state) => isAdaptiveGlassActive(withGlassDefaults(state.UIGlassEffect)),
    globalGlassMenuStyles: (state) => ({
      backgroundColor: glassBackground(withGlassDefaults(state.UIGlassEffect)),
      color: state.UIGlassEffect.fontColor,
      backdropFilter: glassBackdropFilter(withGlassDefaults(state.UIGlassEffect)),
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0px 4px 4px 0px #00000033, 0px 8px 12px 6px #00000016',
    }),
    // For surfaces styled from CSS, such as Leaflet markers and pseudo-elements, which cannot take a style binding
    glassMenuCssVars(): Record<string, string> {
      const styles = this.globalGlassMenuStyles
      return {
        '--glass-background': styles.backgroundColor,
        '--glass-filter': styles.backdropFilter,
        '--glass-border': styles.border,
        '--glass-color': styles.color,
        '--glass-box-shadow': styles.boxShadow,
      }
    },
    glassToneFilter: (state) => {
      const { adaptiveLevel: level, adaptiveSensitivity: sensitivity } = withGlassDefaults(state.UIGlassEffect)
      return { id: glassToneFilterId(level, sensitivity), table: glassToneTable(level, sensitivity) }
    },
    // Softer than a menu's own blur, so a dialog scrim still reads as the page behind it rather than as frosted glass
    dialogBackdropStyles: (state) => {
      const effect = withGlassDefaults(state.UIGlassEffect)
      return { '--glass-filter': glassBackdropFilter(effect, effect.blur * 0.315) }
    },
    glassBackdropFilterWithBlur: (state) => (blurPx: number) =>
      glassBackdropFilter(withGlassDefaults(state.UIGlassEffect), blurPx),
    highlightedComponent: (state) => state.componentToHighlight,
    globalGlassMenuHighlightStyles: (state) => ({
      backgroundColor: glassBackground(withGlassDefaults(state.UIGlassEffect)),
      color: state.UIGlassEffect.fontColor,
      backdropFilter: glassBackdropFilter(withGlassDefaults(state.UIGlassEffect)),
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0px 4px 4px 0px #00000033, 0px 8px 12px 6px #00000016',
      animation: 'highlightBackground 0.5s alternate 20',
    }),
    isConfigPanelVisible: (state) => state.configPanelVisible,
    // A preference stored before a quantity was offered carries no unit for it, and arrives that way
    // again every time a vehicle running an older Cockpit syncs its settings over. Filling the gaps
    // here rather than writing them back keeps the stored key exactly as the user left it.
    displayUnitPreferences: (state): DisplayUnitPreferences => ({
      ...defaultDisplayUnitPreferences,
      ...preferencesFromSingleDistance(state.releasedDisplayUnitPreferences),
      ...state.storedDisplayUnitPreferences,
    }),
  },
})

watch(windowWidth, () => {
  const store = useAppInterfaceStore()
  store.updateWidth()
})

// Actions and widgets that show a value themselves have to know how the user reads it, so the
// choice is published where they can reach it.
setupPostPiniaConnection(() => {
  const store = useAppInterfaceStore()
  watch(
    () => store.displayUnitPreferences,
    (units) => {
      const unitVariables = [
        { id: 'UNITS/displayPreference', name: 'Unit system in use', value: unitSystemFromPreferences(units) },
        { id: 'UNITS/distance', name: 'Distance unit in use', value: unitAbbreviation[units.distance] },
        { id: 'UNITS/depth', name: 'Depth unit in use', value: unitAbbreviation[units.depth] },
        { id: 'UNITS/altitude', name: 'Altitude unit in use', value: unitAbbreviation[units.altitude] },
        { id: 'UNITS/area', name: 'Area unit in use', value: unitAbbreviation[units.area] },
        {
          id: 'UNITS/smallDistance',
          name: 'Unit in use for distances under 1 nmi',
          value: unitAbbreviation[units.smallDistance],
        },
        { id: 'UNITS/smallArea', name: 'Unit in use for areas under 1 nmi²', value: unitAbbreviation[units.smallArea] },
        { id: 'UNITS/speed', name: 'Speed unit in use', value: unitAbbreviation[units.speed] },
        { id: 'UNITS/temperature', name: 'Temperature unit in use', value: unitAbbreviation[units.temperature] },
        { id: 'UNITS/pressure', name: 'Pressure unit in use', value: unitAbbreviation[units.pressure] },
      ]

      unitVariables.forEach(({ id, name, value }) => {
        if (getDataLakeVariableInfo(id) === undefined) {
          createDataLakeVariable({ id, name, type: 'string', description: 'The unit values are shown in.' })
        }
        setDataLakeVariableData(id, value)
      })
    },
    { immediate: true }
  )
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
