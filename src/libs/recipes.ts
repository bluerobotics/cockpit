import { z } from 'zod'

import { findDataLakeVariablesIdsInString } from '@/libs/utils-data-lake'
import { customActionTypes, customActionTypesNames, HttpRequestMethod, MessageFieldType } from '@/types/cockpit-actions'
import {
  type CockpitRecipe,
  type RecipeAction,
  type RecipeItem,
  recipeFileType,
  recipeFormatVersion,
} from '@/types/recipes'

const dataLakeKey = (id: string): string => `data-lake:${id}`
const actionKey = (id: string): string => `action:${id}`
const websocketKey = (url: string): string => `websocket:${url}`
const diyWidgetKey = (id: string): string => `diy-widget:${id}`

const variableTypeSchema = z.enum(['string', 'number', 'boolean'])
const dataLakeVariableSchema = z.object({
  variable: z.object({
    id: z.string().min(1),
    name: z.string(),
    type: variableTypeSchema,
    description: z.string().optional(),
    unit: z.string().optional(),
    persistent: z.boolean().optional(),
    persistValue: z.boolean().optional(),
    allowUserToChangeValue: z.boolean().optional(),
    systemOwned: z.boolean().optional(),
  }),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})
const compoundVariableSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: variableTypeSchema,
  description: z.string().optional(),
  unit: z.string().optional(),
  expression: z.string(),
  systemOwned: z.boolean().optional(),
  allowUserToChangeValue: z.boolean().optional(),
})
const actionCommonFields = {
  id: z.string().min(1),
  link: z.object({ variables: z.array(z.string()), minInterval: z.number().nonnegative() }).optional(),
}
const actionSchema = z.discriminatedUnion('type', [
  z.object({
    ...actionCommonFields,
    type: z.literal(customActionTypes.httpRequest),
    config: z.object({
      name: z.string(),
      url: z.string(),
      method: z.enum(HttpRequestMethod),
      headers: z.record(z.string(), z.string()),
      urlParams: z.record(z.string(), z.string()),
      body: z.string(),
    }),
  }),
  z.object({
    ...actionCommonFields,
    type: z.literal(customActionTypes.mavlinkMessage),
    config: z.object({
      name: z.string(),
      messageType: z.string(),
      messageConfig: z.union([
        z.string(),
        z.record(z.string(), z.object({ type: z.enum(MessageFieldType), value: z.unknown() })),
      ]),
    }),
  }),
  z.object({
    ...actionCommonFields,
    type: z.literal(customActionTypes.javascript),
    config: z.object({ name: z.string(), code: z.string() }),
  }),
])
const diyWidgetSchema = z.object({
  id: z.string().min(1),
  template: z.object({
    name: z.string(),
    html: z.string(),
    css: z.string(),
    js: z.string(),
    inheritCockpitStyles: z.boolean(),
    scopedScript: z.boolean(),
  }),
})
const recipeSchema = z.object({
  type: z.literal(recipeFileType),
  version: z.number(),
  name: z.string(),
  description: z.string().default(''),
  createdAt: z.string().default(''),
  dataLakeVariables: z.array(z.unknown()).default([]),
  compoundVariables: z.array(z.unknown()).default([]),
  actions: z.array(z.unknown()).default([]),
  websocketConnections: z.array(z.unknown()).default([]),
  diyWidgets: z.array(z.unknown()).default([]),
})

/**
 * A recipe read from a file, and how many of its entries were left out
 */
export interface ParsedRecipe {
  /**
   * The recipe, holding only the entries kept
   */
  recipe: CockpitRecipe
  /**
   * Number of entries left out
   */
  droppedEntries: number
}

/**
 * Read a recipe file, keeping the entries that are well formed so one broken entry does not lose the rest
 * @param {string} text - The file's contents
 * @returns {ParsedRecipe} The recipe and the number of entries left out
 * @throws {Error} With a message for the user, when the file is not a recipe this Cockpit can read
 */
