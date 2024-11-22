<template>
  <InteractionDialog
    v-model="showUpdateDialog"
    :title="dialogTitle"
    :message="dialogMessage"
    :variant="dialogVariant"
    :actions="dialogActions"
    max-width="560"
  >
    <template #content>
      <div v-if="updateInfo" class="mt-2">
        <strong>Update Details:</strong>
        <p>Current Version: {{ app_version.version }}</p>
        <p>New Version: {{ updateInfo.version }}</p>
        <p>Release Date: {{ formatDate(updateInfo.releaseDate) }}</p>
      </div>
      <v-progress-linear
        v-if="showProgress"
        :model-value="downloadProgress"
        color="primary"
        height="25"
        rounded
        class="my-4"
      >
        <template #default>
          <strong>{{ Math.round(downloadProgress) }}%</strong>
        </template>
      </v-progress-linear>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { onBeforeMount, ref } from 'vue'

import InteractionDialog, { type Action } from '@/components/InteractionDialog.vue'
import { app_version } from '@/libs/cosmos'
import { isElectron } from '@/libs/utils'

const showUpdateDialog = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogVariant = ref<'error' | 'info' | 'success' | 'warning' | 'text-only'>('info')
const showProgress = ref(false)
const downloadProgress = ref(0)
const dialogActions = ref<Action[]>([])
const updateInfo = ref({
  version: '',
  releaseDate: '',
  releaseNotes: '',
})
const ignoredUpdateVersions = useStorage<string[]>('cockpit-ignored-update-versions', [])

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

onBeforeMount(() => {
  if (!isElectron()) {
    console.info('Not in Electron environment. UpdateNotification will not be initialized.')
    return
  }

  if (!window.electronAPI) {
    console.error('window.electronAPI is not defined. UpdateNotification will not be initialized.')
    return
  }

  // Listen for update events
  window.electronAPI.onCheckingForUpdate(() => {
    console.log('Checking if there are updates for the Electron app...')
    dialogTitle.value = 'Checking for Updates'
    dialogMessage.value = 'Looking for new versions of the application...'
    dialogVariant.value = 'info'
    dialogActions.value = []
    showProgress.value = false
    showUpdateDialog.value = true
  })

  window.electronAPI.onUpdateNotAvailable(() => {
    console.log('No updates available for the Electron app.')
    dialogTitle.value = 'No Updates Available'
    dialogMessage.value = 'You are running the latest version of the application.'
    dialogVariant.value = 'success'
    dialogActions.value = [
      {
        text: 'OK',
        action: () => {
          showUpdateDialog.value = false
        },
      },
    ]
    showProgress.value = false
  })

  window.electronAPI.onUpdateAvailable((info) => {
    console.log('Update available for the Electron app.', info)
    dialogTitle.value = 'Update Available'
    dialogMessage.value = 'A new version of the application is available. Would you like to download it now?'
    dialogVariant.value = 'info'
    updateInfo.value = { ...info }
    dialogActions.value = [
      {
        text: 'Ignore This Version',
        action: () => {
          console.log(`User chose to ignore version ${updateInfo.value.version}`)
          ignoredUpdateVersions.value.push(updateInfo.value.version)
          window.electronAPI!.cancelUpdate()
          showUpdateDialog.value = false
        },
      },
      {
        text: 'Download',
        action: () => {
          window.electronAPI!.downloadUpdate()
          showProgress.value = true
          dialogActions.value = [
            {
              text: 'Cancel',
              action: () => {
                console.log('User chose to cancel the update for the Electron app.')
                window.electronAPI!.cancelUpdate()
                showUpdateDialog.value = false
                dialogMessage.value = 'Downloading update...'
              },
            },
          ]
        },
      },
      {
        text: 'Not Now',
        action: () => {
          window.electronAPI!.cancelUpdate()
          showUpdateDialog.value = false
        },
      },
    ]

    // Check if this version is in the ignored list
    if (ignoredUpdateVersions.value.includes(info.version)) {
      console.log(`Skipping ignored version ${info.version}.`)
      showUpdateDialog.value = false
      return
    }

    showUpdateDialog.value = true
  })

  window.electronAPI.onDownloadProgress((progressInfo) => {
    downloadProgress.value = progressInfo.percent
  })

  window.electronAPI.onUpdateDownloaded(() => {
    console.log('Finished downloading the update for the Electron app.')
    dialogTitle.value = 'Update Ready to Install'
    dialogMessage.value =
      'The update has been downloaded. Would you like to install it now? The application will restart during installation.'
    dialogVariant.value = 'info'
    showProgress.value = false
    dialogActions.value = [
      {
        text: 'Install Now',
        action: () => {
          console.log('User chose to install the update for the Electron app now.')
          window.electronAPI!.installUpdate()
          showUpdateDialog.value = false
        },
      },
      {
        text: 'Later',
        action: () => {
          console.log('User chose to install the update for the Electron app later.')
          showUpdateDialog.value = false
        },
      },
    ]
    showUpdateDialog.value = true
  })
})
</script>
