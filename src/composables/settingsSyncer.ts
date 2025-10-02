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
import { useSettingsConflictDialog } from './settingsConflictDialog'
import { openSnackbar } from './snackbar'

/**
 * Represents a setting that has a conflict between local and remote values
 */
export interface ConflictItem {
  /** The key of the setting with a conflict */
  key: string

  /** The current local value of the setting */
  localValue: unknown

  /** The value of the setting stored in BlueOS */
  remoteValue: unknown

  /** Callback function to resolve the conflict with the user's choice */
  resolve: (useRemoteValue: boolean) => void
}

/**
 * Represents the user's choice for resolving conflicts
 */
export interface SettingsConflictResolution {
  [key: string]: boolean
}

/**
 * Manages settings synchronization between local storage and BlueOS,
 * providing centralized conflict resolution.
 */
class SettingsSyncer {
  /** Singleton instance */
  private static instance: SettingsSyncer

  /** List of conflicts that are on hold until the current conflict resolution dialog is closed */
  private conflictsOnHold: ConflictItem[] = []

  /** Promise to resolve the current conflict resolution dialog */
  private currentConflictDialogResolution: Promise<SettingsConflictResolution> | undefined = undefined

  /** Timeout to prevent multiple conflict resolution dialogs opened at the same time */
  private conflictDialogOpenerTimeout: ReturnType<typeof setTimeout> | undefined = undefined

  /** Private constructor to enforce singleton pattern */
  private constructor() {
    // Singleton initialization
  }

  /**
   * Gets the singleton instance of SettingsSyncer
   * @returns {SettingsSyncer} The SettingsSyncer instance
   */
  public static getInstance(): SettingsSyncer {
    if (!SettingsSyncer.instance) {
      SettingsSyncer.instance = new SettingsSyncer()
    }
    return SettingsSyncer.instance
  }

  /**
   * Schedules the conflict resolution dialog to be opened after a delay
   */
  private async scheduleConflictResolution(): Promise<void> {
    // If there's a conflict resolution dialog already open, wait for it to be closed before scheduling a new one
    if (this.currentConflictDialogResolution !== undefined) {
      await this.currentConflictDialogResolution
    }

    // Clear the current schesuler if it's already set, and schedule a new opening of the conflict resolution dialog
    clearTimeout(this.conflictDialogOpenerTimeout)
    this.conflictDialogOpenerTimeout = setTimeout(async () => {
      await this.resolveConflicts()
    }, 5000)
  }

  /**
   * Adds a new conflict to be resolved and triggers resolution if not already in progress
   * @param {ConflictItem} conflict The conflict to be resolved
   */
  public async addConflict(conflict: ConflictItem): Promise<void> {
    this.conflictsOnHold.push(conflict)
    console.log(`Holding conflict for key: ${conflict.key}. Total conflicts on hold: ${this.conflictsOnHold.length}`)
    await this.currentConflictDialogResolution
    await this.scheduleConflictResolution()
  }

  /**
   * Resolves all pending conflicts with a single user interaction
   */
  private async resolveConflicts(): Promise<void> {
    if (this.conflictsOnHold.length === 0) return

    // Get all conflicts that are on hold for resolution
    const conflictsToResolve = [...this.conflictsOnHold]
    this.conflictsOnHold = []

    try {
      this.currentConflictDialogResolution = useSettingsConflictDialog(conflictsToResolve)
      const resolutions = await this.currentConflictDialogResolution
      console.debug('Resolutions:', resolutions)
    } catch (error) {
      const message = 'Error showing settings conflict dialog'
      openSnackbar({ message, duration: 5000, variant: 'error', closeButton: true })
    } finally {
      this.currentConflictDialogResolution = undefined
    }
  }
}

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
  const rebootDialog = useInteractionDialog()

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

  const askIfUserWantsToUseBlueOsValue = async (remoteValue: T): Promise<boolean> => {
    return new Promise((resolve) => {
      const settingsSyncer = SettingsSyncer.getInstance()
      settingsSyncer.addConflict({
        key,
        localValue: currentValue.value,
        remoteValue,
        resolve,
      })
    })
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
        useBlueOsValue = await askIfUserWantsToUseBlueOsValue(valueOnBlueOS as T)
      }

      if (useBlueOsValue) {
        currentValue.value = valueOnBlueOS as T
        const message = `Fetched remote value of key ${key} from the vehicle.`
        console.info(message)

        // TODO: This is a workaround to make the profiles work after an import.
        // We need to find a better way to handle this, without reloading.
        if (key === savedProfilesKey) {
          await rebootDialog.showDialog({
            title: 'Widget profiles imported',
            message: `The widget profiles have been imported from the vehicle. We need to reload the page to apply the
            changes.`,
            variant: 'warning',
            actions: [{ text: 'OK', action: rebootDialog.closeDialog }],
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
