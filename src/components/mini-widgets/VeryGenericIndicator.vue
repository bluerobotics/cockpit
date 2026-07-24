<template>
  <div
    class="h-12 p-1 min-w-[8.5rem] text-white transition-all relative scroll-container"
    :class="{
      'border-[1px] border-dashed border-[#FFFFFF55]': widgetStore.miniWidgetManagerVars(miniWidget.hash)
        .configMenuOpen,
    }"
    :style="{ width: miniWidget.options.widgetWidth + 'px' }"
  >
    <VgiIcon
      class="h-full left-[0.5rem] bottom-[5%] absolute text-[2.25rem]"
      :icon-name="miniWidget.options.iconName"
    />
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
    max-width="620px"
    @after-leave="closeVgiDialog"
  >
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="relative py-4 text-center text-h6 font-weight-bold">
        {{ $t('Very Generic Indicator') }}
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="text-[16px] absolute top-3 right-3"
          @click="closeVgiDialog"
        />
      </v-card-title>
      <v-tabs v-model="currentTab" color="white" fixed-tabs class="px-6 -mt-[10px]">
        <v-tab value="presets" class="text-white">{{ $t('Presets') }}</v-tab>
        <v-tab value="custom" class="text-white">{{ $t('Custom') }}</v-tab>
      </v-tabs>
      <v-card-text class="px-8 py-5 max-h-[65vh] overflow-y-auto">
        <v-window v-model="currentTab">
          <v-window-item value="custom">
            <div class="flex flex-col gap-5 mt-[6px]">
              <div class="flex gap-4">
                <v-text-field
                  v-model="miniWidget.options.displayName"
                  :label="$t('Display name')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="w-3/4"
                />
                <v-text-field
                  v-model="miniWidget.options.widgetWidth"
                  :label="$t('Display width')"
                  type="number"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="w-[100px]"
                />
              </div>

              <div>
                <v-text-field
                  :model-value="miniWidget.options.variableName"
                  :label="$t('Variable')"
                  :placeholder="$t('Click to choose...')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  readonly
                  append-inner-icon="mdi-swap-horizontal-bold"
                  class="cursor-pointer"
                  @click="showVariableChooseModal = !showVariableChooseModal"
                />
                <Transition>
                  <div v-if="showVariableChooseModal" class="mt-2">
                    <v-text-field
                      v-model="variableNameSearchString"
                      :placeholder="$t('Search variable...')"
                      variant="outlined"
                      density="compact"
                      hide-details
                    />
                    <div class="grid w-full h-32 grid-cols-1 mt-2 overflow-x-hidden overflow-y-auto">
                      <span
                        v-for="(variable, i) in variableNamesToShow"
                        :key="i"
                        class="h-8 p-1 m-1 overflow-x-hidden text-white transition-all rounded-md cursor-pointer select-none bg-slate-700 hover:bg-slate-400/20"
                        @click="onChooseVariable(variable)"
                      >
                        {{ variable }}
                      </span>
                    </div>
                  </div>
                </Transition>
              </div>

              <v-checkbox
                v-model="miniWidget.options.useStringVariable"
                :label="$t(`Use string variable (don't parse as number)`)"
                density="compact"
                hide-details
                class="-my-2"
              />

              <div class="flex gap-4">
                <v-text-field
                  v-model="miniWidget.options.variableUnit"
                  :label="$t('Unit')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-1"
                />
                <v-text-field
                  v-model="miniWidget.options.variableMultiplier"
                  :disabled="miniWidget.options.useStringVariable"
                  :label="$t('Multiplier')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-1"
                />
                <v-text-field
                  v-model="miniWidget.options.decimalPlaces"
                  :disabled="miniWidget.options.useStringVariable"
                  :label="$t('Decimal places')"
                  type="number"
                  min="0"
                  max="5"
                  :placeholder="$t('Auto-formatting')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-1"
                />
              </div>
              <v-divider class="mt-2 mb-1 opacity-10" />
              <div>
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-[50px] h-[50px] text-[34px] text-slate-300 transition-all rounded-md cursor-pointer shrink-0 bg-[#FFFFFF12] hover:bg-slate-400 elevation-1"
                    @click="showIconChooseModal = !showIconChooseModal"
                  >
                    <VgiIcon :icon-name="miniWidget.options.iconName" />
                  </div>
                  <v-text-field
                    :model-value="iconDisplayName"
                    :label="$t('Icon')"
                    :placeholder="$t('Click to choose...')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    readonly
                    class="flex-1 cursor-pointer"
                    @click="showIconChooseModal = !showIconChooseModal"
                  />
                  <v-btn-toggle
                    v-model="iconCategory"
                    mandatory
                    divided
                    density="compact"
                    class="shrink-0 vgi-category-toggle elevation-1"
                    @update:model-value="onIconCategoryChange"
                  >
                    <v-btn value="stock" size="small" class="text-white">{{ $t('Basic icons') }}</v-btn>
                    <v-btn value="custom" size="small" class="text-white">{{ $t('Custom icons') }}</v-btn>
                  </v-btn-toggle>
                </div>
                <Transition>
                  <div v-if="showIconChooseModal" class="flex flex-col items-center w-full mt-4">
                    <template v-if="iconCategory === 'stock'">
                      <v-text-field
                        v-model="iconSearchString"
                        :placeholder="$t('Search icons...')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="w-full"
                      />
                      <RecycleScroller
                        v-if="iconSearchString === ''"
                        ref="iconGridRef"
                        v-slot="{ item }"
                        class="w-full h-40 mt-3"
                        :style="{ fontSize: iconGridFontSize }"
                        :items="iconsNames"
                        :item-size="iconGridRowHeight"
                        :item-secondary-size="iconGridSecondarySize"
                        :grid-items="iconGridColumns"
                      >
                        <span
                          :class="[
                            `block w-full h-full text-center text-white cursor-pointer mdi icon-symbol leading-[${iconGridRowHeight}px]`,
                            item,
                          ]"
                          @click="chooseIcon(item)"
                        />
                      </RecycleScroller>
                      <div
                        v-else
                        class="grid w-full h-40 mt-3 overflow-x-hidden overflow-y-scroll"
                        :style="{
                          gridTemplateColumns: `repeat(${iconGridColumns}, minmax(0, 1fr))`,
                          gridAutoRows: `${iconGridRowHeight}px`,
                          fontSize: iconGridFontSize,
                        }"
                      >
                        <span
                          v-for="icon in iconsToShow"
                          :key="icon"
                          :class="[
                            `block text-center text-white cursor-pointer mdi icon-symbol leading-[${iconGridRowHeight}px]`,
                            icon,
                          ]"
                          @click="chooseIcon(icon)"
                        />
                      </div>
                    </template>

                    <template v-else>
                      <div class="flex items-center justify-between w-full">
                        <span class="text-xs text-slate-100/50">{{ $t('Your uploaded icons') }}</span>
                        <v-btn
                          variant="elevated"
                          size="small"
                          prepend-icon="mdi-upload"
                          class="self-center bg-[#FFFFFF12]"
                          @click="iconUploadInput?.click()"
                        >
                          {{ $t('Upload SVG') }}
                        </v-btn>
                        <input
                          ref="iconUploadInput"
                          type="file"
                          accept=".svg,image/svg+xml"
                          class="hidden"
                          @change="onCustomIconFileSelected"
                        />
                      </div>
                      <span v-if="customIconError" class="w-full mt-1 text-xs text-red-400">{{ customIconError }}</span>
                      <div v-if="customIconsList.length > 0" class="grid w-full grid-cols-7 gap-1 mt-3">
                        <div
                          v-for="icon in customIconsList"
                          :key="icon.id"
                          class="relative flex items-center justify-center w-full h-10 text-2xl text-white rounded-md cursor-pointer group"
                          :title="icon.name"
                          @click="chooseIcon(customIconRefFromId(icon.id))"
                        >
                          <VgiIcon :icon-name="customIconRefFromId(icon.id)" />
                          <span
                            class="absolute top-[-10px] right-[10px] hidden text-[13px] text-white mdi mdi-close-circle group-hover:block"
                            @click.stop="confirmRemoveCustomIcon(icon)"
                          />
                        </div>
                      </div>
                      <div v-else class="w-full py-6 text-sm text-center text-slate-100/40">
                        {{ $t('No custom icons uploaded yet. Use "Upload SVG" to add one.') }}
                      </div>
                    </template>
                  </div>
                </Transition>
              </div>
            </div>
          </v-window-item>

          <v-window-item value="presets">
            <div class="flex flex-wrap items-center justify-around">
              <div
                v-for="(template, i) in veryGenericIndicatorPresets"
                :key="i"
                class="flex items-center justify-center px-2 m-2 text-white transition-all rounded-md cursor-pointer hover:bg-slate-100/20"
                @click="setIndicatorFromTemplate(template)"
              >
                <VgiIcon class="relative w-[2rem] icon-symbol text-[34px] mx-2" :icon-name="template.iconName" />
                <div class="flex flex-col items-start justify-center min-w-[4rem] max-w-[6rem] select-none">
                  <span class="text-xl font-semibold leading-6 w-fit">
                    {{ round(Math.random() * Number(template.variableMultiplier)).toFixed(0) }}
                    {{ template.variableUnit }}
                  </span>
                  <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">
                    {{ template.displayName }}
                  </span>
                </div>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex items-center justify-end w-full pa-2">
          <v-btn color="white" @click="closeVgiDialog">{{ $t('Done') }}</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementSize, watchThrottled } from '@vueuse/core'
