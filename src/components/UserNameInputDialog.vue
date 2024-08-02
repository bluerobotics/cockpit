<template>
  <InteractionDialog
    :show-dialog="showDialog"
    title="Username prompt"
    :actions="interactionDialogActions"
    :max-width="700"
  >
    <template #content>
      <div class="flex flex-col align-center justify-center font-light text-slate-200">
        <p>Please set your username.</p>
        <br />
        <p>This will be used to store your configurations in the vehicle.</p>
        <p>If you have multiple vehicles, make sure to use the same on all of them.</p>
        <br />
        <p>It should be at least 3 characters long.</p>
        <p>It can contain letters, numbers, and the following characters: _ - .</p>
        <p>It is case-insensitive.</p>
        <br />
        <p>If you don't set it, auto-sync with the vehicle won't work.</p>
        <p>It can be changed later in the General menu.</p>
        <v-text-field
          v-model="newUsername"
          variant="filled"
          placeholder="Username"
          type="input"
          density="compact"
          hint="Your identification username. At least 3 characters long."
          class="w-[50%] mt-8 mb-4"
        />
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import InteractionDialog from './InteractionDialog.vue'

const emit = defineEmits(['confirmed', 'dismissed'])

const showDialog = ref(true)
const newUsername = ref('')

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
      showDialog.value = false
      emit('confirmed', newUsername.value)
    },
  },
]
</script>
