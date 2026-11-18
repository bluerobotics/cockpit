<template>
  <InteractionDialog
    variant="text-only"
    persistent
    :show-dialog="showUserDialog"
    :title="dialogTitle"
    :actions="currentDialogActions"
    :max-width="700"
  >
    <template #content>
      <div class="flex absolute top-0 right-0 py-2 pr-3">
        <v-btn
          icon
          :width="34"
          :height="34"
          variant="text"
          :aria-label="t`Close`"
          :disabled="isSeeding"
          class="bg-transparent"
          @click="closeFromCornerButton"
        >
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>
      <div v-if="isLoading" class="flex justify-center items-center w-full">
        <v-progress-circular color="white" indeterminate class="mb-10" />
      </div>
      <div v-else>
        <p class="-mt-4 mb-2 w-full text-center"></p>
        <div class="flex flex-col align-center justify-center font-light text-slate-200 w-full h-full transition-all">
          <div
            v-if="localOnlyNotice"
            class="mb-3 mx-auto max-w-[560px] rounded-md border border-yellow-400 border-opacity-60 bg-yellow-400 bg-opacity-10 px-3 py-2 text-sm text-yellow-200 flex items-start gap-2"
          >
            <v-icon size="18" color="yellow">mdi-alert-circle-outline</v-icon>
            <span>{{ localOnlyNotice }}</span>
          </div>
          <div
            v-if="!isUsernamesEmpty && !showNewUsernamePrompt"
            class="w-full h-full flex flex-col align-center justify-center text-center"
          >
            <p v-if="missionStore.username === undefined">
              {{ t`It seems like you don't have any users stored on this device yet.` }}
            </p>
            <p>
              {{
                isOnEditMode
                  ? t`Be careful when deleting users from the vehicle - this process cannot be undone`
                  : t`Select a user below, or switch to admin mode to create or edit users`
              }}
            </p>
            <br />
            <div class="flex align-center justify-center w-full flex-wrap mb-6" :class="{ 'mb-12': isOnEditMode }">
              <div>
                <v-btn
                  v-for="username in usernamesStoredOnBlueOS"
                  :key="username"
                  variant="flat"
                  class="relative bg-[#FFFFFF18] m-2"
                  :class="[
                    { 'elevation-2 border-2 bg-[#FFFFFF33] border-[#FFFFFF33]': missionStore.username === username },
                    { 'pointer-events-none': isOnEditMode },
                  ]"
                  @click="!isOnEditMode && setNewUsername(username)"
                >
                  {{ usernameLabel(username) }}

                  <template v-if="isOnEditMode && username !== missionStore.username">
                    <div
                      class="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center rounded-full bg-white bg-opacity-90 pointer-events-auto elevation-2 cursor-pointer"
                    >
                      <v-icon size="14" color="red-darken-1" @click="deleteUser(username)">mdi-trash-can</v-icon>
                    </div>
                  </template>
                </v-btn>
              </div>
            </div>
            <v-btn
              v-if="isOnEditMode"
              :key="'add-new-username'"
              class="absolute bottom-20 right-4"
              variant="text"
              @click="showNewUsernamePrompt = true"
            >
              <p class="mr-2">{{ t`add new user` }}</p>
              <p><v-icon size="20" color="white">mdi-plus-circle-outline</v-icon></p></v-btn
            >
            <div class="fixed bottom-[6px] left-8">
              <v-switch v-model="isOnEditMode" hide-details :label="t`admin mode`" color="white" />
            </div>
          </div>
          <div v-else class="w-full h-full flex flex-col align-center justify-center">
            <p>{{ t`This username will be used to store your settings in the vehicle.` }}</p>
            <br />
            <p>{{ t`If you don't set your username, auto-sync with the vehicle won't work.` }}</p>
            <p class="mt-[15px]">{{ t`The user can be set or changed later in the General menu.` }}</p>
            <br />
            <div class="flex items-start gap-6 w-[90%] mt-[10px] mb-[15px]">
              <v-text-field
                v-model="newUsername"
                variant="outlined"
                :placeholder="t`Username`"
                type="input"
                density="compact"
                hide-details="auto"
                class="flex-1"
                :error-messages="validationError"
                @keyup.enter="saveUserName"
              />
              <span v-if="isSettingsSourceSelectable" class="h-10 flex items-center whitespace-nowrap">{{
                t`Copy from`
              }}</span>
              <v-select
                v-if="isSettingsSourceSelectable"
                v-model="settingsSource"
                :items="settingsSourceOptions"
                variant="outlined"
                density="compact"
                theme="dark"
                hide-details
                class="flex-1"
                @update:model-value="onSettingsSourceSelected"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { t } from 'ttag'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useNewUserSeeding } from '@/composables/useNewUserSeeding'