export const parseRecipe = (text: string): ParsedRecipe => {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }

  const parsed = recipeSchema.safeParse(json)
  if (!parsed.success) throw new Error('The file is not a Cockpit recipe.')
  if (parsed.data.version > recipeFormatVersion) {
    throw new Error('The recipe was made by a newer version of Cockpit. Update Cockpit to read it.')
  }

  let droppedEntries = 0
  const validEntries = <T>(entries: unknown[], schema: z.ZodType<T>): T[] => {
    const valid = entries.flatMap((entry) => {
      const result = schema.safeParse(entry)
      return result.success ? [result.data] : []
    })
    droppedEntries += entries.length - valid.length
    return valid
  }

  const recipe: CockpitRecipe = {
    type: recipeFileType,
    version: recipeFormatVersion,
    name: parsed.data.name,
    description: parsed.data.description,
    createdAt: parsed.data.createdAt,
    dataLakeVariables: validEntries(parsed.data.dataLakeVariables, dataLakeVariableSchema),
    compoundVariables: validEntries(parsed.data.compoundVariables, compoundVariableSchema),
    // The schema checks the message type is a string, not that it is a known MAVLink message; sending it does that.
    actions: validEntries(parsed.data.actions, actionSchema) as RecipeAction[],
    websocketConnections: validEntries(parsed.data.websocketConnections, z.string().min(1)),
    diyWidgets: validEntries(parsed.data.diyWidgets, diyWidgetSchema),
  }
  return { recipe, droppedEntries }
}

/**
 * Every entry of a recipe as the dialogs list it
 * @param {CockpitRecipe} recipe - The recipe
 * @returns {RecipeItem[]} One item per entry
 */
export const recipeItems = (recipe: CockpitRecipe): RecipeItem[] => [
  ...recipe.dataLakeVariables.map(({ variable }) => ({
    key: dataLakeKey(variable.id),
    area: 'dataLake' as const,
    kind: 'Variable',
    name: variable.name,
    id: variable.id,
  })),
  ...recipe.compoundVariables.map((func) => ({
    key: dataLakeKey(func.id),
    area: 'dataLake' as const,
    kind: 'Compound variable',
    name: func.name,
    id: func.id,
  })),
  ...recipe.actions.map((action) => ({
    key: actionKey(action.id),
    area: 'actions' as const,
    kind: customActionTypesNames[action.type],
    name: action.config.name,
    id: action.id,
  })),
  ...recipe.websocketConnections.map((url) => ({
    key: websocketKey(url),
    area: 'websockets' as const,
    kind: 'WebSocket connection',
    name: url,
    id: url,
  })),
  ...recipe.diyWidgets.map(({ id, template }) => ({
    key: diyWidgetKey(id),
    area: 'diyWidgets' as const,
    kind: 'DIY widget',
    name: template.name,
    id,
  })),
]

/**
 * Keep only some entries of a recipe
 * @param {CockpitRecipe} recipe - The recipe
 * @param {string[]} keys - Keys of the items to keep
 * @returns {CockpitRecipe} A recipe with only those entries
 */
export const pickRecipeItems = (recipe: CockpitRecipe, keys: string[]): CockpitRecipe => {
  const kept = new Set(keys)
  return {
    ...recipe,
    dataLakeVariables: recipe.dataLakeVariables.filter(({ variable }) => kept.has(dataLakeKey(variable.id))),
    compoundVariables: recipe.compoundVariables.filter((func) => kept.has(dataLakeKey(func.id))),
    actions: recipe.actions.filter((action) => kept.has(actionKey(action.id))),
    websocketConnections: recipe.websocketConnections.filter((url) => kept.has(websocketKey(url))),
    diyWidgets: recipe.diyWidgets.filter(({ id }) => kept.has(diyWidgetKey(id))),
  }
}

/**
 * Keys an item would have for each existing id, to tell which recipe entries would replace something
 * @param {string[]} dataLakeIds - Ids of every data lake variable
 * @param {string[]} actionIds - Ids of every custom action
 * @param {string[]} websocketUrls - Every WebSocket connection URL
 * @param {string[]} diyWidgetIds - Ids of every DIY widget in the library
 * @returns {string[]} The keys
 */
export const existingRecipeItemKeys = (
  dataLakeIds: string[],
  actionIds: string[],
  websocketUrls: string[],
  diyWidgetIds: string[]
): string[] => [
  ...dataLakeIds.map(dataLakeKey),
  ...actionIds.map(actionKey),
  ...websocketUrls.map(websocketKey),
  ...diyWidgetIds.map(diyWidgetKey),
]

/**
 * An empty recipe, to be filled with entries
 * @param {string} name - Name of the recipe
 * @param {string} description - What the recipe is for
 * @returns {CockpitRecipe} The recipe
 */
export const emptyRecipe = (name = '', description = ''): CockpitRecipe => ({
  type: recipeFileType,
  version: recipeFormatVersion,
  name,
  description,
  createdAt: new Date().toISOString(),
  dataLakeVariables: [],
  compoundVariables: [],
  actions: [],
  websocketConnections: [],
  diyWidgets: [],
})

