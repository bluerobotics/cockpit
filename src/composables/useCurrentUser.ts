import { type Ref, onUnmounted, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { askForUsername } from '@/composables/usernamePrompDialog'
import { settingsManager } from '@/libs/settings-management'

/**
 * Composable for managing the current user
 * Provides reactive access to the current user and methods to change users
 *
 * The settings manager is the single source of truth for the current user.
 * This composable provides a Vue-reactive interface to that data.
 * @returns {object} User management interface
 */
export function useCurrentUser(): {
  /**
   * The current user
   */
  currentUser: Ref<string>
  /**
   * The last connected user
   */
  lastConnectedUser: Ref<string | undefined>
  /**
   * Sets the current user
   */
  setCurrentUser: (username: string) => Promise<void>
  /**
   * Gets the list of available users
   */
  getAvailableUsers: (vehicleAddress: string) => Promise<string[]>
  /**
   * Opens the username dialog and changes the user if valid
   */
  promptUserChange: () => Promise<void>
} {
  // Initialize with current value from settings manager
  const currentUser = ref<string>(settingsManager.getCurrentUser())
  const lastConnectedUser = ref<string | undefined>(settingsManager.getLastConnectedUser())

  // Register listener to keep in sync with settings manager
  const listenerId = settingsManager.registerUserChangeListener((username: string) => {
    currentUser.value = username
    lastConnectedUser.value = settingsManager.getLastConnectedUser()
  })

  // Cleanup listener on unmount
  onUnmounted(() => {
    settingsManager.unregisterUserChangeListener(listenerId)
  })

  /**
   * Sets the current user
   * @param {string} username - The new username to set
   */
  const setCurrentUser = async (username: string): Promise<void> => {
    await settingsManager.setCurrentUser(username)
  }

  /**
   * Gets the list of available users
   * @param {string} vehicleAddress - The vehicle address to fetch users from
   * @returns {Promise<string[]>} The list of available usernames
   */
  const getAvailableUsers = async (vehicleAddress: string): Promise<string[]> => {
    return settingsManager.getAvailableUsers(vehicleAddress)
  }

  /**
   * Opens the username dialog and changes the user if valid
   */
  const promptUserChange = async (): Promise<void> => {
    const { showDialog } = useInteractionDialog()
    let newUsername: string | undefined
    try {
      newUsername = await askForUsername()
    } catch (error) {
      console.error('Username not set. User dismissed dialog.')
      return
    }
    console.debug('Username set:', newUsername)

    // If the user cancels the prompt or sets a name with less than 3 chars, do nothing
    if (!newUsername || newUsername.trim().length < 3) {
      showDialog({
        title: 'Invalid username',
        message: 'Username must be at least 3 characters long. No username was set. Auto-sync disabled.',
        variant: 'error',
        maxWidth: 560,
      })
      return
    }

    await setCurrentUser(newUsername)
  }

  return {
    currentUser,
    lastConnectedUser,
    setCurrentUser,
    getAvailableUsers,
    promptUserChange,
  }
}
