<template>
  <div class="mx-1 flex h-12 w-[7rem] items-center justify-center py-1 text-white transition-all">
    <span class="mdi icon-symbol relative w-[2rem] text-[32px]" :class="[miniWidget.options.iconName]"></span>
    <div class="ml-1 flex w-[4.75rem] select-none flex-col items-start justify-center">
      <div>
        <span class="w-fit font-mono text-xl font-semibold leading-6">{{ parsedState }}</span>
        <span class="w-fit text-xl font-semibold leading-6">
          {{ String.fromCharCode(0x20) }} {{ miniWidget.options.variableUnit }}
        </span>
      </div>
      <span class="w-full whitespace-nowrap text-sm font-semibold leading-4">{{ miniWidget.options.displayName }}</span>
    </div>
  </div>
  <v-dialog
    v-model="miniWidget.managerVars.configMenuOpen"
    persistent
    class="flex w-[100vw] items-center justify-center"
  >
    <v-card class="configModal p-8">
      <div class="close-icon mdi mdi-close" @click.stop="closeDialog"></div>
      <v-card-title class="text-white">
        <div class="mb-3 mt-[-5px] flex items-center justify-evenly">
          <div
            class="cursor-pointer select-none rounded-md px-3 py-1 text-slate-100 transition-all hover:bg-slate-400"
            :class="{ 'bg-slate-400': currentTab === 'presets' }"
            @click="currentTab = 'presets'"
          >
            Presets
          </div>
          <div
            class="cursor-pointer select-none rounded-md px-3 py-1 text-slate-100 transition-all hover:bg-slate-400"
            :class="{ 'bg-slate-400': currentTab === 'custom' }"
            @click="currentTab = 'custom'"
          >
            Custom
          </div>
        </div>
      </v-card-title>

      <div v-if="currentTab === 'custom'" class="flex flex-col items-center justify-around">
        <div class="mt-3 flex w-full flex-col items-center justify-between">
          <span class="mb-1 w-full text-sm text-slate-100/50">Display name</span>
          <input v-model="miniWidget.options.displayName" class="w-full rounded-md bg-slate-200 px-2 py-1" />
        </div>
        <div class="mt-3 flex w-full flex-col items-center justify-between">
          <span class="mb-1 w-full text-sm text-slate-100/50">Variable</span>
          <div class="relative w-full">
            <button
              class="w-full rounded-md bg-slate-200 py-1 pl-2 pr-8 text-left transition-all hover:bg-slate-400"
              @click="showVariableChooseModal = !showVariableChooseModal"
            >
              <p class="overflow-x-clip text-ellipsis">
                {{ miniWidget.options.variableName || 'Click to choose...' }}
              </p>
            </button>
            <span
              class="mdi mdi-swap-horizontal-bold absolute right-0.5 m-1 -translate-y-1 cursor-pointer text-2xl text-slate-500"
            />
          </div>
        </div>
        <Transition>
          <div v-if="showVariableChooseModal" class="align-center mx-1 my-3 flex w-full flex-col justify-center">
            <input
              v-model="variableNameSearchString"
              placeholder="Search variable..."
              class="w-full rounded-md bg-slate-200 px-2 py-1"
            />
            <div class="my-2 grid h-32 w-full grid-cols-1 overflow-x-hidden overflow-y-scroll">
              <span
                v-for="(variable, i) in variableNamesToShow"
                :key="i"
                class="m-1 h-8 cursor-pointer select-none overflow-x-hidden rounded-md bg-slate-700 p-1 text-white transition-all hover:bg-slate-400/20"
                @click="chooseVariable(variable)"
              >
                {{ variable }}
              </span>
            </div>
          </div>
        </Transition>
        <div class="mt-2 flex w-full items-center justify-between">
          <div class="mx-5 flex w-full flex-col items-center justify-between">
            <span class="mb-1 w-full text-sm text-slate-100/50">Unit</span>
            <input v-model="miniWidget.options.variableUnit" class="w-full rounded-md bg-slate-200 px-2 py-1" />
          </div>
          <div class="mx-5 flex w-full flex-col items-center justify-between">
            <span class="mb-1 w-full text-sm text-slate-100/50">Multiplier</span>
            <input v-model="miniWidget.options.variableMultiplier" class="w-full rounded-md bg-slate-200 px-2 py-1" />
          </div>
        </div>
        <div class="mt-3 flex w-full flex-col items-center justify-between">
          <span class="mb-1 w-full text-sm text-slate-100/50">Icon</span>
          <div class="relative w-full">
            <button
              class="w-full rounded-md bg-slate-200 py-1 pl-2 pr-8 text-left transition-all hover:bg-slate-400"
              @click="showIconChooseModal = !showIconChooseModal"
            >
              <p class="overflow-x-clip text-ellipsis">{{ miniWidget.options.iconName || 'Click to choose...' }}</p>
            </button>
            <span
              class="mdi absolute right-0.5 m-1 -translate-y-1 cursor-pointer text-2xl text-slate-500"
              :class="[miniWidget.options.iconName]"
            />
          </div>
        </div>
        <Transition>
          <div v-if="showIconChooseModal" class="mt-2 flex w-full flex-col items-center justify-center">
            <div>
              <input
                v-model="iconSearchString"
                class="w-full rounded-md bg-slate-200 px-2 py-1"
                placeholder="Search icons..."
              />
            </div>
            <RecycleScroller
              v-if="iconSearchString === '' && showIconChooseModal"
              v-slot="{ item }"
              class="mt-3 h-40 w-full text-[34px]"
              :items="iconsNames"
              :item-size="46"
              :grid-items="7"
            >
              <span class="mdi icon-symbol m-1 cursor-pointer text-white" :class="[item]" @click="chooseIcon(item)">
              </span>
            </RecycleScroller>
            <div
              v-else-if="showIconChooseModal"
              class="mt-3 grid h-40 w-full grid-cols-7 overflow-x-hidden overflow-y-scroll"
            >
              <span
                v-for="icon in iconsToShow"
                :key="icon"
                class="mdi icon-symbol m-1 cursor-pointer text-white"
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
          class="m-2 flex cursor-pointer items-center justify-center rounded-md px-2 text-white transition-all hover:bg-slate-100/20"
          @click="setIndicatorFromTemplate(template)"
        >
          <span class="mdi icon-symbol relative mx-2 w-[2rem] text-[34px]" :class="[template.iconName]"></span>
          <div class="flex min-w-[4rem] max-w-[6rem] select-none flex-col items-start justify-center">
            <span class="w-fit text-xl font-semibold leading-6">
              {{ round(Math.random() * Number(template.variableMultiplier)).toFixed(0) }} {{ template.variableUnit }}
            </span>
            <span class="w-full whitespace-nowrap text-sm font-semibold leading-4">{{ template.displayName }}</span>
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
  const { managerVars } = miniWidget.value

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
    if (miniWidget.value.managerVars.configMenuOpen === false) {
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
    miniWidget.value.managerVars.configMenuOpen = false
    showVariableChooseModal.value = false
    await Swal.fire({
      text: 'No variables found to choose from. Please make sure your vehicle is connected.',
      icon: 'error',
    })
    miniWidget.value.managerVars.configMenuOpen = true
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
    miniWidget.value.managerVars.configMenuOpen = true
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
