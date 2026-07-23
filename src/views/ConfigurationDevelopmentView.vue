<template>
  <BaseConfigurationView>
    <template #title>{{ $t('Development configuration') }}</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-2 mb-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <div
          class="flex flex-col justify-between items-center w-full"
          :class="interfaceStore.isOnSmallScreen ? 'scale-[80%] mt-0 -mb-3' : 'scale-95 mt-4'"
        >
          <div class="flex flex-row flex-wrap justify-start gap-x-[20px]">
            <v-switch
              v-model="devStore.developmentMode"
              :label="$t('Development mode')"
              color="white"
              hide-details
              class="min-w-[155px]"
            />
            <v-switch
              :model-value="devStore.enableBlueOsSettingsSync"
              :label="$t('BlueOS settings sync')"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="onToggleBlueOsSettingsSync"
            />
            <v-switch
              :model-value="devStore.enableSystemLogging"
              :label="$t('Enable system logging')"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="onToggleSystemLogging"
            />
            <v-switch
              :model-value="devStore.showSplashScreenOnStartup"
              :label="$t('Show splashscreen on startup')"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="onToggleSplashScreen"
            />
          </div>
        </div>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-bottom-divider>
          <template #title>
            <div class="flex justify-between items-center">
              <span>{{ $t('System logs') }}</span>
              <div class="flex items-center gap-2">
                <span
                  v-if="hasSelection"
                  class="text-sm text-gray-300 cursor-pointer flex items-center gap-1"
                  :class="{ 'opacity-50 pointer-events-none': isDownloadingZip }"
                  @click.stop="downloadSelectedLogs"
                >
                  <v-tooltip :text="$t('Download selected logs as ZIP')">
                    <template #activator="{ props }">
                      <v-icon v-bind="props">mdi-download-multiple</v-icon>
                    </template>
                  </v-tooltip>
                  <span>({{ selectedLogNames.length }})</span>
                </span>
                <span
                  v-if="hasSelection"
                  class="text-sm text-gray-300 cursor-pointer mr-[10px]"
                  :class="{ 'opacity-50 pointer-events-none': isDeletingBatch }"
                  @click.stop="deleteSelectedLogs"
                >
                  <v-tooltip :text="$t('Delete selected logs')">
                    <template #activator="{ props }">
                      <v-icon v-bind="props">mdi-delete-sweep</v-icon>
                    </template>
                  </v-tooltip>
                </span>
                <v-btn
                  variant="outlined"
                  color="white"
                  size="small"
                  prepend-icon="mdi-console-line"
                  :disabled="hasSelection"
                  @click.stop="openConsole"
                >
                  {{ $t('Open console') }}
                </v-btn>
                <span
                  class="text-sm text-gray-300 cursor-pointer"
                  :class="{ 'opacity-50 pointer-events-none': hasSelection }"
                  @click.stop="deleteOldLogs"
                >
                  <v-tooltip :text="$t('Delete old logs')">
                    <template #activator="{ props }">
                      <v-icon left class="mr-2" v-bind="props">mdi-delete-clock</v-icon>
                    </template>
                  </v-tooltip>
                </span>
              </div>
            </div>
          </template>
          <template #content>
            <v-data-table
              v-model="selectedLogNames"
              :items="systemLogsData"
              item-value="name"
              show-select
              density="compact"
              theme="dark"
              :headers="headers"
              class="bg-[#FFFFFF11] rounded-lg"
            >
              <template #item.dateTimeMs="{ item }">
                <div class="flex items-center gap-2">
                  <span>{{ item.dateTimeFormatted }}</span>
                  <div v-if="item.isCurrentSession" class="current-session-indicator" />
                </div>
              </template>
              <template #item.sizeBytes="{ item }">
                {{ item.sizeFormatted }}
              </template>
              <template #item.actions="{ item }">
                <div class="flex justify-center space-x-2">
                  <div
                    class="cursor-pointer icon-btn mdi mdi-download"
                    :class="{ 'opacity-50 pointer-events-none': hasSelection }"
                    @click="!hasSelection && downloadLog(item.name)"
                  />
                  <div
                    class="cursor-pointer icon-btn mdi mdi-delete"
                    :class="{ 'opacity-50 pointer-events-none': hasSelection }"
                    @click="!hasSelection && deleteLog(item.name)"
                  />
                </div>
              </template>
            </v-data-table>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
