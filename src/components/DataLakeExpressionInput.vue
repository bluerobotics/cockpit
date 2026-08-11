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
      <div v-if="isDropdownOpen" :id="listboxId" class="dl-expression-dropdown" role="listbox">
        <div
          v-for="(item, index) in filteredVariables"
          :id="optionId(index)"
          :key="item.id"
          class="dl-expression-option"
          :class="{ 'dl-expression-option-highlighted': index === highlightedIndex }"
          role="option"
          :aria-selected="index === highlightedIndex"
          @mousedown.prevent="insertVariable(item.id)"
          @mouseenter="highlightedIndex = index"
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
import { v4 as uuid } from 'uuid'
import { computed, nextTick, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'

import {
  type DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { filterTermAtCursor, insertionStartColumn, nextHighlightedIndex } from '@/libs/data-lake-expression-input'
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

// The option the keyboard acts on, `-1` until the user navigates into the list so Enter keeps
// meaning whatever it meant in the field. Ids are per instance, since the POI dialog renders two.
const highlightedIndex = ref(-1)
const listboxId = `dl-expression-listbox-${uuid()}`
const optionId = (index: number): string => `${listboxId}-option-${index}`

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

  // Covers the two events this edit fires — the content change and the focus — so that neither
  // reopens the list the user just picked from. Both are dispatched synchronously, so the flag
  // only has to hold across this call; leaving it set would swallow the next genuine one.
  suppressReopen = true
  editor.executeEdits('insert-data-lake-variable', [{ range, text: `{{ ${variableId} }}`, forceMoveMarkers: true }])
  isDropdownOpen.value = false
  editor.focus()
  suppressReopen = false
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
      // Monaco otherwise eats Tab as indentation, stranding a keyboard user in a one-line field
      // that has nothing to indent.
      tabFocusMode: true,
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
    highlightedIndex.value = -1
  }

  createdEditor.onDidChangeModelContent(() => {
    pristine = false
    lastEmittedValue = createdEditor.getValue().trim()
    emit('update:modelValue', lastEmittedValue)
    // Typing brings the list back, since picking a variable closes it while the user is usually
    // still writing the expression, and nothing else here would reopen it without a refocus.
    if (!suppressReopen) openDropdown()
  })
  createdEditor.onMouseDown(openDropdown)
  createdEditor.onDidFocusEditorText(() => {
    if (!suppressReopen) openDropdown()
  })
  createdEditor.onDidChangeCursorPosition(() => {
    if (isDropdownOpen.value) variableFilterTerm.value = dropdownFilterTerm()
  })
  // Delay so a dropdown item's mousedown can run before blur closes the dropdown.
  createdEditor.onDidBlurEditorText(() => setTimeout(() => (isDropdownOpen.value = false), 150))
  createdEditor.onKeyDown((event) => {
    // The editor would otherwise move the cursor or break the line under the keys the list uses,
    // and an unstopped Escape reaches the dialog the field sits in and closes it.
    const keepKeyToTheList = (): void => {
      event.preventDefault()
      event.stopPropagation()
    }

    if (event.keyCode === monaco.KeyCode.Escape) {
      if (!isDropdownOpen.value) return
      isDropdownOpen.value = false
      keepKeyToTheList()
      return
    }

    // Neither field this serves is meant to hold two lines, so Enter takes the active option, or
    // does nothing at all rather than breaking the line.
    if (event.keyCode === monaco.KeyCode.Enter) {
      const activeVariable = isDropdownOpen.value ? filteredVariables.value[highlightedIndex.value] : undefined
      if (activeVariable) insertVariable(activeVariable.id)
      keepKeyToTheList()
      return
    }

    // Reopening from the keyboard, since the list closes on every insertion and picking a second
    // variable would otherwise need the mouse.
    if (!isDropdownOpen.value) {
      if (event.keyCode !== monaco.KeyCode.DownArrow) return
      openDropdown()
      keepKeyToTheList()
      return
    }
    if (filteredVariables.value.length === 0) return

    const lastIndex = filteredVariables.value.length - 1
    if (event.keyCode === monaco.KeyCode.DownArrow) {
      highlightedIndex.value = nextHighlightedIndex(highlightedIndex.value, lastIndex, 'down')
    } else if (event.keyCode === monaco.KeyCode.UpArrow) {
      highlightedIndex.value = nextHighlightedIndex(highlightedIndex.value, lastIndex, 'up')
    } else {
      return
    }

    keepKeyToTheList()
  })

  return createdEditor
}

watch(filteredVariables, () => (highlightedIndex.value = -1))

// Monaco owns the focused element, so the state a screen reader reads off it has to be applied to
// its textarea by hand.
watch([isDropdownOpen, highlightedIndex], async () => {
  await nextTick()
  const textArea = editor?.getDomNode()?.querySelector('textarea')
  textArea?.setAttribute('aria-expanded', String(isDropdownOpen.value))
  if (!isDropdownOpen.value || highlightedIndex.value < 0) {
    textArea?.removeAttribute('aria-activedescendant')
    return
  }
  const highlightedOptionId = optionId(highlightedIndex.value)
  textArea?.setAttribute('aria-activedescendant', highlightedOptionId)
  document.getElementById(highlightedOptionId)?.scrollIntoView({ block: 'nearest' })
})

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
  const textArea = editor?.getDomNode()?.querySelector('textarea')
  textArea?.setAttribute('aria-controls', listboxId)
  // Monaco exposes the textarea as a plain textbox, which supports neither `aria-expanded` nor an
  // active descendant, so the list would never be announced. `aria-expanded` is required on the
  // role, and the field is collapsed until the watcher below first says otherwise.
  textArea?.setAttribute('role', 'combobox')
  textArea?.setAttribute('aria-expanded', 'false')
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

.dl-expression-option:hover,
.dl-expression-option-highlighted {
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
