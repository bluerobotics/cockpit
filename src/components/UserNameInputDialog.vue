<template>
  <InteractionDialog
    variant="text-only"
    :show-dialog="showDialog"
    title="Switch user"
    :actions="interactionDialogActions"
    :max-width="700"
  >
    <template #content>
      <div v-if="isLoading" class="flex justify-center items-center h-[120px] w-full">
        <v-progress-circular color="white" indeterminate class="mb-10" />
      </div>
      <div
        v-else
        class="flex flex-col align-center justify-center font-light text-slate-200 w-full h-full transition-all"
      >
        <div
          v-if="!isUsernamesEmpty && !showNewUsernamePrompt"
          class="w-full h-full flex flex-col align-center justify-center text-center"
        >
          <p v-if="missionStore.username === undefined">
            It seems like you don't have an username set in this device yet.
          </p>
          <p>Please select your username below or click "add new" to create a new one.</p>
          <br />
          <div class="flex align-center justify-center w-full flex-wrap">
            <v-btn
              v-for="username in usernamesStoredOnBlueOS"
              :key="username"
              variant="flat"
              class="bg-[#FFFFFF33] m-2"
              @click="setNewUsername(username)"
            >
              {{ username }}
            </v-btn>
            <v-btn
              :key="'add-new-username'"
              variant="flat"
              class="bg-[#ffffff14] m-2"
              @click="showNewUsernamePrompt = true"
            >
              Add new
            </v-btn>
          </div>
          <br />
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
          />
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { computed, onMounted, ref } from 'vue'

import { getSettingsUsernamesFromBlueOS } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])

const missionStore = useMissionStore()
const mainVehicleStore = useMainVehicleStore()

const showDialog = ref(true)
const showNewUsernamePrompt = ref(false)
const validationError = ref('')
const newUsername = ref('')
const usernamesStoredOnBlueOS = ref<string[] | null>(null)
const isLoading = ref(true)

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

onMounted(() => {
  if (mainVehicleStore.isVehicleOnline) {
    loadUsernames()
  } else {
    isLoading.value = false
  }
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

const interactionDialogActions = [
  {
    text: 'Cancel',
    action: () => {
      showDialog.value = false
      emit('dismissed')
    },
  },
  {
    text: 'Save',
    action: () => {
      const slugifiedUsername = slugify(newUsername.value, { lower: true })
      const usernameValidation = validateUsername(slugifiedUsername)
      if (usernameValidation !== true) {
        validationError.value = usernameValidation
        openSnackbar({ message: usernameValidation, variant: 'error', duration: 5000 })
        return
      }
      newUsername.value = slugifiedUsername
      showDialog.value = false
      emit('confirmed', newUsername.value)
    },
  },
]
</script>
