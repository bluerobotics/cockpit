import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { createMission, fetchMissions } from '@/libs/blueos-cloud/api'
import { fetchAuthenticatedUser, isTokenValid, refreshAccessToken } from '@/libs/blueos-cloud/auth'
import { BlueOsCloudMission, BlueOsCloudTokens, BlueOsCloudUser } from '@/libs/blueos-cloud/types'

export const useBlueOsCloudStore = defineStore('blueOsCloud', () => {
  const isIntegrationEnabled = useBlueOsStorage<boolean>('cockpit-blueos-cloud-enabled', false)
  const tokens = useStorage<BlueOsCloudTokens | null>('cockpit-blueos-cloud-tokens', null, undefined, {
    serializer: {
      read: (raw) => {
        if (!raw) return null
        try {
          return JSON.parse(raw) as BlueOsCloudTokens
        } catch {
          return null
        }
      },
      write: (value) => (value ? JSON.stringify(value) : ''),
    },
  })
  const user = useStorage<BlueOsCloudUser | null>('cockpit-blueos-cloud-user', null, undefined, {
    serializer: {
      read: (raw) => {
        if (!raw) return null
        try {
          return JSON.parse(raw) as BlueOsCloudUser
        } catch {
          return null
        }
      },
      write: (value) => (value ? JSON.stringify(value) : ''),
    },
  })

  const missions = ref<BlueOsCloudMission[]>([])
  const isLoadingMissions = ref(false)
  const lastError = ref<string | null>(null)

  /**
   * Identifier of the cloud mission currently linked to the active Cockpit session, set from the mission
   * configuration dialog. Upload pickers read this to auto-select the right mission by default.
   */
  const linkedMissionId = useStorage<string | null>('cockpit-blueos-cloud-linked-mission-id', null, undefined, {
    serializer: {
      read: (raw) => (raw ? raw : null),
      write: (value) => value ?? '',
    },
  })

  const linkedMission = computed(() => missions.value.find((mission) => mission.id === linkedMissionId.value) ?? null)

  const isAuthenticated = computed(() => !!tokens.value && !!user.value)

  /**
   * Clears persisted tokens and the cached user profile, effectively logging the user out locally.
   */
  const clearSession = (): void => {
    tokens.value = null
    user.value = null
    missions.value = []
    linkedMissionId.value = null
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

  /**
   * Returns a valid access token, refreshing it on the fly when it has expired.
   *
   * Throws when there is no active session or when the refresh attempt fails, so callers can show a re-login prompt.
   * @returns {Promise<string>} An access token guaranteed to be valid for the next API call.
   */
  const ensureValidAccessToken = async (): Promise<string> => {
    if (!tokens.value) throw new Error('Not signed in to BlueOS Cloud')

    if (isTokenValid(tokens.value)) return tokens.value.accessToken

    if (!tokens.value.refreshToken) {
      clearSession()
      throw new Error('BlueOS Cloud session expired. Please sign in again.')
    }

    try {
      const refreshed = await refreshAccessToken(tokens.value.refreshToken)
      await persistSession(refreshed)
      return refreshed.accessToken
    } catch (error) {
      clearSession()
      throw error
    }
  }

  /**
   * Refreshes the cached list of cloud missions.
   *
   * Mutates `missions`, `isLoadingMissions` and `lastError` so the UI can react to the load lifecycle.
   * @returns {Promise<BlueOsCloudMission[]>} The updated list of missions.
   */
  const refreshMissions = async (): Promise<BlueOsCloudMission[]> => {
    isLoadingMissions.value = true
    lastError.value = null
    try {
      const accessToken = await ensureValidAccessToken()
      const fetched = await fetchMissions(accessToken)
      missions.value = fetched
      return fetched
    } catch (error) {
      lastError.value = (error as Error).message
      throw error
    } finally {
      isLoadingMissions.value = false
    }
  }

  /**
   * Creates a mission in BlueOS Cloud and prepends it to the local cache.
   * @param {object} input - Mission data.
   * @param {string} input.name - Title for the new mission.
   * @param {string} [input.description] - Optional mission description.
   * @param {number | null} [input.latitude] - Optional starting latitude in decimal degrees.
   * @param {number | null} [input.longitude] - Optional starting longitude in decimal degrees.
   * @returns {Promise<BlueOsCloudMission>} The newly created mission.
   */
  const createCloudMission = async (input: {
    /**
     * Title for the new mission.
     */
    name: string
    /**
     * Optional mission description.
     */
    description?: string
    /**
     * Optional starting latitude in decimal degrees.
     */
    latitude?: number | null
    /**
     * Optional starting longitude in decimal degrees.
     */
    longitude?: number | null
  }): Promise<BlueOsCloudMission> => {
    const accessToken = await ensureValidAccessToken()
    const created = await createMission(input, accessToken)
    missions.value = [created, ...missions.value]
    return created
  }

  return {
    isIntegrationEnabled,
    tokens,
    user,
    missions,
    isLoadingMissions,
    lastError,
    linkedMissionId,
    linkedMission,
    isAuthenticated,
    persistSession,
    clearSession,
    ensureValidAccessToken,
    refreshMissions,
    createCloudMission,
  }
})
