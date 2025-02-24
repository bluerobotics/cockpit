<template>
  <BaseConfigurationView>
    <template #title>Data Lake Configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[700px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Transforming Functions</template>
          <template #info>
            <li>Create new data lake variables by combining existing ones using expressions.</li>
            <li>The expressions will be evaluated in real-time as the input variables change.</li>
            <li>Use JavaScript expressions to define the transformations.</li>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[660px]">
              <v-data-table
                :items="transformingFunctions"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg mb-8"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #headers>
                  <tr>
                    <th class="text-left">
                      <p class="text-[16px] font-bold">Name</p>
                    </th>
                    <th class="text-left">
                      <p class="text-[16px] font-bold">Type</p>
                    </th>
                    <th class="text-right">
                      <p class="text-[16px] font-bold">Actions</p>
                    </th>
                  </tr>
                </template>
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center justify-left rounded-xl mx-1 w-[140px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.name }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-left rounded-xl mx-1 w-[80px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.type }}</p>
                      </div>
                    </td>
                    <td class="w-[120px] text-right">
                      <div class="flex items-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editTransformingFunction(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          color="error"
                          icon="mdi-delete"
                          size="x-small"
                          @click="handleDeleteFunction(item)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr class="w-full">
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                      <v-btn variant="outlined" class="rounded-lg" @click="showNewFunctionDialog = true">
                        <v-icon start>mdi-plus</v-icon>
                        New Function
                      </v-btn>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] ml-[170px] w-full">No transforming functions found</p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>

        <!-- New/Edit Function Dialog -->
        <v-dialog v-model="showNewFunctionDialog" max-width="600px">
          <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
            <v-card-title class="text-h6 font-weight-bold py-4 text-center">
              {{ editingExistingFunction ? 'Edit Function' : 'New Function' }}
            </v-card-title>
            <v-card-text class="px-8">
              <div class="flex flex-col gap-4">
                <v-text-field
                  v-model="newFunction.name"
                  label="Variable Name"
                  variant="outlined"
                  :disabled="editingExistingFunction"
                  :rules="[(v) => !!v || 'Name is required']"
                />
                <v-select
                  v-model="newFunction.type"
                  label="Variable Type"
                  variant="outlined"
                  :items="['string', 'number', 'boolean']"
                  :rules="[(v) => !!v || 'Type is required']"
                />
                <div class="flex flex-col gap-2">
                  <label class="text-sm">Expression</label>
                  <div
                    ref="expressionEditorContainer"
                    class="h-[300px] border border-[#FFFFFF33] rounded-lg overflow-hidden"
                  />
                  <div class="text-xs text-gray-400">
                    Create complex transformations by combining existing Data Lake variables using JavaScript
                    expressions. Type '\{\{' to access available variables. Return is optional, but should be included
                    in complex expressions. Remember to set the type accordingly.
                  </div>
                </div>
                <v-textarea
                  v-model="newFunction.description"
                  label="Description"
                  variant="outlined"
                  placeholder="Optional description of what this transformation does"
                  rows="2"
                />
              </div>
            </v-card-text>
            <v-divider class="mt-2 mx-10" />
            <v-card-actions>
              <div class="flex justify-between items-center pa-2 w-full h-full">
                <v-btn color="white" variant="text" @click="closeNewFunctionDialog">Cancel</v-btn>
                <v-btn color="primary" @click="saveTransformingFunction">Save</v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import * as monaco from 'monaco-editor'
