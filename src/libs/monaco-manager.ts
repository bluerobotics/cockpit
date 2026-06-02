/**
 * Centralized Monaco Editor Manager
 *
 * This module provides a single source of truth for Monaco editor configuration,
 * lazy initialization, and cached autocompletion suggestions for data lake variables.
 *
 * Performance considerations:
 * - Monaco is only initialized when the first editor is created (lazy init)
 * - Completion suggestions are cached and only rebuilt when data lake variables change
 * - The cache listener is only registered when Monaco is initialized
 */
import * as monaco from 'monaco-editor'
// @ts-ignore: Worker imports
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// @ts-ignore: Worker imports
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
// @ts-ignore: Worker imports
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
// @ts-ignore: Worker imports
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
// @ts-ignore: Worker imports
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import {
  type DataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { dataLakeInputRegex } from '@/libs/utils-data-lake'

// =============================================================================
// Types
// =============================================================================

/**
 * Data lake completion behavior type
 * - 'use-bracket-parser': Completes {{variableId}} syntax (for expressions parsed later)
 * - 'use-api-function': Replaces {{ with window.cockpit.getDataLakeVariableData('id')
 */
export type DataLakeCompletionType = 'use-bracket-parser' | 'use-api-function'

// =============================================================================
// State
// =============================================================================

let isInitialized = false

// Track which completion type each editor model uses
const modelCompletionTypes = new Map<string, DataLakeCompletionType>()

// Cached variables map for building suggestions on-the-fly
let cachedVariablesMap: Record<string, DataLakeVariable> = {}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize Monaco editor environment.
 * This is called lazily when the first editor is created.
 */
function initializeMonaco(): void {
  if (isInitialized) return

  // Setup Monaco workers
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    },
  }

  // Configure TypeScript/JavaScript defaults
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    diagnosticCodesToIgnore: [1005, 1128, 7027],
  })

  // Add custom tokens to JavaScript for data lake variable highlighting ({{variable}})
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

  // Create custom theme for data lake variable highlighting
  monaco.editor.defineTheme('data-lake-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [{ token: 'variable.name.data-lake', foreground: '4EC9B0', fontStyle: 'italic' }],
    colors: {},
  })

  // Register completion providers
  registerCompletionProviders()

  // Listen for data lake changes to update variables cache
  listenToDataLakeVariablesInfoChanges(() => {
    rebuildVariablesCache()
  })

  // Build initial cache
  rebuildVariablesCache()

  isInitialized = true
}

// =============================================================================
// Suggestion Cache Management
// =============================================================================

/**
 * Rebuild the variables cache from current data lake variables.
 * This is called on initialization and whenever variables are added/removed.
 */
function rebuildVariablesCache(): void {
  cachedVariablesMap = getAllDataLakeVariablesInfo()
}

/**
 * Register completion providers for JavaScript and plaintext.
 * The provider checks the model's registered completion type to determine behavior.
 */
function registerCompletionProviders(): void {
  // Data lake variable completion provider - triggered on '{' (for '{{' syntax)
  // Behavior depends on the completion type registered for each editor model
  const dataLakeCompletionProvider: monaco.languages.CompletionItemProvider = {
    triggerCharacters: ['{'],
    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      // Only suggest when user types '{{'
      if (!textUntilPosition.endsWith('{{')) {
        // Return incomplete to keep completion context open for the second '{'
        return { suggestions: [], incomplete: true }
      }

      // Check what completion type this model uses
      const modelUri = model.uri.toString()
      const completionType = modelCompletionTypes.get(modelUri)

      if (!completionType) {
        return { suggestions: [] }
      }

      if (completionType === 'use-api-function') {
        // Replace {{ with the full API function call
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: position.column - 2, // Include the {{ we want to replace
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        }

        const nonLegacy = Object.entries(cachedVariablesMap).filter(([, v]) => !(v.name || '').includes('(Legacy)'))
        return {
          suggestions: nonLegacy.map(([id, variable]) => ({
            label: variable.name || id,
            kind: monaco.languages.CompletionItemKind.Variable,
            documentation: `${variable.type}${variable.description ? ` - ${variable.description}` : ''} (${id})`,
            insertText: `window.cockpit.getDataLakeVariableData('${id}')`,
            filterText: `{{${variable.name || id}`,
            range,
          })),
        }
      } else if (completionType === 'use-bracket-parser') {
        // Complete the variable name and closing braces for bracket-parsed expressions
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        }

        const nonLegacy = Object.entries(cachedVariablesMap).filter(([, v]) => !(v.name || '').includes('(Legacy)'))
        return {
          suggestions: nonLegacy.map(([id, variable]) => ({
            label: variable.name || id,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: ` ${id} }}`,
            filterText: `{{${variable.name || id}`,
            detail: `${variable.type}${variable.description ? ` - ${variable.description}` : ''}`,
            range,
          })),
        }
      }

      return { suggestions: [] }
    },
  }

  monaco.languages.registerCompletionItemProvider('javascript', dataLakeCompletionProvider)
  monaco.languages.registerCompletionItemProvider('plaintext', dataLakeCompletionProvider)
}

