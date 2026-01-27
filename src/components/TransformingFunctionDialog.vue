<template>
  <v-dialog :model-value="modelValue" max-width="600px" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ editingExistingFunction ? 'Edit Compound Variable' : 'New Compound Variable' }}
      </v-card-title>
      <v-card-text class="px-8">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <v-text-field
              v-model="newFunction.id"
              label="Variable ID"
              variant="outlined"
              :disabled="editingExistingFunction || !isManualIdEnabled"
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
              :disabled="editingExistingFunction"
              :style="{ cursor: editingExistingFunction ? 'not-allowed' : 'pointer' }"
              @click="toggleManualIdEditing"
            />
          </div>
          <v-text-field
            v-model="newFunction.name"
            label="Variable Name"
            variant="outlined"
            :rules="[(v) => !!v || 'Name is required']"
            density="compact"
            hide-details
          />
          <div class="flex items-center gap-2">
            <label class="text-sm">Variable Type: </label>
            <v-radio-group
              v-model="newFunction.type"
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
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <label class="text-sm">Expression</label>
              <v-btn
                variant="text"
                density="compact"
                icon="mdi-information-outline"
                size="small"
                @click="isExpressionInfoVisible = !isExpressionInfoVisible"
              />
            </div>
            <v-expand-transition>
              <div v-if="isExpressionInfoVisible" class="mb-2 text-sm pa-2 bg-[#FFFFFF11] rounded">
                Create complex transformations by combining existing Data Lake variables using JavaScript expressions.
                <br />
                • Type <code>&#123;&#123;</code> to access available variables
                <br />
                • Return is optional, but should be included in complex expressions
                <br />
                • Remember to set the type accordingly
              </div>
            </v-expand-transition>
            <div
              ref="expressionEditorContainer"
              class="h-[300px] border border-[#FFFFFF33] rounded-lg overflow-hidden"
            />
          </div>
          <v-textarea
            v-model="newFunction.description"
            label="Description"
            variant="outlined"
            placeholder="Optional description of what this transformation does"
            rows="1"
            density="compact"
            hide-details
          />
        </div>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="white" :disabled="!isValidForm" @click="saveTransformingFunction">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import {
  createTransformingFunction,
  TransformingFunction,
  updateTransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import { createMonacoEditor, monaco } from '@/libs/monaco-manager'
import { machinizeString } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

const { openSnackbar } = useSnackbar()

/**
 * Props for the TransformingFunctionDialog component
 */
const props = defineProps<{
  /** Whether the dialog is visible */
  modelValue: boolean
  /** The function to edit, if in edit mode */
  editFunction?: TransformingFunction
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const interfaceStore = useAppInterfaceStore()
const editingExistingFunction = computed(() => !!props.editFunction)
const isManualIdEnabled = ref(false)
const isExpressionInfoVisible = ref(false)

const expressionPlaceholder = `// Example 1:
2 * {{ cockpit-memory-usage }} + 100

// Example 2:
if ({{ cockpit-memory-usage }} > 100) {
  return 'on'
}
return 'off'

// Example 3:
return {{ cockpit-memory-usage }} > 100
`

const defaultValues = {
  id: '',
  name: '',
  type: 'number' as 'string' | 'number' | 'boolean',
  expression: expressionPlaceholder,
  description: '',
}

const newFunction = ref(defaultValues)
// Auto-update ID from name when name changes (if manual ID editing is not enabled)
watch(
  () => newFunction.value.name,
  (newName) => {
    if (!isManualIdEnabled.value && !editingExistingFunction.value) {
      newFunction.value.id = machinizeString(newName)
    }
  }
)

// Initialize newFunction when editing
watch(
  () => props.editFunction,
  (func) => {
    if (func) {
      newFunction.value = {
        id: func.id,
        name: func.name,
        type: func.type,
        expression: func.expression,
        description: func.description || '',
      }
    } else {
      newFunction.value = { ...defaultValues }
    }
  },
  { immediate: true }
)

const closeDialog = (): void => {
  emit('update:modelValue', false)
  newFunction.value = { ...defaultValues }
  isManualIdEnabled.value = false
  isExpressionInfoVisible.value = false
}

// Toggle manual ID editing mode
const toggleManualIdEditing = (): void => {
  if (!editingExistingFunction.value) {
    isManualIdEnabled.value = !isManualIdEnabled.value
  }
}

const isValidForm = computed(() => {
  return newFunction.value.name && newFunction.value.expression && newFunction.value.type && newFunction.value.id
})

const saveTransformingFunction = (): void => {
  if (!isValidForm.value) {
    openSnackbar({ message: 'Please fill in all fields', variant: 'error' })
    return
  }

  if (editingExistingFunction.value && props.editFunction) {
    const { ...otherProps } = newFunction.value
    updateTransformingFunction({
      id: props.editFunction.id,
      ...otherProps,
    })
  } else {
    createTransformingFunction(
      newFunction.value.id,
      newFunction.value.name,
      newFunction.value.type,
      newFunction.value.expression,
      newFunction.value.description
    )
  }

  emit('saved')
  closeDialog()
}

const expressionEditorContainer = ref<HTMLElement | null>(null)
let expressionEditor: monaco.editor.IStandaloneCodeEditor | null = null

// Initialize editor
const initEditor = async (): Promise<void> => {
  if (!expressionEditorContainer.value || expressionEditor) return

  // Use the centralized Monaco manager with transform completion type
  expressionEditor = createMonacoEditor(expressionEditorContainer.value, {
    language: 'javascript',
    value: newFunction.value.expression,
    dataLakeCompletionType: 'use-bracket-parser',
  })

  // Watch for changes
  expressionEditor.onDidChangeModelContent(() => {
    if (expressionEditor) {
      newFunction.value.expression = expressionEditor.getValue()
    }
  })
}

// Clean up editor
const finishEditor = (): void => {
  if (expressionEditor) {
    expressionEditor.dispose()
    expressionEditor = null
  }
}

// Update editor when dialog opens/closes
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue) {
      await nextTick()
      await initEditor()
    } else {
      finishEditor()
    }
  }
)

// Update editor when editing an existing function
watch(
  () => newFunction.value.expression,
  (newValue) => {
    if (expressionEditor && expressionEditor.getValue() !== newValue) {
      expressionEditor.setValue(newValue)
    }
  }
)

onBeforeUnmount(() => {
  finishEditor()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