// @ts-nocheck
// TODO:  As of now Vuetify does not export the necessary types for VDataTable, so we can't fix the type error.

import { format, parse } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  type SystemLog,
  cockpitSytemLogsDB,
  getCurrentSessionLogFileName,
  getCurrentSessionLogInfo,
  systemLogDateTimeFormat,
} from '@/libs/system-logging'
import { formatBytes, isElectron } from '@/libs/utils'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { type ZipFileEntry, createZipBlob } from '@/libs/zip'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'
const { t } = useI18n()
const devStore = useDevelopmentStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const onToggleBlueOsSettingsSync = (value: boolean | null): void => {
  devStore.enableBlueOsSettingsSync = Boolean(value)
  logUserAction(`${value ? 'Enabled' : 'Disabled'} BlueOS settings sync`)
  reloadCockpitAndWarnUser()
}

const onToggleSystemLogging = (value: boolean | null): void => {
  devStore.enableSystemLogging = Boolean(value)
  logUserAction(`${value ? 'Enabled' : 'Disabled'} system logging`)
  reloadCockpitAndWarnUser()
}

const onToggleSplashScreen = (value: boolean | null): void => {
  devStore.showSplashScreenOnStartup = Boolean(value)
  logUserAction(`${value ? 'Enabled' : 'Disabled'} splash screen on startup`)
}

const openConsole = (): void => {
  logUserAction('Opened system console')
  devStore.showConsole = true
}

/* eslint-disable jsdoc/require-jsdoc */
interface SystemLogsData {
  name: string
  dateTimeFormatted: string
  sizeFormatted: string
  sizeBytes: number
  dateTimeMs: number
  isCurrentSession: boolean
}
/* eslint-enable jsdoc/require-jsdoc */

const systemLogsData = ref<SystemLogsData[]>([])
const isRunningInElectron = isElectron()
const currentSessionLogFileName = ref<string | null>(null)
const selectedLogNames = ref<string[]>([])
const isDownloadingZip = ref(false)
const isDeletingBatch = ref(false)
let updateInterval: ReturnType<typeof setInterval> | null = null

// While a selection is active, only the batch actions stay usable.
const hasSelection = computed(() => selectedLogNames.value.length > 0)

/* eslint-disable jsdoc/require-jsdoc */
interface CurrentLogInfo {
  fileName: string
  size: number
}
/* eslint-enable jsdoc/require-jsdoc */

const headers = [
  { title: t('Date/Time'), key: 'dateTimeMs', sortable: true },
  { title: t('Size'), key: 'sizeBytes', sortable: true },
  { title: t('Actions'), key: 'actions', sortable: false },
]

const updateCurrentSessionLogSize = async (): Promise<void> => {
  if (!currentSessionLogFileName.value) {
    return
  }

  try {
    let logInfo: CurrentLogInfo | null = null

    if (isRunningInElectron) {
      // Get current log info (name and size) directly
      logInfo = (await window.electronAPI?.getCurrentElectronLogInfo()) ?? null
    } else {
      // Get current log info from IndexedDB
      logInfo = await getCurrentSessionLogInfo()
    }

    if (logInfo && logInfo.fileName === currentSessionLogFileName.value) {
      // Update the size in systemLogsData
      const index = systemLogsData.value.findIndex((log) => log.name === currentSessionLogFileName.value)
      if (index !== -1) {
        systemLogsData.value[index].sizeBytes = logInfo.size
        if (isRunningInElectron) {
          systemLogsData.value[index].sizeFormatted = formatBytes(logInfo.size)
        } else {
          // For web version, show event count
          systemLogsData.value[index].sizeFormatted = `${logInfo.size} event${logInfo.size !== 1 ? 's' : ''}`
        }
      }
    }
  } catch (error) {
    // Silently fail - don't spam console with errors
  }
}

