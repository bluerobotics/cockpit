<template>
  <div class="flex flex-col text-center">
    <v-btn
      class="absolute top-0 left-0"
      variant="text"
      size="small"
      icon="mdi-close"
      style="z-index: 50000"
      @click="widgetStore.elementToShowOnDrawer = undefined"
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
      <template #title>Options</template>
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
                  v-model="currentElement.options.layout[optionKey]"
                  type="number"
                  class="p-2 bg-[#FFFFFF11] w-[128px]"
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
                  class="flex items-center text-center border-b-[1px] border-l-[1px] border-[#FFFFFF11] h-[40px] w-full whitespace-nowrap"
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
                      <p v-bind="props" class="text-[14px] w-full cursor-pointer">
                        {{ currentElement.options.layout[optionKey][index].name || `Option ${index + 1}` }}
                      </p>
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
                        <v-btn variant="text" size="x-small" class="my-2" @click="isOptionsMenuOpen[index] = false"
                          >close</v-btn
                        >
                        <v-btn
                          variant="text"
                          size="small"
                          class="my-3"
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
                  v-if="currentElement.options.actionParameter === undefined || !openNewActionParameterForm"
                  variant="elevated"
                  class="bg-[#3B78A8] my-[10px] mr-[13px] w-22"
                  size="x-small"
                  @click="addSelectorOption(optionKey)"
                  >add option</v-btn
                >
              </div>
            </template>
          </div>
        </div>
      </template>
    </ExpansiblePanel>
    <ExpansiblePanel
      v-if="currentElement"
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
      <template #title>Cockpit actions</template>
      <template #content>
        <div class="flex flex-col items-center mb-4 -ml-[7px] w-[248px]">
          <template v-if="currentElement.component !== CustomWidgetElementType.Button">
            <div class="flex w-full justify-between items-center h-[40px] border-b-[1px] border-[#FFFFFF33]">
              <p class="text-center w-full text-sm">Action URL parameter</p>
              <v-btn
                v-if="
                  openNewActionParameterForm === false && currentElement.options.actionParameter?.name === undefined
                "
                variant="elevated"
                class="bg-[#3B78A8] mr-[13px]"
                size="x-small"
                @click="openNewActionParameterForm = true"
                >create</v-btn
              >
            </div>
          </template>
          <template v-if="openNewActionParameterForm || currentElement.options.actionParameter?.name">
            <div
              class="flex justify-between items-center h-[40px] w-full border-b-[1px] border-[#FFFFFF33]"
              :class="{ 'border-[1px] border-red-700': actionParameterError.includes('This name is already in use') }"
            >
              <p class="ml-1 text-[14px]">Name</p>
              <input v-model="futureActionParameter.name" type="text" class="p-2 bg-[#FFFFFF11] w-[123px]" />
            </div>
            <div class="flex justify-between items-center h-[40px] w-full border-b-[1px] border-[#FFFFFF33]">
              <p class="ml-1 text-[14px]">Description</p>
              <input v-model="futureActionParameter.description" type="text" class="p-2 bg-[#FFFFFF11] w-[123px]" />
            </div>
            <div class="flex w-full justify-end">
              <v-btn
                variant="text"
                size="x-small"
                class="mr-[15px] mt-2"
                :disabled="currentElement.options.actionParameter === undefined"
                @click="deleteParameterFromDataLake"
                >delete</v-btn
              >
              <v-btn
                variant="elevated"
                size="x-small"
                class="bg-[#3B78A8] mr-1 mt-2"
                :class="{
                  'opacity-10': futureActionParameter.name === '',
                }"
                :disabled="futureActionParameter.name === ''"
                @click="saveOrUpdateParameter"
                >{{ currentElement.options.actionParameter === undefined ? 'save' : 'update' }}</v-btn
              >
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
          v-if="actionParameterError.length > 0"
          class="flex justify-center items-center text-[14px] text-center h-[30px] bg-red-800 rounded-lg"
        >
          <p v-for="message in actionParameterError" :key="message">• {{ message }}</p>
        </div>
      </template>
    </ExpansiblePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  createCockpitActionVariable,
  deleteCockpitActionVariable,
  getCockpitActionVariableInfo,
  updateCockpitActionVariableInfo,
} from '@/libs/actions/data-lake'
import { getAllHttpRequestActionConfigs, HttpRequestActionConfig } from '@/libs/actions/http-request'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CockpitActionParameter, CustomWidgetElement, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { showSnackbar } = useSnackbar()

