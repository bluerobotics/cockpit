<template>
  <div class="draggable-container" @dragover.prevent="handleDragOver">
    <BaseConfigurationView>
      <template #help-icon>
        <GlassButton
          icon="mdi-help-circle-outline"
          :icon-size="interfaceStore.isOnSmallScreen ? 14 : 18"
          :icon-class="interfaceStore.isOnSmallScreen ? '-mt-[2px]' : '-mb-[3px]'"
          variant="uncontained"
          no-effects
          @click="openHelpDialog"
        />
      </template>
      <template #title
        ><div :class="interfaceStore.isOnPhoneScreen ? '' : 'mt-1'">On screen telemetry data</div></template
      >
      <template #content>
        <div
          class="flex justify-start align-start mb-2 overflow-y-auto"
          :class="
            interfaceStore.isOnSmallScreen
              ? 'h-[80vh] w-[80vw] gap-x-0 mt-2'
              : interfaceStore.isOnVeryLargeScreen
              ? 'h-[50vh] w-[50vw] gap-x-1 mt-4'
              : 'h-[60vh] w-[70vw] gap-x-1 mt-4'
          "
        >
          <div
            class="overflow-y-auto overflow-x-hidden"
            :class="interfaceStore.isOnSmallScreen ? 'h-[80vh] w-[200px] pr-1 ml-0' : 'h-[50vh] min-w-[220px] '"
          >
            <div id="leftColumn" class="flex flex-col justify-start align-start mt-[2vh] overflow-auto">
              <ExpansiblePanel compact mark-expanded darken-content hover-effect>
                <template #title>Overlay Options</template>
                <template #content>
                  <div>
                    <div class="flex flex-col flex-wrap justify-between align-start gap-y-0 pt-3">
                      <div class="flex flex-row justify-between align-center w-full gap-x-3">
                        <span
                          class="font-bold text-white text-start mb-5"
                          :class="interfaceStore.isOnSmallScreen ? ' text-xs w-[75px]' : 'text-sm w-[125px]'"
                          >Font size</span
                        >
                        <v-text-field
                          v-model="datalogger.telemetryDisplayOptions.value.fontSize"
                          density="compact"
                          :class="interfaceStore.isOnSmallScreen ? 'w-[50px]' : 'w-[75px]'"
                        />
                      </div>
                      <div class="flex flex-row justify-between align-center w-full gap-x-3 -mt-2">
                        <span
                          class="font-bold text-white text-start mb-5"
                          :class="interfaceStore.isOnSmallScreen ? ' text-xs w-[75px]' : 'text-sm w-[125px]'"
                          >Shadow size</span
                        >
                        <v-text-field
                          v-model="datalogger.telemetryDisplayOptions.value.fontShadowSize"
                          density="compact"
                          min="1"
                          max="5"
                          :class="interfaceStore.isOnSmallScreen ? 'w-[50px]' : 'w-[75px]'"
                        />
                      </div>
                      <div
                        class="flex flex-col justify-between w-full"
                        :class="interfaceStore.isOnSmallScreen ? 'gap-y-3' : 'gap-y-5 mt-2'"
                      >
                        <div class="flex flex-row justify-between w-[90%] align-center gap-x-3">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                          >
                            <template #activator="{ props }">
                              <span
                                :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                                class="text-sm font-bold text-white text-start"
                                >Font color</span
                              >
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
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
                        <div class="flex flex-row justify-between items-center w-[90%] gap-x-3 mt-1">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                            class="overflow-hidden"
                          >
                            <template #activator="{ props }">
                              <span
                                :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                                class="text-sm font-bold text-white text-start"
                                >Outline color</span
                              >
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
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
                        <div class="flex flex-row justify-between items-center w-[90%] gap-x-3">
                          <v-menu
                            :close-on-content-click="false"
                            location="top start"
                            origin="top start"
                            transition="scale-transition"
                          >
                            <template #activator="{ props }">
                              <span
                                :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                                class="text-sm font-bold text-white text-start"
                                >Shadow color</span
                              >
                              <div
                                v-bind="props"
                                class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
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
                      </div>
                      <div>
                        <div
                          class="flex flex-row justify-start align-center -ml-2"
                          :class="interfaceStore.isOnSmallScreen ? 'h-[40px] mt-[20px]' : 'h-[50px] mt-[30px]'"
                        >
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontBold" />
                          <span
                            class="text-sm font-bold text-white -mt-[20px] text-start"
                            :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                            >Bold</span
                          >
                        </div>
                        <div
                          class="flex flex-row justify-start align-center -ml-2"
                          :class="interfaceStore.isOnSmallScreen ? 'h-[40px]' : 'h-[50px]'"
                        >
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontItalic" />
                          <span
                            class="text-sm font-bold text-white -mt-[20px] text-start"
                            :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                            >Italic</span
                          >
                        </div>
                        <div
                          class="flex flex-row justify-start align-center -ml-2"
                          :class="interfaceStore.isOnSmallScreen ? 'h-[40px]' : 'h-[50px]'"
                        >
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontUnderline" />
                          <span
                            class="text-sm font-bold text-white -mt-[20px] text-start"
                            :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                            >Underline</span
                          >
                        </div>
                        <div
                          class="flex flex-row justify-start align-center -ml-2"
                          :class="interfaceStore.isOnSmallScreen ? 'h-[30px]' : 'h-[50px]'"
                        >
                          <v-checkbox v-model="datalogger.telemetryDisplayOptions.value.fontStrikeout" />
                          <span
                            class="text-sm font-bold text-white -mt-[20px] text-start"
                            :class="interfaceStore.isOnSmallScreen ? ' text-xs' : 'text-sm'"
                            >Strikethrough</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </ExpansiblePanel>
              <ExpansiblePanel compact mark-expanded no-top-divider darken-content hover-effect>
                <template #title>Vehicle Variables</template>
                <template #content>
                  <VueDraggable
                    v-model="loggedVariables"
                    tag="div"
                    :sort="true"
                    class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden py-2 overflow-y-auto"
                    :animation="150"
                    :group="{ name: 'availableDataElements', put: false }"
                  >
                    <div v-for="variable in loggedVariables.sort()" :key="variable">
                      <v-chip
                        :size="
                          interfaceStore.isOnSmallScreen
                            ? 'x-small'
                            : interfaceStore.isOnVeryLargeScreen
                            ? 'large'
                            : 'small'
                        "
                        :class="interfaceStore.isOnSmallScreen ? '' : 'my-[2px]'"
                        label
                        class="cursor-grab elevation-1"
                        >{{ variable }}</v-chip
                      >
                    </div>
                  </VueDraggable>
                </template>
              </ExpansiblePanel>
              <ExpansiblePanel compact mark-expanded no-top-divider darken-content hover-effect>
                <template #title>Mission Variables</template>
                <template #content>
                  <VueDraggable
                    v-model="otherLoggingElements"
                    tag="div"
                    :sort="true"
                    class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden py-2 overflow-y-auto grow"
                    :animation="150"
                    :group="{ name: 'availableDataElements', put: false }"
                  >
                    <div v-for="element in otherLoggingElements.sort()" :key="element">
                      <v-chip
                        :size="
                          interfaceStore.isOnSmallScreen
                            ? 'x-small'
                            : interfaceStore.isOnVeryLargeScreen
                            ? 'large'
                            : 'small'
                        "
                        :class="interfaceStore.isOnSmallScreen ? '' : 'my-[2px]'"
                        label
                        class="cursor-grab elevation-1"
                        >{{ element }}</v-chip
                      >
                    </div>
                  </VueDraggable>
                </template>
              </ExpansiblePanel>
              <ExpansiblePanel compact mark-expanded no-top-divider darken-content hover-effect>
                <template #title>Custom Messages</template>
                <template #content>
                  <VueDraggable
                    v-model="customMessageElements"
                    tag="div"
                    :sort="true"
                    class="flex flex-col items-start w-full min-h-[50px] overflow-x-hidden py-2 overflow-y-auto grow"
                    :animation="150"
                    :group="{ name: 'availableDataElements', put: false }"
                  >
                    <div v-for="(element, index) in customMessageElements" :key="element" class="min-h-[50px]">
                      <v-chip
                        :size="
                          interfaceStore.isOnSmallScreen
                            ? 'x-small'
                            : interfaceStore.isOnVeryLargeScreen
                            ? 'large'
                            : 'small'
                        "
                        :class="interfaceStore.isOnSmallScreen ? '' : 'my-[2px]'"
                        close
                        label
                        class="cursor-grab max-w-[180px] elevation-1"
                      >
                        <span class="wrapclass">{{ element }}</span>
                        <v-icon right class="ml-2" @click.stop="removeCustomMessageElement(index)">mdi-close</v-icon>
                      </v-chip>
                    </div>
                    <v-menu :key="customMessageElements.length" :close-on-content-click="false" offset-y>
                      <template #activator="{ props }">
                        <GlassButton
                          v-bind="props"
                          icon="mdi-plus-circle-outline"
                          :icon-size="interfaceStore.isOnSmallScreen ? 16 : 20"
                          variant="uncontained"
                          no-effects
                          @click="props.click"
                        />
                      </template>
                      <div
                        class="frosted-button backdrop-blur-md rounded-lg overflow-hidden w-[400px] px-4 pt-2 elevation-2"
                      >
                        <span class="text-sm font-bold text-white text-center w-full">Enter message</span>
                        <v-text-field
                          v-model="newMessage"
                          variant="outlined"
                          autofocus
                          width="400px"
                          class="mt-2"
                          @keyup.enter="addCustomMessageElement()"
                        />
                      </div>
                    </v-menu>
                  </VueDraggable>
                </template>
              </ExpansiblePanel>
              <ExpansiblePanel compact mark-expanded no-top-divider darken-content hover-effect>
                <template #title>Settings</template>
                <template #content>
                  <p class="text-[12px] mt-2 ml-1">Telemetry frequency - 1 to 100 Hz (default 1 Hz)</p>
                  <div class="flex mb-1 justify">
                    <v-slider
                      v-model="newFrequency"
                      color="white"
                      class="mt-1 scale-90 w-[100px]"
                      min="1"
                      step="1"
                      max="100"
                      hide-details
                    />
                    <v-text-field
                      v-model="newFrequencyString"
                      min="1"
                      step="1"
                      max="100"
                      class="bg-transparent w-[40px] -mr-2"
                      type="number"
                      density="compact"
                      variant="plain"
                      hide-details
                    />
                  </div>
                </template>
              </ExpansiblePanel>
              <div class="flex justify-end w-full mt-2">
                <v-btn size="x-small" variant="text" class="mr-2" @click="resetAllChips">
                  Reset Positions
                  <v-icon size="18" class="ml-2">mdi-refresh</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
          <div id="rightColumn" class="flex flex-col justify-center items-center relative w-full h-full ml-2">
            <div
              id="mocked-screen"
              class="frosted-button flex flex-row flex-wrap justify-start align-start elevation-1 w-full h-full"
              :class="interfaceStore.isOnSmallScreen ? 'rounded-lg' : 'rounded-2xl'"
            >
              <div
                v-for="config in gridConfig"
                :key="config.key"
                class="flex flex-col w-[33.3%] h-[33.3%] border-[0px] border-[#ffffff22] border-dashed p-2"
                :class="{
                  'border-r-[1px]': !['RightTop', 'RightMid', 'RightBottom'].includes(config.key),
                  'border-b-[0px]': !['LeftBottom', 'CenterBottom', 'RightBottom'].includes(config.key),
                  'border-t-[1px]': !['LeftTop', 'CenterTop', 'RightTop'].includes(config.key),
                  'justify-start align-start': ['LeftTop', 'CenterTop', 'LeftBottom'].includes(config.key),
                  'rounded-tr-lg': ['RightTop'].includes(config.key),
                  'rounded-tl-lg': ['LeftTop'].includes(config.key),
                  'rounded-br-lg': ['RightBottom'].includes(config.key),
                  'rounded-bl-lg': ['LeftBottom'].includes(config.key),
                }"
              >
                <VueDraggable
                  v-model="datalogger.telemetryDisplayData.value[config.key]"
                  group="availableDataElements"
                  class="flex flex-col items-start h-full w-full"
                  :class="getClassForConfig(config.key)"
                >
                  <div v-for="variable in datalogger.telemetryDisplayData.value[config.key]" :key="variable">
                    <v-chip
                      close
                      label
                      :size="
                        interfaceStore.isOnSmallScreen
                          ? 'x-small'
                          : interfaceStore.isOnVeryLargeScreen
                          ? 'large'
                          : 'small'
                      "
                      class="cursor-grab elevation-1"
                      :class="interfaceStore.isOnSmallScreen ? '' : 'my-[2px]'"
                      >{{ variable }}
                      <v-icon right class="ml-2 -mr-1" @click="removeChipFromGrid(config.key, variable)">
                        mdi-close
                      </v-icon>
                    </v-chip>
                  </div>
                </VueDraggable>
              </div>
            </div>
          </div>
        </div>
      </template>
    </BaseConfigurationView>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GlassButton from '@/components/GlassButton.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { CurrentlyLoggedVariables, datalogger } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const { showDialog } = useInteractionDialog()

const interfaceStore = useAppInterfaceStore()

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

const openHelpDialog = (): void => {
  showDialog({
    title: 'Video Configuration Help',
    message: [
      // eslint-disable-next-line vue/max-len
      'On this screen, you can configure the telemetry data that will be displayed on the subtitle file for recorded videos. You can change the font size, color, and style, as well as the position of each variable on the screen. You can also add custom messages that will be displayed on the video player screen.',
      'Drag and drop variables from the left panel to the desired position on the Telemetry Data Display.',
      'For additional Help, refer to documentation or contact us.',
    ],
    variant: 'text-only',
    maxWidth: interfaceStore.isOnSmallScreen ? '80vw' : '60vw',
    persistent: false,
  })
}

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
.frosted-button {
  background-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: white;
  transition: all 0.3s;
}
.right-column {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.mock-screen {
  position: absolute;
}
. input[type='number']::-webkit-inner-spin-button {
  margin-left: 6px;
}
</style>
