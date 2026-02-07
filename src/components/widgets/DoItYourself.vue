<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="main">
    <div
      class="w-full h-full"
      :style="widget.options.inheritCockpitStyles ? interfaceStore.globalGlassMenuStyles : {}"
      v-html="compiledCode"
    />
  </div>
  <v-dialog
    v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
    :max-width="interfaceStore.isOnSmallScreen ? '100%' : '800px'"
    @after-enter="handleDialogOpening"
    @after-leave="handleDialogClosing"
  >
    <vue-draggable-resizable :drag-handle="'.drag-handle'" w="auto" h="auto" :handles="['tm', 'mr', 'bm', 'ml']">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-icon class="drag-handle absolute top-[12px] left-[12px] cursor-grab">mdi-drag</v-icon>
        <v-icon class="absolute top-[12px] right-[12px] cursor-pointer" @click="showHelp = !showHelp">
          mdi-help-circle-outline
        </v-icon>
        <v-card-title class="w-full text-center mt-2">{{
          $t('widgets.doItYourself.widgetConfiguration')
        }}</v-card-title>
        <v-card-text class="mx-2 flex flex-col gap-y-3">
          <v-expand-transition>
            <div v-if="showHelp" class="help-panel mb-4 p-4 rounded bg-white/5">
              <h3 class="text-lg mb-2">{{ $t('widgets.doItYourself.editorInstructions') }}</h3>
              <ul class="text-sm text-white/70 list-disc pl-4 space-y-1">
                <li>{{ $t('widgets.doItYourself.instruction1') }}</li>
                <li>{{ $t('widgets.doItYourself.instruction2') }}</li>
                <li>{{ $t('widgets.doItYourself.instruction3') }}</li>
                <li>{{ $t('widgets.doItYourself.instruction4') }}</li>
                <li>{{ $t('widgets.doItYourself.instruction5') }}</li>
                <li>{{ $t('widgets.doItYourself.instruction6') }}</li>
                <li>
                  {{ $t('widgets.doItYourself.instruction7') }}
                  information around this.
                </li>
                <li>Click on each editor's header to expand it to full size</li>
              </ul>
            </div>
          </v-expand-transition>

          <v-expansion-panels v-model="expandedPanel" class="editors-container" multiple>
            <v-expansion-panel value="html">
              <v-expansion-panel-title static height="30px" class="text-white/60"> HTML </v-expansion-panel-title>
              <v-expansion-panel-text eager>
                <div ref="htmlEditorContainer" class="editor-container" :style="{ height: editorHeight }" />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel value="js">
              <v-expansion-panel-title static height="30px" class="text-white/60"> JS </v-expansion-panel-title>
              <v-expansion-panel-text eager>
                <div ref="jsEditorContainer" class="editor-container" :style="{ height: editorHeight }" />
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel value="css">
              <v-expansion-panel-title static height="30px" class="text-white/60"> CSS </v-expansion-panel-title>
              <v-expansion-panel-text eager>
                <div ref="cssEditorContainer" class="editor-container" :style="{ height: editorHeight }" />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-checkbox
            v-model="autoSave"
            :label="$t('doItYourself.autoSave')"
            density="compact"
            class="-mb-2"
            hide-details
          />
          <v-checkbox
            v-model="widget.options.inheritCockpitStyles"
            :label="$t('doItYourself.inheritStyles')"
            density="compact"
            class="-mb-2"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <div class="flex justify-between items-center px-4 w-full h-full">
            <v-btn class="text-white/60" variant="text" @click="closeDialog">Close</v-btn>
            <div class="flex gap-x-3">
              <v-btn
                class="text-white/60"
                variant="text"
                :title="$t('doItYourself.exportConfig')"
                @click="exportConfig"
              >
                <v-icon class="mr-1 mt-[2px]">mdi-download</v-icon>
                {{ $t('doItYourself.export') }}
              </v-btn>
              <v-btn
                class="text-white/60 mr-10"
                variant="text"
                :title="$t('doItYourself.importConfig')"
                @click="importConfig"
              >
                <v-icon class="mr-1 mt-[2px]">mdi-upload</v-icon>
                {{ $t('doItYourself.import') }}
              </v-btn>
              <v-btn class="text-white/60" variant="text" @click="resetChanges">{{ $t('common.reset') }}</v-btn>
              <v-btn class="text-white" variant="text" @click="applyChanges">{{ $t('common.apply') }}</v-btn>
            </div>
          </div>
        </v-card-actions>
      </v-card>
    </vue-draggable-resizable>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { createMonacoEditor, monaco } from '@/libs/monaco-manager'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const { t: $t } = useI18n()
