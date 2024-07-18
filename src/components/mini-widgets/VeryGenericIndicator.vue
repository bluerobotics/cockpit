<template>
  <div class="flex items-center justify-center h-12 py-1 mx-1 text-white transition-all w-[7rem]">
    <span class="relative w-[2rem] mdi icon-symbol text-[32px]" :class="[miniWidget.options.iconName]"></span>
    <div class="flex flex-col items-start justify-center ml-1 select-none w-[4.75rem]">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ parsedState }}</span>
        <span class="text-xl font-semibold leading-6 w-fit">
          {{ String.fromCharCode(0x20) }} {{ miniWidget.options.variableUnit }}
        </span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">{{ miniWidget.options.displayName }}</span>
    </div>
  </div>
  <v-dialog
    v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen"
    persistent
    class="w-[100vw] flex justify-center items-center"
  >
    <v-card class="p-8 configModal">
      <div class="close-icon mdi mdi-close" @click.stop="closeDialog"></div>
      <v-card-title class="text-white">
        <div class="flex items-center mb-3 mt-[-5px] justify-evenly">
          <div
            class="px-3 py-1 transition-all rounded-md cursor-pointer select-none text-slate-100 hover:bg-slate-400"
            :class="{ 'bg-slate-400': currentTab === 'presets' }"
            @click="currentTab = 'presets'"
          >
            Presets
          </div>
          <div
            class="px-3 py-1 transition-all rounded-md cursor-pointer select-none text-slate-100 hover:bg-slate-400"
            :class="{ 'bg-slate-400': currentTab === 'custom' }"
            @click="currentTab = 'custom'"
          >
            Custom
          </div>
        </div>
      </v-card-title>

      <div v-if="currentTab === 'custom'" class="flex flex-col items-center justify-around">
        <div class="flex flex-col items-center justify-between w-full mt-3">
          <span class="w-full mb-1 text-sm text-slate-100/50">Display name</span>
          <input v-model="miniWidget.options.displayName" class="w-full px-2 py-1 rounded-md bg-slate-200" />
        </div>
        <div class="flex flex-col items-center justify-between w-full mt-3">
          <span class="w-full mb-1 text-sm text-slate-100/50">Variable</span>
          <div class="relative w-full">
            <button
              class="w-full py-1 pl-2 pr-8 text-left transition-all rounded-md bg-slate-200 hover:bg-slate-400"
              @click="showVariableChooseModal = !showVariableChooseModal"
            >
              <p class="text-ellipsis overflow-x-clip">
                {{ miniWidget.options.variableName || 'Click to choose...' }}
              </p>
            </button>
            <span
              class="absolute right-0.5 m-1 text-2xl -translate-y-1 cursor-pointer text-slate-500 mdi mdi-swap-horizontal-bold"
            />
          </div>
        </div>
        <Transition>
          <div v-if="showVariableChooseModal" class="flex flex-col justify-center w-full mx-1 my-3 align-center">
            <input
              v-model="variableNameSearchString"
              placeholder="Search variable..."
              class="w-full px-2 py-1 rounded-md bg-slate-200"
            />
            <div class="grid w-full h-32 grid-cols-1 my-2 overflow-x-hidden overflow-y-scroll">
              <span
                v-for="(variable, i) in variableNamesToShow"
                :key="i"
                class="h-8 p-1 m-1 overflow-x-hidden text-white transition-all rounded-md cursor-pointer select-none bg-slate-700 hover:bg-slate-400/20"
                @click="chooseVariable(variable)"
              >
                {{ variable }}
              </span>
            </div>
          </div>
        </Transition>
        <div class="flex items-center justify-between w-full mt-2">
          <div class="flex flex-col items-center justify-between w-full mx-5">
            <span class="w-full mb-1 text-sm text-slate-100/50">Unit</span>
            <input v-model="miniWidget.options.variableUnit" class="w-full px-2 py-1 rounded-md bg-slate-200" />
          </div>
          <div class="flex flex-col items-center justify-between w-full mx-5">
            <span class="w-full mb-1 text-sm text-slate-100/50">Multiplier</span>
            <input v-model="miniWidget.options.variableMultiplier" class="w-full px-2 py-1 rounded-md bg-slate-200" />
          </div>
        </div>
        <div class="flex flex-col items-center justify-between w-full mt-3">
          <span class="w-full mb-1 text-sm text-slate-100/50">Icon</span>
          <div class="relative w-full">
            <button
              class="w-full py-1 pl-2 pr-8 text-left transition-all rounded-md bg-slate-200 hover:bg-slate-400"
              @click="showIconChooseModal = !showIconChooseModal"
            >
              <p class="text-ellipsis overflow-x-clip">{{ miniWidget.options.iconName || 'Click to choose...' }}</p>
            </button>
            <span
              class="absolute right-0.5 m-1 text-2xl -translate-y-1 cursor-pointer text-slate-500 mdi"
              :class="[miniWidget.options.iconName]"
            />
          </div>
        </div>
        <Transition>
          <div v-if="showIconChooseModal" class="flex flex-col items-center justify-center w-full mt-2">
            <div>
              <input
                v-model="iconSearchString"
                class="w-full px-2 py-1 rounded-md bg-slate-200"
                placeholder="Search icons..."
              />
            </div>
            <RecycleScroller
              v-if="iconSearchString === '' && showIconChooseModal"
              v-slot="{ item }"
              class="w-full h-40 mt-3 text-[34px]"
              :items="iconsNames"
              :item-size="46"
              :grid-items="7"
            >
              <span class="m-1 text-white cursor-pointer mdi icon-symbol" :class="[item]" @click="chooseIcon(item)">
              </span>
            </RecycleScroller>
            <div
              v-else-if="showIconChooseModal"
              class="grid w-full h-40 grid-cols-7 mt-3 overflow-x-hidden overflow-y-scroll"
            >
              <span
                v-for="icon in iconsToShow"
                :key="icon"
                class="m-1 text-white cursor-pointer mdi icon-symbol"
                :class="[icon]"
                @click="chooseIcon(icon)"
              />
            </div>
          </div>
        </Transition>
      </div>
      <div v-if="currentTab === 'presets'" class="flex flex-wrap items-center justify-around">
        <div
          v-for="(template, i) in veryGenericIndicatorPresets"
          :key="i"
          class="flex items-center justify-center px-2 m-2 text-white transition-all rounded-md cursor-pointer hover:bg-slate-100/20"
          @click="setIndicatorFromTemplate(template)"
        >
          <span class="relative w-[2rem] mdi icon-symbol text-[34px] mx-2" :class="[template.iconName]"></span>
          <div class="flex flex-col items-start justify-center min-w-[4rem] max-w-[6rem] select-none">
            <span class="text-xl font-semibold leading-6 w-fit">
              {{ round(Math.random() * Number(template.variableMultiplier)).toFixed(0) }} {{ template.variableUnit }}
            </span>
            <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">{{ template.displayName }}</span>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import * as MdiExports from '@mdi/js/mdi'
