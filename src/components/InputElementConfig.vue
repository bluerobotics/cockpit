<template>
  <div
    class="flex fixed w-[250px] right-0 top-0 border-l-[1px] border-[#FFFFFF44] text-white elevation-5 bg-[#051e2d]"
    :style="getMarginsFromBarsHeight"
  >
    <div class="flex flex-col text-center">
      <v-btn
        class="absolute top-0 left-0"
        variant="text"
        size="small"
        icon="mdi-close"
        style="z-index: 50000"
        @click="CloseConfigPanel"
      />
      <v-btn
        class="absolute bg-[#FFFFFF44] text-white bottom-2 right-2"
        variant="plain"
        size="small"
        prepend-icon="mdi-delete"
        @click="deleteElement"
      >
        Delete
      </v-btn>
      <ExpansiblePanel
        v-if="currentElement"
        mark-expanded
        compact
        elevation-effect
        no-bottom-divider
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title><p class="ml-10">Options</p></template>
        <template #content>
          <div class="flex flex-col items-center mb-4 -ml-[7px] w-[248px]">
            <div
              v-for="optionKey in sortedOptionKeys"
              :key="optionKey"
              class="flex w-full justify-between items-center border-b-[1px] border-[#FFFFFF33] h-auto"
            >
              <p class="text-start ml-1 text-[14px] w-[60%]">{{ formatLabel(optionKey) }}</p>

              <template
                v-if="
                  typeof currentElement.options.layout[optionKey] === 'string' &&
                  !Array.isArray(getSelectChoices(optionKey)) &&
                  !isColorPicker(optionKey) &&
                  optionKey !== 'cockpitAction' &&
                  optionKey !== 'cockpitActions'
                "
              >
                <div class="max-w-[120px]">
                  <input
                    v-model="currentElement.options.layout[optionKey]"
                    type="text"
                    class="p-2 bg-[#FFFFFF11] w-[123px]"
                  />
                </div>
              </template>

              <template v-if="optionKey === 'cockpitAction'">
                <div class="max-w-[120px]">
                  <select v-model="currentElement.options.layout[optionKey]" class="p-2 bg-[#FFFFFF11] w-[120px]">
                    <option
                      v-for="cockpitAction in availableCockpitActions"
                      :key="cockpitAction.name"
                      :value="cockpitAction"
                      class="bg-[#000000AA]"
                    >
                      {{ cockpitAction.name }}
                    </option>
                  </select>
                </div>
              </template>

              <template v-if="typeof currentElement.options.layout[optionKey] === 'number'">
                <div class="max-w-[120px]">
                  <input
                    v-model.number="currentElement.options.layout[optionKey]"
                    type="number"
                    class="p-2 bg-[#FFFFFF11] w-[128px]"
                    @blur="validateNumber(optionKey)"
                  />
                </div>
              </template>

              <template v-else-if="Array.isArray(getSelectChoices(optionKey)) && optionKey !== 'selectorOptions'">
                <div class="max-w-[120px]">
                  <select v-model="currentElement.options.layout[optionKey]" class="p-2 bg-[#FFFFFF11] w-[120px]">
                    <option
                      v-for="choice in getSelectChoices(optionKey)"
                      :key="choice"
                      :value="choice"
                      class="bg-[#000000AA]"
                    >
                      {{ choice }}
                    </option>
                  </select>
                </div>
              </template>

              <template v-else-if="typeof currentElement.options.layout[optionKey] === 'boolean'">
                <div class="flex items-center max-w-[120px]">
                  <v-checkbox
                    v-model="currentElement.options.layout[optionKey]"
                    hide-details
                    density="compact"
                    class="text-white mr-10 h-[40px]"
                  />
                </div>
              </template>

              <template v-else-if="isColorPicker(optionKey)">
                <div class="max-w-[120px]">
                  <input v-model="currentElement.options.layout[optionKey]" type="color" class="p-0 w-20 mr-4" />
                </div>
              </template>

              <template v-if="optionKey === 'selectorOptions'">
                <div class="flex flex-col w-[144px] items-end h-auto">
                  <div
                    v-for="(item, index) in currentElement.options.layout[optionKey]"
                    :key="index"
                    class="flex items-center text-center border-b-[1px] border-l-[1px] border-[#FFFFFF11] w-full whitespace-nowrap"
                  >
                    <v-btn
                      v-if="currentElement.options.layout.selectorOptions.length > 1"
                      icon
                      size="x-small"
                      variant="text"
                      @click="removeSelectorOption(optionKey, index)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                    <v-menu
                      v-model="isOptionsMenuOpen[index]"
                      :close-on-content-click="false"
                      location="top start"
                      origin="top start"
                      transition="scale-transition"
                    >
                      <template #activator="{ props }">
                        <div class="flex justify-end items-center min-h-[40px] w-full">
                          <p
                            v-if="currentElement.options.layout[optionKey][index].name"
                            v-bind="props"
                            class="text-[14px] text-center w-[130px] cursor-pointer"
                          >
                            {{ currentElement.options.layout[optionKey][index].name }}
                          </p>

                          <v-btn
                            v-else
                            variant="elevated"
                            class="bg-[#FFFFFF22] my-[10px] mr-[23px] w-22"
                            size="x-small"
                            v-bind="props"
                            >edit</v-btn
                          >
                        </div>
                      </template>
                      <v-card
                        class="flex flex-col overflow-hidden pa-3 pb-0 gap-x-4"
                        :style="interfaceStore.globalGlassMenuStyles"
                      >
                        <div class="flex gap-x-4">
                          <div class="flex flex-col items-center">
                            <p class="text-[14px]">{{ `Option ${index + 1} name` }}</p>
                            <input
                              v-model="currentElement.options.layout[optionKey][index].name"
                              placeholder="option name"
                              theme="dark"
                              type="text"
                              class="p-2 w-[120px] bg-[#FFFFFF11]"
                            />
                          </div>
                          <div class="flex flex-col items-center">
                            <p class="text-[14px]">{{ `Option ${index + 1} value` }}</p>
                            <input
                              v-model="currentElement.options.layout[optionKey][index].value"
                              placeholder="value"
                              theme="dark"
                              type="text"
                              class="p-2 w-[120px] bg-[#FFFFFF11]"
                            />
                          </div>
                        </div>
                        <div class="flex justify-between items-center">
                          <v-btn
                            variant="text"
                            size="x-small"
                            class="my-2"
                            @click="
                              () => {
                                if (currentElement?.options.layout[optionKey][index].name === '') {
                                  removeSelectorOption(optionKey, index)
                                }
                                isOptionsMenuOpen[index] = false
                              }
                            "
                            >close</v-btn
                          >
                          <v-btn
                            variant="text"
                            size="small"
                            class="my-3"
                            :disabled="currentElement.options.layout[optionKey][index].name === ''"
                            @click="
                              () => {
                                addSelectorOption(optionKey)
                                isOptionsMenuOpen[index] = false
                                isOptionsMenuOpen[index + 1] = true
                              }
                            "
                            >add another option</v-btn
                          >
                        </div>
                      </v-card>
                    </v-menu>
                  </div>
                  <v-btn
                    variant="elevated"
                    class="bg-[#3B78A8] my-[10px] mr-[13px] w-22"
                    size="x-small"
                    @click="addSelectorOption(optionKey)"
                    >add</v-btn
                  >
                </div>
              </template>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
      <ExpansiblePanel
        v-if="currentElement && currentElement.isCustomElement"
        :key="currentElement.hash"
        no-bottom-divider
        no-top-divider
        mark-expanded
        elevation-effect
        compact
        darken-content
        invert-chevron
        :is-expanded="true"
      >
        <template #title>Actions</template>
        <template #content>
          <div class="flex flex-col items-center mb-4 -ml-[7px] w-[248px]">
            <template v-if="currentElement.component !== CustomWidgetElementType.Button">
              <div class="flex w-full justify-between items-center h-auto border-b-[1px] border-[#FFFFFF33]">
                <p class="text-center w-full text-sm">Data-lake variable</p>
                <div
                  v-if="!openNewDataLakeVariableForm && !openDataLakeVariableSelector"
                  class="flex flex-col justify-end items-center self-end h-auto mt-1"
                >
                  <v-btn
                    v-if="
                      openNewDataLakeVariableForm === false &&
                      currentElement.options.dataLakeVariable?.name === undefined
                    "
                    variant="elevated"
                    class="bg-[#3B78A8] mr-[13px] w-[60px]"
                    size="x-small"
                    @click="openNewDataLakeVariableForm = true"
                    >create</v-btn
                  >
                  <v-btn
                    v-if="!currentElement.options.dataLakeVariable?.name"
                    variant="elevated"
                    class="bg-[#FFFFFF22] mr-[13px] my-1"
                    size="x-small"
                    @click="openDataLakeVariableSelector = true"
                    >select</v-btn
                  >
                </div>
                <template
                  v-if="
                    (openDataLakeVariableSelector || currentElement.options.dataLakeVariable?.name) &&
                    !openNewDataLakeVariableForm
                  "
                >
                  <div class="max-w-[120px]">
                    <select v-model="currentElement.options.dataLakeVariable" class="p-2 bg-[#FFFFFF11] w-[120px]">
                      <option
                        v-for="variable in availableDataLakeVariables"
                        :key="variable.name"
                        :value="variable"
                        class="bg-[#000000AA]"
                      >
                        {{ variable.name }}
                      </option>
                    </select>
                  </div>
                </template>
              </div>
              <v-btn
                v-if="
                  (openDataLakeVariableSelector || currentElement.options.dataLakeVariable?.name) &&
                  !openNewDataLakeVariableForm
                "
                variant="text"
                class="self-start mt-[9px]"
                size="x-small"
                @click="handleResetVariable"
                >{{ currentElement.options.dataLakeVariable?.name ? 'reset' : 'back' }}</v-btn
              >
            </template>
            <template v-if="openNewDataLakeVariableForm">
              <div
                class="flex justify-between items-center h-[40px] w-full border-b-[1px] border-[#FFFFFF33]"
                :class="{
                  'border-[1px] border-red-700': dataLakeVariableError.includes('This name is already in use'),
                }"
              >
                <p class="ml-1 text-[14px]">Name</p>
                <input v-model="futureDataLakeVariable.name" type="text" class="p-2 bg-[#FFFFFF11] w-[123px]" />
              </div>
              <div class="flex justify-between items-center h-[40px] w-full border-b-[1px] border-[#FFFFFF33]">
                <p class="ml-1 text-[14px]">Description</p>
                <input v-model="futureDataLakeVariable.description" type="text" class="p-2 bg-[#FFFFFF11] w-[123px]" />
              </div>
              <div class="flex w-full justify-between">
                <v-btn variant="text" class="self-start mt-[9px]" size="x-small" @click="handleResetVariable">{{
                  currentElement.options.dataLakeVariable?.name ? 'reset' : 'back'
                }}</v-btn>
                <div>
                  <v-btn
                    variant="text"
                    size="x-small"
                    class="mr-[15px] mt-2"
                    :disabled="currentElement.options.dataLakeVariable === undefined"
                    @click="deleteParameterFromDataLake"
                    >delete</v-btn
                  >
                  <v-btn
                    variant="elevated"
                    size="x-small"
                    class="bg-[#3B78A8] mr-1 mt-2"
                    :class="{
                      'opacity-10': futureDataLakeVariable.name === '',
                    }"
                    :disabled="futureDataLakeVariable.name === ''"
                    @click="saveOrUpdateParameter"
                    >{{ currentElement.options.dataLakeVariable === undefined ? 'save' : 'update' }}</v-btn
                  >
                </div>
              </div>
            </template>

            <template v-if="currentElement.component === CustomWidgetElementType.Button">
              <div class="flex justify-between items-center h-[40px] w-full border-b-[1px] border-[#FFFFFF33]">
                <p class="ml-1 text-[14px]">Action to trigger</p>
                <select v-model="currentElement.options.cockpitAction" class="p-2 bg-[#FFFFFF11] w-[123px]">
                  <option
                    v-for="cockpitAction in availableCockpitActions"
                    :key="cockpitAction.name"
                    :value="cockpitAction"
                    class="bg-[#000000AA]"
                  >
                    {{ cockpitAction.name }}
                  </option>
                </select>
              </div>
            </template>
          </div>
          <div
            v-if="dataLakeVariableError.length > 0"
            class="flex justify-center items-center text-[14px] text-center h-[30px] bg-red-800 rounded-lg"
          >
            <p v-for="message in dataLakeVariableError" :key="message">• {{ message }}</p>
          </div>
        </template>
      </ExpansiblePanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  createDataLakeVariable,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableInfo,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { availableCockpitActions } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElement, CustomWidgetElementType, DataLakeVariable } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const currentElement = ref<CustomWidgetElement | undefined>(widgetStore.elementToShowOnDrawer)