import { deleteUsernameOnBlueOS, getSettingsUsernamesFromBlueOS } from '@/libs/blueos'
import { settingsManager } from '@/libs/settings-management'
import { isDefaultUsername, usernameLabel, validateUsername } from '@/libs/username'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { fallbackUsername } from '@/types/settings-management'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])

const missionStore = useMissionStore()
const mainVehicleStore = useMainVehicleStore()
const { showDialog, closeDialog } = useInteractionDialog()

type BlueOsLoadState = 'idle' | 'loading' | 'loaded' | 'failed' | 'offline'

const showUserDialog = ref(true)
const showNewUsernamePrompt = ref(false)
const validationError = ref('')
const newUsername = ref('')
const usernamesStoredOnBlueOS = ref<string[] | null>(null)
const isLoading = ref(true)
const isOnEditMode = ref(false)
const currentVehicleName = ref<string | undefined>(undefined)
const blueOsLoadState = ref<BlueOsLoadState>('idle')
// Holds "cockpit" and a space, both rejected by `validateUsername`, so it can never clash with a real user.
const startFromDefaults = 'cockpit defaults'
const settingsSource = ref(isDefaultUsername(missionStore.username) ? fallbackUsername : missionStore.username)

const deleteUser = async (username: string): Promise<void> => {
  if (username === missionStore.username) {
    openSnackbar({ message: t`You cannot delete the current user.`, variant: 'error' })
    return
  }

  const UNKNOWN_VEHICLE_LABEL = t`current vehicle`
  const vehicleName = currentVehicleName.value || UNKNOWN_VEHICLE_LABEL
  showUserDialog.value = false

  showDialog({
    title: t`Warning!`,
    message: t`All settings for '${username}' will be permanently removed from ${vehicleName}.`,
    maxWidth: '700px',
    variant: 'warning',
    actions: [
      {
        text: t`Cancel`,
        action: () => {
          closeDialog()
          showUserDialog.value = true
        },
      },
      {
        text: t`Delete`,
        action: async () => {
          logUserAction(`Deleted user '${username}'`)
          try {
            const vehicleAddress = await mainVehicleStore.getVehicleAddress()
            await deleteUsernameOnBlueOS(vehicleAddress, username)
            openSnackbar({ message: t`User '${username}' deleted`, variant: 'success' })

            if (missionStore.username === username) {
              missionStore.username = ''
            }

            usernamesStoredOnBlueOS.value = (usernamesStoredOnBlueOS.value ?? []).filter((u) => u !== username)
          } catch (err) {
            try {
              await loadUsernamesFromBlueOS()
              openSnackbar({
                message: t`Failed deleting '${username}'. The list was refreshed. Please try again.`,
                variant: 'error',
                duration: 5000,
              })
            } catch (updateError) {
              openSnackbar({ message: t`Failed deleting '${username}'`, variant: 'error' })
              console.error(updateError)
            }
            console.error(err)
          } finally {
            closeDialog()
            showUserDialog.value = true
          }
        },
      },
    ],
  })
}

const setNewUsername = (username: string): void => {
  logUserAction(`Selected user '${username}'`)
  newUsername.value = username
  emit('confirmed', username)
}

const loadLocalUsernames = (): void => {
  const locallyStoredUsernames = Object.keys(settingsManager.getLocalSettings())
  if (locallyStoredUsernames.length) {
    usernamesStoredOnBlueOS.value = [...new Set([...(usernamesStoredOnBlueOS.value ?? []), ...locallyStoredUsernames])]
  }
}

const loadUsernamesFromBlueOS = async (): Promise<void> => {
  if (!mainVehicleStore.isVehicleOnline) {
    blueOsLoadState.value = 'offline'
    isLoading.value = false
    return
  }

  isLoading.value = true
  blueOsLoadState.value = 'loading'

  try {
    const vehicleAddress = await mainVehicleStore.getVehicleAddress()
    const blueOSUsernames = await getSettingsUsernamesFromBlueOS(vehicleAddress)
    if (blueOSUsernames && blueOSUsernames.length) {
      usernamesStoredOnBlueOS.value = [...new Set([...(usernamesStoredOnBlueOS.value ?? []), ...blueOSUsernames])]
    }
    blueOsLoadState.value = 'loaded'
  } catch (error) {
    console.error('Failed to load usernames from BlueOS.', error)
    blueOsLoadState.value = 'failed'
  } finally {
    isLoading.value = false
  }
}

