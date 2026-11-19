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
      <div class="flex flex-col items-center -mt-[10px] text-center font-light text-slate-200">
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
          class="w-full mt-4 mb-[10px]"
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
import { settingsManager } from '@/libs/settings-management'
import { isDefaultUsername, validateUsername } from '@/libs/username'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { fallbackUsername } from '@/types/settings-management'

import InteractionDialog from './InteractionDialog.vue'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

const newUsername = ref('')
const isRenaming = ref(false)
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

const canRename = computed(() => !!newUsername.value && !validationError.value && !isRenaming.value)

const postpone = (): void => {
  logUserAction('Postponed renaming the default user')
  isPostponed.value = true
}

const rename = async (): Promise<void> => {
  if (!canRename.value) return
  const username = slugifiedUsername.value
  isRenaming.value = true
  try {
    if (!(await settingsManager.seedNewUserSettings(username, fallbackUsername))) {
      const noSettingsMessage = t`No settings of the default user were found for this vehicle.`
      openSnackbar({ message: noSettingsMessage, variant: 'error', duration: 5000 })
      return
    }
  } catch {
    const unreachableMessage = t`Couldn't reach the vehicle to copy the default user's settings. Check the connection and try again.`
    openSnackbar({ message: unreachableMessage, variant: 'error', duration: 5000 })
    return
  } finally {
    isRenaming.value = false
  }
  logUserAction(`Renamed the default user to '${username}'`)
  missionStore.isDefaultUserRenamed = true
  missionStore.username = username
  newUsername.value = ''
  openSnackbar({ message: t`Default user renamed to '${username}'.`, variant: 'success', duration: 3000 })
}

const actions = computed(() => [
  { text: t`Later`, disabled: isRenaming.value, action: postpone },
  { text: t`Rename`, disabled: !canRename.value, action: rename },
])
</script>
