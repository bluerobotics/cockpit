<template>
  <BaseConfigurationView>
    <template #title>Data Lake</template>
    <template #content>
      <div class="flex-col overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px] max-h-[80vh]">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Variables monitor</template>
          <template #info>
            <p>View, manage, and create data lake variables.</p>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-full h-full">
              <div class="mb-4 flex items-center gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search variables..."
                    class="w-full px-3 py-2 bg-[#FFFFFF22] rounded-md text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span
                    v-if="searchQuery"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer mdi mdi-close-circle"
                    @click="searchQuery = ''"
                  />
                </div>
                <v-btn variant="text" class="rounded-md" @click="openNewVariableDialog">
                  <v-icon start>mdi-plus</v-icon>
                  Add variable
                </v-btn>
                <v-btn variant="text" class="rounded-md" @click="openNewFunctionDialog">
                  <v-icon start>mdi-function-variant</v-icon>
                  Add compound variable
                </v-btn>
              </div>
              <v-data-table
                :items="filteredVariables"
                items-per-page="10"
                density="compact"
                class="w-full h-full rounded-md bg-[#FFFFFF11] elevation-1"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
                :headers="tableHeaders"
                :header-props="{ style: { backgroundColor: 'rgba(0, 0, 0, 0.1)' } }"
                @update:options="(options) => updateTableOptions(options)"
                @update:current-items="(currentItems) => updateListOfActiveVariables(currentItems)"
              >
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center justify-left gap-2 rounded-xl m-1">
                        <button
                          :class="[
                            'transition-colors',
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

                        <p class="w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center rounded-xl mx-1">
                        <p class="w-[100px] whitespace-nowrap overflow-hidden text-ellipsis text-center">
                          {{ item.type }}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center rounded-xl mx-1">
                        <p class="w-[120px] whitespace-nowrap overflow-hidden text-ellipsis text-center">
                          {{ item.source }}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-start rounded-xl mx-1">
                        <p class="w-[220px] whitespace-nowrap overflow-hidden text-ellipsis text-left font-mono">
                          {{ parsedCurrentValue(item.id) }}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-end h-[42px] -mr-2">
                        <v-btn
                          v-if="isCompoundVariable(item.id)"
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editCompoundVariable(item.id)"
                        />
                        <v-btn
                          v-if="isUserDefinedVariable(item.id)"
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editUserDefinedVariable(item.id)"
                        />
                        <v-btn
                          v-if="isCompoundVariable(item.id) || isUserDefinedVariable(item.id)"
                          variant="outlined"
                          color="error"
                          class="rounded-full mx-1"
                          icon="mdi-delete"
                          size="x-small"
                          @click="deleteVariable(item.id)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="5" class="text-center flex items-center justify-center h-[50px] w-full">
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
import Fuse from 'fuse.js'
import { computed, onBeforeMount, onUnmounted, ref, watch } from 'vue'

import DataLakeVariableDialog from '@/components/DataLakeVariableDialog.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
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
  TransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import { copyToClipboard } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

type VariableSource = 'Compound' | 'Cockpit internal' | 'User defined'

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
  { title: 'Name', align: 'start', key: 'name', width: '220px', fixed: true, headerProps: { class: 'pl-10' } },
  { title: 'Type', align: 'center', key: 'type', width: '100px', fixed: true },
  { title: 'Source', align: 'center', key: 'source', width: '120px', fixed: true },
  { title: 'Current Value', align: 'start', key: 'value', width: '220px', fixed: true },
  { title: 'Actions', align: 'end', key: 'actions', width: '100px', fixed: true },
] as const

const copiedId = ref<string | null>(null)
const handleCopy = async (id: string): Promise<void> => {
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
  if (isCompoundVariable(id)) {
    return 'Compound'
  }

  if (isUserDefinedVariable(id)) {
    return 'User defined'
  }

  return 'Cockpit internal'
}

/**
 * Computed property that returns filtered variables based on the search query
 * Uses Fuse.js for fuzzy search on variable names and descriptions
 */
const filteredVariables = computed<DataLakeVariableWithSource[]>(() => {
  const variables = availableDataLakeVariables.value.map((v) => ({
    ...v,
    source: getVariableSource(v.id),
  }))

  if (!searchQuery.value) return variables

  const fuse = new Fuse<DataLakeVariableWithSource>(variables, {
    keys: ['name', 'description', 'id', 'source'],
    threshold: 0.3,
  })
  return fuse.search(searchQuery.value).map((result) => result.item)
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
  idVariableBeingEdited = undefined
  showVariableDialog.value = true
}

/**
 * Opens the dialog to edit an existing variable
 * @param {string} variableId The ID of the variable to edit
 */
const editUserDefinedVariable = (variableId: string): void => {
  const variable = availableDataLakeVariables.value.find((v) => v.id === variableId)
  if (variable && isUserDefinedVariable(variableId)) {
    idVariableBeingEdited = variableId
    showVariableDialog.value = true
  } else if (variable && !isUserDefinedVariable(variableId)) {
    openSnackbar({ message: `Variable with ID ${variableId} is not editable`, variant: 'error' })
  } else {
    openSnackbar({ message: `Variable with ID ${variableId} not found`, variant: 'error' })
  }
}

/**
 * Handles variable save event
 */
const handleVariableSaved = (): void => {
  showVariableDialog.value = false
}

/**
 * Deletes a variable (either compound or regular)
 * @param {string} id Variable ID
 */
const deleteVariable = (id: string): void => {
  if (isCompoundVariable(id)) {
    const func = getAllTransformingFunctions().find((f) => f.id === id)
    if (func) {
      deleteTransformingFunction(func)
    }
  } else if (isUserDefinedVariable(id)) {
    deleteDataLakeVariable(id)
  } else {
    openSnackbar({ message: `Variable with ID ${id} cannot be deleted`, variant: 'error' })
  }
}

// Compound variables functionality
const showNewFunctionDialog = ref(false)
const functionBeingEdited = ref<TransformingFunction | undefined>(undefined)

const isCompoundVariable = (id: string): boolean => {
  return getAllTransformingFunctions().some((func) => func.id === id)
}

const isUserDefinedVariable = (id: string): boolean => {
  return availableDataLakeVariables.value.find((v) => v.id === id)?.persistent ?? false
}

const editCompoundVariable = (id: string): void => {
  const func = getAllTransformingFunctions().find((f) => f.id === id)
  if (func) {
    functionBeingEdited.value = func
    showNewFunctionDialog.value = true
  }
}

const openNewFunctionDialog = (): void => {
  functionBeingEdited.value = undefined
  showNewFunctionDialog.value = true
}

const handleFunctionSaved = (): void => {
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
  table-layout: fixed;
}

:deep(.v-data-table__wrapper) {
  flex-grow: 1;
}
</style>
