import { useBoatStore } from '@/stores/boat'

/**
 *
 */
export default class BoatSimulator {
  /**
   *
   */
  constructor() {
    const store = useBoatStore()
    setInterval(() => {
      store.speed = parseFloat(
        (store.speed + (10 * Math.random() - 5.0)).toFixed(2)
      )
      store.heading = parseFloat(
        (store.heading + (10 * Math.random() - 5.0)).toFixed(2)
      )
      store.depth = parseFloat(
        (store.depth + (10 * Math.random() - 5.0)).toFixed(2)
      )
      store.waterTemp = parseFloat(
        (store.waterTemp + (10 * Math.random() - 5.0)).toFixed(2)
      )
    }, 200)
  }
}
