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
import { useMissionStore } from '@/stores/mission'

import { useInteractionDialog } from './interactionDialog'

const getVehicleAddress = async (): Promise<string> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    console.debug('Waiting for vehicle global address on BlueOS sync routine.')
    await new Promise((r) => setTimeout(r, 1000))
  }

  return vehicleStore.globalAddress
}

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

  const getUsername = async (): Promise<string> => {
    const missionStore = useMissionStore()

    // Wait until we have a username
    while (!missionStore.username) {
      console.debug('Waiting for username on BlueOS sync routine.')
      await new Promise((r) => setTimeout(r, 1000))
    }

    return missionStore.username
  }

  const getCurrentVehicleId = async (): Promise<string> => {
    const vehicleStore = useMainVehicleStore()

    // Wait until we have a vehicle ID
    while (!vehicleStore.currentlyConnectedVehicleId) {
      console.debug('Waiting for vehicle ID on BlueOS sync routine.')
      await new Promise((r) => setTimeout(r, 1000))
    }

    return vehicleStore.currentlyConnectedVehicleId
  }

  const getLastConnectedVehicleId = async (): Promise<string | undefined> => {
    const vehicleStore = useMainVehicleStore()
    return vehicleStore.lastConnectedVehicleId
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
    const username = await getUsername()

    console.debug(`Updating '${key}' on BlueOS.`)

    const tryToUpdateBlueOsValue = async (): Promise<void> => {
      // Clear update routine if there's one left, as we are going to start a new one
      clearTimeout(blueOsUpdateTimeout)

      try {
        await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${username}/${key}`, newValue)
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
    const username = await getUsername()
    const currentVehicleId = await getCurrentVehicleId()
    const lastConnectedVehicleId = await getLastConnectedVehicleId()

    // Clear initial sync routine if there's one left, as we are going to start a new one
    clearTimeout(initialSyncTimeout)

    try {
      const valueOnBlueOS = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, `settings/${username}/${key}`)
      console.debug(`Success getting value of '${key}' from BlueOS:`, valueOnBlueOS)

      // If the value on BlueOS is the same as the one we have locally, we don't need to bother the user
      if (isEqual(currentValue.value, valueOnBlueOS)) {
        console.debug(`Value for '${key}' on BlueOS is the same as the local one. No need to update.`)
        finishedInitialFetch.value = true
        return
      }

      // By default, if there's a conflict, we use the value from BlueOS.
      let useBlueOsValue = true

      // If the connected vehicle is the same as the last connected vehicle, and there are conflicts, it means the user
      // has made changes while offline, so we ask the user if they want to keep the local value or the one from BlueOS.
      // If the connected vehicle is different from the last connected vehicle, we just use the value from BlueOS, as we
      // don't want to overwrite the value on the new vehicle with the one from the previous vehicle.
      if (lastConnectedVehicleId === currentVehicleId) {
        console.debug(`Conflict with BlueOS for key '${key}'. Asking user what to do.`)
        useBlueOsValue = await askIfUserWantsToUseBlueOsValue()
      }

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

export const getSettingsUsernamesFromBlueOS = async (): Promise<string[]> => {
  const vehicleAddress = await getVehicleAddress()
  const usernames = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
  return Object.keys(usernames as string[])
}
