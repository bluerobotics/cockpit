<template>
  <InteractionDialog
    variant="text-only"
    :show-dialog="showDialog"
    title="Custom user settings"
    :actions="interactionDialogActions"
    :max-width="700"
  >
    <template #content>
      <div class="flex flex-col align-center justify-center font-light text-slate-200 w-full h-full transition-all">
        <div
          v-if="!usernamesStoredOnBlueOS.isEmpty() && !showNewUsernamePrompt"
          class="w-full h-full flex flex-col align-center justify-center"
        >
          <p>It seems like you don't have an username set in this device yet.</p>
          <p>Please select your username below or click "add new" to create a new one.</p>
          <br />
          <div class="flex align-center justify-center w-[70%]">
            <button
              v-for="username in usernamesStoredOnBlueOS"
              :key="username"
              class="m-2 p-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-50"
              @click="setNewUsername(username)"
            >
              {{ username }}
            </button>
            <button
              :key="'add-new-username'"
              class="m-2 p-2 bg-slate-400 text-slate-800 rounded-md hover:bg-slate-100"
              @click="showNewUsernamePrompt = true"
            >
              Add new
            </button>
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
import { onBeforeMount, ref } from 'vue'

import { getSettingsUsernamesFromBlueOS } from '@/composables/settingsSyncer'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])

const showDialog = ref(true)
const showNewUsernamePrompt = ref(false)
const validationError = ref('')
const newUsername = ref('')
const usernamesStoredOnBlueOS = ref<string[]>([])

const setNewUsername = (username: string): void => {
  newUsername.value = username
  emit('confirmed', username)
}

onBeforeMount(async () => {
  usernamesStoredOnBlueOS.value = await getSettingsUsernamesFromBlueOS()
})

const validateUsername = (): true | string => {
  if (newUsername.value.length < 3) {
    return 'Username must be at least 3 characters long.'
  } else if (!newUsername.value.match(/^[a-zA-Z0-9_.-]+$/)) {
    return 'Username can only contain letters, numbers, and the following characters: _ - .'
  } else if (newUsername.value.toLowerCase() !== newUsername.value) {
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
      const usernameValidation = validateUsername()
      if (usernameValidation !== true) {
        validationError.value = usernameValidation
        return
      }
      showDialog.value = false
      emit('confirmed', newUsername.value)
    },
  },
]
</script>