const getVehicleName = async (): Promise<void> => {
  if (!mainVehicleStore.isVehicleOnline) return
  try {
    currentVehicleName.value = await mainVehicleStore.getCurrentVehicleName()
  } catch (error) {
    console.error('Failed to get vehicle name:', error)
  }
}

const handleEsc = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    isOnEditMode.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEsc)
  loadLocalUsernames()
  loadUsernamesFromBlueOS()
  getVehicleName()
})

// Retry fetching vehicle data whenever the vehicle (re)comes online and the previous attempt
// hasn't succeeded yet. Without this the dialog would forever show only the locally cached users
// if it was opened while the vehicle was offline.
watch(
  () => mainVehicleStore.isVehicleOnline,
  (isOnline) => {
    if (!isOnline) return
    if (blueOsLoadState.value === 'offline' || blueOsLoadState.value === 'failed') {
      loadUsernamesFromBlueOS()
    }
    if (!currentVehicleName.value) {
      getVehicleName()
    }
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEsc)
})
const isUsernamesEmpty = computed(() => !usernamesStoredOnBlueOS.value || usernamesStoredOnBlueOS.value.length === 0)
const dialogTitle = computed(() =>
  currentVehicleName.value ? t`Manage users on: ${currentVehicleName.value}` : t`Manage users`
)
const localOnlyNotice = computed(() => {
  if (blueOsLoadState.value === 'offline') {
    return t`Vehicle is offline. Showing locally cached users only - other users saved on the vehicle may not appear here.`
  }
  if (blueOsLoadState.value === 'failed') {
    return t`Couldn't load users from the vehicle. Showing locally cached users only - any users saved on the vehicle still exist.`
  }
  return ''
})

const isSettingsSourceSelectable = computed(() => {
  const typedUsername = slugify(newUsername.value, { lower: true })
  return !isUsernamesEmpty.value && !usernamesStoredOnBlueOS.value?.includes(typedUsername)
})
const settingsSourceOptions = computed(() => [
  { title: t`Cockpit's defaults`, value: startFromDefaults },
  ...(usernamesStoredOnBlueOS.value ?? []).map((username) => ({ title: usernameLabel(username), value: username })),
])

const onSettingsSourceSelected = (source: string): void => {
  logUserAction(`Selected '${source}' as the settings source of the new user`)
}

const { isSeeding, seedNewUser } = useNewUserSeeding()

const saveUserName = async (): Promise<void> => {
  if (isSeeding.value) return
  const slugifiedUsername = slugify(newUsername.value, { lower: true })
  const usernameValidation = validateUsername(slugifiedUsername)
  if (usernameValidation !== true) {
    validationError.value = usernameValidation
    openSnackbar({ message: usernameValidation, variant: 'error', duration: 5000 })
    return
  }
  let source: string | null | undefined = undefined
  if (isSettingsSourceSelectable.value) {
    source = settingsSource.value === startFromDefaults ? null : settingsSource.value
    if (!(await seedNewUser(slugifiedUsername, source))) return
  }
  newUsername.value = slugifiedUsername
  const sourceLabel = source === undefined ? '' : ` from '${source ?? 'Cockpit defaults'}'`
  logUserAction(`Created and selected new user '${slugifiedUsername}'${sourceLabel}`)
  closeDialog()
  emit('confirmed', newUsername.value)
  // Raw defaults lack the options mounted widgets fill in on creation, so they only apply cleanly on a fresh start.
  if (source === null) reloadCockpitAndWarnUser()
}

const inputDialogActions = computed(() => [
  {
    text: t`Cancel`,
    disabled: isSeeding.value,
    action: () => {
      showUserDialog.value = false
      emit('dismissed')
    },
  },
  {
    text: t`Save`,
    disabled: isSeeding.value,
    action: saveUserName,
  },
])

const regularDialogActions = [
  {
    text: t`Close`,
    action: () => {
      showUserDialog.value = false
    },
  },
]

const currentDialogActions = computed(() =>
  showNewUsernamePrompt.value || isUsernamesEmpty.value ? inputDialogActions.value : regularDialogActions
)

const closeFromCornerButton = (): void => {
  if (isSeeding.value) return
  logUserAction('Closed user management with the close button')
  currentDialogActions.value[0].action()
}
</script>
