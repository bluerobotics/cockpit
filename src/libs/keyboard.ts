import { getDataLakeVariableData, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { settingsManager } from '@/libs/settings-management'
import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

/**
 * Physical key codes (`KeyboardEvent.code`) mapped to the action each key triggers
 */
export type KeyboardMapping = Record<string, ProtocolAction>

export const keyboardMappingKey = 'cockpit-keyboard-functions-mapping'

const nonTextInputTypes = ['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit']

/**
 * Whether a key event is the user typing into a field, which must not trigger keyboard actions
 * @param {EventTarget | null} target The element the key event was dispatched to
 * @returns {boolean} True for text inputs, text areas, selects and editable content
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  return target instanceof HTMLInputElement && !nonTextInputTypes.includes(target.type)
}

// Keys a focused control answers to, like Space on a button or the arrows on a slider or an open list
const controlKeys = ['Enter', 'NumpadEnter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
const interactiveControls =
  'button, a[href], input, select, [role="button"], [role="option"], [role="menuitem"], ' +
  '[role="slider"], [role="tab"], [role="checkbox"], [role="switch"], [role="radio"], [role="listbox"]'
// A plain button ignores the arrows, so they still reach the mapping after a click, like the one that arms
const arrowControls =
  'input, select, [role="option"], [role="menuitem"], [role="slider"], [role="tab"], [role="radio"], [role="listbox"]'

/**
 * Whether a key event operates the control that has focus, which must keep working from the keyboard
 * @param {KeyboardEvent} event The key event
 * @returns {boolean} True for Space and Enter pressed on a button, input, slider, list or menu, and for the arrow
 * keys pressed on one that moves with them
 */
const operatesFocusedControl = (event: KeyboardEvent): boolean => {
  if (!controlKeys.includes(event.code) || !(event.target instanceof HTMLElement)) return false
  return event.target.closest(event.code.startsWith('Arrow') ? arrowControls : interactiveControls) !== null
}

/**
 * Apply the action mapped to a key. A Cockpit action runs when the key goes down, and a data-lake variable holds 1
 * while the key is down and 0 once it is released.
 * @param {ProtocolAction} action The action mapped to the key
 * @param {boolean} pressed Whether the key went down or up
 * @param {(error: unknown) => void} onError Called when a Cockpit action fails
 */
const applyKeyboardAction = (action: ProtocolAction, pressed: boolean, onError: (error: unknown) => void): void => {
  if (action.protocol === JoystickProtocol.DataLakeVariable) {
    setDataLakeVariableData(action.id, pressed ? 1 : 0)
  } else if (action.protocol === JoystickProtocol.CockpitAction && pressed) {
    executeActionCallback(action.id, onError)
  }
}

/**
 * Give the variable a key was just mapped to its released value, 0, when it holds none yet. A transforming function
 * that adds it to an axis output cannot evaluate while it is empty, which would freeze that axis until the first press.
 * @param {ProtocolAction} action The action the key was mapped to
 */
export const initializeKeyVariable = (action: ProtocolAction): void => {
  if (action.protocol !== JoystickProtocol.DataLakeVariable) return
  if (getDataLakeVariableData(action.id) === undefined) setDataLakeVariableData(action.id, 0)
}

let paused = false

/**
 * Stop mapped keys from acting, as on the controllers configuration page, where keys are pressed to be mapped
 * @param {boolean} value Whether keys are paused
 */
export const setKeyboardControlPaused = (value: boolean): void => {
  paused = value
}

/**
 * Listen to the keyboard and apply the action mapped to each key, alongside any joystick
 * @param {(error: unknown) => void} onError Called when a Cockpit action fails
 * @returns {() => void} Stops listening, releasing every key still held
 */
export const startKeyboardControl = (onError: (error: unknown) => void): (() => void) => {
  const pressedKeys = new Set<string>()
  const getMapping = (): KeyboardMapping => settingsManager.getKeyValue<KeyboardMapping>(keyboardMappingKey) ?? {}
  // A variable that does not persist its value comes back empty on every boot
  Object.values(getMapping()).forEach(initializeKeyVariable)

  const onKeyDown = (event: KeyboardEvent): void => {
    // Modifier combinations are left to the browser and to Cockpit's own shortcuts
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isTypingTarget(event.target) || operatesFocusedControl(event)) return
    const action = paused ? undefined : getMapping()[event.code]
    // Repeats are prevented too, or a held arrow key or space bar would still scroll the page
    if (action) event.preventDefault()
    if (event.repeat) return
    pressedKeys.add(event.code)
    if (action) applyKeyboardAction(action, true, onError)
  }

  const releaseKey = (code: string): void => {
    if (!pressedKeys.delete(code)) return
    const action = getMapping()[code]
    if (action) applyKeyboardAction(action, false, onError)
  }

  const onKeyUp = (event: KeyboardEvent): void => releaseKey(event.code)
  // A key released while the window is unfocused never reports its keyup, so it would stay held forever
  const releaseAllKeys = (): void => [...pressedKeys].forEach(releaseKey)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseAllKeys)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', releaseAllKeys)
    releaseAllKeys()
  }
}

/**
 * A short label for a key code, as printed on most keyboards
 * @param {string} code The key code, e.g. `KeyW`, `Digit1` or `ArrowUp`
 * @returns {string} The code without its `Key`/`Digit` prefix, e.g. `W`, `1` or `ArrowUp`
 */
export const keyLabel = (code: string): string => code.replace(/^(Key|Digit)/, '')
