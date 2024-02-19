<template>
  <div class="flex items-center justify-center h-12 py-1 text-white transition-all w-[7rem]">
    <span class="relative w-[2rem] mdi icon-symbol" :class="[miniWidget.options.iconName]"></span>
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
  <Dialog v-model:show="miniWidget.managerVars.configMenuOpen" class="w-[24rem]">
    <div class="w-full h-full">
      <div class="flex items-center mb-3 justify-evenly">
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
              <p class="text-ellipsis overflow-x-clip">{{ miniWidget.options.variableName || 'Click to choose...' }}</p>
            </button>
            <span
              class="absolute right-0.5 m-1 text-2xl -translate-y-1 cursor-pointer text-slate-500 mdi mdi-swap-horizontal-bold"
            />
          </div>
        </div>
        <div v-if="showVariableChooseModal" class="flex flex-col justify-center mx-1 my-3 align-center">
          <input
            v-model="variableNameSearchString"
            placeholder="Search variable..."
            class="w-full px-2 py-1 rounded-md bg-slate-200"
          />
          <div class="grid w-full h-32 grid-cols-1 my-2 overflow-x-hidden overflow-y-scroll">
            <span
              v-for="variable in variableNamesToShow"
              :key="variable"
              class="h-8 p-1 m-1 overflow-x-hidden text-white transition-all rounded-md cursor-pointer select-none bg-slate-700 hover:bg-slate-400/20"
              @click="chooseVariable(variable)"
            >
              {{ variable }}
            </span>
          </div>
        </div>
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
            <input v-model="miniWidget.options.iconName" class="w-full py-1 pl-2 pr-8 rounded-md bg-slate-200" />
            <span
              class="absolute right-0.5 m-1 text-2xl -translate-y-1 cursor-pointer text-slate-500 mdi"
              :class="[miniWidget.options.iconName]"
            />
          </div>
        </div>
        <div class="flex items-center justify-center w-full mt-2">
          <input
            v-model="iconSearchString"
            class="w-full px-2 py-1 rounded-md bg-slate-200"
            placeholder="Search icons..."
          />
        </div>
        <RecycleScroller
          v-if="iconSearchString === ''"
          v-slot="{ item }"
          class="w-full h-40 mt-3"
          :items="iconsNames"
          :item-size="46"
          :grid-items="7"
        >
          <span
            class="m-1 text-white cursor-pointer mdi icon-symbol"
            :class="[item]"
            @click="miniWidget.options.iconName = item"
          >
          </span>
        </RecycleScroller>
        <div v-else class="grid w-full h-40 grid-cols-7 mt-3 overflow-x-hidden overflow-y-scroll">
          <span
            v-for="icon in iconsToShow"
            :key="icon"
            class="m-1 text-white cursor-pointer mdi icon-symbol"
            :class="[icon]"
            @click="miniWidget.options.iconName = icon"
          />
        </div>
      </div>
      <div v-if="currentTab === 'presets'" class="flex flex-wrap items-center justify-around">
        <div
          v-for="(template, i) in veryGenericIndicatorPresets"
          :key="i"
          class="flex items-center w-[6.25rem] h-12 m-2 rounded-md text-white justify-center cursor-pointer hover:bg-slate-100/20 transition-all"
          @click="setIndicatorFromTemplate(template)"
        >
          <span class="relative w-[2rem] mdi icon-symbol" :class="[template.iconName]"></span>
          <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
            <span class="text-xl font-semibold leading-6 w-fit">
              {{ round(Math.random() * Number(template.variableMultiplier)).toFixed(0) }} {{ template.variableUnit }}
            </span>
            <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">{{ template.displayName }}</span>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import * as MdiExports from '@mdi/js/mdi'
import { watchThrottled } from '@vueuse/core'
import Fuse from 'fuse.js'
import Swal from 'sweetalert2'
import { computed, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import { round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { type VeryGenericIndicatorPreset, veryGenericIndicatorPresets } from '@/types/genericIndicator'
import type { MiniWidget } from '@/types/miniWidgets'

import Dialog from '../Dialog.vue'

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

const updateVariableState = (): void => {
  currentState.value = store.genericVariables[miniWidget.value.options.variableName as string]
}
const updateWidgetName = (): void => {
  miniWidget.value.name = miniWidget.value.options.displayName || miniWidget.value.options.variableName
}
const updateGenericVariablesNames = (): void => {
  allVariablesNames.value = Object.keys(store.genericVariables)
}
watch(store.genericVariables, () => {
  updateVariableState()
  updateGenericVariablesNames()
})
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
  updateVariableState()
  updateWidgetName()
  updateGenericVariablesNames()
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
const variableNamesToShow = ref<string[]>([])
const allVariablesNames = ref<string[]>([])
const showVariableChooseModal = ref(false)

watchThrottled(
  [variableNameSearchString, allVariablesNames],
  () => {
    if (variableNameSearchString.value === '') {
      variableNamesToShow.value = allVariablesNames.value
      return
    }

    const variableNameFuse = new Fuse(allVariablesNames.value, fuseOptions)
    const filteredVariablesResult = variableNameFuse.search(variableNameSearchString.value)
    variableNamesToShow.value = filteredVariablesResult.map((r) => r.item)
  },
  { throttle: 300 }
)

const chooseVariable = (variable: string): void => {
  miniWidget.value.options.variableName = variable
  variableNameSearchString.value = ''
  showVariableChooseModal.value = false
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
</script>

<style>
.icon-symbol {
  font-size: 2rem;
  line-height: 2rem;
}
</style>