onBeforeMount(async () => {
  // Get the current session's log file name
  if (isRunningInElectron) {
    const logInfo = await window.electronAPI?.getCurrentElectronLogInfo()
    currentSessionLogFileName.value = logInfo?.fileName ?? null
    await loadElectronLogs()
  } else {
    currentSessionLogFileName.value = getCurrentSessionLogFileName()
    await loadIndexedDBLogs()
  }

  // Start updating the current session log size every second
  updateInterval = setInterval(updateCurrentSessionLogSize, 1000)
})

onBeforeUnmount(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
})

const loadElectronLogs = async (): Promise<void> => {
  try {
    const electronLogs = await window.electronAPI?.getElectronLogs()
    if (electronLogs) {
      const dateTimeFormatWithoutOffset = systemLogDateTimeFormat.replace(' O', '')
      const logs = electronLogs.map((log) => {
        const dateTimeString = log.path.split('(')[1]?.split(' GMT')[0] ?? ''
        const dateTime = parse(dateTimeString, dateTimeFormatWithoutOffset, new Date())
        return {
          name: log.path,
          dateTimeFormatted: `${log.initialDate} - ${log.initialTime}`,
          sizeFormatted: formatBytes(log.size),
          sizeBytes: log.size,
          dateTimeMs: dateTime.getTime(),
          isCurrentSession: log.path === currentSessionLogFileName.value,
        }
      })
      systemLogsData.value = getSortedLogs(logs)
    }
  } catch (error) {
    console.error('Error loading electron logs:', error)
  }
}

const loadIndexedDBLogs = async (): Promise<void> => {
  const logs: SystemLogsData[] = []
  const dateTimeFormatWithoutOffset = systemLogDateTimeFormat.replace(' O', '')
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName) => {
    // Use event count for web version (lighter than estimating size)
    const eventCount = log.events.length
    const dateTimeString = logName.split('(')[1]?.split(' GMT')[0] ?? ''
    const dateTime = parse(dateTimeString, dateTimeFormatWithoutOffset, new Date())
    logs.push({
      name: logName,
      dateTimeFormatted: `${log.initialDate} - ${log.initialTime}`,
      sizeFormatted: `${eventCount} event${eventCount !== 1 ? 's' : ''}`,
      sizeBytes: eventCount, // Use event count for sorting
      dateTimeMs: dateTime.getTime(),
      isCurrentSession: logName === currentSessionLogFileName.value,
    })
  })
  systemLogsData.value = getSortedLogs(logs)
}

const getSortedLogs = (logs: SystemLogsData[]): SystemLogsData[] => {
  return logs.sort((a, b) => b.dateTimeMs - a.dateTimeMs)
}

const getLogBlob = async (logName: string): Promise<Blob> => {
  if (isRunningInElectron) {
    const content = await window.electronAPI?.getElectronLogContent(logName)
    if (!content) {
      throw new Error('Failed to get electron log content')
    }
    return new Blob([content], { type: 'text/plain' })
  }

  const log = await cockpitSytemLogsDB.getItem(logName)
  return new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
}

const downloadLog = async (logName: string): Promise<void> => {
  logUserAction(`Downloaded system log '${logName}'`)
  try {
    saveAs(await getLogBlob(logName), logName)
    openSnackbar({ message: `${t('Downloaded')} ${logName}`, variant: 'success' })
  } catch (error) {
    openSnackbar({ message: t('Failed to download log'), variant: 'error' })
  }
}

