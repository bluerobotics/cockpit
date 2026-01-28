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
  listenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'

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
 * Register completion providers for JavaScript.
 * The provider checks the model's registered completion type to determine behavior.
 */
function registerCompletionProviders(): void {
  // Data lake variable completion provider - triggered on '{' (for '{{' syntax)
  // Behavior depends on the completion type registered for each editor model
  monaco.languages.registerCompletionItemProvider('javascript', {
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

        return {
          suggestions: Object.entries(cachedVariablesMap).map(([id, variable]) => ({
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

        return {
          suggestions: Object.entries(cachedVariablesMap).map(([id, variable]) => ({
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
    autoClosingBrackets: options.language === 'javascript' ? 'never' : 'languageDefined',
    autoClosingQuotes: options.language === 'javascript' ? 'never' : 'languageDefined',
  })

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
