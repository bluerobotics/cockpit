import { type RemovableRef, useStorage, watchThrottled } from '@vueuse/core'
import { type MaybeRef, onMounted, ref, unref } from 'vue'

import {
  getKeyDataFromCockpitVehicleStorage,
  NoPathInBlueOsErrorName,
  setKeyDataOnCockpitVehicleStorage,
} from '@/libs/blueos'
import { isEqual } from '@/libs/utils'
import { useDevelopmentStore } from '@/stores/development'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import { useInteractionDialog } from './interactionDialog'

/**
 * This composable will keep a setting in sync between the browser's local storage and BlueOS.
 *
 * When initialized, it will try to get the value from BlueOS. While BlueOS does not connect, it will use the local
 * stored value and keep trying to communicate with BlueOS to get it's value.
 *
 * Once the connection is stablished, if BlueOS doesn't have a value, it will use the local stored one and update
 * BlueOS with it. On the other hand, if BlueOS has a value, it will ask the user if they want to use the value from
 *  BlueOS or the local one. Depending on the user's choice, it will update the local value or BlueOS.
 *
 * Once everything is in sync, if the local value changes, it will update the value on BlueOS.
 * In resume, the initial source of truth is decided by the user, and once everything is in sync, the source of truth
 *  is the local value.
 * @param { string } key
 * @param { T } defaultValue
 * @returns { RemovableRef<T> }
 */
export function useBlueOsStorage<T>(key: string, defaultValue: MaybeRef<T>): RemovableRef<T> {
  const { showDialog, closeDialog } = useInteractionDialog()

  const primitiveDefaultValue = unref(defaultValue)
  const currentValue = useStorage(key, primitiveDefaultValue)
  const finishedInitialFetch = ref(false)
  let initialSyncTimeout: ReturnType<typeof setTimeout> | undefined = undefined
  let blueOsUpdateTimeout: ReturnType<typeof setTimeout> | undefined = undefined

  const getVehicleAddress = async (): Promise<string> => {
    const vehicleStore = useMainVehicleStore()

    while (vehicleStore.globalAddress === undefined) {
      console.debug('Waiting for vehicle global address on BlueOS sync routine.')
      await new Promise((r) => setTimeout(r, 1000))
      // Wait until we have a global address
    }

    return vehicleStore.globalAddress
  }

  const askIfUserWantsToUseBlueOsValue = async (): Promise<boolean> => {
    let useBlueOsValue = true

    const preferBlueOs = (): void => {
      useBlueOsValue = true
    }

    const preferCockpit = (): void => {
      useBlueOsValue = false
    }

    await showDialog({
      maxWidth: 600,
      title: 'Conflict with BlueOS',
      message: `
        The value for '${key}' that is currently used in Cockpit differs from the one stored in BlueOS. What do you
        want to do?
      `,
      variant: 'warning',
      actions: [
        { text: 'Use the value from BlueOS', action: preferBlueOs },
        { text: "Keep Cockpit's value", action: preferCockpit },
      ],
    })

    closeDialog()

    return useBlueOsValue
  }

  const updateValueOnBlueOS = async (newValue: T): Promise<void> => {
    const vehicleAddress = await getVehicleAddress()

    console.debug(`Updating '${key}' on BlueOS.`)

    const tryToUpdateBlueOsValue = async (): Promise<void> => {
      // Clear update routine if there's one left, as we are going to start a new one
      clearTimeout(blueOsUpdateTimeout)

      try {
        await setKeyDataOnCockpitVehicleStorage(vehicleAddress, key, newValue)
        console.info(`Success updating '${key}' on BlueOS.`)
      } catch (fetchError) {
        console.error(`Failed updating '${key}' on BlueOS. Will keep trying.`)
        console.error(fetchError)

        // If we can't update the value on BlueOS, try again in 10 seconds
        blueOsUpdateTimeout = setTimeout(tryToUpdateBlueOsValue, 10000)
      }
    }

    // Start BlueOS value update routine
    tryToUpdateBlueOsValue()
  }

  const tryToDoInitialSync = async (): Promise<void> => {
    const vehicleAddress = await getVehicleAddress()

    // Clear initial sync routine if there's one left, as we are going to start a new one
    clearTimeout(initialSyncTimeout)

    try {
      const valueOnBlueOS = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, key)
      console.debug(`Success getting value of '${key}' from BlueOS:`, valueOnBlueOS)

      // If the value on BlueOS is the same as the one we have locally, we don't need to bother the user
      if (isEqual(currentValue.value, valueOnBlueOS)) {
        console.debug(`Value for '${key}' on BlueOS is the same as the local one. No need to update.`)
        finishedInitialFetch.value = true
        return
      }

      // If Cockpit has a different value than BlueOS, ask the user if they want to use the value from BlueOS or
      // if they want to update BlueOS with the value from Cockpit.

      const useBlueOsValue = await askIfUserWantsToUseBlueOsValue()

      if (useBlueOsValue) {
        currentValue.value = valueOnBlueOS as T
      } else {
        updateValueOnBlueOS(currentValue.value)
      }

      console.info(`Success syncing '${key}' with BlueOS.`)

      finishedInitialFetch.value = true
    } catch (initialSyncError) {
      // If the initial sync fails because there's no value for the key on BlueOS, we can just use the current value
      if ((initialSyncError as Error).name === NoPathInBlueOsErrorName) {
        console.debug(`No value for '${key}' on BlueOS. Using current value.`)
        updateValueOnBlueOS(currentValue.value)
        finishedInitialFetch.value = true
        return
      }

      // If the initial sync fails because we can't connect to BlueOS, try again in 10 seconds
      initialSyncTimeout = setTimeout(tryToDoInitialSync, 10000)

      console.error(`Failed syncing '${key}' with BlueOS. Will keep trying.`)
      console.error(`Not able to get current value of '${key}' on BlueOS. ${initialSyncError}`)
    }
  }

  onMounted(async () => {
    const devStore = useDevelopmentStore()
    if (!devStore.enableBlueOsSettingsSync) return

    console.debug(`Started syncing '${key}' with BlueOS.`)

    // Start initial sync routine
    tryToDoInitialSync()
  })

  // Update BlueOS value when local value changes.
  // Throttle to avoid spamming BlueOS with requests while the user is updating the value.
  watchThrottled(
    currentValue,
    async (newValue) => {
      const devStore = useDevelopmentStore()
      if (!devStore.enableBlueOsSettingsSync) return

      // Don't update the value on BlueOS if we haven't finished the initial fetch, so we don't overwrite the value there without user consent
      if (!finishedInitialFetch.value) return

      updateValueOnBlueOS(newValue)
    },
    { throttle: 3000, deep: true }
  )

  return currentValue
}
