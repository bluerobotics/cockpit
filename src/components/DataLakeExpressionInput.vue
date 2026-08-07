<template>
  <fieldset class="dl-expression-field">
    <legend class="dl-expression-legend">
      <span>{{ label }}</span>
      <v-tooltip v-if="slots.hint" location="top">
        <template #activator="{ props: tooltipProps }">
          <v-icon v-bind="tooltipProps" size="14" color="grey">mdi-help-circle-outline</v-icon>
        </template>
        <div class="max-w-xs">
          <slot name="hint" />
        </div>
      </v-tooltip>
    </legend>
    <div class="dl-expression-wrapper">
      <div ref="editorContainer" class="dl-expression-editor" />
      <div v-if="isDropdownOpen" class="dl-expression-dropdown">
        <div
          v-for="item in filteredVariables"
          :key="item.id"
          class="dl-expression-option"
          @mousedown.prevent="insertVariable(item.id)"
        >
          <span class="dl-expression-option-name">{{ item.name }}</span>
          <span class="dl-expression-option-id">{{ item.id }}</span>
        </div>
        <div v-if="filteredVariables.length === 0" class="dl-expression-empty">{{ emptyDropdownMessage }}</div>
      </div>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'

import {
  type DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { filterTermAtCursor, insertionStartColumn } from '@/libs/data-lake-expression-input'
import { createMonacoEditor, monaco } from '@/libs/monaco-manager'
import { isNumber } from '@/libs/utils'

const props = defineProps<{
  /**
   * Current expression. Free text that may reference data lake variables as `{{ variable/id }}`.
   */
  modelValue: string
  /**
   * Label shown on the field's legend.
   */
  label: string
  /**
   * Restricts which data lake variables the dropdown offers. All of them when not given.
   */
  variableFilter?: (variable: DataLakeVariable) => boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const slots = useSlots()

const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const isDropdownOpen = ref(false)
const variableFilterTerm = ref('')

// Set right after inserting a variable, so the programmatic re-focus does not immediately reopen the dropdown.
let suppressReopen = false

// Whether the field still shows its initial value (not yet edited). While pristine, clicking it
// shows the full variable list instead of filtering by the pre-filled content.
let pristine = true

// Set on each emit, so the value coming back through `modelValue` is not written into the editor,
// which would fight the cursor while typing.
let lastEmittedValue: string | null = null

const availableVariables = ref<DataLakeVariable[]>([])

const refreshAvailableVariables = (): void => {
  availableVariables.value = Object.values(getAllDataLakeVariablesInfo())
    .filter((variable) => props.variableFilter?.(variable) ?? true)
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
}

const filteredVariables = computed(() => {
  const term = variableFilterTerm.value.toLowerCase()
  const variables = availableVariables.value.map((variable) => ({
    id: variable.id,
    name: variable.name || variable.id,
  }))
  if (!term) return variables
  return variables.filter(
    (variable) => variable.id.toLowerCase().includes(term) || variable.name.toLowerCase().includes(term)
  )
})

// An empty data lake means nothing is feeding it, which the user fixes by connecting the vehicle,
// not by changing what they typed.
const emptyDropdownMessage = computed(() =>
  availableVariables.value.length === 0
    ? 'No variables found to choose from. Please make sure your vehicle is connected.'
    : 'No matching variables'
)

const textUntilCursor = (): string => {
  const model = editor?.getModel()
  const position = editor?.getPosition()
  if (!model || !position) return ''
  return model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })
}

// The dropdown shows the full list while the field is pristine or holds a plain number (filtering by
// a number matches nothing); otherwise it filters by the token under the cursor.
const dropdownFilterTerm = (): string => {
  if (!editor || pristine || isNumber(editor.getValue())) return ''
  return filterTermAtCursor(textUntilCursor())
}

const insertVariable = (variableId: string): void => {
  const position = editor?.getPosition()
  if (!editor || !position) return

  logUserAction(`Inserted the data lake variable '${variableId}' into the '${props.label}' field`)

  const startColumn = insertionStartColumn(textUntilCursor(), position.column)
  const range = new monaco.Range(position.lineNumber, startColumn, position.lineNumber, position.column)
  editor.executeEdits('insert-data-lake-variable', [{ range, text: `{{ ${variableId} }}`, forceMoveMarkers: true }])

  isDropdownOpen.value = false
  suppressReopen = true
  editor.focus()
}