// Matches getDataLakeVariableData('id') API calls, capturing the quoted variable id
const dataLakeApiCallRegex = /getDataLakeVariableData\(\s*['"]([^'"]+)['"]\s*\)/g

type DataLakeReference = {
  /** The id of the referenced data lake variable */
  variableId: string
  /** The editor range that covers the reference */
  range: monaco.Range
}

/**
 * Find the data lake reference (mustache expression or getDataLakeVariableData() call) at a position.
 * @param {monaco.editor.ITextModel} model - The editor model to inspect
 * @param {monaco.IPosition} position - The position to test, typically the one under the pointer
 * @returns {DataLakeReference | null} The variable id and its range, or null if none
 */
function findDataLakeReferenceAtPosition(
  model: monaco.editor.ITextModel,
  position: monaco.IPosition
): DataLakeReference | null {
  const lineContent = model.getLineContent(position.lineNumber)

  for (const sourceRegex of [dataLakeInputRegex, dataLakeApiCallRegex]) {
    const regex = new RegExp(sourceRegex.source, 'g')

    let match: RegExpExecArray | null
    while ((match = regex.exec(lineContent)) !== null) {
      const startColumn = match.index + 1
      const endColumn = startColumn + match[0].length

      // Skip references the position is not over
      if (position.column < startColumn || position.column > endColumn) continue

      return {
        variableId: match[1].trim(),
        range: new monaco.Range(position.lineNumber, startColumn, position.lineNumber, endColumn),
      }
    }
  }

  return null
}

/**
 * Attach a tooltip that shows the live data lake value of the reference under the pointer.
 * Unlike a static hover, it subscribes to the variable while shown so the displayed value
 * keeps updating in real time, and unsubscribes once the pointer leaves the reference.
 * @param {monaco.editor.IStandaloneCodeEditor} editor - The editor to attach the tooltip to
 */
function attachDataLakeLiveTooltip(editor: monaco.editor.IStandaloneCodeEditor): void {
  const domNode = document.createElement('div')
  const hoverBox = document.createElement('div')
  // Self-contained dark tooltip styling; min/max width keeps it wide instead of collapsing per word
  Object.assign(hoverBox.style, {
    boxSizing: 'border-box',
    minWidth: '220px',
    maxWidth: '500px',
    whiteSpace: 'normal',
    padding: '6px 10px',
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
    border: '1px solid #454545',
    borderRadius: '3px',
    fontSize: '13px',
    lineHeight: '1.4',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
  } as Partial<CSSStyleDeclaration>)
  const headerEl = document.createElement('div')
  headerEl.style.fontWeight = 'bold'
  const valueEl = document.createElement('div')
  valueEl.style.marginTop = '4px'
  const valueDataEl = document.createElement('span')
  valueEl.append('Current value: ', valueDataEl)
  const descriptionEl = document.createElement('div')
  descriptionEl.style.marginTop = '6px'
  descriptionEl.style.opacity = '0.7'
  hoverBox.append(headerEl, valueEl, descriptionEl)
  domNode.appendChild(hoverBox)

  let widgetPosition: monaco.editor.IContentWidgetPosition | null = null
  const widget: monaco.editor.IContentWidget = {
    getId: () => 'data-lake.live-value-tooltip',
    getDomNode: () => domNode,
    getPosition: () => widgetPosition,
    allowEditorOverflow: true,
  }

  let isShown = false
  let shownKey: string | null = null
  let listenerId: string | null = null
  let listenedVariableId: string | null = null
  let pendingFrame: number | null = null

  const renderValue = (value: string | number | boolean | undefined): void => {
    valueDataEl.textContent = value === undefined ? 'no value yet' : String(value)
  }

  const unsubscribe = (): void => {
    if (listenedVariableId && listenerId) {
      unlistenDataLakeVariable(listenedVariableId, listenerId)
    }
    listenerId = null
    listenedVariableId = null
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame)
      pendingFrame = null
    }
  }

  const hide = (): void => {
    unsubscribe()
    shownKey = null
    if (isShown) {
      editor.removeContentWidget(widget)
      isShown = false
    }
  }

  const show = (variableId: string, range: monaco.Range): void => {
    unsubscribe()

    const variableInfo = getDataLakeVariableInfo(variableId)
    if (!variableInfo) {
      headerEl.textContent = `Unknown data lake variable: ${variableId}`
      valueEl.style.display = 'none'
      descriptionEl.style.display = 'none'
    } else {
      headerEl.textContent = `${variableInfo.name || variableId} (${variableInfo.type})`
      valueEl.style.display = ''
      renderValue(getDataLakeVariableData(variableId))

      // Subscribe so the value keeps updating live, coalescing bursts into a single frame
      listenedVariableId = variableId
      listenerId = listenDataLakeVariable(variableId, (value) => {
        if (pendingFrame !== null) return
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = null
          renderValue(value)
        })
      })

      descriptionEl.style.display = variableInfo.description ? '' : 'none'
      descriptionEl.textContent = variableInfo.description ?? ''
    }

    widgetPosition = {
      position: { lineNumber: range.startLineNumber, column: range.startColumn },
      preference: [
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
        monaco.editor.ContentWidgetPositionPreference.BELOW,
      ],
    }

    if (isShown) {
      editor.layoutContentWidget(widget)
    } else {
      editor.addContentWidget(widget)
      isShown = true
    }
  }

  // Collect the editor-owned listeners so they are explicitly released on disposal
  const disposables: monaco.IDisposable[] = []

  disposables.push(
    editor.onMouseMove((e) => {
      const position = e.target.position
      const model = editor.getModel()
      const reference = position && model ? findDataLakeReferenceAtPosition(model, position) : null

      if (!reference) {
        hide()
        return
      }

      const key = `${reference.variableId}@${reference.range.startLineNumber}:${reference.range.startColumn}`
      if (key === shownKey) return

      shownKey = key
      show(reference.variableId, reference.range)
    })
  )

  disposables.push(editor.onMouseLeave(() => hide()))
  editor.onDidDispose(() => {
    hide()
    disposables.forEach((disposable) => disposable.dispose())
  })
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Standard editor options used across the application
 */
