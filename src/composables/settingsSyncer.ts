import { type RemovableRef, useStorage } from '@vueuse/core'
import { type MaybeRef, onMounted, ref, toRaw, unref, watch } from 'vue'

import {
  getKeyDataFromCockpitVehicleStorage,
  NoPathInBlueOsErrorName,
  setKeyDataOnCockpitVehicleStorage,
} from '@/libs/blueos'
import { isEqual, reloadCockpit } from '@/libs/utils'
import { useDevelopmentStore } from '@/stores/development'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { savedProfilesKey } from '@/stores/widgetManager'

import { useInteractionDialog } from './interactionDialog'
import { openSnackbar } from './snackbar'

/**
 * Maps setting key to its last update timestamp, organized by user and vehicle ID
 */
export interface SettingsEpochTable {
  [userId: string]: {
    [vehicleId: string]: {
      [key: string]: number
    }
  }
}

export const resetJustMadeKey = 'cockpit-reset-just-made'
const resetJustMade = useStorage(resetJustMadeKey, false)
setTimeout(() => {
  resetJustMade.value = false
}, 10000)

// Store epochs for local settings
const localEpochTable = useStorage<SettingsEpochTable>('cockpit-settings-epochs', {})

// Helper function to get/set epoch for a specific user, vehicle, and key
const getLocalEpoch = (username: string, vehicleId: string, key: string): number | undefined => {
  return localEpochTable.value[username]?.[vehicleId]?.[key] || undefined
}

const setLocalEpoch = (username: string, vehicleId: string, key: string, epoch: number): void => {
  if (!localEpochTable.value[username]) {
    localEpochTable.value[username] = {}
  }
  if (!localEpochTable.value[username][vehicleId]) {
    localEpochTable.value[username][vehicleId] = {}
  }
  localEpochTable.value[username][vehicleId][key] = epoch
}

const getSettingsEpochOnVehicle = async (
  vehicleAddress: string,
  username: string,
  key: string
): Promise<number | undefined> => {
  const url = `settings/${username}/epochs/${key}`
  return (await getKeyDataFromCockpitVehicleStorage(vehicleAddress, url).catch(() => undefined)) as number | undefined
}

const setSettingsEpochOnVehicle = async (
  vehicleAddress: string,
  username: string,
  key: string,
  epoch: number
): Promise<void> => {
  const url = `settings/${username}/epochs/${key}`
  await setKeyDataOnCockpitVehicleStorage(vehicleAddress, url, epoch)
}

const getSettingsValueOnVehicle = async (
  vehicleAddress: string,
  username: string,
  key: string
): Promise<any | undefined> => {
  const url = `settings/${username}/${key}`
  return (await getKeyDataFromCockpitVehicleStorage(vehicleAddress, url).catch(() => undefined)) as any | undefined
}