// @ts-ignore: Worker imports
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// @ts-ignore: Worker imports
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import {
  createTransformingFunction,
  deleteTransformingFunction,
  getAllTransformingFunctions,
  TransformingFunction,
  updateTransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import { copyToClipboard } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const transformingFunctions = reactive<TransformingFunction[]>([])
const showNewFunctionDialog = ref(false)
const editingExistingFunction = ref(false)

const defaultValues = {
  name: '',
  type: 'number' as 'string' | 'number' | 'boolean',
  expression: '',
  description: '',
}
const newFunction = ref(defaultValues)

const expressionPlaceholder = `2 * {{ cockpit-memory-usage }} + 100
----------------------------------------------------

if ({{ cockpit-memory-usage }} > 100) {
  return 'on'
}
return 'off'

----------------------------------------------------

return {{ cockpit-memory-usage }} > 100
`

const variablesMap = ref<Record<string, DataLakeVariable>>({})
const { openSnackbar } = useSnackbar()

const availableVariables = computed(() => Object.entries(variablesMap.value))

/**
 * Closes the new/edit function dialog and resets the form
 */
const closeNewFunctionDialog = (): void => {
  showNewFunctionDialog.value = false
  editingExistingFunction.value = false
  newFunction.value = {
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean',
    expression: '',
    description: '',
  }
}

/**
 * Opens the edit dialog for a transforming function
 * @param {TransformingFunction} func - The function to edit
 */
const editTransformingFunction = (func: TransformingFunction): void => {
  editingExistingFunction.value = true
  newFunction.value = {
    name: func.name,
    type: func.type,
    expression: func.expression,
    description: func.description || '',
  }
  showNewFunctionDialog.value = true
}

/**
 * Handles deleting a transforming function
 * @param {TransformingFunction} func - The function to delete
 */
const handleDeleteFunction = (func: TransformingFunction): void => {
  deleteTransformingFunction(func)
  updateTransformingFunctionsList()
}

const updateTransformingFunctionsList = (): void => {
  transformingFunctions.length = 0
  transformingFunctions.push(...getAllTransformingFunctions())
}

/**
 * Saves the current transforming function being edited or creates a new one
 */
const saveTransformingFunction = (): void => {
  if (!newFunction.value.name || !newFunction.value.expression || !newFunction.value.type) return

  if (editingExistingFunction.value) {
    updateTransformingFunction({
      id: newFunction.value.name,
      ...newFunction.value,
    })
  } else {
    createTransformingFunction(
      newFunction.value.name,
      newFunction.value.name,
      newFunction.value.type,
      newFunction.value.expression,
      newFunction.value.description
    )
  }

  updateTransformingFunctionsList()
  closeNewFunctionDialog()
}

const expressionEditorContainer = ref<HTMLElement | null>(null)
let expressionEditor: monaco.editor.IStandaloneCodeEditor | null = null
let completionProvider: monaco.IDisposable | null = null

// Configure Monaco environment
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

// Configure custom language for data lake expressions
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: true,
  diagnosticCodesToIgnore: [1005, 1128, 7027],
})

// Add custom tokens to JavaScript language
monaco.languages.setMonarchTokensProvider('javascript', {
  tokenizer: {
    root: [
      [/\{\{[^}]*\}\}/, { token: 'variable.name.data-lake' }],
      [/[a-z_$][\w$]*/, 'identifier'],
      [/[A-Z][\w$]*/, 'type.identifier'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/[0-9]+/, 'number'],
      [/[,.]/, 'delimiter'],
      [/[()]/, '@brackets'],
      [/[{}]/, '@brackets'],
      [/[[\]]/, '@brackets'],
      [/[;]/, 'delimiter'],
      [/[+\-*/=<>!&|^~?:]/, 'operator'],
      [/@[a-zA-Z]+/, 'annotation'],
      [/\s+/, 'white'],
    ],
    string_double: [
      [/[^"]+/, 'string'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^']+/, 'string'],
      [/'/, 'string', '@pop'],
    ],
  },
})

// Create custom theme to style our data lake variables
monaco.editor.defineTheme('data-lake-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [{ token: 'variable.name.data-lake', foreground: '4EC9B0', fontStyle: 'italic' }],
  colors: {},
})

// Create Monaco editor
const createEditor = (container: HTMLElement, value: string): monaco.editor.IStandaloneCodeEditor => {
  return monaco.editor.create(container, {
    value,
    language: 'javascript',
    theme: 'data-lake-dark',
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
  })
}

// Initialize editor
const initEditor = async (): Promise<void> => {
  if (!expressionEditorContainer.value || expressionEditor) return
  expressionEditor = createEditor(expressionEditorContainer.value, newFunction.value.expression)

  // Dispose of previous completion provider if it exists
  if (completionProvider) {
    completionProvider.dispose()
    completionProvider = null
  }

  // Configure auto-completion for data lake variables
  completionProvider = monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['{'],
    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      if (!textUntilPosition.endsWith('{{')) {
        return { suggestions: [] }
      }

      const suggestions = Object.entries(variablesMap.value).map(([id, variable]) => ({
        label: variable.name,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: `${id}}}`,
        detail: `${variable.type} - ${variable.description || 'No description'}`,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      }))

      return { suggestions }
    },
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
  if (completionProvider) {
    completionProvider.dispose()
    completionProvider = null
  }
}

// Update editor when dialog opens/closes
watch(showNewFunctionDialog, async (newValue) => {
  if (newValue) {
    await nextTick()
    await initEditor()
  } else {
    finishEditor()
  }
})

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

// Load available variables when mounted
let variablesInfoListener: string | undefined = undefined
onMounted((): void => {
  // Listen for changes in available variables
  variablesInfoListener = listenToDataLakeVariablesInfoChanges((variables) => {
    variablesMap.value = variables
  })

  // Initial load
  variablesMap.value = getAllDataLakeVariablesInfo()
  updateTransformingFunctionsList()
})

onUnmounted(() => {
  if (variablesInfoListener) {
    unlistenToDataLakeVariablesInfoChanges(variablesInfoListener)
  }
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
