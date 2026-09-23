import { JavascriptActionConfig } from '@/types/cockpit-actions'

import {
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { settingsManager } from '../settings-management'
import { type CleanupScope, createCleanupScope, runUserScript } from '../user-script'

const javascriptActionIdPrefix = 'javascript-action'

let registeredJavascriptActionConfigs: Record<string, JavascriptActionConfig> = {}
const cleanupScopeOfAction: Record<string, CleanupScope> = {}

const actionCleanupScope = (id: string): CleanupScope => {
  cleanupScopeOfAction[id] ??= createCleanupScope('JavaScript action')
  return cleanupScopeOfAction[id]
}

// Saving new code or deleting the action must not leave the old code's listeners and timers running beside it.
const undoActionRuns = (id: string): void => {
  cleanupScopeOfAction[id]?.cleanUp()
}

/**
 * Register a new JavaScript action config and create a cockpit action for it
 * @param {JavascriptActionConfig} action - The action config to register
 * @param {string} customId - Optional explicit ID (e.g. from an extension manifest). Falls back to a generated ID.
 * @returns {string} The ID under which the action was registered
 */
export const registerJavascriptActionConfig = (action: JavascriptActionConfig, customId?: string): string => {
  const id = customId ?? `${javascriptActionIdPrefix} (${action.name})`
  undoActionRuns(id)
  registeredJavascriptActionConfigs[id] = action
  saveJavascriptActionConfigs()
  updateCockpitActions()
  return id
}

export const getJavascriptActionConfig = (id: string): JavascriptActionConfig | undefined => {
  return registeredJavascriptActionConfigs[id]
}

export const getAllJavascriptActionConfigs = (): Record<string, JavascriptActionConfig> => {
  return registeredJavascriptActionConfigs
}

export const deleteJavascriptActionConfig = (id: string): void => {
  undoActionRuns(id)
  deleteAction(id as CockpitActionsFunction)
  delete registeredJavascriptActionConfigs[id]
  saveJavascriptActionConfigs()
  updateCockpitActions()
}

export const updateCockpitActions = (): void => {
  Object.entries(registeredJavascriptActionConfigs).forEach(([id]) => {
    if (id.includes(javascriptActionIdPrefix)) {
      deleteAction(id as CockpitActionsFunction)
    }
  })

  const javascriptActions = getAllJavascriptActionConfigs()
  for (const [id, action] of Object.entries(javascriptActions)) {
    try {
      const cockpitAction = new CockpitAction(id as CockpitActionsFunction, action.name)
      registerNewAction(cockpitAction)
      registerActionCallback(cockpitAction, getJavascriptActionCallback(id))
    } catch (error) {
      console.error(`Error registering action ${id}: ${error}`)
    }
  }
}

export const loadJavascriptActionConfigs = (): void => {
  const savedActions = settingsManager.getKeyValue('cockpit-javascript-actions')
  if (savedActions !== undefined) {
    registeredJavascriptActionConfigs = savedActions as Record<string, JavascriptActionConfig>
  }
}

export const saveJavascriptActionConfigs = (): void => {
  settingsManager.setKeyValue('cockpit-javascript-actions', registeredJavascriptActionConfigs)
}

export type JavascriptActionCallback = () => void

/**
 * Run an action's code with the tracked `cockpit` API, recording what it registers there in `scope`
 * @param {string} code - The code to run
 * @param {CleanupScope} scope - Where the run records what to undo
 */
export const executeActionCode = (code: string, scope: CleanupScope): void => {
  runUserScript(code, 'JavaScript action', scope)
}

export const getJavascriptActionCallback = (id: string): JavascriptActionCallback => {
  const action = getJavascriptActionConfig(id)
  if (!action) {
    throw new Error(`Action with id ${id} not found.`)
  }

  return () => {
    executeActionCode(action.code, actionCleanupScope(id))
  }
}

loadJavascriptActionConfigs()
updateCockpitActions()