const currentElement = ref<CustomWidgetElement | undefined>(widgetStore.elementToShowOnDrawer)
const defaultActionParameter: CockpitActionParameter = {
  id: '',
  name: '',
  type: currentElement.value?.options.variableType,
  description: '',
}

const availableCockpitActions = reactive<Record<string, HttpRequestActionConfig>>({})
const futureActionParameter = ref<CockpitActionParameter>(defaultActionParameter)
const openNewActionParameterForm = ref(false)
const isOptionsMenuOpen = ref<{ [key: number]: boolean }>({})
const actionParameterError = ref<string[]>([])

watch(
  () => widgetStore.elementToShowOnDrawer,
  (newValue) => {
    currentElement.value = newValue
    futureActionParameter.value = newValue?.options.actionParameter || {
      id: '',
      name: '',
      type: currentElement.value?.options.variableType,
      description: '',
    }
    openNewActionParameterForm.value = false
  }
)

const showActionExistsError = (): void => {
  showSnackbar({
    message: 'Action name already exists',
    variant: 'error',
  })
  actionParameterError.value.push('This name is already in use')
  setTimeout(() => {
    actionParameterError.value.splice(0, 1)
  }, 3000)
}

const deleteParameterFromDataLake = (): void => {
  if (currentElement.value?.options.actionParameter.name) {
    deleteCockpitActionVariable(currentElement.value.options.actionParameter)
    futureActionParameter.value.name = ''
    futureActionParameter.value = defaultActionParameter
    currentElement.value.options.actionParameter = undefined
    openNewActionParameterForm.value = false
  }
}

const saveOrUpdateParameter = (): void => {
  let newCockpitActionParameter = {
    id: futureActionParameter.value?.name,
    name: futureActionParameter.value?.name,
    type: currentElement.value?.options.variableType,
    description: futureActionParameter.value?.description,
  }
  if (
    currentElement.value &&
    futureActionParameter.value &&
    currentElement.value.options.actionParameter?.name === undefined // Knows that it's a new input element being named
  ) {
    if (getCockpitActionVariableInfo(newCockpitActionParameter.id) !== undefined) {
      showActionExistsError()
      return
    }
    createCockpitActionVariable(newCockpitActionParameter)
    currentElement.value.options.actionParameter = newCockpitActionParameter
    return
  }
  if (futureActionParameter.value && currentElement.value?.options.actionParameter?.name) {
    const actionVariableToCheck = getCockpitActionVariableInfo(newCockpitActionParameter.id)
    // Checks if it is updating the same element
    if (
      actionVariableToCheck !== undefined &&
      actionVariableToCheck.id !== currentElement.value.options.actionParameter.id
    ) {
      showActionExistsError()
      return
    }
    updateCockpitActionVariableInfo(newCockpitActionParameter)
    currentElement.value.options.actionParameter = newCockpitActionParameter
  }
}

// Sort layout options in alphabetical order
const sortedOptionKeys = computed(() => {
  if (!currentElement.value) return []

  return Object.keys(currentElement.value.options.layout).sort((a, b) => {
    return a.localeCompare(b)
  })
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
  }
}

const removeSelectorOption = (key: string, index: number): void => {
  if (currentElement.value && currentElement.value.options.layout[key]) {
    currentElement.value.options.layout[key].splice(index, 1)
  }
}

const deleteElement = (): void => {
  if (currentElement.value) {
    widgetStore.removeElementFromCustomWidget(widgetStore.elementToShowOnDrawer!.hash)
    widgetStore.elementToShowOnDrawer = undefined
    deleteParameterFromDataLake()
  }
}

const loadSavedActions = (): void => {
  Object.assign(availableCockpitActions, getAllHttpRequestActionConfigs())
}

onMounted(() => {
  if (currentElement.value?.options.actionParameter?.name) {
    futureActionParameter.value = currentElement.value?.options.actionParameter
  }
  loadSavedActions()
})
</script>

<style scoped>
.label-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
