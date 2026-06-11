<template>
  <teleport to="body">
    <InteractionDialog v-model:show-dialog="isVisible" max-width="560" variant="text-only">
      <template #title>
        <div class="relative flex items-center w-full justify-center">
          <span>{{ $t('Shared Data') }}</span>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute -right-3 mt-1"
            aria-label="Close shared data dialog"
            @click="close"
          />
        </div>
      </template>
      <template #content>
        <div class="flex flex-col w-full -mt-6 gap-4 mb-2">
          <p class="text-sm text-white/85">
            {{
              $t(
                'To help us understand how Cockpit is being used and prioritise the development effort, the application shares a small set of anonymous information with the Blue Robotics team.'
              )
            }}
          </p>

          <div
            role="switch"
            tabindex="0"
            :aria-checked="shareHardwareDetails"
            class="rounded-md bg-white/[0.04] border border-white/10 px-3 py-3 cursor-pointer hover:bg-white/[0.06] transition-colors duration-150"
            @click="shareHardwareDetails = !shareHardwareDetails"
            @keydown.enter.prevent="shareHardwareDetails = !shareHardwareDetails"
            @keydown.space.prevent="shareHardwareDetails = !shareHardwareDetails"
          >
            <div class="flex items-center gap-3">
              <span class="text-[14px] font-semibold text-white">{{ $t('Detailed hardware specifications') }}</span>
              <v-switch
                v-model="shareHardwareDetails"
                hide-details
                density="compact"
                color="#4fa483"
                class="ml-auto -my-1 scale-75"
                inset
                aria-label="Share detailed hardware specifications"
                @click.stop
              />
            </div>
            <p class="text-[12px] text-white/70 leading-snug mt-1">
              {{
                $t(
                  'Adds the device manufacturer / model, CPU and GPU details, total memory and storage, and display size information. Helps us know which hardware we should target and test for.'
                )
              }}
            </p>
          </div>

          <div class="rounded-md bg-white/[0.04] border border-white/10 px-3 py-3">
            <div class="flex items-center gap-2">
              <v-icon size="18" color="#7ad1aa">mdi-information-outline</v-icon>
              <span class="text-[14px] font-semibold text-white">{{ $t('Basic information') }}</span>
              <span class="text-[11px] text-white/55 ml-auto">{{ $t('Always shared') }}</span>
            </div>
            <p class="text-[12px] text-white/70 leading-snug mt-1">
              {{
                $t(
                  'Cockpit version, runtime, system context (operating system, system language, window size, touch capability) and connected vehicle type / firmware. This baseline cannot be turned off.'
                )
              }}
            </p>
          </div>
        </div>
      </template>
      <template #actions>
        <div class="flex w-full justify-between items-center px-1">
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-open-in-new"
            :href="telemetryDataPrivacyDocsUrl"
            target="_blank"
            rel="noopener"
          >
            {{ $t('View documentation') }}
          </v-btn>
          <v-btn variant="flat" size="small" class="bg-[#FFFFFF33] text-white" @click="close">{{ $t('Close') }}</v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { telemetryDataPrivacyDocsUrl } from '@/libs/external-telemetry/event-tracking'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useDevelopmentStore } from '@/stores/development'

const interfaceStore = useAppInterfaceStore()
const developmentStore = useDevelopmentStore()

const isVisible = computed({
  get: () => interfaceStore.isDataPrivacyModalVisible,
  set: (v: boolean) => {
    interfaceStore.isDataPrivacyModalVisible = v
  },
})

const shareHardwareDetails = toRef(developmentStore, 'shareHardwareDetails')

/**
 * Hide the modal.
 * @returns {void}
 */
const close = (): void => {
  isVisible.value = false
}
</script>
