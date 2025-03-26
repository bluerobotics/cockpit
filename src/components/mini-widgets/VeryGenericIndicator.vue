<template>
  <div
    class="h-12 p-1 min-w-[8.5rem] text-white transition-all relative scroll-container"
    :class="{
      'border-[1px] border-dashed border-[#FFFFFF55]': widgetStore.miniWidgetManagerVars(miniWidget.hash)
        .configMenuOpen,
    }"
    :style="{ width: miniWidget.options.widgetWidth + 'px' }"
  >
    <span class="h-full left-[0.5rem] bottom-[5%] absolute mdi text-[2.25rem]" :class="[miniWidget.options.iconName]" />
    <div class="absolute left-[3rem] h-full select-none font-semibold scroll-container w-full">
      <div class="w-full" :class="{ 'scroll-text': valueIsOverflowing }">
        <span class="font-mono text-xl leading-6">{{ parsedState }}</span>
        <span class="text-xl leading-6"> {{ String.fromCharCode(0x20) }} {{ miniWidget.options.variableUnit }} </span>
      </div>
      <span class="w-full text-sm absolute bottom-[0.5rem] whitespace-nowrap text-ellipsis overflow-x-hidden">
        {{ miniWidget.options.displayName }}
      </span>
    </div>
  </div>
  <v-dialog
    v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen"
    class="w-[100vw] flex justify-center items-center"
    @after-leave="closeVgiDialog"
  >
    <v-card class="config-modal p-8" :style="interfaceStore.globalGlassMenuStyles">
      <div class="close-icon mdi mdi-close" @click.stop="closeVgiDialog"></div>
      <v-card-title class="text-white">
        <div class="flex items-center mb-3 mt-[-5px] justify-evenly">
          <div
            class="px-3 py-1 transition-all rounded-md cursor-pointer select-none text-slate-100 hover:bg-[#FFFFFF33]"
            :class="{ 'bg-[#FFFFFF22]': currentTab === 'presets' }"
            @click="currentTab = 'presets'"
          >
            Presets
          </div>
          <div
            class="px-3 py-1 transition-all rounded-md cursor-pointer select-none text-slate-100 hover:bg-[#FFFFFF33]"
            :class="{ 'bg-[#FFFFFF22]': currentTab === 'custom' }"
            @click="currentTab = 'custom'"
          >
            Custom
          </div>
        </div>
      </v-card-title>

      <div v-if="currentTab === 'custom'" class="flex flex-col items-center justify-around">
        <div class="flex w-full gap-x-10">
          <div class="flex flex-col items-center justify-between w-3/4 mt-3">
            <span class="w-full mb-1 text-sm text-slate-100/50">Display name</span>
            <input v-model="miniWidget.options.displayName" class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]" />
          </div>
          <div class="flex flex-col items-center justify-between w-1/4 mt-3">
            <span class="w-full text-sm text-slate-100/50">Display Width</span>
            <input
              v-model="miniWidget.options.widgetWidth"
              type="number"
              class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]"
            />
          </div>
        </div>
        <div class="flex flex-col items-center justify-between w-full mt-3">
          <span class="w-full mb-1 text-sm text-slate-100/50">Variable</span>
          <div class="relative w-full">
            <button
              class="w-full py-1 pl-2 pr-8 text-left transition-all rounded-md bg-[#FFFFFF12] hover:bg-slate-400"
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
              class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]"
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
            <input v-model="miniWidget.options.variableUnit" class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]" />
          </div>
          <div class="flex flex-col items-center justify-between w-full mx-5">
            <span class="w-full mb-1 text-sm text-slate-100/50">Multiplier</span>
            <input v-model="miniWidget.options.variableMultiplier" class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]" />
          </div>
          <div class="flex flex-col items-center justify-between w-full mx-5">
            <span class="w-full mb-1 text-sm text-slate-100/50">Decimal Places</span>
            <input
              v-model="miniWidget.options.decimalPlaces"
              type="number"
              min="0"
              max="5"
              placeholder="Auto-formatting"
              class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]"
            />
          </div>
        </div>
        <div class="flex flex-col items-center justify-between w-full mt-3">
          <span class="w-full mb-1 text-sm text-slate-100/50">Icon</span>
          <div class="relative w-full">
            <button
              class="w-full py-1 pl-2 pr-8 text-left transition-all rounded-md bg-[#FFFFFF12] hover:bg-slate-400"
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
                class="w-full px-2 py-1 rounded-md bg-[#FFFFFF12]"
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
      <div v-if="currentTab === 'presets'" class="flex flex-wrap items-center justify-around max-w-[24rem]">
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
import { computed, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import { CurrentlyLoggedVariables, datalogger } from '@/libs/sensors-logging'
import { round } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type VeryGenericIndicatorPreset, veryGenericIndicatorPresets } from '@/types/genericIndicator'
import type { MiniWidget } from '@/types/widgets'

const { showDialog } = useInteractionDialog()
const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

onBeforeMount(() => {
  if (Object.keys(miniWidget.value.options).length === 0) {
    Object.assign(miniWidget.value.options, {
      displayName: '',
      variableName: '',
      iconName: 'mdi-help-box',
      variableUnit: '%',
      variableMultiplier: 1,
      decimalPlaces: null,
      widgetWidth: 136,
    })
  }

  iconsNames = Object.keys(MdiExports).map((originalName) => {
    return originalName.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  })
})