const downloadSelectedLogs = async (): Promise<void> => {
  if (isDownloadingZip.value) return

  const selectedNames = [...selectedLogNames.value]
  if (selectedNames.length === 0) return

  logUserAction(`Downloaded ${selectedNames.length} system logs as ZIP`)
  isDownloadingZip.value = true
  try {
    const entries: ZipFileEntry[] = []
    for (const logName of selectedNames) {
      try {
        entries.push({ name: logName, blob: await getLogBlob(logName) })
      } catch (error) {
        console.error(`Error reading system log '${logName}':`, error)
      }
    }

    if (entries.length === 0) {
      openSnackbar({ message: t('No logs could be read'), variant: 'warning' })
      return
    }

    const zipBlob = await createZipBlob(entries)
    const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
    const fileName = `Cockpit_System_Logs_${dateStr}.zip`
    saveAs(zipBlob, fileName)
    openSnackbar({ message: `Downloaded ${fileName}`, variant: 'success' })
    selectedLogNames.value = []
  } catch (error) {
    openSnackbar({ message: t('Failed to download selected logs'), variant: 'error' })
  } finally {
    isDownloadingZip.value = false
  }
}

const deleteLog = async (logName: string): Promise<void> => {
  logUserAction(`Deleted system log '${logName}'`)
  try {
    if (isRunningInElectron) {
      // Delete from electron-log
      await window.electronAPI?.deleteElectronLog(logName)
      systemLogsData.value = systemLogsData.value.filter((log) => log.name !== logName)
    } else {
      // Delete from IndexedDB
      await cockpitSytemLogsDB.removeItem(logName)
      systemLogsData.value = systemLogsData.value.filter((log) => log.name !== logName)
    }
  } catch (error) {
    console.error('Error deleting log:', error)
  }
}

const deleteSelectedLogs = async (): Promise<void> => {
  if (isDeletingBatch.value) return

  const selectedNames = [...selectedLogNames.value]
  if (selectedNames.length === 0) return

  logUserAction(`Deleted ${selectedNames.length} system logs`)
  isDeletingBatch.value = true
  try {
    const deletedNames: string[] = []
    for (const logName of selectedNames) {
      try {
        if (isRunningInElectron) {
          await window.electronAPI?.deleteElectronLog(logName)
        } else {
          await cockpitSytemLogsDB.removeItem(logName)
        }
        deletedNames.push(logName)
      } catch (error) {
        console.error(`Error deleting system log '${logName}':`, error)
      }
    }
    // Only drop the logs that were actually deleted, leaving any that failed selected for a retry.
    systemLogsData.value = systemLogsData.value.filter((log) => !deletedNames.includes(log.name))
    selectedLogNames.value = selectedLogNames.value.filter((name) => !deletedNames.includes(name))
  } finally {
    isDeletingBatch.value = false
  }
}

const deleteOldLogs = async (): Promise<void> => {
  logUserAction('Deleted old system logs')
  try {
    if (isRunningInElectron) {
      // Delete old logs from electron-log
      const deletedFiles = await window.electronAPI?.deleteOldElectronLogs()
      if (deletedFiles) {
        systemLogsData.value = systemLogsData.value.filter((log) => !deletedFiles.includes(log.name))
      }
    } else {
      await deleteOldLogsFromDB()
    }
  } catch (error) {
    console.error('Error deleting old logs:', error)
  }
}

const deleteOldLogsFromDB = async (): Promise<void> => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const logsToDelete: string[] = []
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName: string) => {
    const logDate = new Date(log.initialDate)
    if (logDate < yesterday) {
      logsToDelete.push(logName)
    }
  })

  for (const logName of logsToDelete) {
    await cockpitSytemLogsDB.removeItem(logName)
  }

  systemLogsData.value = systemLogsData.value.filter((log) => {
    const logDate = new Date(log.initialDate)
    return logDate >= yesterday
  })
}
</script>
<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}

.current-session-indicator {
  width: 8px;
  height: 8px;
  margin-top: 2px;
  border-radius: 50%;
  background-color: #ef4444;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