export interface EditorOptions {
  /** The language for syntax highlighting */
  language: string
  /** Initial value for the editor */
  value: string
  /**
   * Type of data lake variable completion behavior.
   * - 'use-bracket-parser': Completes {{variableId}} syntax (for expressions parsed later)
   * - 'use-api-function': Replaces {{ with window.cockpit.getDataLakeVariableData('id')
   * - undefined: No data lake completions
   */
  dataLakeCompletionType?: DataLakeCompletionType
  /** Optional Monaco editor construction option overrides (e.g. lineNumbers, fontSize, padding) */
  editorOverrides?: monaco.editor.IStandaloneEditorConstructionOptions
}

/**
 * Create a Monaco editor instance with standard configuration.
 * This will lazily initialize Monaco if not already done.
 * @param {HTMLElement} container - The HTML element to host the editor
 * @param {EditorOptions} options - Editor configuration options
 * @returns {monaco.editor.IStandaloneCodeEditor} The created editor instance
 */
export function createMonacoEditor(
  container: HTMLElement,
  options: EditorOptions
): monaco.editor.IStandaloneCodeEditor {
  // Ensure Monaco is initialized
  initializeMonaco()

  // Host hover/suggest widgets in a body-level node so they escape both ancestor `overflow: hidden`
  // clipping and `transform` ancestors (e.g. vue-draggable-resizable), which break `position: fixed`.
  const overflowWidgetsDomNode = document.createElement('div')
  overflowWidgetsDomNode.className = 'monaco-editor'
  overflowWidgetsDomNode.style.zIndex = '10000'
  document.body.appendChild(overflowWidgetsDomNode)

  const editor = monaco.editor.create(container, {
    value: options.value,
    language: options.language,
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    fixedOverflowWidgets: true,
    overflowWidgetsDomNode,
    autoClosingBrackets: options.language === 'javascript' ? 'never' : 'languageDefined',
    autoClosingQuotes: options.language === 'javascript' ? 'never' : 'languageDefined',
    ...options.editorOverrides,
  })

  editor.onDidDispose(() => {
    overflowWidgetsDomNode.remove()
  })

  // Show live data lake values when hovering mustache expressions or getDataLakeVariableData() calls
  attachDataLakeLiveTooltip(editor)

  // Register completion type for this editor's model
  const model = editor.getModel()
  if (model && options.dataLakeCompletionType) {
    const modelUri = model.uri.toString()
    modelCompletionTypes.set(modelUri, options.dataLakeCompletionType)

    // Clean up when editor is disposed
    editor.onDidDispose(() => {
      modelCompletionTypes.delete(modelUri)
    })
  }

  return editor
}

/**
 * Get the current cached variables map.
 * Useful for components that need access to variable info.
 * @returns {Record<string, DataLakeVariable>} The cached variables map
 */
export function getCachedVariablesMap(): Record<string, DataLakeVariable> {
  // Ensure Monaco is initialized so we have the cache
  initializeMonaco()
  return cachedVariablesMap
}

/**
 * Re-export monaco for components that need direct access to types or APIs
 */
export { monaco }
