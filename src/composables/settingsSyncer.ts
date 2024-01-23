import { type RemovableRef, useStorage, watchThrottled } from '@vueuse/core'
import Swal from 'sweetalert2'
import { type MaybeRef, onMounted, ref, unref } from 'vue'

import {
  getKeyDataFromCockpitVehicleStorage,
  NoPathInBlueOsErrorName,
  setKeyDataOnCockpitVehicleStorage,
} from '@/libs/blueos'
import { isEqual } from '@/libs/utils'
import { useAlertStore } from '@/stores/alert'
import { useMainVehicleStore } from '@/stores/mainVehicle'

/**
 * This composable will keep a setting in sync between local storage and BlueOS .
 * The initial value will be the one stored on BlueOS.
 * If we fail to get the value from BlueOS on the first seconds after boot, we will ask the user if they prefer to use
 * the value stored locally or the value stored on BlueOS.
 * Once everything is in sync, if the local value changes, it will update the value on BlueOS.
 * In resume, the initial source of truth is BlueOS, and once everything is in sync, the source of truth is the local value.
 * @param { string } key
 * @param { T } defaultValue
 * @returns { RemovableRef<T> }
 */
export function useBlueOsStorage<T>(key: string, defaultValue: MaybeRef<T>): RemovableRef<T> {
  const vehicleStore = useMainVehicleStore()

  const alertStore = useAlertStore()

  const primitiveDefaultValue = unref(defaultValue)
  const currentValue = useStorage(key, primitiveDefaultValue)
  const finishedInitialFetch = ref(false)
  let fallbackFetchInterval: ReturnType<typeof setInterval> | undefined = undefined
  let fallbackPushInterval: ReturnType<typeof setInterval> | undefined = undefined

  const updateValueOnBlueOS = async (newValue: T): Promise<void> => {
    alertStore.pushInfoAlert(`Updating '${key}' on BlueOS.`)

    // Clear fallback push routine if there is one left, as we are going to start a new one with the new value
    clearInterval(fallbackPushInterval)

    try {
      await setKeyDataOnCockpitVehicleStorage(vehicleStore.globalAddress, key, newValue)
      alertStore.pushSuccessAlert(`Success updating '${key}' on BlueOS.`)
    } catch (fetchError) {
      alertStore.pushErrorAlert(`Failed updating '${key}' on BlueOS. Will keep trying.`)
      console.error(fetchError)

      // Start fallback push routine
      fallbackPushInterval = setInterval(async () => {
        console.log(`Trying again to push new value of '${key}' to BlueOS.`)
        try {
          await setKeyDataOnCockpitVehicleStorage(vehicleStore.globalAddress, key, newValue)
          alertStore.pushSuccessAlert(`Success updating '${key}' on BlueOS.`)

          // Once we update the value on BlueOS, stop the fallback push routine
          clearInterval(fallbackPushInterval)
        } catch (fallbackPushError) {
          console.error(`Still not able to push new value of '${key}' to BlueOS. ${fallbackPushError}`)
        }
      }, 10000)
    }
  }

  onMounted(async () => {
    while (vehicleStore.globalAddress === undefined) {
      console.info('Waiting for vehicle global address before starting BlueOS sync routine.')
      await new Promise((r) => setTimeout(r, 1000))
      // Wait until we have a global address
    }

    alertStore.pushInfoAlert(`Started syncing '${key}' with BlueOS.`)

    try {
      const valueOnBlueOS = await getKeyDataFromCockpitVehicleStorage(vehicleStore.globalAddress, key)
      currentValue.value = valueOnBlueOS as T
      alertStore.pushSuccessAlert(`Success syncing '${key}' with BlueOS.`)
      finishedInitialFetch.value = true
    } catch (error) {
      if ((error as Error).name === NoPathInBlueOsErrorName) {
        console.info(`No value for '${key}' on BlueOS. Using current value.`)
        updateValueOnBlueOS(currentValue.value)
        finishedInitialFetch.value = true
        return
      }
      alertStore.pushErrorAlert(`Failed syncing '${key}' with BlueOS. Will keep trying.`)

      // Start fallback fetch routine
      fallbackFetchInterval = setInterval(async () => {
        try {
          const valueOnBlueOS = await getKeyDataFromCockpitVehicleStorage(vehicleStore.globalAddress, key)
          console.log(`Success getting value of '${key}' from BlueOS: ${valueOnBlueOS}.`)

          // Once we get the value from BlueOS, stop the fallback fetch routine
          clearInterval(fallbackFetchInterval)

          // If the value on BlueOS is the same as the one we have locally, we don't need to bother the user
          if (isEqual(currentValue.value, valueOnBlueOS)) return

          // If Cockpit has a different value than BlueOS, ask the user if they want to use the value from BlueOS or
          // if they want to update BlueOS with the value from Cockpit.
          const result = await Swal.fire({
            text: `
              The value for '${key}' that is current running on Cockpit differs from the one stored in BlueOS.
              What do you want to do?
            `,
            showCancelButton: true,
            cancelButtonText: "Keep Cockpit's current value",
            confirmButtonText: 'Use the value stored in BlueOS',
            icon: 'question',
          })

          if (result.isConfirmed) {
            currentValue.value = valueOnBlueOS as T
            alertStore.pushSuccessAlert(`Success syncing '${key}' with BlueOS.`)
          } else {
            updateValueOnBlueOS(currentValue.value)
          }

          finishedInitialFetch.value = true
        } catch (fallbackFetchError) {
          console.error(`Still not able to get current value of '${key}' on BlueOS. ${fallbackFetchError}`)
        }
      }, 10000)
    }
  })

  // Update BlueOS value when local value changes.
  // Throttle to avoid spamming BlueOS with requests while the user is updating the value.
  watchThrottled(
    currentValue,
    async (newValue) => {
      // Don't update the value on BlueOS if we haven't finished the initial fetch, so we don't overwrite the value there without user consent
      if (!finishedInitialFetch.value) return

      updateValueOnBlueOS(newValue)
    },
    { throttle: 3000, deep: true }
  )

  return currentValue
}
