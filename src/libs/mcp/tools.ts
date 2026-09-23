import { z } from 'zod'

import {
  createDataLakeVariable,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import {
  createTransformingFunction,
  deleteTransformingFunction,
  evaluateDataLakeExpression,
  getAllTransformingFunctions,
  isCompoundDataLakeVariable,
  updateTransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import {
  deleteJavascriptActionConfig,
  getAllJavascriptActionConfigs,
  registerJavascriptActionConfig,
} from '@/libs/actions/free-javascript'
import {
  deleteHttpRequestActionConfig,
  getAllHttpRequestActionConfigs,
  registerHttpRequestActionConfig,
} from '@/libs/actions/http-request'
import {
  deleteMavlinkMessageActionConfig,
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import type { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { availableCockpitActions, executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import {
  canUserChangeDataLakeVariable,
  canUserDeleteDataLakeVariable,
  isSystemOwnedDataLakeVariable,
} from '@/libs/utils-data-lake'
import { customActionTypes, customActionTypesNames, HttpRequestMethod, MessageFieldType } from '@/types/cockpit-actions'
import type { McpToolDefinition } from '@/types/mcp'

/**
 * Tool offered to agents over MCP
 */
export interface McpTool extends Omit<McpToolDefinition, 'inputSchema'> {
  /**
   * Schema the agent's arguments are validated against
   */
  input: z.ZodType
  /**
   * Validates the arguments and runs the tool
   * @param args - Arguments sent by the agent
   * @returns {unknown} JSON-serializable result
   */
  run: (args: unknown) => unknown
}

/**
 * Define a tool whose arguments are validated against its schema before it runs
 * @param {McpTool} tool - The tool, with a run function taking the validated arguments
 * @returns {McpTool} The tool, with a run function taking unvalidated arguments
 */
export const defineMcpTool = <S extends z.ZodType>(
  tool: Omit<McpTool, 'input' | 'run'> & {
    /**
     * Schema the agent's arguments are validated against
     */
    input: S
    /**
     * Runs the tool
     * @param args - Validated arguments
     * @returns {unknown} JSON-serializable result
     */
    run: (args: z.output<S>) => unknown
  }
): McpTool => ({ ...tool, run: (args: unknown) => tool.run(tool.input.parse(args)) })

/**
 * Convert a tool to the definition registered with the MCP server
 * @param {McpTool} tool - The tool
 * @returns {McpToolDefinition} Its definition, with the schema as JSON Schema
 */
export const mcpToolDefinition = (tool: McpTool): McpToolDefinition => {
  const { name, title, description, readOnly, runsCode } = tool
  const inputSchema = z.toJSONSchema(tool.input, { io: 'input' }) as Record<string, unknown>
  return { name, title, description, readOnly, runsCode, inputSchema }
}

const variableType = z.enum(['string', 'number', 'boolean'])
const variableValue = z.union([z.string(), z.number(), z.boolean()])
const id = z.string().trim().min(1)
// Keeps a listing within what an agent can take in one tool result.
const variablesPageSize = 100
// How the vehicle names the unprefixed copies it keeps of each MAVLink field for widgets made before the prefix.
const legacyVariableNamePrefix = '(Legacy) '

const variableWithValue = (variableId: string): Record<string, unknown> => ({
  ...getDataLakeVariableInfo(variableId),
  value: getDataLakeVariableData(variableId),
})

// Transforming functions splice variable values into their source and eval it, so text able to end a quoted splice
// would run as code once any function reads the variable, now or later. Only the code switch may let an agent run code.
const splicedTextBreakout = /['"`\\\r\n]/

const refuseExpressionInjection = (value: unknown): void => {
  if (typeof value !== 'string' || !splicedTextBreakout.test(value)) return
  throw new Error(
    'Agents cannot write quotes, backslashes or line breaks to a variable, since expressions run its text.'
  )
}

const userVariableOrThrow = (variableId: string): void => {
  if (getDataLakeVariableInfo(variableId) === undefined) throw new Error(`No variable with id '${variableId}'.`)
  if (isSystemOwnedDataLakeVariable(variableId)) throw new Error(`Variable '${variableId}' belongs to Cockpit.`)
}

const dataLakeTools: McpTool[] = [
  defineMcpTool({
    name: 'list_data_lake_variables',
    title: 'List data-lake variables',
    description:
      'List data-lake variables with their current values, at most 100 per call. Vehicle telemetry adds ' +
      'hundreds of them, named /mavlink/<system>/<component>/<MESSAGE>/<field>, so filter with search. ' +
      "Use get_data_lake_variable for a variable's full description.",
    readOnly: true,
    runsCode: false,
    input: z.object({
      search: z.string().optional().describe('Case-insensitive filter on id and name'),
      includeLegacy: z.boolean().default(false).describe('Include the legacy unprefixed copies of MAVLink fields'),
      offset: z.number().int().min(0).default(0),
    }),
    run: ({ search, includeLegacy, offset }) => {
      const needle = search?.toLowerCase() ?? ''
      const matches = Object.values(getAllDataLakeVariablesInfo()).filter((v) => {
        if (!includeLegacy && v.name.startsWith(legacyVariableNamePrefix)) return false
        return v.id.toLowerCase().includes(needle) || v.name.toLowerCase().includes(needle)
      })
      const variables = matches.slice(offset, offset + variablesPageSize).map(({ id: variableId, name, type }) => ({
        id: variableId,
        name,
        type,
        value: getDataLakeVariableData(variableId),
      }))
      return { total: matches.length, offset, variables }
    },
  }),
  defineMcpTool({
    name: 'get_data_lake_variable',
    title: 'Get data-lake variable',
    description: 'Get a data-lake variable and its current value.',
    readOnly: true,
    runsCode: false,
    input: z.object({ id }),
    run: ({ id: variableId }) => {
      if (getDataLakeVariableInfo(variableId) === undefined) throw new Error(`No variable with id '${variableId}'.`)
      return variableWithValue(variableId)
    },
  }),
  defineMcpTool({
    name: 'create_data_lake_variable',
    title: 'Create data-lake variable',
    description:
      'Create a data-lake variable that widgets, actions and transforming functions can read, and the operator ' +
      'can change. Use the {{ id }} syntax to reference it from actions and transforming functions.',
    readOnly: false,
    runsCode: false,
    input: z.object({
      id,
      name: z.string().min(1),
      type: variableType,
      description: z.string().optional(),
      persistent: z.boolean().default(true).describe('Keep the variable between Cockpit restarts'),
      persistValue: z.boolean().default(false).describe('Keep its value between Cockpit restarts'),
      initialValue: variableValue.optional(),
    }),
    run: ({ initialValue, ...variable }) => {
      if (getDataLakeVariableInfo(variable.id) !== undefined) {
        throw new Error(`A variable with id '${variable.id}' already exists.`)
      }
      if (initialValue !== undefined && typeof initialValue !== variable.type) {
        throw new Error(`The initial value must be a ${variable.type}.`)
      }
      refuseExpressionInjection(initialValue)
      createDataLakeVariable({ ...variable, allowUserToChangeValue: true, systemOwned: false }, initialValue)
      return variableWithValue(variable.id)
    },
  }),
  defineMcpTool({
    name: 'update_data_lake_variable',
    title: 'Update data-lake variable',
    description: 'Change the name, description or persistence of a variable created by the operator or an agent.',
    readOnly: false,
    runsCode: false,
    input: z.object({
      id,
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      persistent: z.boolean().optional(),
      persistValue: z.boolean().optional(),
    }),
    run: (changes) => {
      userVariableOrThrow(changes.id)
      if (isCompoundDataLakeVariable(changes.id)) {
        throw new Error(`Variable '${changes.id}' is a transforming function. Use save_transforming_function.`)
      }
      const definedChanges = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
      updateDataLakeVariableInfo({ ...getDataLakeVariableInfo(changes.id)!, ...definedChanges })
      return variableWithValue(changes.id)
    },
  }),
  defineMcpTool({
    name: 'delete_data_lake_variable',
    title: 'Delete data-lake variable',
    description: 'Delete a variable created by the operator or an agent.',
    readOnly: false,
    runsCode: false,
    input: z.object({ id }),
    run: ({ id: variableId }) => {
      if (isCompoundDataLakeVariable(variableId)) {
        throw new Error(`Variable '${variableId}' is a transforming function. Use delete_transforming_function.`)
      }
      if (!canUserDeleteDataLakeVariable(variableId)) throw new Error(`Variable '${variableId}' cannot be deleted.`)
      deleteDataLakeVariable(variableId)
      return { deleted: variableId }
    },
  }),
  defineMcpTool({
    name: 'set_data_lake_variable_value',
    title: 'Set data-lake variable value',
    description: 'Set the value of a variable the operator is allowed to change. The value must match its type.',
    readOnly: false,
    runsCode: false,
    input: z.object({ id, value: variableValue }),
    run: ({ id: variableId, value }) => {
      const info = getDataLakeVariableInfo(variableId)
      if (info === undefined) throw new Error(`No variable with id '${variableId}'.`)
      if (!canUserChangeDataLakeVariable(variableId) || isCompoundDataLakeVariable(variableId)) {
        throw new Error(`The value of '${variableId}' cannot be changed.`)
      }
      if (typeof value !== info.type) throw new Error(`The value of '${variableId}' must be a ${info.type}.`)
      refuseExpressionInjection(value)
      setDataLakeVariableData(variableId, value)
      return variableWithValue(variableId)
    },
  }),
]

const transformingFunctionTools: McpTool[] = [
  defineMcpTool({
    name: 'list_transforming_functions',
    title: 'List transforming functions',
    description: 'List the transforming functions, which compute a data-lake variable from an expression.',
    readOnly: true,
    runsCode: false,
    input: z.object({}),
    run: () => getAllTransformingFunctions().map((func) => ({ ...func, value: getDataLakeVariableData(func.id) })),
  }),
  defineMcpTool({
    name: 'save_transforming_function',
    title: 'Save transforming function',
    description:
      'Create or update a transforming function: a data-lake variable whose value is a JavaScript expression ' +
      'recomputed whenever the variables it references change, e.g. "{{ /mavlink/1/1/VFR_HUD/alt }} * 3.28". ' +
      'Multi-line bodies must return the value.',
    readOnly: false,
    runsCode: true,
    input: z.object({
      id,
      name: z.string().min(1),
      type: variableType,
      expression: z.string().min(1),
      description: z.string().optional(),
    }),
    run: (func) => {
      const stored = getAllTransformingFunctions().find((f) => f.id === func.id)
      if (stored !== undefined) {
        if (!canUserChangeDataLakeVariable(func.id)) throw new Error(`Function '${func.id}' belongs to Cockpit.`)
        // Spread over the stored one so its provenance flags survive, as the Data Lake page does.
        updateTransformingFunction({ ...stored, ...func })
      } else if (getDataLakeVariableInfo(func.id) !== undefined) {
        throw new Error(`A variable with id '${func.id}' already exists.`)
      } else {
        createTransformingFunction(func.id, func.name, func.type, func.expression, func.description, {
          systemOwned: false,
        })
      }
      return variableWithValue(func.id)
    },
  }),
  defineMcpTool({
    name: 'delete_transforming_function',
    title: 'Delete transforming function',
    description: 'Delete a transforming function created by the operator or an agent, and its variable.',
    readOnly: false,
    runsCode: false,
    input: z.object({ id }),
    run: ({ id: funcId }) => {
      const stored = getAllTransformingFunctions().find((f) => f.id === funcId)
      if (stored === undefined) throw new Error(`No transforming function with id '${funcId}'.`)
      if (stored.systemOwned !== false) throw new Error(`Function '${funcId}' belongs to Cockpit.`)
      deleteTransformingFunction(stored)
      return { deleted: funcId }
    },
  }),
  defineMcpTool({
    name: 'evaluate_expression',
    title: 'Evaluate expression',
    description: 'Evaluate a transforming-function expression against the current data-lake values, to test it.',
    readOnly: false,
    runsCode: true,
    input: z.object({ expression: z.string().min(1) }),
    run: ({ expression }) => ({ value: evaluateDataLakeExpression(expression) }),
  }),
]

const actionConfigGetters = {
  [customActionTypes.httpRequest]: getAllHttpRequestActionConfigs,
  [customActionTypes.mavlinkMessage]: getAllMavlinkMessageActionConfigs,
  [customActionTypes.javascript]: getAllJavascriptActionConfigs,
}

const actionConfigDeleters = {
  [customActionTypes.httpRequest]: deleteHttpRequestActionConfig,
  [customActionTypes.mavlinkMessage]: deleteMavlinkMessageActionConfig,
  [customActionTypes.javascript]: deleteJavascriptActionConfig,
}

const customActionType = (actionId: string): customActionTypes | undefined => {
  const types = Object.keys(actionConfigGetters) as customActionTypes[]
  return types.find((type) => actionConfigGetters[type]()[actionId] !== undefined)
}

const optionalActionId = z.string().trim().min(1).optional().describe('Id of the action to replace. Omit to create')

// Actions are keyed by id alone, so saving under a built-in or another type's id would take over its buttons.
const replaceableActionId = (type: customActionTypes, actionId: string | undefined): string | undefined => {
  if (actionId === undefined || customActionType(actionId) === type) return actionId
  throw new Error(`'${actionId}' is not a ${customActionTypesNames[type]} action. Omit the id to create a new one.`)
}

const actionTools: McpTool[] = [
  defineMcpTool({
    name: 'list_actions',
    title: 'List actions',
    description:
      'List the actions the operator can trigger from joystick buttons and widgets, with the configuration of ' +
      'the custom ones. Built-in actions cannot be changed.',
    readOnly: true,
    runsCode: false,
    input: z.object({}),
    run: () => {
      return Object.values(availableCockpitActions).map((action) => {
        const type = customActionType(action.id)
        const config = type === undefined ? undefined : actionConfigGetters[type]()[action.id]
        return { id: action.id, name: action.name, type: type ?? 'built-in', config }
      })
    },
  }),
  defineMcpTool({
    name: 'save_http_request_action',
    title: 'Save HTTP request action',
    description:
      'Create or replace an action that sends an HTTP request. The URL, parameters and body may reference ' +
      'data-lake variables with {{ id }}.',
    readOnly: false,
    runsCode: true,
    input: z.object({
      id: optionalActionId,
      name: z.string().min(1),
      url: z.string().min(1),
      method: z.enum(HttpRequestMethod),
      headers: z.record(z.string(), z.string()).default({}),
      urlParams: z.record(z.string(), z.string()).default({}),
      body: z.string().default(''),
    }),
    run: ({ id: actionId, ...config }) => {
      return {
        id: registerHttpRequestActionConfig(config, replaceableActionId(customActionTypes.httpRequest, actionId)),
      }
    },
  }),
  defineMcpTool({
    name: 'save_mavlink_message_action',
    title: 'Save MAVLink message action',
    description:
      'Create or replace an action that sends a MAVLink message to the vehicle. messageConfig maps each ' +
      'message field to its type and value, or is the whole message as a JSON string.',
    readOnly: false,
    runsCode: true,
    input: z.object({
      id: optionalActionId,
      name: z.string().min(1),
      messageType: z.string().min(1).describe('MAVLink message type, e.g. COMMAND_LONG'),
      messageConfig: z.union([
        z.string(),
        z.record(z.string(), z.object({ type: z.enum(MessageFieldType), value: z.unknown() })),
      ]),
    }),
    run: ({ id: actionId, messageType, ...config }) => {
      return {
        id: registerMavlinkMessageActionConfig(
          { ...config, messageType: messageType as MAVLinkType },
          replaceableActionId(customActionTypes.mavlinkMessage, actionId)
        ),
      }
    },
  }),
  defineMcpTool({
    name: 'save_javascript_action',
    title: 'Save JavaScript action',
    description:
      'Create or replace an action that runs JavaScript inside Cockpit. The code gets a cockpit argument with ' +
      'the data-lake API: register listeners and timers with cockpit.listenDataLakeVariable(id, callback), ' +
      'cockpit.setInterval and cockpit.setTimeout, and pass any other teardown to cockpit.onCleanup(fn), so ' +
      'replacing or deleting the action stops them. The bare setInterval and window.cockpit are not tracked.',
    readOnly: false,
    runsCode: true,
    input: z.object({ id: optionalActionId, name: z.string().min(1), code: z.string().min(1) }),
    run: ({ id: actionId, ...config }) => {
      return { id: registerJavascriptActionConfig(config, replaceableActionId(customActionTypes.javascript, actionId)) }
    },
  }),
  defineMcpTool({
    name: 'delete_action',
    title: 'Delete action',
    description: 'Delete a custom action.',
    readOnly: false,
    runsCode: false,
    input: z.object({ id }),
    run: ({ id: actionId }) => {
      const type = customActionType(actionId)
      if (type === undefined) throw new Error(`No custom action with id '${actionId}'.`)
      actionConfigDeleters[type](actionId)
      return { deleted: actionId }
    },
  }),
  defineMcpTool({
    name: 'execute_action',
    title: 'Execute action',
    description: 'Trigger an action, as if the operator pressed a button mapped to it. It may command the vehicle.',
    readOnly: false,
    runsCode: true,
    input: z.object({ id }),
    run: ({ id: actionId }) => {
      if (!Object.keys(availableCockpitActions).includes(actionId)) throw new Error(`No action with id '${actionId}'.`)
      executeActionCallback(actionId)
      return { executed: actionId }
    },
  }),
]

export const libMcpTools: McpTool[] = [...dataLakeTools, ...transformingFunctionTools, ...actionTools]
