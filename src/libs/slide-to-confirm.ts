import { ref, watch } from 'vue'

import { useMissionStore } from '@/stores/mission'

export const showSlideToConfirm = ref(false)
export const sliderText = ref('Slide to Confirm')
export const confirmationSliderText = ref('Action Confirm')
export const confirmed = ref(false)

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
 * Waits for user confirmation through the slide-to-confirm component.
 * @param {EventCategory} category - The category of the event that requires confirmation.
 * @param {string} text - The custom text to display on the slider.
 * @param {string} confirmationText - The custom text to display on the confirmation slider after the user slides to confirm.
 * @returns {Promise<boolean>} - A promise that resolves with true when the action is confirmed and false when the user cancels the action.
 */
export function slideToConfirm(category: EventCategory, text: string, confirmationText: string): Promise<boolean> {
  console.log(`slideToConfirm from category ${category} with text: ${text}`)

  const missionStore = useMissionStore()

  return new Promise((resolve) => {
    if (!missionStore.slideEventsEnabled || !missionStore.slideEventsCategoriesRequired[category]) {
      return resolve(true)
    }

    sliderText.value = text
    confirmationSliderText.value = confirmationText
    showSlideToConfirm.value = true

    const stopWatching = watch([confirmed, showSlideToConfirm], ([newConfirmed, newShowSlideToConfirm]) => {
      if (newConfirmed) {
        stopWatching()
        confirmed.value = false
        resolve(true)
      } else if (!newShowSlideToConfirm) {
        stopWatching()
        resolve(false)
      }
    })
  })
}