const defaultDataLakeVariable: DataLakeVariable = {
  id: '',
  name: '',
  type: currentElement.value?.options.variableType,
  description: '',
}

const futureDataLakeVariable = ref<DataLakeVariable>(defaultDataLakeVariable)
const openNewDataLakeVariableForm = ref(false)
const isOptionsMenuOpen = ref<{ [key: number]: boolean }>({})
const dataLakeVariableError = ref<string[]>([])
const openDataLakeVariableSelector = ref(false)

watch(
  () => widgetStore.elementToShowOnDrawer,
  (newValue) => {
    currentElement.value = newValue
    futureDataLakeVariable.value = newValue?.options.dataLakeVariable || {
      id: '',
      name: '',
      type: currentElement.value?.options.variableType,
      description: '',
    }
    openNewDataLakeVariableForm.value = false
    openDataLakeVariableSelector.value = false
    if (newValue && newValue.hash) {
      widgetStore.miniWidgetManagerVars(newValue.hash).configMenuOpen = false
    }
  }
)

const getMarginsFromBarsHeight = computed(() => {
  return {
    marginTop: widgetStore.currentTopBarHeightPixels + 'px',
    marginBottom: widgetStore.currentBottomBarHeightPixels + 'px',
    height:
      window.innerHeight - widgetStore.currentTopBarHeightPixels - widgetStore.currentBottomBarHeightPixels - 1 + 'px',
  }
})