import Fuse from 'fuse.js'
import { computed, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'

import VgiIcon from '@/components/mini-widgets/VgiIcon.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useCustomIcons } from '@/composables/useCustomIcons'
import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import { type CustomIcon, customIconRefFromId, idFromCustomIconRef, isCustomIconRef } from '@/libs/custom-icons'
import { CurrentlyLoggedVariables, datalogger } from '@/libs/sensors-logging'
import { round } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type VeryGenericIndicatorPreset, veryGenericIndicatorPresets } from '@/types/genericIndicator'
import type { MiniWidget } from '@/types/widgets'

const { showDialog, closeDialog } = useInteractionDialog()
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
      useStringVariable: false,
    })
  }

  iconsNames = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule) {
          const match = rule.selectorText.match(/^\.(mdi-[a-z0-9-]+)::before$/)
          if (match) iconsNames.push(match[1])
        }
      }
    } catch {
      // Skip CORS-restricted stylesheets
    }
  }
})

const widgetStore = useWidgetManagerStore()

const currentState = ref<unknown>(0)

const finalValue = computed(() => Number(miniWidget.value.options.variableMultiplier) * Number(currentState.value))

const parsedState = computed(() => {
  if (currentState.value === undefined) {
    return '--'
  }

  // If using string variable, return the raw value as string without parsing
  if (miniWidget.value.options.useStringVariable) {
    return String(currentState.value)
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
const iconGridColumns = 7
const iconGridRowHeight = 46
const iconGridFontSize = '34px'

const iconGridRef = ref<HTMLElement | null>(null)
const { width: iconGridWidth } = useElementSize(iconGridRef)
const iconGridSecondarySize = computed(() => {
  if (!iconGridWidth.value) return iconGridRowHeight
  return Math.floor(iconGridWidth.value / iconGridColumns)
})

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
const iconCategory = ref<'stock' | 'custom'>('stock')

const {
  icons: customIconsList,
  addIconFromFile: addCustomIconFromFile,
  removeIcon: removeCustomIcon,
} = useCustomIcons()
const customIconError = ref('')
const iconUploadInput = ref<HTMLInputElement | null>(null)

// For custom icons the stored value is an opaque `custom:<id>` ref, so show the icon's name instead
const iconDisplayName = computed(() => {
  const iconName = miniWidget.value.options.iconName
  if (!isCustomIconRef(iconName)) return iconName
  const id = idFromCustomIconRef(iconName)
  return customIconsList.value.find((icon) => icon.id === id)?.name ?? iconName
})

const onIconCategoryChange = (category: 'stock' | 'custom'): void => {
  logUserAction(`Switched to '${category}' indicator icon category`)
  showIconChooseModal.value = true
}

const onCustomIconFileSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const { id, error } = await addCustomIconFromFile(file)
  customIconError.value = error ?? ''
  if (id) chooseIcon(customIconRefFromId(id))
}

const confirmRemoveCustomIcon = (icon: CustomIcon): void => {
  logUserAction(`Opened delete confirmation for custom icon '${icon.name}'`)
  showDialog({
    title: 'Delete custom icon',
    message: `Delete the custom icon "${icon.name}"? Indicators using it will show a placeholder instead.`,
    variant: 'warning',
    actions: [
      { text: 'Cancel', action: () => closeDialog() },
      {
        text: 'Delete',
        action: () => {
          removeCustomIcon(icon.id)
          closeDialog()
        },
      },
    ],
  })
}

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

const onChooseVariable = (variable: string): void => {
  logUserAction(`Selected indicator variable '${variable}'`)
  chooseVariable(variable)
}

const chooseIcon = (iconName: string): void => {
  logUserAction(`Selected indicator icon '${iconName}'`)
  miniWidget.value.options.iconName = iconName
  iconSearchString.value = ''
  if (!isCustomIconRef(iconName)) showIconChooseModal.value = false
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
  logUserAction(`Applied indicator preset '${template.displayName}'`)
  miniWidget.value.options.displayName = template.displayName
  miniWidget.value.options.variableName = template.variableName
  miniWidget.value.options.iconName = template.iconName
  miniWidget.value.options.variableUnit = template.variableUnit
  miniWidget.value.options.variableMultiplier = template.variableMultiplier
}
</script>

<style scoped>
.vgi-category-toggle {
  background-color: transparent;
  border: 1px solid #ffffff1a;
}
.vgi-category-toggle :deep(.v-btn) {
  background-color: transparent;
}
.vgi-category-toggle :deep(.v-btn.v-btn--active) {
  background-color: #ffffff11;
}
.vgi-category-toggle :deep(.v-btn__overlay) {
  opacity: 0;
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
