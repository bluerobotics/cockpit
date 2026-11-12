import { ref } from 'vue'

import { useMissionStore } from '@/stores/mission'

import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from './joystick/protocols/cockpit-actions'

/**
 * Callback to confirm the action
 * @callback ConfirmCallback
 * @returns {void}
 */
export type ConfirmCallback = () => void | Promise<void>

/** Refs */
export const showSlideToConfirm = ref(false)
export const sliderText = ref('Slide to Confirm')
export const confirmationSliderText = ref('Action Confirm')
export const deniedText = ref('Action Denied')
export const expiredText = ref('Action Expired')
export const sliderPercentage = ref(0)
export const onAction = ref<(confirmed: boolean) => void>()

/**
 * Different categories of events that requires confirmation from the user.
 * @enum {string}
 */
export enum EventCategory {
  ARM = 'Arm',
  DISARM = 'Disarm',
  TAKEOFF = 'Takeoff',
  ALT_CHANGE = 'Altitude Change',
  LAND = 'Land',
  GOTO = 'Goto',
  SET_POSITION = 'Set Position',
}

/**
 * The content of the confirmation slider
 * @interface ConfirmContent
 */
export interface ConfirmContent {
  /**
   * The text to display in the slider
   * @type {string}
   */
  command: string

  /**
   * The text to display in the confirmation slider, if not provided, will be used
   * `$Confirm {command}`
   */
  text?: string

  /**
   * The text to display if confirmed, if not provided, will be used
   * `${command} confirmed`
   * @type {string}
   */
  confirmedText?: string

  /**
   * The text to display if denied, if not provided, will be used
   * `${command} denied`
   * @type {string}
   */
  deniedText?: string

  /**
   * The text to display if the confirmation is expired, if not provided, will be used
   * `${command} expired`
   * @type {string}
   */
  expiredText?: string
}

/**
 * Specify if by default event categories need to be confirmed by the user.
 * @type {boolean}
 */
const defaultCategoriesRequired = true

/**
 * The default mapping of event categories to the confirmation requirement.
 * @type {Record<string, boolean>}
 */
export const eventCategoriesDefaultMapping: Record<string, boolean> = Object.values(EventCategory).reduce(
  (acc: Record<string, boolean>, v) => {
    acc[v] = defaultCategoriesRequired
    return acc
  },
  {}
)

/**
 * Time interval in ms a hold has to last, from its start action, to be considered as a confirmation
 * @type {number}
 */
const holdActionTimeMs = 1000

/**
 * Check if the user wants the given category to be confirmed, falling back to the default for categories added after
 * the user's settings were stored
 * @param {EventCategory} category The category of the event
 * @returns {boolean} True if the category is set to require confirmation
 */
export const isCategoryConfirmationRequired = (category: EventCategory): boolean => {
  const missionStore = useMissionStore()

  return missionStore.slideEventsCategoriesRequired[category] ?? eventCategoriesDefaultMapping[category]
}

/**
 * Check if slide can be bypassed for the given category
 * @param {EventCategory} category The category of the event
 * @returns {boolean} True if the slide can be bypassed, false otherwise
 */
export const canByPassCategory = (category: EventCategory): boolean => {
  const missionStore = useMissionStore()

  return !(missionStore.slideEventsEnabled && isCategoryConfirmationRequired(category))
}

/**
 * Register the actions that start and stop a hold to confirm
 * @returns {() => void} Unregisters both actions and ends a hold still in progress
 */
const registerHoldToConfirm = (): (() => void) => {
  let holdProgressInterval: ReturnType<typeof setInterval> | undefined
  // The percentage left by the previous confirmation would otherwise confirm this one as soon as it opens
  sliderPercentage.value = 0

  const endHold = (): void => {
    clearInterval(holdProgressInterval)
    holdProgressInterval = undefined
  }

  const onStartHold = (): void => {
    if (holdProgressInterval !== undefined) return
    const holdStart = Date.now()
    holdProgressInterval = setInterval(() => {
      sliderPercentage.value = Math.min(((Date.now() - holdStart) / holdActionTimeMs) * 100, 100)
    }, 50)
  }

  const onStopHold = (): void => {
    endHold()
    sliderPercentage.value = 0
  }

  const startCallbackId = registerActionCallback(availableCockpitActions.start_hold_to_confirm, onStartHold)
  const stopCallbackId = registerActionCallback(availableCockpitActions.stop_hold_to_confirm, onStopHold)

  return () => {
    unregisterActionCallback(startCallbackId)
    unregisterActionCallback(stopCallbackId)
    endHold()
  }
}

/**
 * Wraps a callback and wait for the user confirmation by a popup to call it
 * @param {ConfirmContent} content The content of the confirmation slider
 * @param {boolean} byPass If true, the action is confirmed without waiting for the user to slide
 * @returns {void | Promise<void>}
 */
export function slideToConfirm(content: ConfirmContent, byPass = false): Promise<void> {
  // Early return if the action is already confirmed or doesn't require confirmation
  if (byPass) {
    return Promise.resolve()
  }

  /** If there is already some confirmation step, deny the action */
  if (showSlideToConfirm.value) {
    return Promise.reject(new Error(`Cannot confirm ${content.command}. Another confirmation is already in progress.`))
  }

  // Register the hold to confirm actions for joystick and keyboard listening
  const unregisterHoldToConfirm = registerHoldToConfirm()

  // Setup and show the slide to confirm component
  sliderText.value = content.text ?? `Confirm ${content.command}`
  confirmationSliderText.value = content.confirmedText ?? `${content.command} confirmed`
  deniedText.value = content.deniedText ?? `${content.command} denied`
  expiredText.value = content.expiredText ?? `${content.command} expired`
  showSlideToConfirm.value = true

  // Register the callback to call the action
  return new Promise((resolve, reject) => {
    onAction.value = (confirmed: boolean) => {
      // Unregister the hold to confirm action callbacks
      unregisterHoldToConfirm()

      if (confirmed) {
        return resolve()
      }

      return reject(new Error(`Confirmation of '${content.command}' command ignored or denied by the user.`))
    }
  })
}