const handleResetVariable = (): void => {
  currentElement.value!.options.dataLakeVariable = undefined
  futureDataLakeVariable.value = defaultDataLakeVariable
  openNewDataLakeVariableForm.value = false
  openDataLakeVariableSelector.value = false
}

const validateNumber = (optionKey: string): void => {
  if (!currentElement.value) return

  const value = currentElement.value.options.layout[optionKey]
  if (value === '' || isNaN(Number(value))) {
    if (optionKey === 'minValue') {
      currentElement.value.options.layout[optionKey] = 0
    } else if (optionKey === 'maxValue') {
      currentElement.value.options.layout[optionKey] = currentElement.value.options.layout['minValue'] + 1
    } else {
      currentElement.value.options.layout[optionKey] = 0
    }
  }
}

const availableDataLakeVariables = computed(() => {
  return getAllDataLakeVariablesInfo()
})

const CloseConfigPanel = (): void => {
  widgetStore.elementToShowOnDrawer = undefined
  widgetStore.miniWidgetManagerVars(currentElement.value!.hash).configMenuOpen = false
}

const showActionExistsError = (): void => {
  openSnackbar({
    message: 'Variable name already exists',
    variant: 'error',
  })
  dataLakeVariableError.value.push('This name is already in use')
  setTimeout(() => {
    dataLakeVariableError.value.splice(0, 1)
  }, 3000)
}

