<template>
  <div class="draggable-container" @dragover.prevent="handleDragOver">
    <v-tabs v-model="selectedTab" fixed-tabs align-tabs="center">
      <v-tab value="telemetry" class="text-slate-600">Telemetry Overlay Configuration</v-tab>
      <v-tab value="logs" class="text-slate-600">Logging Options</v-tab>
    </v-tabs>
    <BaseConfigurationView>
      <template #content>
        <div v-show="selectedTab === 'telemetry'" id="draggable-container" class="w-full mb-3">
          <div class="flex justify-start w-full align-start gap-x-5">
            <div id="leftColumn" class="flex flex-col justify-start align-start w-[220px] gap-y-1 ml-2 mt-[60px]">
              <v-expansion-panels v-model="optionsPanel">
                <v-expansion-panel v-model="optionsPanel">
                  <v-expansion-panel-title>
                    <span class="text-md font-bold text-slate-600 text-center w-[200px]">Overlay Options</span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div>
                      <div class="flex flex-col flex-wrap justify-between w-full pt-2 align-start gap-y-0">
                        <div class="flex flex-row justify-between w-full align-center gap-x-3">
                          <span class="w-[85px] text-sm font-bold text-slate-600 text-start mb-5">Font size</span>
                          <v-text-field
                            v-model="datalogger.telemetryDisplayOptions.value.fontSize"
                            type="number"
                            density="compact"
                            class="w-[75px]"
                          />
                        </div>
                        <div class="flex flex-row justify-between w-full -mt-2 align-center gap-x-3">
                          <span class="w-[85px] text-sm font-bold text-slate-600 text-start mb-5">Shadow size</span>
                          <v-select
                            v-model="datalogger.telemetryDisplayOptions.value.fontShadowSize"
                            density="compact"
                            :items="[0, 1, 2, 3, 4, 5]"
                            class="w-[75px]"
                          />
                        </div>
                        <div class="flex flex-row justify-between w-[90%] align-center gap-x-3">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                          >
                            <template #activator="{ props }">
                              <span class="text-sm font-bold text-slate-600 text-start">Font color</span>
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full"
                                :style="{ backgroundColor: datalogger.telemetryDisplayOptions.value.fontColor }"
                              ></div>
                            </template>
                            <v-card class="overflow-hidden"
                              ><v-color-picker
                                v-model="datalogger.telemetryDisplayOptions.value.fontColor"
                                width="400px"
                            /></v-card>
                          </v-menu>
                        </div>
                        <div class="flex flex-row justify-between w-[90%] align-center gap-x-3 mt-7">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                            class="overflow-hidden"
                          >
                            <template #activator="{ props }">
                              <span class="text-sm font-bold text-slate-600 text-start">Outline color</span>
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full"
                                :style="{ backgroundColor: datalogger.telemetryDisplayOptions.value.fontOutlineColor }"
                              ></div>
                            </template>
                            <v-card class="overflow-hidden"
                              ><v-color-picker
                                v-model="datalogger.telemetryDisplayOptions.value.fontOutlineColor"
                                width="400px"
                            /></v-card>
                          </v-menu>
                        </div>
                        <div class="flex flex-row justify-between w-[90%] align-center gap-x-3 mt-7">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                          >
                            <template #activator="{ props }">
                              <span class="text-sm font-bold text-slate-600 text-start">Shadow color</span>
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full"
                                :style="{ backgroundColor: datalogger.telemetryDisplayOptions.value.fontShadowColor }"
                              ></div>
                            </template>
                            <v-card class="overflow-hidden"
                              ><v-color-picker
                                v-model="datalogger.telemetryDisplayOptions.value.fontShadowColor"
                                width="400px"
                            /></v-card>
                          </v-menu>
                        </div>
                        <div class="flex flex-row justify-start h-[50px] align-center mt-7 -ml-2">
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontBold" />
                          <span class="text-sm font-bold text-slate-600 -mt-[20px] text-start">Bold</span>
                        </div>
                        <div class="flex flex-row justify-start h-[50px] align-center -ml-2">
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontItalic" />
                          <span class="text-sm font-bold text-slate-600 -mt-[20px] text-start">Italic</span>
                        </div>
                        <div class="flex flex-row justify-start h-[50px] align-center -ml-2">
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontUnderline" />
                          <span class="text-sm font-bold text-slate-600 -mt-[20px] text-start">Underline</span>
                        </div>
                        <div class="flex flex-row justify-start h-[50px] align-center -ml-2">
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontStrikeout" />
                          <span class="text-sm font-bold text-slate-600 -mt-[20px] text-start">Strikethrough</span>
                        </div>
                      </div>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
              <v-expansion-panels v-model="variablesPanel">
                <v-expansion-panel v-model="variablesPanel">
                  <v-expansion-panel-title>
                    <span class="text-md font-bold text-slate-600 text-center w-[200px]">Vehicle Variables</span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <VueDraggable
                      v-model="loggedVariables"
                      tag="div"
                      :sort="true"
                      class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden overflow-y-auto grow"
                      :animation="150"
                      :group="{ name: 'availableDataElements', put: false }"
                    >
                      <div v-for="variable in loggedVariables.sort()" :key="variable" class="">
                        <v-chip label class="m-1 cursor-grab">{{ variable }}</v-chip>
                      </div>
                    </VueDraggable>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <span class="text-md font-bold text-slate-600 text-center w-[200px]">Mission Variables</span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <VueDraggable
                      v-model="otherLoggingElements"
                      tag="div"
                      :sort="true"
                      class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden overflow-y-auto grow"
                      :animation="150"
                      :group="{ name: 'availableDataElements', put: false }"
                    >
                      <div v-for="element in otherLoggingElements.sort()" :key="element">
                        <v-chip label class="m-1 cursor-grab">{{ element }}</v-chip>
                      </div>
                    </VueDraggable>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
              <v-expansion-panels v-model="customMessagePanel">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <span class="text-md font-bold text-slate-600 text-center w-[200px]">Custom Messages</span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <VueDraggable
                      v-model="customMessageElements"
                      tag="div"
                      :sort="true"
                      class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden overflow-y-auto grow"
                      :animation="150"
                      :group="{ name: 'availableDataElements', put: false }"
                    >
                      <div v-for="(element, index) in customMessageElements" :key="element">
                        <v-chip close label class="m-1 cursor-grab max-w-[180px]">
                          <span class="wrapclass">{{ element }}</span>
                          <v-icon right class="ml-2" @click.stop="removeCustomMessageElement(index)">mdi-close</v-icon>
                        </v-chip>
                      </div>
                      <v-menu :key="customMessageElements.length" :close-on-content-click="false" offset-y>
                        <template #activator="{ props }">
                          <v-btn size="sm" icon v-bind="props" class="mt-3 mb-1 mr-1" @click="props.click">
                            <v-icon>mdi-plus</v-icon>
                          </v-btn>
                        </template>
                        <v-card class="px-4 pt-2 overflow-hidden" width="400px">
                          <span class="w-full text-sm font-bold text-center text-slate-600">Enter message</span>
                          <v-text-field
                            v-model="newMessage"
                            variant="outlined"
                            autofocus
                            width="400px"
                            class="mt-2"
                            @keyup.enter="addCustomMessageElement()"
                          />
                        </v-card>
                      </v-menu>
                    </VueDraggable>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
            <div id="rightColumn" class="flex flex-col w-[80%] ml-2">
              <div class="flex flex-row justify-between w-full align-center">
                <div class="w-1"></div>
                <h1 class="mb-4 text-lg font-bold text-center text-slate-600">On Screen Telemetry Data</h1>
                <div>
                  <v-icon color="slate-600" class="mb-1 mr-0.5" @click="showHelpTooltip = !showHelpTooltip"
                    >mdi-help-circle-outline</v-icon
                  >
                  <v-tooltip
                    v-model="showHelpTooltip"
                    :open-on-hover="false"
                    activator="parent"
                    location="bottom"
                    arrow
                    content-class="border-[#ffffff55] border-2"
                    @click:outside="showHelpTooltip = false"
                  >
                    <div class="flex flex-col p-2 gap-y-2">
                      Drag and drop variables from the left panel to the desired position on the Telemetry Data Display.
                    </div>
                  </v-tooltip>
                </div>
              </div>
              <div
                class="flex flex-row flex-wrap justify-start align-start w-full h-[70vh] border rounded-2xl elevation-1 bg-[#fdfdfd]"
              >
                <div
                  v-for="config in gridConfig"
                  :key="config.key"
                  class="flex flex-col w-[33.3%] h-[33.3%] border-dashed p-2"
                  :class="{
                    'border-r': !['RightTop', 'RightMid', 'RightBottom'].includes(config.key),
                    'border-b': !['LeftBottom', 'CenterBottom', 'RightBottom'].includes(config.key),
                    'justify-start align-start': ['LeftTop', 'CenterTop', 'LeftBottom'].includes(config.key),
                  }"
                >
                  <VueDraggable
                    v-model="datalogger.telemetryDisplayData.value[config.key]"
                    group="availableDataElements"
                    class="flex flex-col w-full h-full"
                    :class="getClassForConfig(config.key)"
                  >
                    <div v-for="variable in datalogger.telemetryDisplayData.value[config.key]" :key="variable">
                      <v-chip close label class="m-1 cursor-grab"
                        >{{ variable }}
                        <v-icon right class="ml-2 -mr-1" @click="removeChipFromGrid(config.key, variable)"
                          >mdi-close</v-icon
                        >
                      </v-chip>
                    </div>
                  </VueDraggable>
                </div>
                <div class="flex w-[97%] justify-end mt-[10px]">
                  <v-btn size="sm" variant="text" @click="resetAllChips">
                    <v-icon size="18" class="mr-2">mdi-refresh</v-icon>
                    <span>Reset Positions</span>
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-show="selectedTab === 'logs'" class="flex flex-col justify-center align-center">
          <h1 class="text-lg font-bold text-slate-600">Frequency of the telemetry log</h1>
          <span class="text-sm text-slate-400 w-[50%] text-center">
            Common values (1 - 100Hz) can be set with the slider.
          </span>
          <span class="text-sm text-slate-400">
            The full allowed range (0.1 - 1000Hz) can be specified using the text input.
          </span>
          <div class="flex flex-col justify-center m-3 align-center">
            <fwb-range v-model="newFrequency" class="m-2" :min="1" :max="100" :steps="1" label="" />
            <fwb-input v-model="newFrequencyString" class="w-24 m-1 text-center align-middle">
              <template #suffix>
                <span class="flex justify-center h-7 align-center">Hz</span>
              </template>
            </fwb-input>
          </div>
        </div>
      </template>
    </BaseConfigurationView>
  </div>