const actionTemplates = (action: RecipeAction): string[] => {
  switch (action.type) {
    case customActionTypes.httpRequest: {
      const { url, body, urlParams, headers } = action.config
      return [url, body, ...Object.values(urlParams), ...Object.values(headers)]
    }
    case customActionTypes.mavlinkMessage: {
      const { messageConfig } = action.config
      if (typeof messageConfig === 'string') return [messageConfig]
      return Object.values(messageConfig).map((field) => String(field.value))
    }
    case customActionTypes.javascript:
      return []
  }
}

/**
 * Which entries of a recipe each entry needs, from the `{{ variable }}` inputs of its templates, the variables that
 * trigger an action, and the variable and action ids named in JavaScript and DIY widget code
 * @param {CockpitRecipe} recipe - The recipe
 * @returns {Record<string, string[]>} Keys of the items each item needs, by item key. Only entries of the recipe are
 * listed, since anything else is Cockpit's own or missing from the recipe either way
 */
export const recipeDependencies = (recipe: CockpitRecipe): Record<string, string[]> => {
  const dataLakeIds = [
    ...recipe.dataLakeVariables.map(({ variable }) => variable.id),
    ...recipe.compoundVariables.map((func) => func.id),
  ]
  const actionIds = recipe.actions.map((action) => action.id)

  const needs = (ownKey: string, templates: string[], variableIds: string[] = [], code: string[] = []): string[] => {
    const referencedVariables = [...templates.flatMap(findDataLakeVariablesIdsInString), ...variableIds]
    // ponytail: a plain substring search, so an id contained in a longer one is over-reported. Parse the `cockpit.*`
    // calls if that ever selects something unwanted.
    const named = (ids: string[]): string[] => ids.filter((id) => code.some((snippet) => snippet.includes(id)))
    const keys = [
      ...dataLakeIds.filter((id) => referencedVariables.includes(id)).map(dataLakeKey),
      ...named(dataLakeIds).map(dataLakeKey),
      ...named(actionIds).map(actionKey),
    ]
    return [...new Set(keys)].filter((key) => key !== ownKey)
  }

  const dependencies: Record<string, string[]> = {}
  recipe.compoundVariables.forEach((func) => {
    dependencies[dataLakeKey(func.id)] = needs(dataLakeKey(func.id), [func.expression])
  })
  recipe.actions.forEach((action) => {
    const code = action.type === customActionTypes.javascript ? [action.config.code] : []
    dependencies[actionKey(action.id)] = needs(
      actionKey(action.id),
      actionTemplates(action),
      action.link?.variables,
      code
    )
  })
  recipe.websocketConnections.forEach((url) => {
    dependencies[websocketKey(url)] = needs(websocketKey(url), [url])
  })
  recipe.diyWidgets.forEach(({ id, template }) => {
    dependencies[diyWidgetKey(id)] = needs(diyWidgetKey(id), [], [], [template.html, template.js])
  })
  return dependencies
}

/**
 * The given items plus every item they need, directly or through another item
 * @param {string[]} keys - Keys of the items
 * @param {Record<string, string[]>} dependencies - Keys of the items each item needs, from `recipeDependencies`
 * @returns {string[]} The keys, with those of the items needed added
 */
export const withDependencies = (keys: string[], dependencies: Record<string, string[]>): string[] => {
  const result = new Set(keys)
  const pending = [...keys]
  for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
    const unseen = (dependencies[key] ?? []).filter((needed) => !result.has(needed))
    unseen.forEach((needed) => result.add(needed))
    pending.push(...unseen)
  }
  return [...result]
}

/**
 * The items each chosen item needs but that were left out
 * @param {string[]} selected - Keys of the chosen items
 * @param {Record<string, string[]>} dependencies - Keys of the items each item needs, from `recipeDependencies`
 * @returns {Record<string, string[]>} Keys of the items left out, by key of the chosen item needing them. Chosen
 * items missing nothing are not listed
 */
export const missingDependencies = (
  selected: string[],
  dependencies: Record<string, string[]>
): Record<string, string[]> => {
  const chosen = new Set(selected)
  return Object.fromEntries(
    selected
      .map((key) => [key, (dependencies[key] ?? []).filter((needed) => !chosen.has(needed))] as const)
      .filter(([, missing]) => missing.length > 0)
  )
}
