<template>
  <InteractionDialog
    variant="text-only"
    persistent
    :show-dialog="isPromptVisible"
    :title="t`Rename the default user`"
    :actions="actions"
    :max-width="560"
  >
    <template #content>
      <div class="flex flex-col items-center -mt-2.5 pb-2.5 text-center font-light text-slate-200">
        <p>
          {{
            t`You are using Cockpit's default user. Give it a name to keep your settings easy to manage under your own user.`
          }}
        </p>
        <v-text-field
          v-model="newUsername"
          variant="outlined"
          density="compact"
          :placeholder="t`Username`"
          :error-messages="validationError"
          hide-details="auto"
          class="w-full mt-4"
          @keyup.enter="rename"
        />
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { t } from 'ttag'
import { computed, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useNewUserSeeding } from '@/composables/useNewUserSeeding'
import { settingsManager } from '@/libs/settings-management'
import { isDefaultUsername, validateUsername } from '@/libs/username'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { fallbackUsername } from '@/types/settings-management'

import InteractionDialog from './InteractionDialog.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

const newUsername = ref('')
const isPostponed = ref(false)

// "Later" only lasts until the next launch or the next switch of user.
watch(
  () => missionStore.username,
  () => (isPostponed.value = false)
)

const isPromptVisible = computed(
  () => isDefaultUsername(missionStore.username) && !isPostponed.value && !interfaceStore.isTutorialVisible
)

const slugifiedUsername = computed(() => slugify(newUsername.value, { lower: true }))

const validationError = computed(() => {
  if (!newUsername.value) return ''
  const validation = validateUsername(slugifiedUsername.value)
  if (validation !== true) return validation
  if (Object.keys(settingsManager.getLocalSettings()).includes(slugifiedUsername.value)) {
    return t`A user with this name already exists.`
  }
  return ''
})

const { isSeeding, seedNewUser } = useNewUserSeeding()

const canRename = computed(() => !!newUsername.value && !validationError.value && !isSeeding.value)

const postpone = (): void => {
  logUserAction('Postponed renaming the default user')
  isPostponed.value = true
}

const rename = async (): Promise<void> => {
  if (!canRename.value) return
  const username = slugifiedUsername.value
  if (!(await seedNewUser(username, fallbackUsername))) return
  logUserAction(`Renamed the default user to '${username}'`)
  missionStore.isDefaultUserRenamed = true
  missionStore.username = username
  newUsername.value = ''
  openSnackbar({ message: t`Default user renamed to '${username}'.`, variant: 'success', duration: 3000 })
}

const actions = computed(() => [
  { text: t`Later`, disabled: isSeeding.value, action: postpone },
  { text: t`Rename`, disabled: !canRename.value, action: rename },
])
</script>