</template>

<script setup lang="ts">
import { FwbInput, FwbRange } from 'flowbite-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { CurrentlyLoggedVariables, datalogger } from '@/libs/sensors-logging'

import BaseConfigurationView from './BaseConfigurationView.vue'

const updateVariables = (): void => {
  loggedVariables.value = Array.from(CurrentlyLoggedVariables.getAllVariables()).filter(
    (variable) => !otherLoggingElements.value.includes(variable)
  )
  originalLoggedVariables.value = Array.from(CurrentlyLoggedVariables.getAllVariables()).filter(
    (variable) => !otherLoggingElements.value.includes(variable)
  )

  const allTelemetryValues: Set<string> = new Set()

  Object.values(datalogger.telemetryDisplayData.value).forEach((displayGridArray) => {
    displayGridArray.forEach((variable) => allTelemetryValues.add(variable))
  })
  // Filter variables that are already in the telemetry display grid
  loggedVariables.value = loggedVariables.value.filter((variable) => !allTelemetryValues.has(variable))
  otherLoggingElements.value = otherLoggingElements.value.filter((element) => !allTelemetryValues.has(element))
}

onMounted(updateVariables)

const otherAvailableLoggingElements = ['Mission name', 'Time', 'Date']

const loggedVariables = ref<string[]>([])
const originalLoggedVariables = ref<string[]>([])
const otherLoggingElements = ref(otherAvailableLoggingElements)
const originalOtherLoggingElements = ref(otherAvailableLoggingElements)
const newFrequency = ref(1000 / datalogger.logInterval.value)
const selectedTab = ref('telemetry')
const variablesPanel = ref<number[]>([])
const optionsPanel = ref<number[]>([])
const customMessagePanel = ref<number[]>([])
const showHelpTooltip = ref(false)
const customMessageElements = ref<string[]>([])
const newMessage = ref('')
const dragPosition = ref(0)

