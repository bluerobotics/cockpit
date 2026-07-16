import { StorageSerializers, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { fetchAuthenticatedUser, isTokenValid, refreshAccessToken } from '@/libs/blueos-cloud/auth'
import { BlueOsCloudTokens, BlueOsCloudUser } from '@/libs/blueos-cloud/types'

export const useBlueOsCloudStore = defineStore('blueOsCloud', () => {
  const isIntegrationEnabled = useBlueOsStorage<boolean>('cockpit-blueos-cloud-enabled', false)
  const tokens = useStorage<BlueOsCloudTokens | null>('cockpit-blueos-cloud-tokens', null, undefined, {
    serializer: StorageSerializers.object,
  })
  const user = useStorage<BlueOsCloudUser | null>('cockpit-blueos-cloud-user', null, undefined, {
    serializer: StorageSerializers.object,
  })

  const isAuthenticated = computed(() => !!tokens.value && !!user.value)

  const displayName = computed(() => {
    const currentUser = user.value
    if (!currentUser) return ''
    return currentUser.name || currentUser.nickname || currentUser.email || currentUser.sub
  })

  /**
   * Clears persisted tokens and the cached user profile, effectively logging the user out locally.
   */
  const clearSession = (): void => {
    tokens.value = null
    user.value = null
  }

  /**
   * Stores a freshly issued token bundle and refreshes the cached user profile from Auth0.
   *
   * Used both at the end of the device-flow login wizard and after a successful refresh-token exchange.
   * @param {BlueOsCloudTokens} newTokens - Token bundle to persist.
   */
  const persistSession = async (newTokens: BlueOsCloudTokens): Promise<void> => {
    tokens.value = newTokens
    user.value = await fetchAuthenticatedUser(newTokens.accessToken)
  }

  // Shared in-flight refresh so concurrent callers exchange the refresh token only once.
  let refreshPromise: Promise<string> | null = null

  /**
   * Returns a valid access token, refreshing it on the fly when it has expired.
   *
   * Concurrent callers share a single in-flight refresh, so the refresh token is never exchanged more than once.
   * Throws when there is no active session or when the refresh attempt fails, so callers can show a re-login prompt.
   * @returns {Promise<string>} An access token guaranteed to be valid for the next API call.
   */
  const ensureValidAccessToken = async (): Promise<string> => {
    if (!tokens.value) throw new Error('Not signed in to BlueOS Cloud')

    if (isTokenValid(tokens.value)) return tokens.value.accessToken

    const refreshToken = tokens.value.refreshToken
    if (!refreshToken) {
      clearSession()
      throw new Error('BlueOS Cloud session expired. Please sign in again.')
    }

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken(refreshToken)
        .then(async (refreshed) => {
          await persistSession(refreshed)
          return refreshed.accessToken
        })
        .catch((error) => {
          clearSession()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  return {
    isIntegrationEnabled,
    tokens,
    user,
    isAuthenticated,
    displayName,
    persistSession,
    clearSession,
    ensureValidAccessToken,
  }
})
