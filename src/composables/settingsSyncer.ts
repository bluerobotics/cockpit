import { type RemovableRef, useStorage } from '@vueuse/core'
import { type MaybeRef, onMounted, ref, toRaw, unref, watch } from 'vue'

import {
  getKeyDataFromCockpitVehicleStorage,
  getVehicleAddress,
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

export const resetJustMadeKey = 'cockpit-reset-just-made'
const resetJustMade = useStorage(resetJustMadeKey, false)
setTimeout(() => {
  resetJustMade.value = false
}, 10000)

let lastUsernameWaitingLogDate: Date = new Date()
let lastVehicleIdWaitingLogDate: Date = new Date()

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
      if (new Date().getTime() - lastUsernameWaitingLogDate.getTime() > 1000) {
        console.debug('Waiting for username on BlueOS sync routine.')
        lastUsernameWaitingLogDate = new Date()
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    return missionStore.username
  }

  const getCurrentVehicleId = async (): Promise<string> => {
    const vehicleStore = useMainVehicleStore()

    // Wait until we have a vehicle ID
    while (!vehicleStore.currentlyConnectedVehicleId) {
      if (new Date().getTime() - lastVehicleIdWaitingLogDate.getTime() > 1000) {
        console.debug('Waiting for vehicle ID on BlueOS sync routine.')
        lastVehicleIdWaitingLogDate = new Date()
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    return vehicleStore.currentlyConnectedVehicleId
  }

  const getLastConnectedVehicleId = async (): Promise<string | undefined> => {
    const vehicleStore = useMainVehicleStore()
    return vehicleStore.lastConnectedVehicleId
  }

  const getLastConnectedUser = async (): Promise<string | undefined> => {
    const missoinStore = useMissionStore()
    return missoinStore.lastConnectedUser
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
        const message = `Success updating '${key}' on BlueOS.`
        if (finishedInitialFetch.value) {
          openSnackbar({ message, duration: 3000, variant: 'success', closeButton: true })
        } else {
          console.info(message)
        }
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
    const lastConnectedVehicleId = await getLastConnectedVehicleId()
    const lastConnectedUser = await getLastConnectedUser()

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

      // If the connected vehicle is the same as the last connected vehicle, and the user is also the same, and there
      // are conflicts, it means the user has made changes while offline, so we ask the user if they want to keep the
      // local value or the one from BlueOS.
      // If the connected vehicle is different from the last connected vehicle, we just use the value from BlueOS, as we
      // don't want to overwrite the value on the new vehicle with the one from the previous vehicle.
      if (resetJustMade.value) {
        useBlueOsValue = false
      } else if (lastConnectedUser === username && lastConnectedVehicleId === currentVehicleId) {
        console.debug(`Conflict with BlueOS for key '${key}'. Asking user what to do.`)
        useBlueOsValue = await askIfUserWantsToUseBlueOsValue()
      }

      if (useBlueOsValue) {
        currentValue.value = valueOnBlueOS as T
        const message = `Fetched remote value of key ${key} from the vehicle.`
        console.info(message)

        // TODO: This is a workaround to make the profiles work after an import.
        // We need to find a better way to handle this, without reloading.
        if (key === savedProfilesKey) {
          await showDialog({
            title: 'Widget profiles imported',
            message: `The widget profiles have been imported from the vehicle. We need to reload the page to apply the
            changes.`,
            variant: 'warning',
            actions: [{ text: 'OK', action: closeDialog }],
            timer: 3000,
          })
          reloadCockpit()
        }
      } else {
        await updateValueOnBlueOS(currentValue.value)
        const message = `Pushed local value of key ${key} to the vehicle.`
        console.info(message)
      }

      console.info(`Success syncing '${key}' with BlueOS.`)

      finishedInitialFetch.value = true
    } catch (initialSyncError) {
      // If the initial sync fails because there's no value for the key on BlueOS, we can just use the current value
      if ((initialSyncError as Error).name === NoPathInBlueOsErrorName) {
        console.debug(`No value for '${key}' on BlueOS. Using current value. Will push it to BlueOS.`)
        try {
          await updateValueOnBlueOS(currentValue.value)
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

  const maybeUpdateValueOnBlueOs = async (newValue: T, oldValue: T): Promise<void> => {
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

    updateValueOnBlueOS(newValue)
  }

  watch(
    currentValue,
    async (newValue) => {
      clearTimeout(valueUpdateMethodTimeout)
      valueUpdateMethodTimeout = setTimeout(() => maybeUpdateValueOnBlueOs(newValue, valueBeforeDebouncedChange), 1000)
    },
    { deep: true }
  )

  return currentValue
}
