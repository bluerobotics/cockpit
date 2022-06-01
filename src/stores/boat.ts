import { defineStore } from 'pinia'

export const useBoatStore = defineStore({
  id: 'boat',
  state: () => ({
    speed: 0,
    heading: 0,
    depth: 0,
    waterTemp: 0,
  }),
})
