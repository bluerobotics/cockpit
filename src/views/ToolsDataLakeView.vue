<template>
  <BaseConfigurationView>
    <template #title>Data Lake</template>
    <template #content>
      <div class="flex-col overflow-y-auto ml-[10px] pr-3 -mr-[10px] max-h-[80vh] w-[880px] max-w-[calc(100vw-9rem)]">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Variables monitor</template>
          <template #info>
            <p>
              View, manage, and create data lake variables. Use the Record checkbox to include a variable in CSV/JSON
              data logs.
            </p>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-1 mb-4 mt-1 w-full h-full">
              <div class="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1.5">
                <div class="relative min-w-[8rem] flex-1">
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search variables..."
                    class="w-full px-2 py-1.5 bg-[#FFFFFF22] rounded-md text-xs text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span
                    v-if="searchQuery"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer mdi mdi-close-circle"
                    @click="searchQuery = ''"
                  />
                </div>
                <v-btn variant="text" size="small" class="rounded-md text-xs" @click="openNewVariableDialog">
                  <v-icon start size="16">mdi-plus</v-icon>
                  Add variable
                </v-btn>
                <v-btn variant="text" size="small" class="rounded-md text-xs" @click="openNewFunctionDialog">
                  <v-icon start size="16">mdi-function-variant</v-icon>
                  Add compound variable
                </v-btn>
                <v-btn-toggle
                  :model-value="viewMode"
                  mandatory
                  divided
                  density="compact"
                  variant="text"
                  class="bg-transparent shrink-0 elevation-1 border border-[#FFFFFF1A]"
                  @update:model-value="setViewMode"
                >
                  <v-btn
                    v-for="mode in viewModes"
                    :key="mode"
                    :value="mode"
                    size="x-small"
                    class="capitalize text-white text-xs px-2"
                  >
                    {{ mode }}
                  </v-btn>
                </v-btn-toggle>
              </div>
              <v-data-table
                :items="filteredVariables"
                items-per-page="10"
                density="compact"
                class="rounded-lg bg-[#FFFFFF11] mb-2 elevation-1"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
                :headers="tableHeaders"
                :header-props="{ style: { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }"
                @update:options="(options) => updateTableOptions(options)"
                @update:current-items="(currentItems) => updateListOfActiveVariables(currentItems)"
              >
                <template #item="{ item }">
                  <tr :class="{ 'relative z-10': copiedId === item.id }">
                    <td>
                      <div class="flex items-center gap-1 min-w-0">
                        <button
                          :class="[
                            'transition-colors shrink-0 text-sm',
                            'relative',
                            copiedId === item.id
                              ? 'text-green-400 hover:text-green-400'
                              : 'text-gray-400 hover:text-white',
                          ]"
                          title="Copy ID"
                          @click="handleCopy(item.id)"
                        >
                          <span class="mdi mdi-content-copy" />
                          <div
                            v-if="copiedId === item.id"
                            class="absolute -top-5 left-1/2 translate-x-2 bg-green-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10"
                          >
                            Variable ID copied!
                          </div>
                        </button>

                        <v-tooltip location="top">
                          <template #activator="{ props: tooltipProps }">
                            <div v-bind="tooltipProps" class="min-w-0 flex-1">
                              <ScrollingText :text="item.name" max-width="100%" align="left" :pause-on-hover="false" />
                            </div>
                          </template>
                          <span>{{ item.name }}</span>
                        </v-tooltip>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center gap-0.5 min-w-0">
                        <p class="whitespace-nowrap overflow-hidden text-ellipsis">
                          {{ item.type }}
                        </p>
                        <div class="w-3.5 shrink-0">
                          <v-tooltip
                            v-if="isCompoundVariable(item.id)"
                            location="top"
                            text="Compound variable: its value is calculated from an expression"
                          >
                            <template #activator="{ props: tooltipProps }">
                              <span v-bind="tooltipProps" class="mdi mdi-function-variant text-gray-400 text-sm" />
                            </template>
                          </v-tooltip>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p class="whitespace-nowrap overflow-hidden text-ellipsis text-center">
                        {{ item.source }}
                      </p>
                    </td>
                    <td>
                      <p class="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-left font-mono">
                        {{ displayedValue(item) }}
                      </p>
                    </td>
                    <td>
                      <p class="whitespace-nowrap overflow-hidden text-ellipsis text-center">
                        {{ displayedUnit(item) }}
                      </p>
                    </td>
                    <td>
                      <div class="grid grid-cols-2 place-items-center">
                        <div class="flex h-[18px] w-[18px] items-center justify-center">
                          <button
                            v-if="isCompoundVariable(item.id) && canEditVariable(item.id)"
                            class="text-gray-400 hover:text-white text-sm leading-none"
                            title="Edit"
                            @click="editCompoundVariable(item.id)"
                          >
                            <span class="mdi mdi-pencil" />
                          </button>
                          <button
                            v-else-if="!isCompoundVariable(item.id) && canEditVariable(item.id)"
                            class="text-gray-400 hover:text-white text-sm leading-none"
                            title="Edit"
                            @click="editVariable(item.id)"
                          >
                            <span class="mdi mdi-pencil" />
                          </button>
                        </div>
                        <div class="flex h-[18px] w-[18px] items-center justify-center">
                          <button
                            v-if="canDeleteVariable(item.id)"
                            class="text-red-400 hover:text-red-300 text-sm leading-none"
                            title="Delete"
                            @click="deleteVariable(item.id)"
                          >
                            <span class="mdi mdi-delete" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center">
                        <v-checkbox
                          :model-value="recordedVariableIds.includes(item.id)"
                          density="compact"
                          hide-details
                          color="white"
                          class="record-checkbox flex-none"
                          @update:model-value="(recorded) => handleRecordToggle(item.id, recorded)"
                          @click.stop
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="7" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] ml-[170px] w-full">No data lake variables found</p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>

  <TransformingFunctionDialog
    v-model="showNewFunctionDialog"
    :edit-function="functionBeingEdited"
    @saved="handleFunctionSaved"
  />

  <DataLakeVariableDialog
    v-model="showVariableDialog"
    :id-variable-being-edited="idVariableBeingEdited"
    @saved="handleVariableSaved"
  />
