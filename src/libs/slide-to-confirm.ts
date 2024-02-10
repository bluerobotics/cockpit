import { ref, watch } from 'vue'

export const showSlideToConfirm = ref(false)
export const sliderText = ref('Slide to Confirm')
export const confirmationSliderText = ref('Action Confirm')
export const confirmed = ref(false)

/**
 * Waits for user confirmation through the slide-to-confirm component.
 * @param {string} text - The custom text to display on the slider.
 * @param {string} confirmationText - The custom text to display on the confirmation slider after the user slides to confirm.
 * @returns {Promise<boolean>} - A promise that resolves with true when the action is confirmed and false when the user cancels the action.
 */
export function slideToConfirm(text: string, confirmationText: string): Promise<boolean> {
  console.log('slideToConfirm with text:', text)
  return new Promise((resolve) => {
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
