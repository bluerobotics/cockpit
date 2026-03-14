<template>
  <div>
    <Dropdown
      v-model="currentModeTranslated"
      name-key="translatedName"
      :options="modesWithTranslation"
      class="min-w-[128px]"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Dropdown from '../Dropdown.vue'

datalogger.registerUsage(DatalogVariable.mode)
const vehicleStore = useMainVehicleStore()
const { t } = useI18n()
const currentMode = ref()
const currentModeTranslated = ref<{
  /**
cccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccc
   */
  mode: string
  /**
mmmmmmmmmmmmmm *
mmmmmmmmmmmmmm
   */
  translatedName: string
}>()

const translateModeName = (modeName: string): string => {
  // Try to find translation key for the mode
  const translationKey = `flightModes.${modeName}`
  const translated = t(translationKey)
  // Return translation if it exists and is different from the key
  return translated !== translationKey ? translated : modeName
}

const modesWithTranslation = computed(() => {
  return vehicleStore.modesAvailable().map((mode) => ({
    mode: mode,
    translatedName: translateModeName(mode),
  }))
})

watch(currentModeTranslated, (newVal) => {
  if (!newVal || currentMode.value === undefined) return
  const newMode = newVal.mode
  // Fetch the current mode directly from the store to ensure it's different
  if (newMode === vehicleStore.mode) {
    console.log('New mode is the same as the current one. No mode-change commands will be issued.')
    return
  }
  currentMode.value = newMode
  vehicleStore.setFlightMode(newMode)
})

watch(
  () => vehicleStore.mode,
  (newMode) => {
    if (newMode && currentMode.value !== newMode) {
      currentMode.value = newMode
      const modeObj = modesWithTranslation.value.find((m) => m.mode === newMode)
      if (modeObj) {
        currentModeTranslated.value = modeObj
      }
    }
  },
  { immediate: true }
)

// eslint-disable-next-line no-undef
let modeUpdateInterval: NodeJS.Timer | undefined = undefined
// Poll for mode updates since vehicleStore.mode might not be reactive in all cases
onMounted(() => {
  modeUpdateInterval = setInterval(() => {
    const newMode = vehicleStore.mode
    if (newMode && currentMode.value !== newMode) {
      currentMode.value = newMode
      const modeObj = modesWithTranslation.value.find((m) => m.mode === newMode)
      if (modeObj) {
        currentModeTranslated.value = modeObj
      }
    }
  }, 500)
})
onUnmounted(() => clearInterval(modeUpdateInterval))
</script>