const deleteParameterFromDataLake = async (): Promise<void> => {
  if (currentElement.value?.options.dataLakeVariable?.name) {
    try {
      await deleteDataLakeVariable(currentElement.value.options.dataLakeVariable)
      openSnackbar({
        message: 'Action variable deleted',
        variant: 'success',
      })
    } catch (e) {
      openSnackbar({
        message: 'Error deleting action variable',
        variant: 'error',
      })
    }
    futureDataLakeVariable.value.name = ''
    futureDataLakeVariable.value = defaultDataLakeVariable
    currentElement.value.options.dataLakeVariable = undefined
    openNewDataLakeVariableForm.value = false
  }
}

const saveOrUpdateParameter = (): void => {
  let newDataLakeVariable = {
    id: futureDataLakeVariable.value?.id === '' ? futureDataLakeVariable.value?.name : futureDataLakeVariable.value?.id,
    name: futureDataLakeVariable.value?.name,
    type: currentElement.value?.options.variableType,
    description: futureDataLakeVariable.value?.description,
  }
  if (
    currentElement.value &&
    futureDataLakeVariable.value &&
    currentElement.value.options.dataLakeVariable?.name === undefined // Knows that it's a new input element being named
  ) {
    if (getDataLakeVariableInfo(newDataLakeVariable.id) !== undefined) {
      showActionExistsError()
      return
    }
    createDataLakeVariable({ ...newDataLakeVariable, persistent: true, allowUserToChangeValue: true })
    currentElement.value.options.dataLakeVariable = newDataLakeVariable
    return
  }
  if (futureDataLakeVariable.value && currentElement.value?.options.dataLakeVariable?.name) {
    newDataLakeVariable.id = currentElement.value.options.dataLakeVariable.id
    updateDataLakeVariableInfo({ ...newDataLakeVariable, persistent: true, allowUserToChangeValue: true })
    currentElement.value.options.dataLakeVariable = newDataLakeVariable
  }
}

