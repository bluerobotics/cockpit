import { ref } from 'vue'

import { t } from '@/plugins/i18n'
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
 * Get translated confirm text based on command
 * @param {string} command The command to translate
 * @returns {string} The translated confirm text
 */
function getConfirmText(command: string): string {
  const commandMap: Record<string, string> = {
    'Arm': t('libs.slideToConfirm.confirmArm'),
    'Disarm': t('libs.slideToConfirm.confirmDisarm'),
    'Takeoff': t('libs.slideToConfirm.confirmTakeoff'),
    'Land': t('libs.slideToConfirm.confirmLand'),
    'Goto': t('libs.slideToConfirm.confirmGoto'),
    'GoTo': t('libs.slideToConfirm.confirmGoto'),
    'Altitude Change': t('libs.slideToConfirm.confirmAltitudeChange'),
    'Arm and GoTo': t('libs.slideToConfirm.confirmArmAndGoTo'),
  }
  return commandMap[command] || `Confirm ${command}`
}

/**
 * Get translated confirmed text based on command
 * @param {string} command The command to translate
 * @returns {string} The translated confirmed text
 */
function getConfirmedText(command: string): string {
  const commandMap: Record<string, string> = {
    'Arm': t('libs.slideToConfirm.armConfirmed'),
    'Disarm': t('libs.slideToConfirm.disarmConfirmed'),
    'Takeoff': t('libs.slideToConfirm.takeoffConfirmed'),
    'Land': t('libs.slideToConfirm.landConfirmed'),
    'Goto': t('libs.slideToConfirm.gotoConfirmed'),
    'GoTo': t('libs.slideToConfirm.gotoConfirmed'),
    'Altitude Change': t('libs.slideToConfirm.altitudeChangeConfirmed'),
    'Arm and GoTo': t('libs.slideToConfirm.armAndGoToConfirmed'),
  }
  return commandMap[command] || `${command} confirmed`
}

/**
 * Get translated denied text based on command
 * @param {string} command The command to translate
 * @returns {string} The translated denied text
 */
function getDeniedText(command: string): string {
  const commandMap: Record<string, string> = {
    'Arm': t('libs.slideToConfirm.armDenied'),
    'Disarm': t('libs.slideToConfirm.disarmDenied'),
    'Takeoff': t('libs.slideToConfirm.takeoffDenied'),
    'Land': t('libs.slideToConfirm.landDenied'),
    'Goto': t('libs.slideToConfirm.gotoDenied'),
    'GoTo': t('libs.slideToConfirm.gotoDenied'),
    'Altitude Change': t('libs.slideToConfirm.altitudeChangeDenied'),
  }
  return commandMap[command] || `${command} denied`
}

/**
 * Get translated expired text based on command
 * @param {string} command The command to translate
 * @returns {string} The translated expired text
 */
function getExpiredText(command: string): string {
  const commandMap: Record<string, string> = {
    'Arm': t('libs.slideToConfirm.armExpired'),
    'Disarm': t('libs.slideToConfirm.disarmExpired'),
    'Takeoff': t('libs.slideToConfirm.takeoffExpired'),
    'Land': t('libs.slideToConfirm.landExpired'),
    'Goto': t('libs.slideToConfirm.gotoExpired'),
    'GoTo': t('libs.slideToConfirm.gotoExpired'),
    'Altitude Change': t('libs.slideToConfirm.altitudeChangeExpired'),
  }
  return commandMap[command] || `${command} expired`
}

/**
 * Get translated command name
 * @param {string} command The command to translate
 * @returns {string} The translated command name
 */
function getCommandName(command: string): string {
  const commandMap: Record<string, string> = {
    'Arm': t('libs.slideToConfirm.arm'),
    'Disarm': t('libs.slideToConfirm.disarm'),
    'Takeoff': t('libs.slideToConfirm.takeoff'),
    'Land': t('libs.slideToConfirm.land'),
    'Goto': t('libs.slideToConfirm.goto'),
    'GoTo': t('libs.slideToConfirm.goto'),
    'Altitude Change': t('libs.slideToConfirm.altitudeChange'),
    'Arm and GoTo': t('libs.slideToConfirm.armAndGoTo'),
  }
  return commandMap[command] || command
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
const maxRepeatIntervalMs = 150

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

  return !(missionStore.slideEventsEnabled && missionStore.slideEventsCategoriesRequired[category])
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
    return Promise.reject(new Error(t('errors.anotherConfirmationInProgress', { command: content.command })))
  }

  // Register the hold to confirm action for joystick listening
  const holdToConfirmCallbackId = registerHoldToConfirm()

  // Setup and show the slide to confirm component
  sliderText.value = content.text ?? getConfirmText(content.command)
  confirmationSliderText.value = content.confirmedText ?? getConfirmedText(content.command)
  deniedText.value = content.deniedText ?? getDeniedText(content.command)
  expiredText.value = content.expiredText ?? getExpiredText(content.command)
  showSlideToConfirm.value = true

  // Register the callback to call the action
  return new Promise((resolve, reject) => {
    onAction.value = (confirmed: boolean) => {
      // Unregister the hold to confirm action callback
      unregisterActionCallback(holdToConfirmCallbackId)

      if (confirmed) {
        return resolve()
      }

      return reject(new Error(t('errors.commandIgnoredOrDenied', { command: getCommandName(content.command) })))
    }
  })
}