import { watchThrottled } from '@vueuse/core'
import Fuse from 'fuse.js'
import Swal from 'sweetalert2'
import { computed, onBeforeMount, onMounted, ref, toRefs, watch, watchEffect } from 'vue'

import { CurrentlyLoggedVariables, datalogger } from '@/libs/sensors-logging'
import { round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type VeryGenericIndicatorPreset, veryGenericIndicatorPresets } from '@/types/genericIndicator'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(miniWidget.value.options).length === 0) {
    Object.assign(miniWidget.value.options, {
      displayName: '',
      variableName: '',
      iconName: 'mdi-help-box',
      variableUnit: '%',
      variableMultiplier: 1,
    })
  }

  iconsNames = Object.keys(MdiExports).map((originalName) => {
    return originalName.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  })
})

const store = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()

const currentState = ref<unknown>(0)

const finalValue = computed(() => Number(miniWidget.value.options.variableMultiplier) * Number(currentState.value))
const parsedState = computed(() => {
  if (currentState.value === undefined) {
    return '--'
  }
  const value = finalValue.value

  if (value < 0 && value > -10) return value.toFixed(1)
  if (value <= -10 && value > -100) return value.toFixed(1)
  if (value <= -100 && value > -1000) return value.toFixed(0)
  if (value <= -1000 && value > -10000) return `${(value / 1000).toFixed(1)}k`
  if (value <= -10000 && value > -100000) return `${(value / 1000).toFixed(0)}k`
  if (value <= -100000) return '-∞'

  if (value < 1) return value.toFixed(2)
  if (value >= 1 && value < 100) return value.toFixed(1)
  if (value >= 10000) return `${(value / 10000).toFixed(0)}k`
  return value.toFixed(0)
})

const loggedMiniWidgets = ref(Array.from(CurrentlyLoggedVariables.getAllVariables()))
const lastWidgetName = ref('')

const updateLoggedMiniWidgets = (): void => {
  loggedMiniWidgets.value = Array.from(CurrentlyLoggedVariables.getAllVariables())
}

// prevent closing the configuration menu if no variable and name are selected
const closeDialog = async (): Promise<void> => {
  const { variableName, displayName } = miniWidget.value.options
  const managerVars = widgetStore.miniWidgetManagerVars(miniWidget.value.hash)

  if (variableName === '' || displayName === '') {
    await Swal.fire({
      text: 'Please select a variable and name it before closing the configuration menu.',
      icon: 'error',
    })
    return
  }
  CurrentlyLoggedVariables.removeVariable(lastWidgetName.value)
  CurrentlyLoggedVariables.addVariable(miniWidget.value.options.displayName)
  lastWidgetName.value = miniWidget.value.options.displayName
  updateLoggedMiniWidgets()
  managerVars.configMenuOpen = false
}

