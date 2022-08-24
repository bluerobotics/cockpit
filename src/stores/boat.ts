import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBoatStore = defineStore('boat', () => {
  const speed = ref(0)
  const heading = ref(0)
  const depth = ref(0)
  const waterTemp = ref(0)

  setInterval(() => {
    speed.value = parseFloat(
      (speed.value + (10 * Math.random() - 5.0)).toFixed(2)
    )
    heading.value = parseFloat(
      (heading.value + (10 * Math.random() - 5.0)).toFixed(2)
    )
    depth.value = parseFloat(
      (depth.value + (10 * Math.random() - 5.0)).toFixed(2)
    )
    waterTemp.value = parseFloat(
      (waterTemp.value + (10 * Math.random() - 5.0)).toFixed(2)
    )
  }, 200)

  return { speed, heading, depth, waterTemp }
})
