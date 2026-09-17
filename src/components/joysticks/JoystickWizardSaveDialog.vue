<template>
  <v-dialog
    :model-value="true"
    persistent
    width="520"
    class="dialog-backdrop"
    :style="interfaceStore.dialogBackdropStyles"
  >
    <v-card class="px-5 pt-4 pb-3 rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <div class="relative flex items-center justify-center w-full pb-2">
        <p class="text-h6 text-center px-10">Save this mapping</p>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          class="absolute -right-2 text-sm"
          aria-label="Go back to the review"
          @click="emit('dismiss')"
        />
      </div>

      <div class="flex flex-col py-3">
        <v-radio-group
          :model-value="destination"
          theme="dark"
          density="compact"
          hide-details
          @update:model-value="setDestination"
        >
          <v-radio label="Create a new profile" value="new" />
          <v-radio label="Replace an existing profile" value="replace" />
        </v-radio-group>

        <v-text-field
          v-if="destination === 'new'"
          :model-value="name"
          class="mt-3"
          label="Profile name"
          theme="dark"
          variant="outlined"
          density="compact"
          hide-details="auto"
          :error-messages="nameError"
          @update:model-value="name = $event"
        />
        <v-select
          v-else
          :model-value="replacedHash"
          :items="profiles"
          class="mt-3"
          label="Profile to replace"
          theme="dark"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="setReplacedProfile"
        />

        <p class="text-sm opacity-70 mt-3">{{ explanation }}</p>
      </div>

      <v-divider class="opacity-10 border-[#fafafa]" />

      <div class="flex justify-between items-center pt-3">
        <v-btn variant="text" size="small" @click="emit('discard')">Discard mapping</v-btn>
        <v-btn variant="flat" size="small" class="bg-[#FFFFFF33] text-white" :disabled="!canSave" @click="onSave">
          Save
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { type JoystickProfileOption } from '@/types/joystick'

const props = defineProps<{
  /**
   * Name to offer for a newly created profile
   */
  defaultName: string
  /**
   * Profiles already saved, offered as targets to replace
   */
  profiles: JoystickProfileOption[]
}>()

const emit = defineEmits<{
  (e: 'save-new', name: string): void
  (e: 'replace', hash: string): void
  (e: 'discard'): void
  (e: 'dismiss'): void
}>()

const interfaceStore = useAppInterfaceStore()

const destination = ref<'new' | 'replace'>('new')
const name = ref(props.defaultName)
// Left unset so overwriting a profile is always a deliberate pick, never whichever one happened to be offered first
const replacedHash = ref<string | undefined>(undefined)

// Names are what the picker and the delete confirmation identify a profile by, so two alike would leave the user
// unable to tell which one they are acting on
const nameError = computed(() =>
  props.profiles.some((profile) => profile.title === name.value.trim())
    ? 'A profile with this name already exists.'
    : undefined
)

const canSave = computed(() =>
  destination.value === 'new'
    ? name.value.trim().length > 0 && nameError.value === undefined
    : replacedHash.value !== undefined
)

const explanation = computed(() => {
  if (destination.value === 'new')
    return 'The new profile becomes the active one, leaving your other profiles as they are.'
  return 'The chosen profile keeps its name and becomes the active one, with its bindings replaced by this mapping.'
})

const setDestination = (value: 'new' | 'replace' | null): void => {
  if (value === null) return
  const choice = value === 'new' ? 'create a new profile' : 'replace an existing profile'
  logUserAction(`Chose to ${choice} in the joystick wizard save dialog`)
  destination.value = value
}

const setReplacedProfile = (hash: string | null): void => {
  if (hash === null) return
  const replacedName = props.profiles.find((profile) => profile.value === hash)?.title
  logUserAction(`Picked "${replacedName}" as the joystick profile the wizard mapping replaces`)
  replacedHash.value = hash
}

const onSave = (): void => {
  if (destination.value === 'new') {
    emit('save-new', name.value.trim())
  } else if (replacedHash.value !== undefined) {
    emit('replace', replacedHash.value)
  }
}
</script>
