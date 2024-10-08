import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { getCockpitActionVariableData } from './data-lake'

const httpRequestActionIdPrefix = 'http-request-action'

/**
 * The types of HTTP methods that can be used.
 */
export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}
export const availableHttpRequestMethods: HttpRequestMethod[] = Object.values(HttpRequestMethod)

export type HttpRequestActionConfig = {
  /**
   * The name of the action.
   */
  name: string
  /**
   * The URL to send the request to.
   */
  url: string
  /**
   * The HTTP method to use.
   */
  method: HttpRequestMethod
  /**
   * The headers to send with the request.
   */
  headers: Record<string, string>
  /**
   * The URL parameters to send with the request.
   */
  urlParams: Record<string, string>
  /**
   * The body of the request.
   */
  body: string
}

let registeredHttpRequestActionConfigs: Record<string, HttpRequestActionConfig> = {}

export const registerHttpRequestActionConfig = (action: HttpRequestActionConfig): void => {
  const id = `${httpRequestActionIdPrefix} (${action.name})`
  registeredHttpRequestActionConfigs[id] = action
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const getHttpRequestActionConfig = (id: string): HttpRequestActionConfig | undefined => {
  return registeredHttpRequestActionConfigs[id]
}

export const getAllHttpRequestActionConfigs = (): Record<string, HttpRequestActionConfig> => {
  return registeredHttpRequestActionConfigs
}

export const deleteHttpRequestActionConfig = (id: string): void => {
  delete registeredHttpRequestActionConfigs[id]
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateHttpRequestActionConfig = (id: string, updatedAction: HttpRequestActionConfig): void => {
  registeredHttpRequestActionConfigs[id] = updatedAction
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateCockpitActions = (): void => {
  Object.entries(availableCockpitActions).forEach(([id]) => {
    if (id.includes(httpRequestActionIdPrefix)) {
      deleteAction(id as CockpitActionsFunction)
    }
  })

  const httpResquestActions = getAllHttpRequestActionConfigs()
  for (const [id, action] of Object.entries(httpResquestActions)) {
    try {
      const cockpitAction = new CockpitAction(id as CockpitActionsFunction, action.name)
      registerNewAction(cockpitAction)
      registerActionCallback(cockpitAction, getHttpRequestActionCallback(id))
    } catch (error) {
      console.error(`Error registering action ${id}: ${error}`)
    }
  }
}

export const loadHttpRequestActionConfigs = (): void => {
  const savedActions = localStorage.getItem('cockpit-http-request-actions')
  if (savedActions) {
    registeredHttpRequestActionConfigs = JSON.parse(savedActions)
  }
}

export const saveHttpRequestActionConfigs = (): void => {
  localStorage.setItem('cockpit-http-request-actions', JSON.stringify(registeredHttpRequestActionConfigs))
}

export type HttpRequestActionCallback = () => void

export const getHttpRequestActionCallback = (id: string): HttpRequestActionCallback => {
  const action = getHttpRequestActionConfig(id)
  if (!action) {
    throw new Error(`Action with id ${id} not found.`)
  }

  let parsedBody = action.body
  const parsedUrlParams = action.urlParams

  const cockpitInputsInBody = action.body.match(/{{\s*([^{}\s]+)\s*}}/g)
  if (cockpitInputsInBody) {
    for (const input of cockpitInputsInBody) {
      const parsedInput = input.replace('{{', '').replace('}}', '').trim()
      const inputData = getCockpitActionVariableData(parsedInput)
      if (inputData) {
        parsedBody = parsedBody.replace(input, inputData.toString())
      }
    }
  }

  const cockpitInputsInUrlParams = Object.entries(action.urlParams).filter(
    ([, value]) => typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')
  )
  if (cockpitInputsInUrlParams) {
    for (const [key, value] of cockpitInputsInUrlParams) {
      const parsedInput = value.replace('{{', '').replace('}}', '').trim()
      const inputData = getCockpitActionVariableData(parsedInput)
      if (inputData) {
        parsedUrlParams[key] = inputData.toString()
      }
    }
  }

  const url = new URL(action.url)

  url.search = new URLSearchParams(parsedUrlParams).toString()

  return () => {
    fetch(url, {
      method: action.method,
      headers: action.headers,
      body: action.method === HttpRequestMethod.GET ? undefined : parsedBody,
    })
  }
}

loadHttpRequestActionConfigs()
updateCockpitActions()
