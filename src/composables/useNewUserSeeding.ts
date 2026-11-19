import { t } from 'ttag'
import { type Ref, ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { settingsManager } from '@/libs/settings-management'
import { usernameLabel } from '@/libs/username'

/**
 * Seeds a new user's settings and tells the operator why when nothing could be seeded
 * @returns {{ isSeeding: Ref<boolean>, seedNewUser: (username: string, source: string | null) => Promise<boolean> }}
 * The busy state, and the seeding call, which resolves to whether the user was seeded
 */
export const useNewUserSeeding = (): {
  /**
   * Whether a seeding is in progress
   */
  isSeeding: Ref<boolean>
  /**
   * Seeds the user from the source user, or from the defaults when the source is null
   */
  seedNewUser: (username: string, source: string | null) => Promise<boolean>
} => {
  const isSeeding = ref(false)

  const seedNewUser = async (username: string, source: string | null): Promise<boolean> => {
    isSeeding.value = true
    try {
      const outcome = await settingsManager.seedNewUserSettings(username, source)
      if (outcome === 'seeded') return true
      const sourceName = usernameLabel(source)
      const message =
        outcome === 'exists'
          ? t`A user named '${username}' already exists.`
          : t`No settings of '${sourceName}' were found to copy. Pick another user or start from Cockpit's defaults.`
      openSnackbar({ message, variant: 'error', duration: 5000 })
    } catch {
      const unreachableMessage = t`Couldn't reach the vehicle to create the user. Check the connection and try again.`
      openSnackbar({ message: unreachableMessage, variant: 'error', duration: 5000 })
    } finally {
      isSeeding.value = false
    }
    return false
  }

  return { isSeeding, seedNewUser }
}
