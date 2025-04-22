<template>
  <v-dialog :model-value="modelValue" max-width="560px" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ editMode ? 'Edit Variable' : 'New Variable' }}
      </v-card-title>
      <v-card-text class="px-8">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <v-text-field
              v-model="variable.id"
              label="Variable ID"
              variant="outlined"
              :disabled="editMode || !isManualIdEnabled"
              :rules="[(v) => !!v || 'ID is required']"
              class="flex-1"
              density="compact"
              hide-details
            />
            <v-btn
              class="self-start -mt-1"
              variant="text"
              icon="mdi-pencil"
              :color="isManualIdEnabled ? 'white' : 'grey'"
              :disabled="editMode"
              :style="{ cursor: editMode ? 'not-allowed' : 'pointer' }"
              @click="toggleManualIdEditing"
            />
          </div>
          <v-text-field
            v-model="variable.name"
            label="Variable Name"
            variant="outlined"
            :rules="[(v) => !!v || 'Name is required']"
            density="compact"
            hide-details
          />
          <div class="flex items-center gap-2">
            <label class="text-sm">Variable Type: </label>
            <v-radio-group
              v-model="variable.type"
              :rules="[(v) => !!v || 'Type is required']"
              density="compact"
              hide-details
              inline
            >
              <v-radio class="ml-3 mr-4" label="String" value="string" />
              <v-radio class="ml-3 mr-4" label="Number" value="number" />
              <v-radio class="ml-3 mr-4" label="Boolean" value="boolean" />
            </v-radio-group>
          </div>
          <v-text-field
            v-model="initialValue"
            :label="`Initial Value (${variable.type})`"
            variant="outlined"
            :error-messages="valueError"
            density="compact"
            hide-details
            @input="validateValue"
          />
          <v-textarea
            v-model="variable.description"
            label="Description"
            variant="outlined"
            placeholder="Optional description of what this variable is used for"
            rows="1"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="variable.persistent"
            label="Persist variable between boots"
            hide-details
            class="-mb-4 -mt-2"
          />
          <v-checkbox
            v-model="variable.persistValue"
            class="-my-4"
            hide-details
            label="Save variable value between boots"
            :disabled="!variable.persistent"
          />
        </div>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="white" :disabled="!isValid" @click="saveVariable">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue'

import {
  createDataLakeVariable,
  DataLakeVariable,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { machinizeString } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Props for the DataLakeVariableDialog component
 */
const props = defineProps<{
  /** Whether the dialog is visible */
  modelValue: boolean
  /** The variable to edit, if in edit mode */
  idVariableBeingEdited?: string
}>()

/**
 * Emits for the DataLakeVariableDialog component
 */
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const interfaceStore = useAppInterfaceStore()
const editMode = computed(() => !!props.idVariableBeingEdited)
const isManualIdEnabled = ref(false)
const modelValue = toRef(props, 'modelValue')

/**
 * The variable being created or edited
 */
const variable = reactive<DataLakeVariable>({
  id: '',
  name: '',
  type: 'number',
  description: '',
  persistent: true,
  persistValue: true,
})

/**
 * The initial value for the variable
 */
const initialValue = ref<string>('')

/**
 * Error message for the value field
 */
const valueError = ref<string>('')

/**
 * Resets the form to its initial state
 */
const resetForm = (): void => {
  variable.id = ''
  variable.name = ''
  variable.type = 'number'
  variable.description = ''
  variable.persistent = true
  variable.persistValue = true
  initialValue.value = ''
  valueError.value = ''
  isManualIdEnabled.value = false
}

/**
 * Toggle manual ID editing mode
 */
const toggleManualIdEditing = (): void => {
  if (!editMode.value) {
    isManualIdEnabled.value = !isManualIdEnabled.value
  }
}

/**
 * Auto-update ID from name when name changes (if manual ID editing is not enabled)
 */
watch(
  () => variable.name,
  (newName) => {
    if (!isManualIdEnabled.value && !editMode.value) {
      variable.id = machinizeString(newName)
    }
  }
)

/**
 * Set persistValue to false when persistent is set to false
 */
watch(
  () => variable.persistent,
  (isPersistent) => {
    if (!isPersistent) {
      variable.persistValue = false
    }
  }
)

/**
 * Watch for changes to variable.id
 * If manual ID editing is not enabled, update variable.name to match the new ID
 */
watch(
  () => variable.id,
  (newId) => {
    if (!isManualIdEnabled.value && !editMode.value) {
      variable.id = machinizeString(newId)
    }
  }
)

/**
 * Reset form when dialog is opened in create mode
 */
watch(modelValue, (isOpen) => {
  if (isOpen && props.idVariableBeingEdited === undefined) {
    resetForm()
  } else if (isOpen && props.idVariableBeingEdited !== undefined) {
    const variableInfo = getDataLakeVariableInfo(props.idVariableBeingEdited)
    if (variableInfo) {
      const currentValue = getDataLakeVariableData(variableInfo.id)
      variable.id = variableInfo.id
      variable.name = variableInfo.name
      variable.type = variableInfo.type
      variable.description = variableInfo.description || ''
      variable.persistent = variableInfo.persistent
      variable.persistValue = variableInfo.persistValue
      initialValue.value = currentValue ? currentValue.toString() : ''
    }
  }
})

/**
 * Validates the value field based on the selected type
 * @returns { boolean } True if valid, false otherwise
 */
const validateValue = (): boolean => {
  if (!initialValue.value) return true

  if (variable.type === 'number') {
    const num = Number(initialValue.value)
    if (isNaN(num)) {
      valueError.value = 'Must be a valid number'
      return false
    }
  } else if (variable.type === 'boolean') {
    if (!['true', 'false', '0', '1'].includes(initialValue.value.toLowerCase())) {
      valueError.value = 'Must be a boolean value (true/false)'
      return false
    }
  }
  valueError.value = ''
  return true
}

/**
 * Whether the form is valid and can be submitted
 */
const isValid = computed(() => {
  return !!variable.name.trim() && !!variable.id && !valueError.value
})

/**
 * Closes the dialog
 */
const closeDialog = (): void => {
  emit('update:modelValue', false)
}

/**
 * Saves the variable
 */
const saveVariable = (): void => {
  if (!isValid.value) return

  let parsedValue: string | number | boolean | undefined

  if (initialValue.value) {
    if (variable.type === 'number') {
      parsedValue = Number(initialValue.value)
    } else if (variable.type === 'boolean') {
      parsedValue = initialValue.value.toLowerCase() === 'true' || initialValue.value === '1'
    } else {
      parsedValue = initialValue.value
    }
  }

  const newVariable = { ...variable, allowUserToChangeValue: true }

  if (editMode.value) {
    updateDataLakeVariableInfo(newVariable)
    if (parsedValue !== undefined) {
      setDataLakeVariableData(newVariable.id, parsedValue)
    }
  } else {
    createDataLakeVariable(newVariable, parsedValue)
  }

  emit('saved')
  closeDialog()
  resetForm()
}
</script>
