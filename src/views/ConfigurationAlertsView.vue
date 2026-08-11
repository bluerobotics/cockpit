<template>
  <BaseConfigurationView>
    <template #title>Alerts configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-top-divider>
          <template #title>Voice alerts:</template>
          <template #info>
            Enable voice alerts to receive audible notifications about system and vehicle activities. <br />
            Select specific alert levels to customize which types of notifications you receive.
          </template>
          <template #content>
            <div class="flex justify-between">
              <v-switch
                :model-value="alertStore.enableVoiceAlerts"
                label="Enable voice alerts"
                color="white"
                class="ml-3"
                @update:model-value="setVoiceAlertsEnabled"
              />
              <v-slider
                v-model="alertStore.alertVolume"
                min="0"
                max="1"
                step="0.05"
                hide-details
                label="Alerts volume"
                color="white"
                class="max-w-[300px]"
                :disabled="!alertStore.enableVoiceAlerts"
              />
            </div>
            <span class="text-sm font-medium mt-4">Alert levels:</span>
            <div class="flex flex-wrap items-center justify-start">
              <div
                v-for="enabledLevel in alertStore.enabledAlertLevels"
                :key="enabledLevel.level"
                class="mx-2 min-w-[100px]"
              >
                <v-checkbox
                  :model-value="enabledLevel.enabled"
                  :label="capitalize(enabledLevel.level)"
                  hide-details
                  color="white"
                  @update:model-value="(value) => setAlertLevelEnabled(enabledLevel.level, value)"
                />
              </div>
            </div>
            <span class="text-sm font-medium mt-4">Alert voice:</span>
            <div class="flex items-center gap-x-3 mt-2 mb-2 ml-2 max-w-[620px]">
              <v-select
                v-if="voiceOptions.length > 0"
                :model-value="selectedVoiceId"
                :items="voiceOptions"
                item-title="name"
                item-value="value"
                aria-label="Alert voice"
                theme="dark"
                density="compact"
                variant="outlined"
                hide-details
                class="flex-1 min-w-0 max-w-[350px] text-sm"
                @update:model-value="setAlertVoice"
              />
              <p v-else-if="voiceListSettled" class="text-sm text-yellow-300 max-w-[350px]">
                Voice system not working: no speech voice found.
                <template v-if="hostOs === 'Linux'">
                  Install <span class="font-mono">speech-dispatcher</span> and <span class="font-mono">espeak-ng</span>.
                </template>
              </p>
              <template v-if="piperAvailable && !allHdVoicesDownloaded">
                <v-btn
                  v-if="!downloadingHdVoices"
                  variant="flat"
                  size="x-small"
                  class="text-none bg-[#FFFFFF22] text-white shrink-0"
                  @click="promptDownloadHdVoices"
                >
                  Download higher-quality voices
                </v-btn>
                <div v-else class="flex items-center gap-x-2 shrink-0">
                  <div class="w-[220px]">
                    <v-progress-linear :model-value="hdDownloadPercent" height="4" color="white" rounded />
                    <p class="text-xs opacity-70 mt-1 text-center leading-none">
                      {{ hdDownloadProgress.completed }} of {{ hdDownloadProgress.total }} voices
                    </p>
                  </div>
                  <v-btn
                    variant="flat"
                    size="x-small"
                    class="text-none bg-[#FFFFFF22] text-white"
                    @click="cancelHdVoiceDownload"
                  >
                    Cancel
                  </v-btn>
                </div>
              </template>
              <v-btn
                v-if="piperAvailable && hasDownloadedHdVoices && !downloadingHdVoices"
                variant="flat"
                size="x-small"
                class="text-none bg-[#FFFFFF22] text-white shrink-0 ml-auto"
                @click="promptDeleteHdVoices"
              >
                Remove higher-quality voices
              </v-btn>
            </div>
            <v-checkbox
              v-if="piperAvailable && hasOsVoices"
              :model-value="showOsVoices"
              :label="osVoicesLabel"
              hide-details
              color="white"
              class="ml-2"
              @update:model-value="setShowOsVoices"
            />
          </template>
        </ExpansiblePanel>
        <!-- Armed Menu Warning Toggle -->
        <v-switch
          :model-value="!alertStore.neverShowArmedMenuWarning"
          label="Show warning when opening menu with armed vehicle"
          color="white"
          class="mt-3 mb-2 ml-3"
          hide-details
          @update:model-value="setShowArmedMenuWarning"
        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { capitalize, computed } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useTextToSpeech } from '@/composables/useTextToSpeech'
