import { ref, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'

import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from './joystick/protocols/cockpit-actions'

export const showSlideToConfirm = ref(false)
export const sliderText = ref('Slide to Confirm')
export const sliderPercentage = ref(0)
export const confirmationSliderText = ref('Action Confirm')
export const confirmed = ref(false)

/**
 * Callback to confirm the action
 * @callback ConfirmCallback
 * @returns {void}
 */
export type ConfirmCallback = () => void | Promise<void>

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
  text: string

  /**
   * The text to display in the confirmation slider
   * @type {string}
   */
  confirmationText: string
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
 * The maximum interval in milliseconds between the last call from a joystick action
 * to be considered as a repeat action
 * @type {number}
 */
const maxRepeatIntervalMs = 50

/**
 * Time interval in ms needed to keep a repeat action pressed to be considered as a hold action
 * @type {number}
 */
const holdActionTimeMs = 1000

/**
 * Check if slide can be bypassed for the given category
 * @param {EventCategory} category The category of the event
 * @returns {boolean} True if the slide can be bypassed, false otherwise
 */
export const canByPassCategory = (category: EventCategory): boolean => {
  const missionStore = useMissionStore()

  return !(missionStore.slideEventsEnabled && eventCategoriesDefaultMapping[category])
}

/**
 * Register the hold to confirm action
 * @returns {string} The id of the registered action callback
 */
const registerHoldToConfirm = (): string => {
  let lastConfirmCall = 0
  let totalPressedTime = 0

  const onHoldConfirmCallback = (): void => {
    const dt = Date.now() - lastConfirmCall

    // Reset total pressed time if user releases the button
    if (dt > maxRepeatIntervalMs) {
      totalPressedTime = 0
      sliderPercentage.value = 0
    } else {
      totalPressedTime += dt
      sliderPercentage.value = Math.min((totalPressedTime / holdActionTimeMs) * 100, 100)
    }

    lastConfirmCall = Date.now()
  }

  return registerActionCallback(availableCockpitActions.hold_to_confirm, onHoldConfirmCallback)
}

/**
 * Wraps a callback and wait for the user confirmation by a popup to call it
 * @param {ConfirmCallback} callback The callback to call after the user confirms the action
 * @param {ConfirmContent} content The content of the confirmation slider
 * @param {boolean} byPass If true, the action is confirmed without waiting for the user to slide
 * @returns {void | Promise<void>}
 */
export function slideToConfirm(
  callback: ConfirmCallback,
  content: ConfirmContent,
  byPass = false
): void | Promise<void> {
  console.log(`slideToConfirm with text: ${content.text}`)

  // Early return if the action is already confirmed or doesn't require confirmation
  if (byPass) {
    return callback()
  }

  // Register the hold to confirm action for joystick listening
  const holdToConfirmCallbackId = registerHoldToConfirm()

  sliderText.value = content.text
  confirmationSliderText.value = content.confirmationText
  showSlideToConfirm.value = true

  const stopWatching = watch([confirmed, showSlideToConfirm], ([newConfirmed, newShowSlideToConfirm]) => {
    // Unregister the hold to confirm action callback
    unregisterActionCallback(holdToConfirmCallbackId)

    if (newConfirmed) {
      stopWatching()
      confirmed.value = false
      return callback()
    } else if (!newShowSlideToConfirm) {
      stopWatching()
    }
  })
}