const createEditor = (container: HTMLElement): monaco.editor.IStandaloneCodeEditor => {
  const createdEditor = createMonacoEditor(container, {
    language: 'plaintext',
    value: props.modelValue,
    editorOverrides: {
      lineNumbers: 'off',
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 8,
      lineNumbersMinChars: 0,
      fontSize: 13,
      padding: { top: 8, bottom: 8 },
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
      quickSuggestions: false,
      wordBasedSuggestions: 'off',
      suggestOnTriggerCharacters: false,
      autoClosingBrackets: 'never',
    },
  })

  // Grow the editor to fit its content so a wrapped long expression spans multiple lines instead of
  // being clipped at a fixed height.
  const applyAutoHeight = (): void => {
    const contentHeight = createdEditor.getContentHeight()
    container.style.height = `${contentHeight}px`
    createdEditor.layout({ width: container.clientWidth, height: contentHeight })
  }
  createdEditor.onDidContentSizeChange(applyAutoHeight)
  applyAutoHeight()

  const openDropdown = (): void => {
    isDropdownOpen.value = true
    variableFilterTerm.value = dropdownFilterTerm()
  }

  createdEditor.onDidChangeModelContent(() => {
    pristine = false
    lastEmittedValue = createdEditor.getValue().trim()
    emit('update:modelValue', lastEmittedValue)
    if (isDropdownOpen.value) variableFilterTerm.value = dropdownFilterTerm()
  })
  createdEditor.onMouseDown(openDropdown)
  createdEditor.onDidFocusEditorText(() => {
    if (suppressReopen) {
      suppressReopen = false
      return
    }
    openDropdown()
  })
  createdEditor.onDidChangeCursorPosition(() => {
    if (isDropdownOpen.value) variableFilterTerm.value = dropdownFilterTerm()
  })
  // Delay so a dropdown item's mousedown can run before blur closes the dropdown.
  createdEditor.onDidBlurEditorText(() => setTimeout(() => (isDropdownOpen.value = false), 150))
  createdEditor.onKeyDown((event) => {
    if (event.keyCode === monaco.KeyCode.Escape) isDropdownOpen.value = false
  })

  return createdEditor
}

// Follow changes the parent makes on its own (e.g. applying a preset) without disturbing typing.
watch(
  () => props.modelValue,
  (value) => {
    if (!editor || value === lastEmittedValue || value === editor.getValue()) return
    editor.setValue(value)
    pristine = true
  }
)

let variablesInfoListenerId: string | undefined

onMounted(() => {
  refreshAvailableVariables()
  variablesInfoListenerId = listenToDataLakeVariablesInfoChanges(refreshAvailableVariables)
  if (editorContainer.value) editor = createEditor(editorContainer.value)
})

onUnmounted(() => {
  editor?.dispose()
  editor = null
  if (variablesInfoListenerId) unlistenToDataLakeVariablesInfoChanges(variablesInfoListenerId)
})
</script>

<style scoped>
/* Outlined field with a notched label (the legend cuts the top border, like a v-text-field). */
.dl-expression-field {
  min-inline-size: 0;
  margin: 0;
  padding: 2px 8px 6px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 4px;
}

.dl-expression-legend {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
  color: #ffffffb3;
}

.dl-expression-wrapper {
  position: relative;
}

.dl-expression-editor {
  min-height: 36px;
  width: 100%;
  overflow: visible;
}

/* Monaco builds its own DOM inside the container, so its rules have to pierce the scoping. */
.dl-expression-editor :deep(.monaco-editor),
.dl-expression-editor :deep(.monaco-editor .margin),
.dl-expression-editor :deep(.monaco-editor-background) {
  background-color: transparent !important;
}

.dl-expression-editor :deep(.monaco-editor),
.dl-expression-editor :deep(.monaco-editor.focused),
.dl-expression-editor :deep(.monaco-editor .inputarea) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.dl-expression-editor :deep(.monaco-editor .overflow-guard) {
  border-radius: 4px;
}

.dl-expression-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 30;
  max-height: 220px;
  overflow-y: auto;
  background-color: #1e1e1e;
  border: 1px solid #ffffff33;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.dl-expression-option {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  cursor: pointer;
}

.dl-expression-option:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.dl-expression-option-name {
  font-size: 13px;
  color: #ffffffde;
}

.dl-expression-option-id {
  font-size: 11px;
  color: #ffffff80;
}

.dl-expression-empty {
  padding: 8px 10px;
  font-size: 12px;
  color: #ffffff80;
}
</style>
