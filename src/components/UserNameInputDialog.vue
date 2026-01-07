<template>
  <InteractionDialog
    variant="text-only"
    persistent
    :show-dialog="showUserDialog"
    :title="`${t('usernameDialog.title')} ${currentVehicleName}`"
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
              {{ t('usernameDialog.noUsersYet') }}
            </p>
            <p>
              {{
                isOnEditMode
                  ? t('usernameDialog.deleteWarning')
                  : t('usernameDialog.selectOrEdit')
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
              <p class="mr-2">{{ t('usernameDialog.addNewUser') }}</p>
              <p><v-icon size="20" color="white">mdi-plus-circle-outline</v-icon></p></v-btn
            >
            <div class="fixed bottom-[6px] left-8">
              <v-switch v-model="isOnEditMode" hide-details label="admin mode" color="white" />
            </div>
          </div>
          <div v-else class="w-full h-full flex flex-col align-center justify-center">
            <p>{{ t('usernameDialog.usernameInfo') }}</p>
            <br />
            <p>{{ t('usernameDialog.autoSyncWarning') }}</p>
            <p>{{ t('usernameDialog.canSetLater') }}</p>
            <br />
            <v-text-field
              v-model="newUsername"
              variant="filled"
              :placeholder="t('usernameDialog.username')"
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
import { useI18n } from 'vue-i18n'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { deleteUsernameOnBlueOS, getSettingsUsernamesFromBlueOS } from '@/libs/blueos'
import { settingsManager } from '@/libs/settings-management'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])
const { t } = useI18n()

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
    openSnackbar({ message: t('usernameDialog.cannotDeleteCurrent'), variant: 'error' })
    return
  }

  const UNKNOWN_VEHICLE_LABEL = t('usernameDialog.currentVehicle')
  showUserDialog.value = false

  showDialog({
    title: t('common.warning') + '!',
    message: `${t('usernameDialog.deleteUserWarning').replace('the vehicle', currentVehicleName.value || UNKNOWN_VEHICLE_LABEL)} (${username})`,
    maxWidth: '700px',
    variant: 'warning',
    actions: [
      {
        text: t('common.cancel'),
        action: () => {
          closeDialog()
          showUserDialog.value = true
        },
      },
      {
        text: t('common.delete'),
        action: async () => {
          try {
            const vehicleAddress = await mainVehicleStore.getVehicleAddress()
            await deleteUsernameOnBlueOS(vehicleAddress, username)
            openSnackbar({ message: `${t('usernameDialog.userDeleted')} (${username})`, variant: 'success' })

            if (missionStore.username === username) {
              missionStore.username = ''
            }

            usernamesStoredOnBlueOS.value = (usernamesStoredOnBlueOS.value ?? []).filter((u) => u !== username)
          } catch (err) {
            try {
              await loadUsernamesFromBlueOS()
              openSnackbar({
                message: `${t('usernameDialog.deleteUserFailed')} (${username})`,
                variant: 'error',
                duration: 5000,
              })
            } catch (updateError) {
              openSnackbar({ message: `${t('usernameDialog.deleteUserFailed')} (${username})`, variant: 'error' })
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

const loadLocalUsernames = (): void => {
  const locallyStoredUsernames = Object.keys(settingsManager.getLocalSettings())
  if (locallyStoredUsernames.length) {
    usernamesStoredOnBlueOS.value = [...new Set([...(usernamesStoredOnBlueOS.value ?? []), ...locallyStoredUsernames])]
  }
}

const loadUsernamesFromBlueOS = async (): Promise<void> => {
  isLoading.value = true

  try {
    const vehicleAddress = await mainVehicleStore.getVehicleAddress()
    const blueOSUsernames = await getSettingsUsernamesFromBlueOS(vehicleAddress)
    if (blueOSUsernames && blueOSUsernames.length) {
      usernamesStoredOnBlueOS.value = [...new Set([...(usernamesStoredOnBlueOS.value ?? []), ...blueOSUsernames])]
    }
  } catch (error) {
    console.error('Failed to load usernames from BlueOS.')
  } finally {
    isLoading.value = false
  }
}

const getVehicleName = async (): Promise<void> => {
  if (mainVehicleStore.isVehicleOnline) {
    try {
      currentVehicleName.value = await mainVehicleStore.getCurrentVehicleName()
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
  loadLocalUsernames()
  if (mainVehicleStore.isVehicleOnline) {
    loadUsernamesFromBlueOS()
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
  if (username.includes(' ')) {
    return t('usernameDialog.validationNoSpaces')
  } else if (username.toLowerCase().includes('cockpit')) {
    return t('usernameDialog.validationNoCockpit')
  } else if (username.toLowerCase().includes('fallback')) {
    return t('usernameDialog.validationNoFallback')
  } else if (username.length < 3) {
    return t('usernameDialog.validationMinLength')
  } else if (username.length > 16) {
    return t('usernameDialog.validationMaxLength')
  } else if (!username.match(/^[a-zA-Z0-9_.-]+$/)) {
    return t('usernameDialog.validationCharacters')
  } else if (username.toLowerCase() !== username) {
    return t('usernameDialog.validationLowercase')
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
    text: t('common.cancel'),
    action: () => {
      showUserDialog.value = false
      emit('dismissed')
    },
  },
  {
    text: t('common.save'),
    action: saveUserName,
  },
]

const regularDialogActions = [
  {
    text: t('common.close'),
    action: () => {
      showUserDialog.value = false
    },
  },
]
</script>