const widgetStore = useWidgetManagerStore()

const currentState = ref<unknown>(0)

const finalValue = computed(() => Number(miniWidget.value.options.variableMultiplier) * Number(currentState.value))

const parsedState = computed(() => {
  if (currentState.value === undefined) {
    return '--'
  }
  const value = finalValue.value

  const decimalPlaces = miniWidget.value.options.decimalPlaces
  if (decimalPlaces !== null && !isNaN(decimalPlaces)) {
    return value.toFixed(decimalPlaces)
  }

  if (value < 0 && value > -10) return value.toFixed(1)
  if (value <= -10 && value > -100) return value.toFixed(1)
  if (value <= -100 && value > -1000) return value.toFixed(0)
  if (value <= -1000 && value > -10000) return `${(value / 1000).toFixed(1)}k`
  if (value <= -10000) return `${(value / 1000).toFixed(0)}k`

  if (value < 1) return value.toFixed(3)
  if (value >= 1 && value < 100) return value.toFixed(2)
  if (value >= 100 && value < 1000) return value.toFixed(1)
  if (value >= 1000 && value < 10000) return value.toFixed(0)
  if (value >= 10000 && value < 100000) return `${(value / 1000).toFixed(1)}k`
  if (value >= 100000) return `${(value / 1000).toFixed(0)}k`

  return value.toFixed(0)
})

const valueIsOverflowing = computed(() => {
  return finalValue.value <= -100000 || finalValue.value >= 1000000
})

const loggedMiniWidgets = ref(Array.from(CurrentlyLoggedVariables.getAllVariables()))
const lastWidgetName = ref('')

const updateLoggedMiniWidgets = (): void => {
  loggedMiniWidgets.value = Array.from(CurrentlyLoggedVariables.getAllVariables())
}

const widgetIsConfigured = computed(() => {
  return miniWidget.value.options.displayName !== '' && miniWidget.value.options.variableName !== ''
})

// prevent closing the configuration menu if no variable and name are selected
const closeVgiDialog = async (): Promise<void> => {
  const managerVars = widgetStore.miniWidgetManagerVars(miniWidget.value.hash)

  if (widgetIsConfigured.value) {
    CurrentlyLoggedVariables.removeVariable(lastWidgetName.value)
    CurrentlyLoggedVariables.addVariable(miniWidget.value.options.displayName)
    lastWidgetName.value = miniWidget.value.options.displayName
    updateLoggedMiniWidgets()
  }

  managerVars.configMenuOpen = false
}

const updateVariableState = (): void => {
  currentState.value = getDataLakeVariableData(miniWidget.value.options.variableName)
}
const updateWidgetName = (): void => {
  miniWidget.value.name = miniWidget.value.options.displayName || miniWidget.value.options.variableName
}
const updateGenericVariablesNames = (): void => {
  const variablesNames = Object.keys(getAllDataLakeVariablesInfo())
  allVariablesNames.value = variablesNames
  // TODO: Update CurrentlyLoggedVariables to match data lake state
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
  () => miniWidget.value.options.decimalPlaces,
  (newVal) => {
    if (newVal === '' || newVal === null || newVal === undefined) {
      miniWidget.value.options.decimalPlaces = null
    } else {
      const num = Number(newVal)
      if (!isNaN(num) && num >= 0 && Number.isInteger(num)) {
        miniWidget.value.options.decimalPlaces = num
      } else {
        miniWidget.value.options.decimalPlaces = null
      }
    }
  }
)

watch(
  finalValue,
  () => {
    if (widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen === false) {
      logCurrentState()
    }
  },
  { immediate: true }
)

// Watch for changes in the data lake variable
watch(
  () => miniWidget.value.options.variableName,
  (newVariableName) => {
    if (!newVariableName) return
    updateVariableState()
  }
)
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

  // Update list of available variables when the data-lake has new stuff
  listenToDataLakeVariablesInfoChanges(updateGenericVariablesNames)

  chooseVariable(miniWidget.value.options.variableName)

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

  listenDataLakeVariable(variable, updateVariableState)
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
    await showDialog({
      message: 'No variables found to choose from. Please make sure your vehicle is connected.',
      variant: 'error',
    })
    widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
  }
})

const currentTab = ref(widgetIsConfigured.value ? 'custom' : 'presets')

const setIndicatorFromTemplate = (template: VeryGenericIndicatorPreset): void => {
  miniWidget.value.options.displayName = template.displayName
  miniWidget.value.options.variableName = template.variableName
  miniWidget.value.options.iconName = template.iconName
  miniWidget.value.options.variableUnit = template.variableUnit
  miniWidget.value.options.variableMultiplier = template.variableMultiplier
}
</script>

<style scoped>
.close-icon {
  position: fixed;
  top: 5px;
  right: 10px;
  cursor: pointer;
  color: white;
  font-size: 26px;
  border-radius: 8px;
}

.config-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-right: -50%;
  transform: translate(-50%, -50%);
  height: fit-content;
  border-radius: 5px;
}

.scroll-container {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scroll-text {
  animation: 3s linear 1s infinite alternate slidein;
}

@keyframes slidein {
  25%,
  50% {
    transform: translateX(0%);
  }
  90%,
  100% {
    transform: translateX(-50%);
  }
}
</style>
