import { ref, watch } from 'vue'

export const showAltitudeSlider = ref(false)
export const altitude_setpoint = ref(0)

/**
 * Watches the altitude value for changes and updates the altitude accordingly.
 */
watch(altitude_setpoint, (newValue, oldValue) => {
  console.log(`Altitude changed from ${oldValue} to ${newValue}`)
})