import { hostOsName } from '@/libs/utils'
import { useAlertStore } from '@/stores/alert'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const alertStore = useAlertStore()
const { showDialog, closeDialog } = useInteractionDialog()
const {
  voiceOptions,
  selectedVoiceId,
  piperAvailable,
  voiceListSettled,
  showOsVoices,
  hasOsVoices,
  allHdVoicesDownloaded,
  hasDownloadedHdVoices,
  downloadingHdVoices,
  hdDownloadProgress,
  speak,
  downloadHdVoices,
  cancelHdVoicesDownload,
  deleteHdVoices,
} = useTextToSpeech()

const hostOs = hostOsName()
const osVoicesLabel = `Also list ${hostOs ?? "this computer's"} default speech voices`

const hdDownloadPercent = computed(() => {
  const { completed, total, voiceProgress } = hdDownloadProgress.value
  return total > 0 ? ((completed + voiceProgress) / total) * 100 : 0
})

const setVoiceAlertsEnabled = (value: boolean | null): void => {
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} voice alerts`)
  alertStore.enableVoiceAlerts = enabled
}

const setAlertLevelEnabled = (level: string, value: boolean | null): void => {
  const enabledLevel = alertStore.enabledAlertLevels.find((item) => item.level === level)
  if (!enabledLevel) return
  const enabled = value ?? false
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} '${level}' alert level`)
  enabledLevel.enabled = enabled
}

const setAlertVoice = (value: unknown): void => {
  logUserAction(`Set alert voice to '${value}'`)
  selectedVoiceId.value = value as string
  if (alertStore.alertVolume === 0) {
    openSnackbar({ message: 'Voice set. Raise the alerts volume to hear it.', variant: 'info', duration: 5000 })
    return
  }
  void speak('Voice alerts will sound like this.', alertStore.alertVolume)
}

const setShowOsVoices = (value: boolean | null): void => {
  const show = value ?? false
  logUserAction(`${show ? 'Showed' : 'Hid'} the ${hostOs ?? 'host'} default TTS voices`)
  showOsVoices.value = show
}

const setShowArmedMenuWarning = (value: boolean | null): void => {
  const show = value ?? false
  logUserAction(`${show ? 'Enabled' : 'Disabled'} armed-vehicle menu warning`)
  alertStore.neverShowArmedMenuWarning = !show
}

const downloadOutcomes = {
  ok: { message: 'Higher-quality voices downloaded.', variant: 'success' },
  cancelled: { message: 'Higher-quality voices download cancelled.', variant: 'info' },
  failed: { message: 'Could not download all voices. Check your internet connection and try again.', variant: 'error' },
  busy: { message: 'A voice download is already running.', variant: 'info' },
} as const

const startHdVoiceDownload = async (): Promise<void> => {
  const result = await downloadHdVoices()
  // Undefined means a second press never started a download, which is not a failure to report.
  if (result === undefined) return
  openSnackbar({ ...downloadOutcomes[result], duration: 5000 })
}

const cancelHdVoiceDownload = (): void => {
  logUserAction('Cancelled the higher-quality voices download in progress')
  cancelHdVoicesDownload()
}

const promptDownloadHdVoices = (): void => {
  logUserAction('Opened the higher-quality voices download dialog')
  showDialog({
    title: 'Download higher-quality voices',
    variant: 'info',
    maxWidth: 520,
    message: [
      'Downloads four higher-quality neural voices: Amy and Lessac (female), Ryan and Joe (male).',
      'This transfers about 250 MB and uses roughly the same amount of disk space. The voices then work offline.',
    ],
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction('Cancelled the higher-quality voices download')
          closeDialog()
        },
      },
      {
        text: 'Download',
        class: 'bg-[#FFFFFF33] text-white',
        action: () => {
          logUserAction('Confirmed the higher-quality voices download')
          closeDialog()
          void startHdVoiceDownload()
        },
      },
    ],
  })
}

const removeHdVoices = async (): Promise<void> => {
  const success = await deleteHdVoices()
  openSnackbar({
    message: success ? 'Higher-quality voices removed.' : 'Could not remove the downloaded voices.',
    variant: success ? 'success' : 'error',
    duration: 5000,
  })
}

const promptDeleteHdVoices = (): void => {
  logUserAction('Opened the remove higher-quality voices dialog')
  showDialog({
    title: 'Remove higher-quality voices',
    variant: 'warning',
    maxWidth: 520,
    message: [
      'Delete the downloaded higher-quality voices and free up their disk space?',
      'Amy reverts to the built-in voice, and the others are removed until downloaded again.',
    ],
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction('Cancelled removing the higher-quality voices')
          closeDialog()
        },
      },
      {
        text: 'Remove',
        class: 'bg-[#FFFFFF33] text-white',
        action: () => {
          logUserAction('Confirmed removing the higher-quality voices')
          closeDialog()
          void removeHdVoices()
        },
      },
    ],
  })
}
</script>
