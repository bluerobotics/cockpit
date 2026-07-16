<template>
  <BaseConfigurationView>
    <template #title>Cloud configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[650px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>BlueOS Cloud integration</template>
          <template #subtitle>
            <span v-if="cloudStore.isAuthenticated">Signed in as {{ cloudStore.displayName }}</span>
            <span v-else>Not connected</span>
          </template>
          <template #info>
            <p class="w-full">
              Connect Cockpit to your BlueOS Cloud account to create missions and upload recorded videos directly from
              the app. After enabling the integration you will be guided through a quick login wizard.
            </p>
          </template>
          <template #content>
            <div class="flex flex-col w-full py-2 gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <v-switch
                    v-model="cloudStore.isIntegrationEnabled"
                    color="white"
                    hide-details
                    base-color="#FFFFFF33"
                    class="mt-0"
                    @update:model-value="onCloudIntegrationToggle"
                  />
                  <span class="text-sm">Enable BlueOS Cloud integration</span>
                </div>
                <v-btn
                  v-if="cloudStore.isAuthenticated"
                  size="x-small"
                  variant="flat"
                  class="bg-[#FFFFFF22] shadow-1"
                  @click="signOutFromCloud"
                >
                  Sign out
                </v-btn>
                <v-btn
                  v-else-if="cloudStore.isIntegrationEnabled"
                  size="x-small"
                  variant="flat"
                  class="bg-[#FFFFFF22] shadow-1"
                  @click="openLoginDialog"
                >
                  Sign in
                </v-btn>
              </div>
              <div v-if="cloudStore.isAuthenticated" class="flex items-center gap-3 px-3 py-2 rounded bg-[#FFFFFF11]">
                <v-avatar size="36">
                  <img
                    v-if="cloudStore.user?.picture"
                    :src="cloudStore.user.picture"
                    alt="BlueOS Cloud profile picture"
                    referrerpolicy="no-referrer"
                    class="w-full h-full object-cover"
                  />
                  <v-icon v-else>mdi-account</v-icon>
                </v-avatar>
                <div class="flex flex-col">
                  <span class="font-medium">{{ cloudStore.displayName }}</span>
                  <span v-if="cloudStore.user?.email" class="text-xs opacity-80">{{ cloudStore.user.email }}</span>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
  <BlueOsCloudLoginDialog v-model="showCloudLoginDialog" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import BlueOsCloudLoginDialog from '@/components/blueos-cloud/BlueOsCloudLoginDialog.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const cloudStore = useBlueOsCloudStore()
const { openSnackbar } = useSnackbar()

const showCloudLoginDialog = ref(false)

// Revert the toggle when the login wizard is dismissed without a completed sign-in.
watch(showCloudLoginDialog, (isOpen) => {
  if (!isOpen && !cloudStore.isAuthenticated) {
    cloudStore.isIntegrationEnabled = false
  }
})

const openLoginDialog = (): void => {
  logUserAction('Opened the BlueOS Cloud login dialog')
  showCloudLoginDialog.value = true
}

const onCloudIntegrationToggle = (value: boolean | null): void => {
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} BlueOS Cloud integration`)
  if (enabled && !cloudStore.isAuthenticated) {
    openLoginDialog()
  }
}

const signOutFromCloud = (): void => {
  logUserAction('Signed out from BlueOS Cloud')
  cloudStore.clearSession()
  cloudStore.isIntegrationEnabled = false
  openSnackbar({
    message: 'Signed out from BlueOS Cloud.',
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })
}
</script>
