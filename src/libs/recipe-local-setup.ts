import { getActionLink, removeActionLink, saveActionLink } from '@/libs/actions/action-links'
import { getAutoRunConfig, removeAutoRunConfig, saveAutoRunConfig } from '@/libs/actions/auto-run'
import {
  createDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import {
  createTransformingFunction,
  deleteTransformingFunction,
  getAllTransformingFunctions,
  isCompoundDataLakeVariable,
} from '@/libs/actions/data-lake-transformations'
import { getAllJavascriptActionConfigs, registerJavascriptActionConfig } from '@/libs/actions/free-javascript'
import { getAllHttpRequestActionConfigs, registerHttpRequestActionConfig } from '@/libs/actions/http-request'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { getAllDiyWidgetTemplates, saveDiyWidgetTemplate } from '@/libs/diy-widget-library'
import { addGenericWebSocketConnection, getGenericWebSocketConnections } from '@/libs/generic-websocket'
import { mavlinkCameraFocusActionId, mavlinkCameraZoomActionId } from '@/libs/joystick/protocols/predefined-resources'
import { type ParsedRecipe, emptyRecipe, existingRecipeItemKeys } from '@/libs/recipes'
import { customActionTypes } from '@/types/cockpit-actions'
import type { CockpitRecipe, RecipeAction } from '@/types/recipes'

const cockpitActionIds = (): (string | undefined)[] => [mavlinkCameraZoomActionId, mavlinkCameraFocusActionId]

const withTriggers = (action: RecipeAction): RecipeAction => {
  const link = getActionLink(action.id)
  const autoRun = getAutoRunConfig(action.id)
  return {
    ...action,
    ...(link && { link: { variables: link.variables, minInterval: link.minInterval } }),
    ...(autoRun && { autoRun: { ...autoRun } }),
  }
}

/**
 * Everything the user made in this Cockpit that a recipe can carry, as one recipe
 * @returns {CockpitRecipe} A recipe with every user data lake variable, compound variable, custom action, WebSocket
 * connection and library DIY widget
 */
export const userSetupAsRecipe = (): CockpitRecipe => {
  const recipe = emptyRecipe()

  recipe.dataLakeVariables = Object.values(getAllDataLakeVariablesInfo())
    .filter((variable) => variable.systemOwned === false && !isCompoundDataLakeVariable(variable.id))
    .map((variable) => {
      const value = getDataLakeVariableData(variable.id)
      return { variable: { ...variable }, ...(variable.persistValue && value !== undefined && { value }) }
    })
  recipe.compoundVariables = getAllTransformingFunctions()
    .filter((func) => func.systemOwned === false)
    .map((func) => ({ ...func }))
  recipe.actions = [
    ...Object.entries(getAllHttpRequestActionConfigs()).map(([id, config]) => ({
      id,
      type: customActionTypes.httpRequest as const,
      config,
    })),
    ...Object.entries(getAllMavlinkMessageActionConfigs()).map(([id, config]) => ({
      id,
      type: customActionTypes.mavlinkMessage as const,
      config,
    })),
    ...Object.entries(getAllJavascriptActionConfigs()).map(([id, config]) => ({
      id,
      type: customActionTypes.javascript as const,
      config,
    })),
  ]
    .filter((action) => !cockpitActionIds().includes(action.id))
    .map((action) => withTriggers(structuredClone(action)))
  recipe.websocketConnections = Object.keys(getGenericWebSocketConnections())
  recipe.diyWidgets = Object.entries(getAllDiyWidgetTemplates()).map(([id, template]) => ({ id, template }))
  return recipe
}

/**
 * Leave out of a recipe the entries that would replace something of Cockpit's own here, which making a recipe never
 * puts in one, so only a hand-edited file can carry them
 * @param {CockpitRecipe} recipe - The recipe read from a file
 * @returns {ParsedRecipe} The recipe without those entries, and how many were left out
 */
export const withoutCockpitOwnedEntries = (recipe: CockpitRecipe): ParsedRecipe => {
  const ownedByCockpit = (id: string): boolean => {
    const info = getDataLakeVariableInfo(id)
    return info !== undefined && info.systemOwned !== false
  }
  const kept: CockpitRecipe = {
    ...recipe,
    dataLakeVariables: recipe.dataLakeVariables.filter(({ variable }) => !ownedByCockpit(variable.id)),
    compoundVariables: recipe.compoundVariables.filter((func) => !ownedByCockpit(func.id)),
    actions: recipe.actions.filter((action) => !cockpitActionIds().includes(action.id)),
  }
  const count = (r: CockpitRecipe): number => r.dataLakeVariables.length + r.compoundVariables.length + r.actions.length
  return { recipe: kept, droppedEntries: count(recipe) - count(kept) }
}

/**
 * Keys of every item that already exists in this Cockpit, user-made or not, which reading a recipe would replace
 * @returns {string[]} The item keys
 */
export const existingItemKeys = (): string[] =>
  existingRecipeItemKeys(
    Object.keys(getAllDataLakeVariablesInfo()),
    [
      ...Object.keys(getAllHttpRequestActionConfigs()),
      ...Object.keys(getAllMavlinkMessageActionConfigs()),
      ...Object.keys(getAllJavascriptActionConfigs()),
    ],
    Object.keys(getGenericWebSocketConnections()),
    Object.keys(getAllDiyWidgetTemplates())
  )

const registerAction = (action: RecipeAction): void => {
  switch (action.type) {
    case customActionTypes.httpRequest:
      registerHttpRequestActionConfig(action.config, action.id)
      break
    case customActionTypes.mavlinkMessage:
      registerMavlinkMessageActionConfig(action.config, action.id)
      break
    case customActionTypes.javascript:
      registerJavascriptActionConfig(action.config, action.id)
      break
  }

  if (action.link) {
    saveActionLink(action.id, action.type, action.link.variables, action.link.minInterval)
  } else {
    removeActionLink(action.id)
  }

  // Saving alone would leave a running interval behind when the recipe switches the action to run once.
  removeAutoRunConfig(action.id)
  if (action.autoRun) saveAutoRunConfig(action.id, action.autoRun)
}

/**
 * What reading a recipe did
 */
export interface RecipeApplyResult {
  /**
   * Number of entries added or replaced
   */
  applied: number
  /**
   * Names of the entries that could not be added, with the reason
   */
  failed: string[]
}

/**
 * Add every entry of a recipe to this Cockpit, replacing what exists under the same id so that actions, widgets and
 * joystick mappings calling those ids keep working. Everything read becomes the user's own.
 * @param {CockpitRecipe} recipe - The recipe, holding only the entries to add
 * @returns {RecipeApplyResult} How many entries were added, and which failed
 */
export const applyRecipe = (recipe: CockpitRecipe): RecipeApplyResult => {
  const result: RecipeApplyResult = { applied: 0, failed: [] }
  const attempt = (name: string, apply: () => void): void => {
    try {
      apply()
      result.applied++
    } catch (error) {
      result.failed.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const dropCompoundVariable = (id: string): void => {
    const existing = getAllTransformingFunctions().find((func) => func.id === id)
    if (existing) deleteTransformingFunction(existing)
  }

  // Variables go first, as the compound variables, actions and connections after them may read them.
  recipe.dataLakeVariables.forEach(({ variable, value }) =>
    attempt(variable.name, () => {
      dropCompoundVariable(variable.id)
      createDataLakeVariable({ ...variable, systemOwned: false })
      if (value !== undefined) setDataLakeVariableData(variable.id, value)
    })
  )
  recipe.compoundVariables.forEach((func) =>
    attempt(func.name, () => {
      // Creating one again would store a second function under the same id rather than replace the first.
      dropCompoundVariable(func.id)
      createTransformingFunction(func.id, func.name, func.type, func.expression, func.description, {
        systemOwned: false,
        unit: func.unit,
      })
    })
  )
  recipe.actions.forEach((action) => attempt(action.config.name, () => registerAction(action)))
  recipe.websocketConnections.forEach((url) => attempt(url, () => addGenericWebSocketConnection(url)))
  recipe.diyWidgets.forEach(({ id, template }) => attempt(template.name, () => saveDiyWidgetTemplate(template, id)))
  return result
}