const autoSave = useBlueOsStorage('diy-widget-auto-save', false)

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()

const widget = toRefs(props).widget
const htmlEditorContainer = ref<HTMLElement | null>(null)
const cssEditorContainer = ref<HTMLElement | null>(null)
const jsEditorContainer = ref<HTMLElement | null>(null)
const showHelp = ref(false)
const expandedPanel = ref<string[]>(['html', 'css', 'js'])
const editorHeightVh = 50
let htmlEditor: monaco.editor.IStandaloneCodeEditor | null = null
let cssEditor: monaco.editor.IStandaloneCodeEditor | null = null
let jsEditor: monaco.editor.IStandaloneCodeEditor | null = null

const defaultOptions = {
  html: `<!-- Write your HTML code here -->
<div id="diy-container">
  <span>{{ $t('widgets.doItYourself.createYourOwn') }}</span>
</div>`,
  css: `/* Write your CSS code here */
#diy-container {
  width: 100%;
  height: 100%;
  padding: 1rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  text-align: center;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
}`,
  js: `// Write your JavaScript code here
document.addEventListener('DOMContentLoaded', () => {
  // Your code here
});`,
  inheritCockpitStyles: true,
}

/* eslint-disable no-useless-escape */
const compiledCode = computed(() => {
  const html = widget.value.options.html || defaultOptions.html
  const css = widget.value.options.css || defaultOptions.css
  const js = widget.value.options.js || defaultOptions.js

  return `${html}
<style>
${css}
</style>
<script>
${js}
<\/script>`
})
/* eslint-enable jsdoc/require-jsdoc */

const createEditor = (
  container: HTMLElement,
  language: string,
  value: string,
  dataLakeCompletionType?: 'use-bracket-parser' | 'use-api-function'
): monaco.editor.IStandaloneCodeEditor => {
  return createMonacoEditor(container, { language, value, dataLakeCompletionType })
}

const addKeyboardShortcuts = (editor: monaco.editor.IStandaloneCodeEditor): void => {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => applyChanges())
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => applyChanges())

  // Add shortcuts to move between editors
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
    if (htmlEditor && htmlEditor.hasTextFocus() && cssEditor) cssEditor.focus()
    else if (jsEditor && jsEditor.hasTextFocus() && htmlEditor) htmlEditor.focus()
    else if (cssEditor && cssEditor.hasTextFocus() && jsEditor) jsEditor.focus()
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
    if (htmlEditor && htmlEditor.hasTextFocus() && jsEditor) jsEditor.focus()
    else if (jsEditor && jsEditor.hasTextFocus() && cssEditor) cssEditor.focus()
    else if (cssEditor && cssEditor.hasTextFocus() && htmlEditor) htmlEditor.focus()
  })
}

const addChangeListener = (editor: monaco.editor.IStandaloneCodeEditor): void => {
  editor.onDidChangeModelContent(() => {
    onAutoSave()
  })
}

const initEditor = async (): Promise<void> => {
  if (htmlEditor || !htmlEditorContainer.value) return
  if (jsEditor || !jsEditorContainer.value) return
  if (cssEditor || !cssEditorContainer.value) return

  htmlEditor = createEditor(htmlEditorContainer.value, 'html', widget.value.options.html || defaultOptions.html)
  jsEditor = createEditor(
    jsEditorContainer.value,
    'javascript',
    widget.value.options.js || defaultOptions.js,
    'use-api-function'
  )
  cssEditor = createEditor(cssEditorContainer.value, 'css', widget.value.options.css || defaultOptions.css)

  // Add keyboard shortcuts and change listener to all editors
  if (htmlEditor) {
    addKeyboardShortcuts(htmlEditor)
    addChangeListener(htmlEditor)
  }
  if (jsEditor) {
    addKeyboardShortcuts(jsEditor)
    addChangeListener(jsEditor)
  }
  if (cssEditor) {
    addKeyboardShortcuts(cssEditor)
    addChangeListener(cssEditor)
  }
}

const onAutoSave = (): void => {
  if (!autoSave.value) return
  applyChanges()
}

const handleDialogOpening = async (): Promise<void> => {
  await initEditor()
}

const handleDialogClosing = async (): Promise<void> => {
  finishEditor()
}

