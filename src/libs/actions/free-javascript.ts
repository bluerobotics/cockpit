import {
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'

const javascriptActionIdPrefix = 'javascript-action'

export type JavascriptActionConfig = {
  /**
   * The name of the action
   */
  name: string
  /**
   * The JavaScript code to execute
   */
  code: string
}

let registeredJavascriptActionConfigs: Record<string, JavascriptActionConfig> = {}

export const registerJavascriptActionConfig = (action: JavascriptActionConfig): void => {
  const id = `${javascriptActionIdPrefix} (${action.name})`
  registeredJavascriptActionConfigs[id] = action
  saveJavascriptActionConfigs()
  updateCockpitActions()
}

export const getJavascriptActionConfig = (id: string): JavascriptActionConfig | undefined => {
  return registeredJavascriptActionConfigs[id]
}

export const getAllJavascriptActionConfigs = (): Record<string, JavascriptActionConfig> => {
  return registeredJavascriptActionConfigs
}

export const deleteJavascriptActionConfig = (id: string): void => {
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
  const savedActions = localStorage.getItem('cockpit-javascript-actions')
  if (savedActions) {
    registeredJavascriptActionConfigs = JSON.parse(savedActions)
  }
}

export const saveJavascriptActionConfigs = (): void => {
  localStorage.setItem('cockpit-javascript-actions', JSON.stringify(registeredJavascriptActionConfigs))
}

export type JavascriptActionCallback = () => void

export const executeActionCode = (code: string): void => {
  try {
    // Execute the code
    new Function(code)()
  } catch (error) {
    console.error(`Error executing JavaScript action:`, error)
  }
}

export const getJavascriptActionCallback = (id: string): JavascriptActionCallback => {
  const action = getJavascriptActionConfig(id)
  if (!action) {
    throw new Error(`Action with id ${id} not found.`)
  }

  return () => {
    executeActionCode(action.code)
  }
}

loadJavascriptActionConfigs()
updateCockpitActions()
