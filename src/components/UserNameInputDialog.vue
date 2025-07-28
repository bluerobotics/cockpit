<template>
  <InteractionDialog
    variant="text-only"
    persistent
    :show-dialog="showUserDialog"
    :title="`Manage users on: ${currentVehicleName}`"
    :actions="showNewUsernamePrompt || isUsernamesEmpty ? inputDialogActions : regularDialogActions"
    :max-width="700"
  >
    <template #content>
      <div v-if="isLoading" class="flex justify-center items-center w-full">
        <v-progress-circular color="white" indeterminate class="mb-10" />
      </div>
      <div v-else>
        <p class="-mt-4 mb-2 w-full text-center"></p>
        <div class="flex flex-col align-center justify-center font-light text-slate-200 w-full h-full transition-all">
          <div
            v-if="!isUsernamesEmpty && !showNewUsernamePrompt"
            class="w-full h-full flex flex-col align-center justify-center text-center"
          >
            <p v-if="missionStore.username === undefined">
              It seems like you don't have any users stored on this device yet.
            </p>
            <p>
              {{
                isOnEditMode
                  ? `Be careful when deleting users from the vehicle - this process cannot be undone`
                  : 'Select a user below, or switch to admin mode to create or edit users'
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
                  {{ username }}

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
              <p class="mr-2">add new user</p>
              <p><v-icon size="20" color="white">mdi-plus-circle-outline</v-icon></p></v-btn
            >
            <div class="fixed bottom-[6px] left-8">
              <v-switch v-model="isOnEditMode" hide-details label="admin mode" color="white" />
            </div>
          </div>
          <div v-else class="w-full h-full flex flex-col align-center justify-center">
            <p>This username will be used to store your settings in the vehicle.</p>
            <br />
            <p>If you don't set your username, auto-sync with the vehicle won't work.</p>
            <p>The user can be set or changed later in the General menu.</p>
            <br />
            <v-text-field
              v-model="newUsername"
              variant="filled"
              placeholder="Username"
              type="input"
              density="compact"
              hint="Your identification username."
              class="w-[50%] m-4"
              :error-messages="validationError"
              @keyup.enter="saveUserName"
            />
          </div>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { deleteUsernameOnBlueOS, getSettingsUsernamesFromBlueOS } from '@/libs/blueos'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])

const missionStore = useMissionStore()
const mainVehicleStore = useMainVehicleStore()
const { showDialog, closeDialog } = useInteractionDialog()

const showUserDialog = ref(true)
const showNewUsernamePrompt = ref(false)
const validationError = ref('')
const newUsername = ref('')
const usernamesStoredOnBlueOS = ref<string[] | null>(null)
const isLoading = ref(true)
const isOnEditMode = ref(false)
const currentVehicleName = ref<string | undefined>(undefined)

const deleteUser = async (username: string): Promise<void> => {
  if (username === missionStore.username) {
    openSnackbar({ message: 'You cannot delete the current user.', variant: 'error' })
    return
  }

  const UNKNOWN_VEHICLE_LABEL = 'current vehicle'
  showUserDialog.value = false

  showDialog({
    title: 'Warning!',
    message: `All settings for '${username}' will be permanently removed from ${
      currentVehicleName.value || UNKNOWN_VEHICLE_LABEL
    }.`,
    maxWidth: '700px',
    variant: 'warning',
    actions: [
      {
        text: 'Cancel',
        action: () => {
          closeDialog()
          showUserDialog.value = true
        },
      },
      {
        text: 'Delete',
        action: async () => {
          try {
            await deleteUsernameOnBlueOS(username)
            openSnackbar({ message: `User '${username}' deleted`, variant: 'success' })

            if (missionStore.username === username) {
              missionStore.username = ''
            }

            usernamesStoredOnBlueOS.value = (usernamesStoredOnBlueOS.value ?? []).filter((u) => u !== username)
          } catch (err) {
            try {
              await loadUsernames()
              openSnackbar({
                message: `Failed deleting '${username}'. The list was refreshed. Please try again.`,
                variant: 'error',
                duration: 5000,
              })
            } catch (updateError) {
              openSnackbar({ message: `Failed deleting '${username}'`, variant: 'error' })
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
  newUsername.value = username
  emit('confirmed', username)
}

const loadUsernames = async (): Promise<void> => {
  try {
    const usernames = await getSettingsUsernamesFromBlueOS()
    if (!usernames?.length) {
      usernamesStoredOnBlueOS.value = []
      return
    }
    usernamesStoredOnBlueOS.value = usernames
  } catch (error) {
    usernamesStoredOnBlueOS.value = []
    console.error('Failed to load usernames.')
  } finally {
    isLoading.value = false
  }
}

const getVehicleName = async (): Promise<void> => {
  if (mainVehicleStore.isVehicleOnline) {
    try {
      const response = await mainVehicleStore.getCurrentVehicleName()
      currentVehicleName.value = response
    } catch (error) {
      console.error('Failed to get vehicle name:', error)
    }
  }
}

const handleEsc = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    isOnEditMode.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEsc)
  if (mainVehicleStore.isVehicleOnline) {
    loadUsernames()
    getVehicleName()
  } else {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEsc)
})
const isUsernamesEmpty = computed(() => !usernamesStoredOnBlueOS.value || usernamesStoredOnBlueOS.value.length === 0)

const validateUsername = (username: string): true | string => {
  if (username.length < 3) {
    return 'Username must be at least 3 characters long.'
  } else if (username.length > 16) {
    return 'Username must be at most 16 characters long.'
  } else if (!username.match(/^[a-zA-Z0-9_.-]+$/)) {
    return 'Username can only contain letters, numbers, and the following characters: _ - .'
  } else if (username.toLowerCase() !== username) {
    return 'Username must be lowercase.'
  }
  return true
}

const saveUserName = (): void => {
  const slugifiedUsername = slugify(newUsername.value, { lower: true })
  const usernameValidation = validateUsername(slugifiedUsername)
  if (usernameValidation !== true) {
    validationError.value = usernameValidation
    openSnackbar({ message: usernameValidation, variant: 'error', duration: 5000 })
    return
  }
  newUsername.value = slugifiedUsername
  closeDialog()
  emit('confirmed', newUsername.value)
}

const inputDialogActions = [
  {
    text: 'Cancel',
    action: () => {
      showUserDialog.value = false
      emit('dismissed')
    },
  },
  {
    text: 'Save',
    action: saveUserName,
  },
]

const regularDialogActions = [
  {
    text: 'Close',
    action: () => {
      showUserDialog.value = false
    },
  },
]
</script>