const applyChanges = (): void => {
  if (!htmlEditor || !cssEditor || !jsEditor) return
  widget.value.options.html = htmlEditor.getValue()
  widget.value.options.css = cssEditor.getValue()
  widget.value.options.js = jsEditor.getValue()
  executeUserScript()
}

const executeUserScript = (): void => {
  const js = widget.value.options.js || ''
  const scriptElementId = `diy-script-${widget.value.hash}`

  // Remove existing script element
  document.getElementById(scriptElementId)?.remove()

  // Create new script element
  const scriptEl = document.createElement('script')
  scriptEl.type = 'text/javascript'
  scriptEl.textContent = js
  scriptEl.id = scriptElementId
  document.body.appendChild(scriptEl)
}

const resetChanges = (): void => {
  if (!htmlEditor || !cssEditor || !jsEditor) return
  htmlEditor.setValue(widget.value.options.html || defaultOptions.html)
  cssEditor.setValue(widget.value.options.css || defaultOptions.css)
  jsEditor.setValue(widget.value.options.js || defaultOptions.js)
}

const finishEditor = (): void => {
  if (htmlEditor) {
    htmlEditor.dispose()
    htmlEditor = null
  }
  if (cssEditor) {
    cssEditor.dispose()
    cssEditor = null
  }
  if (jsEditor) {
    jsEditor.dispose()
    jsEditor = null
  }
}

const closeDialog = (): void => {
  widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen = false
  if (autoSave.value) applyChanges()
  finishEditor()
}

// Function to export configuration as a JSON file
const exportConfig = (): void => {
  if (!htmlEditor || !cssEditor || !jsEditor) return

  // Create configuration object
  const config = {
    html: htmlEditor.getValue(),
    css: cssEditor.getValue(),
    js: jsEditor.getValue(),
    inheritCockpitStyles: widget.value.options.inheritCockpitStyles || false,
  }

  // Create file content as JSON string
  const fileContent = JSON.stringify(config, null, 2)

  // Create blob with JSON content
  const blob = new Blob([fileContent], { type: 'application/json' })

  // Create URL for the blob
  const url = URL.createObjectURL(blob)

  // Create a temporary link element to trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = 'diy-widget-config.json'
  document.body.appendChild(link)
  link.click()

  // Clean up
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Function to import configuration from a JSON file
const importConfig = (): void => {
  // Create a temporary file input element
  const input = document.createElement('input')
  input.type = 'file'

  // Handle file selection
  input.onchange = (event) => {
    const target = event.target as HTMLInputElement
    if (!target.files || !target.files[0] || !htmlEditor || !cssEditor || !jsEditor) return

    const file = target.files[0]
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const result = e.target?.result as string
        const config = JSON.parse(result)

        // Validate the imported configuration
        if (!config.html || !config.css || !config.js) {
          throw new Error('Invalid configuration file')
        }

        // Update the editors with the imported values
        if (htmlEditor) htmlEditor.setValue(config.html)
        if (cssEditor) cssEditor.setValue(config.css)
        if (jsEditor) jsEditor.setValue(config.js)

        // Update the inheritCockpitStyles option if present (defaults to false for backwards compatibility)
        widget.value.options.inheritCockpitStyles = config.inheritCockpitStyles || false

        // Apply changes
        applyChanges()
      } catch (error) {
        console.error('Error importing configuration:', error)
        alert('Invalid configuration file')
      }
    }

    reader.readAsText(file)
  }

  // Trigger file input dialog
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

// Add computed property for editor heights
const editorHeight = computed(() => {
  const openPanels = expandedPanel.value.length
  if (openPanels === 0) return `${editorHeightVh}vh`
  return `${Math.round(editorHeightVh / openPanels)}vh` // Divide the total height by number of open panels
})

onBeforeMount(() => {
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
})

onMounted(() => {
  executeUserScript()
})

onBeforeUnmount(() => {
  finishEditor()
})
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 150px;
  min-height: 200px;
}

.editors-container {
  width: 100%;
  height: 100%;
  background: transparent !important;
  overflow-y: auto;
}

.editor-container {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 100%;
  transition: height 0.3s ease;
}

.editor-expanded {
  height: v-bind(editorHeight);
}

:deep(.v-expansion-panel) {
  background: transparent !important;
}

:deep(.v-expansion-panel-title) {
  padding: 8px 16px;
  min-height: unset;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
</style>