const updateVariableState = (): void => {
  currentState.value = store.genericVariables[miniWidget.value.options.variableName as string]
}
const updateWidgetName = (): void => {
  miniWidget.value.name = miniWidget.value.options.displayName || miniWidget.value.options.variableName
}
const updateGenericVariablesNames = (): void => {
  allVariablesNames.value = store.availableGenericVariables
}

const logData = computed(() => ({
  displayName: props.miniWidget.options.displayName,
  variableValue: `${parsedState.value} ${props.miniWidget.options.variableUnit}`,
  lastChanged: 0,
  currentView: widgetStore.currentView.name,
}))

const logCurrentState = (): void => {
  if (miniWidget.value.options.variableName) {
    datalogger.registerVeryGenericData(logData.value)
  }
}

watch(
  finalValue,
  () => {
    if (widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen === false) {
      logCurrentState()
    }
  },
  { immediate: true }
)

watch(store.genericVariables, () => updateVariableState())
watch(store.availableGenericVariables, () => updateGenericVariablesNames())
watch(
  miniWidget,
  () => {
    updateVariableState()
    updateWidgetName()
    updateGenericVariablesNames()
  },
  { deep: true }
)
onMounted(() => {
  // Update old variables naming to new pattern
  // TODO: Remove this before 1.0.0 release
  if (miniWidget.value.options.variableName) {
    miniWidget.value.options.variableName = miniWidget.value.options.variableName.replaceAll('.', '/')
  }

  updateVariableState()
  updateWidgetName()
  updateGenericVariablesNames()

  if (miniWidget.value.options.displayName && widgetStore.editingMode === false) {
    CurrentlyLoggedVariables.addVariable(miniWidget.value.options.displayName)
  }

  if (miniWidget.value.options.variableName) {
    store.registerUsageOfGenericVariable(miniWidget.value.options.variableName)
  }

  lastWidgetName.value = miniWidget.value.options.displayName
})

const fuseOptions = { includeScore: true, ignoreLocation: true, threshold: 0.3 }

let iconsNames: string[] = []

// Search for icon using fuzzy-finder
const iconSearchString = ref('')
const iconsToShow = ref<string[]>([])
watchThrottled(
  iconSearchString,
  () => {
    const iconFuse = new Fuse(iconsNames, fuseOptions)
    const filteredIconsResult = iconFuse.search(iconSearchString.value)
    iconsToShow.value = filteredIconsResult.map((r) => r.item)
  },
  { throttle: 1000 }
)

// Search for variable using fuzzy-finder
const variableNameSearchString = ref('')
const allVariablesNames = ref<string[]>([])
const showVariableChooseModal = ref(false)
const showIconChooseModal = ref(false)

const variableNamesToShow = computed(() => {
  if (variableNameSearchString.value === '') {
    return allVariablesNames.value
  }

  const variableNameFuse = new Fuse(allVariablesNames.value, fuseOptions)
  const filteredVariablesResult = variableNameFuse.search(variableNameSearchString.value)
  return filteredVariablesResult.map((r) => r.item).filter((value, index, self) => self.indexOf(value) === index)
})

const chooseVariable = (variable: string): void => {
  miniWidget.value.options.variableName = variable
  variableNameSearchString.value = ''
  showVariableChooseModal.value = false
  store.registerUsageOfGenericVariable(variable)
}

const chooseIcon = (iconName: string): void => {
  miniWidget.value.options.iconName = iconName
  iconSearchString.value = ''
  showIconChooseModal.value = false
}

watch(showVariableChooseModal, async (newValue) => {
  if (newValue === true && variableNamesToShow.value.isEmpty()) {
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
    showVariableChooseModal.value = false
    await Swal.fire({
      text: 'No variables found to choose from. Please make sure your vehicle is connected.',
      icon: 'error',
    })
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
  }
})

const currentTab = ref('presets')

const setIndicatorFromTemplate = (template: VeryGenericIndicatorPreset): void => {
  miniWidget.value.options.displayName = template.displayName
  miniWidget.value.options.variableName = template.variableName
  miniWidget.value.options.iconName = template.iconName
  miniWidget.value.options.variableUnit = template.variableUnit
  miniWidget.value.options.variableMultiplier = template.variableMultiplier
}

// Pops open the config menu if the mini-widget is a non-configured VeryGenericIndicator
watchEffect(() => {
  if (miniWidget.value.component === 'VeryGenericIndicator' && miniWidget.value.options.displayName === '') {
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
  }
})
</script>

<style>
.close-icon {
  position: fixed;
  top: 0px;
  right: 5px;
  cursor: pointer;
  color: white;
  font-size: 24px;
  border-radius: 8px;
}

.configModal {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-right: -50%;
  transform: translate(-50%, -50%);
  height: fit-content;
  background-color: rgba(71, 85, 105, 0.4);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px 5px rgba(0, 0, 0, 0.25);
  border-radius: 5px;
}
</style>