const setSettingsValueOnVehicle = async (
  vehicleAddress: string,
  username: string,
  key: string,
  value: any
): Promise<void> => {
  const url = `settings/${username}/${key}`
  await setKeyDataOnCockpitVehicleStorage(vehicleAddress, url, value)
}

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
 * BlueOS with it. On the other hand, if BlueOS also has a value, it will use the most recent one, based on an epoch
 * that stores the moment that value was last updated locally and on BlueOS.
 *
 * Once everything is in sync, if the local value changes, it will update the value on BlueOS.
 * In resume, the initial source of truth is the most recent value, and once everything is in sync, the source of truth
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

  const getLastConnectedVehicleId = (): string | undefined => {
    const vehicleStore = useMainVehicleStore()
    return vehicleStore.lastConnectedVehicleId
  }

  const getLastConnectedUser = (): string | undefined => {
    const missoinStore = useMissionStore()
    return missoinStore.lastConnectedUser
  }

  const updateValueOnBlueOS = async (newValue: T, updateEpoch: number): Promise<void> => {
    const vehicleAddress = await getVehicleAddress()
    const username = await getUsername()

    console.debug(`Updating '${key}' on BlueOS. New value:`, newValue, 'New epoch:', updateEpoch)

    const tryToUpdateBlueOsValue = async (): Promise<void> => {
      // Clear update routine if there's one left, as we are going to start a new one
      clearTimeout(blueOsUpdateTimeout)

      try {
        // Update the value of the key and its epoch on BlueOS
        await setSettingsValueOnVehicle(vehicleAddress, username, key, newValue)
        await setSettingsEpochOnVehicle(vehicleAddress, username, key, updateEpoch)

        const message = `Success updating '${key}' on BlueOS.`
        openSnackbar({ message, duration: 3000, variant: 'success', closeButton: true })
        console.info(message)
      } catch (fetchError) {
        const message = `Failed updating '${key}' on BlueOS. Will keep trying.`
        openSnackbar({ message, duration: 3000, variant: 'error', closeButton: true })
        console.error(message)
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

    // Clear initial sync routine if there's one left, as we are going to start a new one
    clearTimeout(initialSyncTimeout)

    try {
      const valueOnBlueOS = await getSettingsValueOnVehicle(vehicleAddress, username, key)
      console.debug(`Success getting value of '${key}' from BlueOS:`, valueOnBlueOS)

      // If the value on BlueOS is the same as the one we have locally, we don't need to do anything
      if (isEqual(currentValue.value, valueOnBlueOS)) {
        console.debug(`Value for '${key}' on BlueOS is the same as the local one. No need to update.`)
        finishedInitialFetch.value = true
        return
      }

      // Get epochs for both local and remote values
      const remoteEpoch = await getSettingsEpochOnVehicle(vehicleAddress, username, key)
      const localEpoch = getLocalEpoch(username, currentVehicleId, key)

      // By default, if there's a conflict, we use the value with the newest epoch
      let useBlueOsValue = (remoteEpoch ?? 0) > (localEpoch ?? 0)

      // Do nothing if both values are undefined
      if (currentValue.value === undefined && valueOnBlueOS === undefined) {
        console.debug(`Both local and remote values for '${key}' are undefined. No need to update.`)
        finishedInitialFetch.value = true
        return
      } else if (currentValue.value === undefined) {
        // If only the local value is undefined, use the value from BlueOS
        console.debug(`Local value for '${key}' is undefined. Using value from BlueOS.`)
        useBlueOsValue = true
      } else if (valueOnBlueOS === undefined) {
        // If only the remote value is undefined, use the value from local storage
        console.debug(`Remote value for '${key}' is undefined. Using value from local storage.`)
        useBlueOsValue = false
      }

      const msg = `Key: ${key} // Epochs: Remote: ${remoteEpoch}, Local: ${localEpoch} // Use BlueOS value: ${useBlueOsValue}`
      console.debug(msg)

      // If the epochs are equal and the values are different, we use the value from BlueOS
      if (remoteEpoch === localEpoch && !isEqual(currentValue.value, valueOnBlueOS)) {
        useBlueOsValue = true
      }

      if (useBlueOsValue) {
        currentValue.value = valueOnBlueOS as T
        const remoteEpochOrNow = remoteEpoch ?? Date.now()

        // Update local epoch to match remote
        setLocalEpoch(username, currentVehicleId, key, remoteEpochOrNow)

        // Update epoch on BlueOS as well if it's not there yet
        if (remoteEpoch === undefined) {
          await setSettingsEpochOnVehicle(vehicleAddress, username, key, remoteEpochOrNow)
        }

        const message = `Fetched remote value of key ${key} from the vehicle.`
        openSnackbar({ message, duration: 3000, variant: 'success' })

        finishedInitialFetch.value = true

        if (key === savedProfilesKey) {
          await showDialog({
            title: 'Widget profiles imported',
            message: `The widget profiles have been imported from the vehicle. We need to reload the page to apply the changes.`,
            variant: 'warning',
            actions: [{ text: 'OK', action: closeDialog }],
            timer: 3000,
          })
          reloadCockpit()
        }
      } else {
        // Update both value and epoch on BlueOS
        const localEpochOrNow = localEpoch ?? Date.now()

        await updateValueOnBlueOS(currentValue.value, localEpochOrNow)

        // Update epoch locally if it's not there yet
        if (localEpoch === undefined) {
          setLocalEpoch(username, currentVehicleId, key, localEpochOrNow)
        }

        const message = `Pushed local value of key ${key} to the vehicle.`
        openSnackbar({ message, duration: 3000, variant: 'success' })
      }

      console.info(`Success syncing '${key}' with BlueOS.`)

      finishedInitialFetch.value = true
    } catch (initialSyncError) {
      // If the initial sync fails because there's no value for the key on BlueOS, we can just use the current value
      if ((initialSyncError as Error).name === NoPathInBlueOsErrorName) {
        console.debug(`No value for '${key}' on BlueOS. Using current value. Will push it to BlueOS.`)
        try {
          // Set initial epoch and push both value and epoch
          const localEpochOrNow = getLocalEpoch(username, currentVehicleId, key) ?? Date.now()
          setLocalEpoch(username, currentVehicleId, key, localEpochOrNow)
          await updateValueOnBlueOS(currentValue.value, localEpochOrNow)
          finishedInitialFetch.value = true
          return
        } catch (fetchError) {
          console.error(`Not able to push current value of '${key}' to BlueOS. ${fetchError}`)
          console.error(`Failed syncing '${key}' with BlueOS. Will keep trying.`)

          // If we can't update the value on BlueOS, try again in 10 seconds
          initialSyncTimeout = setTimeout(tryToDoInitialSync, 10000)
          return
        }
      }

      // If the initial sync fails because we can't connect to BlueOS, try again in 10 seconds
      initialSyncTimeout = setTimeout(tryToDoInitialSync, 10000)

      console.error(`Failed syncing '${key}' with BlueOS. Will keep trying. Error: ${initialSyncError}`)
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
  let valueBeforeDebouncedChange = structuredClone(toRaw(currentValue.value))
  let valueUpdateMethodTimeout: ReturnType<typeof setTimeout> | undefined = undefined

  const maybeUpdateValueOnBlueOs = async (newValue: T, oldValue: T, epoch: number): Promise<void> => {
    console.debug(`Detected changes in the local value for key '${key}'. Updating BlueOS.`)

    // Don't update the value on BlueOS if we haven't finished the initial fetch, so we don't overwrite the value there without user consent
    if (!finishedInitialFetch.value) {
      console.debug(`Value of '${key}' changed, but we haven't finished the initial fetch. Not updating BlueOS.`)
      return
    }

    if (isEqual(newValue, oldValue)) {
      console.debug(`Old value for key ${key} is equal to the new one. Aborting update on BlueOS.`)
      return
    }

    valueBeforeDebouncedChange = structuredClone(toRaw(newValue))

    const devStore = useDevelopmentStore()
    if (!devStore.enableBlueOsSettingsSync) return

    updateValueOnBlueOS(newValue, epoch)
  }

  const updateEpochLocally = (epoch: number): void => {
    const lastConnectedUser = getLastConnectedUser()
    const lastConnectedVehicleId = getLastConnectedVehicleId()

    if (lastConnectedUser === undefined || lastConnectedVehicleId === undefined) {
      console.error('Not able to update epoch locally. Last connected user or vehicle ID not found.')
      return
    }

    setLocalEpoch(lastConnectedUser, lastConnectedVehicleId, key, epoch)
  }

  watch(
    currentValue,
    async (newValue) => {
      // Update the local epoch immediately
      const epoch = Date.now()
      updateEpochLocally(epoch)

      // Throttle remote value updates to avoid spamming BlueOS with requests
      clearTimeout(valueUpdateMethodTimeout)
      valueUpdateMethodTimeout = setTimeout(() => {
        maybeUpdateValueOnBlueOs(newValue, valueBeforeDebouncedChange, epoch)
      }, 1000)
    },
    { deep: true }
  )

  return currentValue
}

export const getSettingsUsernamesFromBlueOS = async (): Promise<string[]> => {
  const vehicleAddress = await getVehicleAddress()
  const usernames = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
  return Object.keys(usernames as string[])
}