type GridKey =
  | 'LeftTop'
  | 'CenterTop'
  | 'RightTop'
  | 'LeftMid'
  | 'CenterMid'
  | 'RightMid'
  | 'LeftBottom'
  | 'CenterBottom'
  | 'RightBottom'

/* eslint-disable jsdoc/require-jsdoc  */
type GridConfig = {
  key: GridKey
  label: string
}

const gridConfig: GridConfig[] = [
  { key: 'LeftTop', label: 'Left Top' },
  { key: 'CenterTop', label: 'Center Top' },
  { key: 'RightTop', label: 'Right Top' },
  { key: 'LeftMid', label: 'Left Middle' },
  { key: 'CenterMid', label: 'Center Middle' },
  { key: 'RightMid', label: 'Right Middle' },
  { key: 'LeftBottom', label: 'Left Bottom' },
  { key: 'CenterBottom', label: 'Center Bottom' },
  { key: 'RightBottom', label: 'Right Bottom' },
]

const getClassForConfig = computed(() => {
  const alignments: Record<GridKey, string> = {
    CenterMid: 'justify-center align-center',
    LeftMid: 'justify-center align-start',
    RightBottom: 'justify-end align-end',
    RightMid: 'justify-center align-end',
    RightTop: 'justify-start align-end',
    LeftTop: 'justify-start align-start',
    CenterBottom: 'justify-end align-center',
    CenterTop: 'justify-start align-center',
    LeftBottom: 'justify-end align-start',
  }

  return (key: GridKey) => alignments[key] || ''
})

