import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)

  return { developmentMode, widgetDevInfoBlurLevel }
})