// Sort layout options in alphabetical order
const sortedOptionKeys = computed(() => {
  if (currentElement.value?.options?.layout) {
    return Object.keys(currentElement.value?.options?.layout).sort((a, b) => {
      return a.localeCompare(b)
    })
  }
  return []
})

// Capitalize and format labels
const formatLabel = (key: string): string => {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
}

const getSelectChoices = (key: string): string[] | undefined => {
  if (key === 'align') {
    return ['start', 'center', 'end']
  }
  if (key === 'buttonSize') {
    return ['small', 'default', 'large']
  }
  if (key === 'variant') {
    return ['text', 'outlined', 'flat', 'elevated', 'tonal', 'plain']
  }
  if (key === 'size') {
    return ['small', 'medium', 'large']
  }
  if (key === 'weight') {
    return ['normal', 'bold']
  }
  if (key === 'decoration') {
    return ['none', 'underline', 'overline', 'line-through']
  }
  if (key === 'selectorOptions') {
    return ['selector']
  }
}

const isColorPicker = (key: string): boolean => {
  return key.toLowerCase().includes('color')
}

const addSelectorOption = (key: string): void => {
  if (currentElement.value) {
    if (!currentElement.value.options.layout[key]) {
      currentElement.value.options.layout[key] = [{ name: '', value: '' }]
    } else {
      currentElement.value.options.layout[key].push({ name: '', value: '' })
    }
    isOptionsMenuOpen.value[currentElement.value.options.layout[key].length - 1] = true
  }
}

const removeSelectorOption = (key: string, index: number): void => {
  if (currentElement.value && currentElement.value.options.layout[key]) {
    currentElement.value.options.layout[key].splice(index, 1)
  }
}

const deleteElement = (): void => {
  if (currentElement.value) {
    try {
      widgetStore.removeElementFromCustomWidget(currentElement.value.hash)
      widgetStore.elementToShowOnDrawer = undefined
    } catch (e) {
      widgetStore.deleteMiniWidget(currentElement.value as any) // eslint-disable-line
    }
  }
}

onMounted(() => {
  if (currentElement.value?.options.dataLakeVariable?.name) {
    futureDataLakeVariable.value = currentElement.value?.options.dataLakeVariable
  }
})
</script>

<style scoped>
.label-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