function handleDragOver(event: DragEvent): void {
  const thresholdTop = window.innerHeight * 0.5
  dragPosition.value = event.clientY

  if (dragPosition.value < thresholdTop) {
    document.getElementById('draggable-container')!.scrollIntoView({ behavior: 'smooth' })
  }
}

const removeChipFromGrid = (quadrantKey: string, chip: string): void => {
  const index = datalogger.telemetryDisplayData.value[quadrantKey].indexOf(chip)
  if (index !== -1) {
    datalogger.telemetryDisplayData.value[quadrantKey].splice(index, 1)

    if (originalLoggedVariables.value.includes(chip)) {
      loggedVariables.value.push(chip)
    } else if (originalOtherLoggingElements.value.includes(chip)) {
      otherLoggingElements.value.push(chip)
    } else if (!CurrentlyLoggedVariables.getAllVariables().includes(chip)) {
      customMessageElements.value.push(chip)
    }
  }
}

const addCustomMessageElement = (): void => {
  if (newMessage.value.trim() !== '') {
    customMessageElements.value.push(newMessage.value)
    newMessage.value = ''
  }
}

const removeCustomMessageElement = (index: number): void => {
  customMessageElements.value.splice(index, 1)
}

const resetAllChips = (): void => {
  loggedVariables.value = []
  otherLoggingElements.value = []

  const customMessageElementsBackup: string[] = []
  Object.values(datalogger.telemetryDisplayData.value).forEach((displayGridArray) => {
    displayGridArray.forEach((variable) => {
      if (CurrentlyLoggedVariables.getAllVariables().includes(variable)) return
      customMessageElementsBackup.push(variable)
    })
  })

  datalogger.telemetryDisplayData.value = {
    LeftTop: [],
    CenterTop: [],
    RightTop: [],
    LeftMid: [],
    CenterMid: [],
    RightMid: [],
    LeftBottom: [],
    CenterBottom: [],
    RightBottom: [],
  }

  otherLoggingElements.value = otherAvailableLoggingElements
  customMessageElements.value = [...customMessageElementsBackup, ...customMessageElements.value]
  updateVariables()
}

watch(newFrequency, (newVal) => {
  datalogger.setFrequency(newVal)
})

const newFrequencyString = computed({
  get: () => newFrequency.value.toString(),
  set: (value) => (newFrequency.value = parseFloat(value)),
})
</script>
<style scoped>
.wrapclass {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
