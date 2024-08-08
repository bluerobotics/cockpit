<template>
  <BaseConfigurationView>
    <template #title>User configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[20vw]' : 'max-w-[24vw]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>User settings</template>
          <template #info
            >User related configuration. Here you can set the user that is currently set for this device as well as
            create a new user account.
          </template>
          <template #content>
            <div class="flex align-center justify-between pl-4 pr-2 mt-2 mb-6">
              <div>
                <span class="mr-2">Current user:</span>
                <span class="font-semibold text-2xl">{{ missionStore.username }}</span>
              </div>
              <v-btn
                id="select-profile"
                size="sm"
                icon="mdi-swap-horizontal"
                class="bg-transparent"
                variant="text"
                @click="missionStore.changeUsername"
              />
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
</script>