</template>

<script setup lang="ts">
import { useThrottle } from '@vueuse/core'
import { computed, onBeforeMount, onUnmounted, ref, watch } from 'vue'

import DataLakeVariableDialog from '@/components/DataLakeVariableDialog.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import ScrollingText from '@/components/ScrollingText.vue'
import TransformingFunctionDialog from '@/components/TransformingFunctionDialog.vue'
import { openSnackbar } from '@/composables/snackbar'
import {
  DataLakeVariable,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import {
  deleteTransformingFunction,
  getAllTransformingFunctions,
  isCompoundDataLakeVariable,
  TransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import { dataLakeLogger } from '@/libs/data-lake-logging'
import { type ConvertedValue, convertValue, UnitSystem, unitSystems } from '@/libs/units'
import { copyToClipboard } from '@/libs/utils'
import {
  canUserChangeDataLakeVariable,
  canUserDeleteDataLakeVariable,
  isSystemOwnedDataLakeVariable,
} from '@/libs/utils-data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

type VariableSource = 'Cockpit internal' | 'User defined'

/**
 * DataLakeVariable with source type
 */
interface DataLakeVariableWithSource extends DataLakeVariable {
  /**
   * Source type
   */
  source: VariableSource
}

const tableHeaders = [
  { title: 'Name', align: 'start', key: 'name', width: '260px' },
  { title: 'Type', align: 'center', key: 'type', width: '78px' },
  { title: 'Source', align: 'center', key: 'source', width: '118px' },
  { title: 'Value', align: 'start', key: 'value', width: '160px' },
  { title: 'Unit', align: 'center', key: 'unit', width: '52px' },
  { title: 'Actions', align: 'end', key: 'actions', width: '56px' },
  {
    title: 'Record',
    align: 'center',
    key: 'record',
    width: '56px',
    sortable: true,
    value: (item: DataLakeVariableWithSource) => (recordedVariableIds.value.includes(item.id) ? 1 : 0),
  },
] as const

const recordedVariableIds = ref<string[]>([...dataLakeLogger.recordedVariableIds])

const handleRecordToggle = (variableId: string, recorded: boolean | null): void => {
  logUserAction(`${recorded ? 'Enabled' : 'Disabled'} recording of data-lake variable '${variableId}'`)
  dataLakeLogger.setVariableRecorded(variableId, recorded ?? false)
  recordedVariableIds.value = [...dataLakeLogger.recordedVariableIds]
}

const copiedId = ref<string | null>(null)
const handleCopy = async (id: string): Promise<void> => {
  logUserAction(`Copied data-lake variable ID '${id}'`)
  await copyToClipboard(id)
  copiedId.value = id
  setTimeout(() => {
    copiedId.value = null
  }, 2000)
}

const availableDataLakeVariables = ref<DataLakeVariable[]>([])
let dataLakeVariablesCurrentlyBeingShown: string[] = []
const currentValues = ref<Record<string, string | number | boolean | undefined>>({})
let initialVariablesSetupRun = false

const listeners: Record<string, string> = {}
let dataLakeVariableInfoListenerId: string | undefined

const setupVariableListeners = (): void => {
  cleanupVariableListeners()

  dataLakeVariablesCurrentlyBeingShown.forEach((variableId) => {
    currentValues.value[variableId] = getDataLakeVariableData(variableId)

    const listenerId = listenDataLakeVariable(variableId, (value) => {
      currentValues.value[variableId] = value
    })

    listeners[variableId] = listenerId
  })
}

const cleanupVariableListeners = (): void => {
  Object.entries(listeners).forEach(([variableId, listenerId]) => {
    unlistenDataLakeVariable(variableId, listenerId)
    delete listeners[variableId]
  })
}

onBeforeMount(() => {
  availableDataLakeVariables.value = Object.values(getAllDataLakeVariablesInfo())
  dataLakeVariableInfoListenerId = listenToDataLakeVariablesInfoChanges((variables) => {
    availableDataLakeVariables.value = Object.values(variables)
  })
})

onUnmounted(() => {
  cleanupVariableListeners()

  if (dataLakeVariableInfoListenerId) {
    unlistenToDataLakeVariablesInfoChanges(dataLakeVariableInfoListenerId)
  }
})

const parsedCurrentValue = (id: string): string => {
  if (currentValues.value[id] === undefined) return ''

  if (availableDataLakeVariables.value.find((variable) => variable.id === id)?.type === 'number') {
    return String(currentValues.value[id])
  }

  return String(currentValues.value[id])
}

const viewModes = ['raw', UnitSystem.Metric, UnitSystem.Imperial] as const

const viewMode = ref<(typeof viewModes)[number]>('raw')

const setViewMode = (mode: unknown): void => {
  logUserAction(`Switched the data-lake variables monitor to ${mode} units`)
  viewMode.value = mode as (typeof viewModes)[number]
}

// Values are stored as the vehicle sent them, so reading them in another unit is a display-time
// conversion the table does on what it is about to show.
const convertedValue = (item: DataLakeVariable): ConvertedValue | undefined => {
  const value = currentValues.value[item.id]
  if (viewMode.value === 'raw' || typeof value !== 'number') return undefined
  return convertValue(value, item.unit, unitSystems[viewMode.value])
}

const displayedValue = (item: DataLakeVariable): string => {
  const converted = convertedValue(item)
  // Conversion is lossless; rounding here is what turned a degE7 latitude into four decimals of a degree.
  const text =
    converted === undefined ? parsedCurrentValue(item.id) : Number(converted.value.toPrecision(15)).toString()
  const value = converted?.value ?? currentValues.value[item.id]
  // A leading figure-space keeps digits from shifting when the value oscillates around zero.
  if (typeof value !== 'number' || text === '' || text.startsWith('-')) return text
  return `\u2007${text}`
}

const displayedUnit = (item: DataLakeVariable): string => {
  return convertedValue(item)?.unit ?? item.unit ?? ''
}

/**
 * Search query for filtering variables
 */
const searchQuery = ref('')

/**
 * Gets the source type for a data lake variable
 * @param {string} id Variable ID
 * @returns {VariableSource} Source type
 */
const getVariableSource = (id: string): VariableSource => {
  return isSystemOwnedDataLakeVariable(id) ? 'Cockpit internal' : 'User defined'
}

const throttledSearchQuery = useThrottle(searchQuery, 300, true, true)

/**
 * Computed property that returns filtered variables based on the search query
 */
const filteredVariables = computed<DataLakeVariableWithSource[]>(() => {
  const variables = availableDataLakeVariables.value.map((v) => ({
    ...v,
    source: getVariableSource(v.id),
  }))

  if (!throttledSearchQuery.value) return variables

  const query = throttledSearchQuery.value.toLowerCase()

  return variables.filter((v) => {
    return (
      v.name.toLowerCase().includes(query) ||
      (v.description && v.description.toLowerCase().includes(query)) ||
      v.id.toLowerCase().includes(query) ||
      v.source.toLowerCase().includes(query) ||
      // Searchable by the word the table no longer shows, since the "Add compound variable" button teaches it.
      (isCompoundVariable(v.id) && 'compound'.startsWith(query))
    )
  })
})

// Do not listen to variables that are not in the list, so we don't use unnecessary CPU/Memory resources
// eslint-disable-next-line jsdoc/require-jsdoc
const updateListOfActiveVariables = (currentItems: { raw: DataLakeVariableWithSource }[]): void => {
  const currentItemsIds = currentItems.map((v) => v.raw.id)
  dataLakeVariablesCurrentlyBeingShown = currentItemsIds
  setupVariableListeners()
}

const updateTableOptions = (options: any): void => {
  if (!initialVariablesSetupRun) {
    initialVariablesSetupRun = true
    updateListOfActiveVariables(filteredVariables.value.slice(0, options.itemsPerPage).map((v) => ({ raw: v })))
  }
}

// Variable management
const showVariableDialog = ref(false)
let idVariableBeingEdited: string | undefined

/**
 * Opens the dialog to create a new variable
 */
const openNewVariableDialog = (): void => {
  logUserAction('Opened new data-lake variable dialog')
  idVariableBeingEdited = undefined
  showVariableDialog.value = true
}

/**
 * Opens the dialog to edit a user-defined or user-editable variable
 * @param {string} variableId The ID of the variable to edit
 */
const editVariable = (variableId: string): void => {
  const variable = availableDataLakeVariables.value.find((v) => v.id === variableId)
  if (variable && canEditVariable(variableId)) {
    logUserAction(`Opened edit dialog for data-lake variable '${variableId}'`)
    idVariableBeingEdited = variableId
    showVariableDialog.value = true
  } else if (variable) {
    openSnackbar({ message: `Variable with ID ${variableId} is not editable`, variant: 'error' })
  } else {
    openSnackbar({ message: `Variable with ID ${variableId} not found`, variant: 'error' })
  }
}

/**
 * Handles variable save event
 */
const handleVariableSaved = (): void => {
  logUserAction('Saved data-lake variable')
  showVariableDialog.value = false
}

/**
 * Deletes a variable (either compound or regular)
 * @param {string} id Variable ID
 */
const deleteVariable = (id: string): void => {
  if (!canDeleteVariable(id)) {
    openSnackbar({ message: `Variable with ID ${id} cannot be deleted`, variant: 'error' })
    return
  }

  if (isCompoundVariable(id)) {
    const func = getAllTransformingFunctions().find((f) => f.id === id)
    if (func) {
      logUserAction(`Deleted compound variable '${id}'`)
      deleteTransformingFunction(func)
    }
  } else {
    logUserAction(`Deleted data-lake variable '${id}'`)
    deleteDataLakeVariable(id)
  }
}

// Compound variables functionality
const showNewFunctionDialog = ref(false)
const functionBeingEdited = ref<TransformingFunction | undefined>(undefined)

const isCompoundVariable = (id: string): boolean => {
  return isCompoundDataLakeVariable(id)
}

const canDeleteVariable = (id: string): boolean => {
  return canUserDeleteDataLakeVariable(id)
}

const canEditVariable = (id: string): boolean => {
  return canUserChangeDataLakeVariable(id)
}

const editCompoundVariable = (id: string): void => {
  if (!canEditVariable(id)) {
    openSnackbar({ message: `Variable with ID ${id} is not editable`, variant: 'error' })
    return
  }

  const func = getAllTransformingFunctions().find((f) => f.id === id)
  if (func) {
    logUserAction(`Opened edit dialog for compound variable '${id}'`)
    functionBeingEdited.value = func
    showNewFunctionDialog.value = true
  }
}

const openNewFunctionDialog = (): void => {
  logUserAction('Opened new compound variable dialog')
  functionBeingEdited.value = undefined
  showNewFunctionDialog.value = true
}

const handleFunctionSaved = (): void => {
  logUserAction('Saved compound variable')
  showNewFunctionDialog.value = false
}

watch(showNewFunctionDialog, (show) => {
  if (show) return
  functionBeingEdited.value = undefined
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}

:deep(.v-data-table) {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 11px;
}

:deep(.v-data-table table) {
  table-layout: fixed;
  width: 100%;
}

:deep(.v-data-table__wrapper) {
  flex-grow: 1;
  overflow-x: hidden;
}

:deep(.v-data-table th),
:deep(.v-data-table td) {
  padding: 1px 4px !important;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.v-data-table th:first-child),
:deep(.v-data-table td:first-child) {
  padding-left: 16px !important;
}

:deep(.v-data-table td:first-child) {
  overflow: visible;
}

.record-checkbox :deep(.v-selection-control) {
  min-height: auto;
  justify-content: center;
}
</style>
