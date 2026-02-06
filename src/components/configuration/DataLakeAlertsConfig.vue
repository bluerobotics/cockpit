<template>
  <ExpansiblePanel :is-expanded="true" no-top-divider>
    <template #title>Data Lake Alerts:</template>
    <template #info>
      Configure alerts for any Data Lake variable. <br />
      Create custom conditions based on variable type and set alert levels.
    </template>
    <template #content>
      <div class="ml-4 mb-4 mr-4">
        <!-- Existing Alerts Table -->
        <div v-if="alerts.length > 0" class="mb-4">
          <table class="w-full">
            <thead>
              <tr>
                <th class="text-center text-sm font-medium text-slate-200 pb-3 w-12"></th>
                <th class="text-left text-sm font-medium text-slate-200 pb-3">Name</th>
                <th class="text-center text-sm font-medium text-slate-200 pb-3"># Conditions</th>
                <th class="text-center text-sm font-medium text-slate-200 pb-3 w-24">Min Interval</th>
                <th class="text-center text-sm font-medium text-slate-200 pb-3 w-24">Level</th>
                <th class="text-center text-sm font-medium text-slate-200 pb-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="alert in alerts" :key="alert.id" class="border-b border-slate-600 hover:bg-[#FFFFFF11]">
                <td class="py-3 text-center">
                  <v-checkbox
                    :model-value="alert.enabled"
                    hide-details
                    density="compact"
                    color="white"
                    class="justify-center"
                    @update:model-value="toggleAlertEnabled(alert)"
                  />
                </td>
                <td class="py-3 text-left">
                  <span class="text-sm font-medium">{{ alert.name }}</span>
                  <br />
                  <span class="text-xs text-slate-400">{{ getAlertVariablesSummary(alert) }}</span>
                </td>
                <td class="py-3 text-center">
                  <span class="text-sm">{{ alert.conditions.length }}</span>
                </td>
                <td class="py-3 text-center">
                  <span class="text-sm">{{ alert.minInterval / 1000 }}s</span>
                </td>
                <td class="py-3 text-center">
                  <span class="text-xs px-2 py-1 rounded" :class="getLevelClass(alert.level)">
                    {{ alert.level }}
                  </span>
                </td>
                <td class="py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      class="p-1 rounded hover:bg-[#FFFFFF22] transition-colors"
                      title="Edit alert"
                      @click="openEditDialog(alert)"
                    >
                      <v-icon size="18" icon="mdi-pencil" />
                    </button>
                    <button
                      class="p-1 rounded hover:bg-[#FFFFFF22] transition-colors"
                      title="Duplicate alert"
                      @click="duplicateAlert(alert)"
                    >
                      <v-icon size="18" icon="mdi-content-copy" />
                    </button>
                    <button
                      class="p-1 rounded hover:bg-[#FFFFFF22] transition-colors"
                      title="Delete alert"
                      @click="confirmDeleteAlert(alert)"
                    >
                      <v-icon size="18" icon="mdi-delete" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-6 text-slate-400">
          <v-icon size="48" icon="mdi-bell-outline" class="mb-2 opacity-50" />
          <p class="text-sm">No alerts configured yet.</p>
        </div>

        <!-- Add New Alert Button -->
        <button
          class="w-full py-2 px-4 rounded bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors text-sm font-medium flex items-center justify-center gap-2"
          @click="openCreateDialog"
        >
          <v-icon size="18" icon="mdi-plus" />
          Add New Alert
        </button>
      </div>
    </template>
  </ExpansiblePanel>

  <!-- Create/Edit Alert Dialog -->
  <v-dialog v-model="isDialogOpen" max-width="650px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ isEditing ? 'Edit Alert' : 'New Alert' }}
      </v-card-title>
      <v-card-text class="px-6">
        <div class="flex flex-col gap-4">
          <!-- Alert Name -->
          <v-text-field
            v-model="editingAlert.name"
            label="Alert Name"
            variant="outlined"
            density="compact"
            hide-details
            placeholder="e.g., High CPU Temperature"
          />

          <!-- Conditions Section -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium">Conditions (all must match)</label>
              <button
                class="text-xs px-2 py-1 rounded bg-[#FFFFFF22] hover:bg-[#FFFFFF33] transition-colors"
                @click="addCondition"
              >
                + Add Condition
              </button>
            </div>

            <div
              v-for="(condition, index) in editingAlert.conditions"
              :key="index"
              class="flex flex-col gap-2 p-3 rounded bg-[#FFFFFF11]"
            >
              <!-- Variable Selection for this condition -->
              <div class="flex items-center gap-2">
                <v-autocomplete
                  v-model="condition.variableId"
                  :items="availableVariables"
                  item-title="label"
                  item-value="value"
                  label="Variable"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-1"
                  @update:model-value="onConditionVariableChanged(condition)"
                />
                <v-tooltip text="Copy variable name for use in custom message" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <button
                      v-bind="tooltipProps"
                      class="p-2 rounded hover:bg-[#FFFFFF22] transition-colors"
                      :class="{ 'opacity-50 cursor-not-allowed': !condition.variableId }"
                      :disabled="!condition.variableId"
                      @click="copyVariableName(condition.variableId)"
                    >
                      <v-icon size="18" icon="mdi-content-copy" />
                    </button>
                  </template>
                </v-tooltip>
              </div>

              <!-- Operator and Value Row -->
              <div v-if="condition.variableId" class="flex items-center gap-2">
                <!-- Operator Selection -->
                <v-select
                  v-model="condition.operator"
                  :items="getOperatorsForCondition(condition)"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-shrink-0"
                  style="max-width: 120px"
                />

                <!-- Compare Value Input -->
                <template v-if="getConditionVariableType(condition) === 'boolean'">
                  <v-select
                    v-model="condition.compareValue"
                    :items="[
                      { title: 'true', value: true },
                      { title: 'false', value: false },
                    ]"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-1"
                  />
                </template>
                <template v-else-if="getConditionVariableType(condition) === 'number'">
                  <v-text-field
                    v-model.number="condition.compareValue"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-1"
                  />
                </template>
                <template v-else>
                  <v-text-field
                    v-model="condition.compareValue"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-1"
                  />
                </template>

                <!-- Remove Condition Button -->
                <button
                  v-if="editingAlert.conditions.length > 1"
                  class="p-1 rounded hover:bg-[#FFFFFF22] transition-colors text-red-400"
                  title="Remove condition"
                  @click="removeCondition(index)"
                >
                  <v-icon size="18" icon="mdi-close" />
                </button>
              </div>
            </div>

            <p v-if="editingAlert.conditions.length === 0" class="text-xs text-slate-400 text-center py-2">
              No conditions added. Click "Add Condition" to create one.
            </p>
          </div>

          <!-- Alert Level -->
          <v-select
            v-model="editingAlert.level"
            :items="alertLevelOptions"
            item-title="title"
            item-value="value"
            label="Alert Level"
            variant="outlined"
            density="compact"
            hide-details
          />

          <!-- Minimum Interval -->
          <v-text-field
            v-model.number="editingAlertIntervalSeconds"
            label="Minimum Interval (seconds)"
            type="number"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            hint="Minimum time between alerts"
          />

          <!-- Minimum Duration -->
          <div class="flex flex-col gap-2">
            <v-checkbox
              v-model="isDurationEnabled"
              label="Require minimum time meeting conditions"
              hide-details
              density="compact"
              color="white"
            />
            <v-text-field
              v-if="isDurationEnabled"
              v-model.number="editingAlertDurationMs"
              label="Minimum Duration (milliseconds)"
              type="number"
              min="1"
              variant="outlined"
              density="compact"
              hide-details
              hint="Conditions must be true for this duration before alerting"
            />
          </div>

          <!-- Custom Message (optional) -->
          <v-textarea
            v-model="editingAlert.customMessage"
            label="Custom Message (optional)"
            variant="outlined"
            density="compact"
            hide-details
            rows="2"
            auto-grow
            placeholder="Use {{variableName}} to include current values"
          />
        </div>
      </v-card-text>
      <v-divider class="mx-6" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full">
          <v-btn color="white" variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="white" :disabled="!isFormValid" @click="saveAlert">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Delete Confirmation Dialog -->
  <v-dialog v-model="isDeleteDialogOpen" max-width="400px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">Delete Alert</v-card-title>
      <v-card-text class="px-6 text-center">
        Are you sure you want to delete the alert "{{ alertToDelete?.name }}"?
      </v-card-text>
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full">
          <v-btn color="white" variant="text" @click="isDeleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="red" @click="deleteAlertConfirmed">Delete</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import {
  DataLakeVariable,
  DataLakeVariableType,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import {
  AlertCondition,
  createDataLakeAlert,
  DataLakeAlert,
  deleteDataLakeAlert,
  getAllDataLakeAlerts,
  getComparisonOperatorsForType,
  setDataLakeAlertEnabled,
  updateDataLakeAlert,
} from '@/libs/actions/data-lake-alerts'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { AlertLevel } from '@/types/alert'

const interfaceStore = useAppInterfaceStore()

// State
const alerts = ref<DataLakeAlert[]>([])
const availableVariablesMap = ref<Record<string, DataLakeVariable>>({})
const isDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const isEditing = ref(false)
const alertToDelete = ref<DataLakeAlert | null>(null)

// Default alert values
const defaultAlert: Omit<DataLakeAlert, 'id'> = {
  name: '',
  enabled: true,
  conditions: [],
  level: AlertLevel.Warning,
  minInterval: 60000,
  minDuration: 0,
  customMessage: '',
}

const editingAlert = ref<
  Omit<DataLakeAlert, 'id'> & {
    /**
     * Optional ID for editing an existing alert
     */
    id?: string
  }
>({ ...defaultAlert })

// Computed
const availableVariables = computed(() => {
  return Object.entries(availableVariablesMap.value).map(([id, variable]) => ({
    value: id,
    label: `${variable.name} (${variable.type})`,
  }))
})

/**
 * Get the variable type for a specific condition
 * @param {AlertCondition} condition - The condition to get the variable type for
 * @returns {DataLakeVariableType | undefined} The variable type
 */
const getConditionVariableType = (condition: AlertCondition): DataLakeVariableType | undefined => {
  if (!condition.variableId) return undefined
  return availableVariablesMap.value[condition.variableId]?.type
}

/**
 * Get available operators for a specific condition based on its variable type
 * @param {AlertCondition} condition - The condition to get the operators for
 * @returns {Array<{value: string, label: string}>} The available operators
 */
const getOperatorsForCondition = (
  condition: AlertCondition
): Array<{
  /** The operator value */
  value: string
  /** The operator label */
  label: string
}> => {
  const type = getConditionVariableType(condition)
  if (!type) return []
  return getComparisonOperatorsForType(type)
}

const editingAlertIntervalSeconds = computed({
  get: () => editingAlert.value.minInterval / 1000,
  set: (value: number) => {
    editingAlert.value.minInterval = value * 1000
  },
})

const editingAlertDurationMs = computed({
  get: () => editingAlert.value.minDuration,
  set: (value: number) => {
    editingAlert.value.minDuration = value
  },
})

const isDurationEnabled = computed({
  get: () => editingAlert.value.minDuration > 0,
  set: (enabled: boolean) => {
    editingAlert.value.minDuration = enabled ? 1000 : 0
  },
})

const isFormValid = computed(() => {
  return (
    editingAlert.value.name.trim() !== '' &&
    editingAlert.value.conditions.length > 0 &&
    editingAlert.value.conditions.every(
      (c) => c.variableId !== '' && c.operator !== undefined && c.compareValue !== undefined
    )
  )
})

const alertLevelOptions = [
  { title: 'Success', value: AlertLevel.Success },
  { title: 'Info', value: AlertLevel.Info },
  { title: 'Warning', value: AlertLevel.Warning },
  { title: 'Error', value: AlertLevel.Error },
  { title: 'Critical', value: AlertLevel.Critical },
]

// Methods
const loadAlerts = (): void => {
  alerts.value = getAllDataLakeAlerts()
}

const loadVariables = (): void => {
  availableVariablesMap.value = getAllDataLakeVariablesInfo()
}

const getVariableName = (variableId: string): string => {
  const variable = getDataLakeVariableInfo(variableId)
  return variable?.name || variableId
}

/**
 * Copy the variable name to clipboard for use in custom messages
 * @param {string} variableId - The ID of the variable to copy the name for
 */
const copyVariableName = async (variableId: string): Promise<void> => {
  if (!variableId) return
  const variableName = getVariableName(variableId)
  const placeholder = `{{${variableName}}}`
  try {
    await navigator.clipboard.writeText(placeholder)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

/**
 * Get a summary of all variables used in an alert's conditions
 * @param {DataLakeAlert} alert - The alert to get the variables summary for
 * @returns {string} The summary of the variables used in the alert's conditions
 */
const getAlertVariablesSummary = (alert: DataLakeAlert): string => {
  const uniqueVariableIds = [...new Set(alert.conditions.map((c) => c.variableId))]
  if (uniqueVariableIds.length === 0) return 'No variables'
  const names = uniqueVariableIds.map((id) => getVariableName(id))
  return names.join(', ')
}

const getLevelClass = (level: AlertLevel): string => {
  const classes: Record<AlertLevel, string> = {
    [AlertLevel.Success]: 'bg-green-600',
    [AlertLevel.Info]: 'bg-blue-600',
    [AlertLevel.Warning]: 'bg-yellow-600',
    [AlertLevel.Error]: 'bg-red-600',
    [AlertLevel.Critical]: 'bg-red-800',
  }
  return classes[level] || 'bg-slate-600'
}

const toggleAlertEnabled = (alert: DataLakeAlert): void => {
  setDataLakeAlertEnabled(alert.id, !alert.enabled)
  loadAlerts()
}

/**
 * Handle when a condition's variable is changed - reset operator and value to defaults
 * @param {AlertCondition} condition - The condition to handle the variable change for
 */
const onConditionVariableChanged = (condition: AlertCondition): void => {
  const type = getConditionVariableType(condition)
  if (type) {
    const operators = getComparisonOperatorsForType(type)
    condition.operator = operators[0]?.value || 'equals'
    // Set default compare value based on type
    switch (type) {
      case 'boolean':
        condition.compareValue = true
        break
      case 'number':
        condition.compareValue = 0
        break
      default:
        condition.compareValue = ''
    }
  }
}

/**
 * Add a new empty condition
 */
const addCondition = (): void => {
  editingAlert.value.conditions.push({
    variableId: '',
    operator: 'equals',
    compareValue: '',
  })
}

const removeCondition = (index: number): void => {
  editingAlert.value.conditions.splice(index, 1)
}

const openCreateDialog = (): void => {
  isEditing.value = false
  editingAlert.value = { ...defaultAlert }
  isDialogOpen.value = true
}

const openEditDialog = (alert: DataLakeAlert): void => {
  isEditing.value = true
  // Deep copy to avoid modifying the original alert in globalAlerts while editing
  editingAlert.value = JSON.parse(JSON.stringify(alert))
  isDialogOpen.value = true
}

const closeDialog = (): void => {
  isDialogOpen.value = false
  editingAlert.value = { ...defaultAlert }
}

const saveAlert = (): void => {
  if (!isFormValid.value) return

  if (isEditing.value && editingAlert.value.id) {
    updateDataLakeAlert(editingAlert.value as DataLakeAlert)
  } else {
    const { ...alertWithoutId } = editingAlert.value
    createDataLakeAlert(alertWithoutId)
  }

  loadAlerts()
  closeDialog()
}

/**
 * Duplicate an existing alert with a new ID
 * @param {DataLakeAlert} alert - The alert to duplicate
 */
const duplicateAlert = (alert: DataLakeAlert): void => {
  // Create a deep copy using JSON parse/stringify to avoid any references
  const alertCopy = JSON.parse(JSON.stringify(alert)) as DataLakeAlert
  // Remove the id so a new one will be generated
  const alertCopyWithoutId = alertCopy as Omit<DataLakeAlert, 'id'>
  // Append " (copy)" to the name
  alertCopyWithoutId.name = `${alert.name} (copy)`
  // Create the new alert
  createDataLakeAlert(alertCopyWithoutId)
  loadAlerts()
}

const confirmDeleteAlert = (alert: DataLakeAlert): void => {
  alertToDelete.value = alert
  isDeleteDialogOpen.value = true
}

const deleteAlertConfirmed = (): void => {
  if (alertToDelete.value) {
    deleteDataLakeAlert(alertToDelete.value.id)
    loadAlerts()
  }
  isDeleteDialogOpen.value = false
  alertToDelete.value = null
}

// Lifecycle
let variablesListenerId: string | null = null

onMounted(() => {
  loadAlerts()
  loadVariables()

  // Listen for variable changes
  variablesListenerId = listenToDataLakeVariablesInfoChanges(() => {
    loadVariables()
  })
})

onUnmounted(() => {
  if (variablesListenerId) {
    unlistenToDataLakeVariablesInfoChanges(variablesListenerId)
  }
})
</script>
