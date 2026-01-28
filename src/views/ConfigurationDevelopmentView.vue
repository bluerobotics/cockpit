<template>
  <BaseConfigurationView>
    <template #title>Development configuration</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-2 mb-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <div
          class="flex flex-col justify-between items-center w-full"
          :class="interfaceStore.isOnSmallScreen ? 'scale-[80%] mt-0 -mb-3' : 'scale-95 mt-4'"
        >
          <div class="flex flex-row gap-x-[40px]">
            <v-switch
              v-model="devStore.developmentMode"
              label="Development mode"
              color="white"
              hide-details
              class="min-w-[155px]"
            />
            <v-switch
              v-model="devStore.enableBlueOsSettingsSync"
              label="BlueOS settings sync"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
            <v-switch
              v-model="devStore.enableUsageStatisticsTelemetry"
              label="Usage statistics telemetry"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
            <v-switch
              v-model="devStore.enableSystemLogging"
              label="Enable system logging"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
          </div>
          <div class="flex flex-row w-full justify-start gap-x-[40px]">
            <v-switch
              v-model="devStore.showSplashScreenOnStartup"
              label="Show splashscreen on startup"
              color="white"
              hide-details
              class="min-w-[155px]"
            />
          </div>
          <v-slider
            v-model="devStore.widgetDevInfoBlurLevel"
            label="Dev info blur level"
            min="0"
            max="10"
            class="w-[350px]"
            color="white"
            step="1"
            thumb-label="hover"
          />
        </div>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-bottom-divider>
          <template #title>
            <div class="flex justify-between">
              <span>System logs</span>
              <span class="text-sm text-gray-300 cursor-pointer" @click.stop="deleteOldLogs">
                <v-tooltip text="Delete old logs">
                  <template #activator="{ props }">
                    <v-icon left class="mr-2" v-bind="props">mdi-delete-sweep</v-icon>
                  </template>
                </v-tooltip>
              </span>
            </div>
          </template>
          <template #content>
            <v-data-table
              :items="systemLogsData"
              density="compact"
              theme="dark"
              :headers="headers"
              class="bg-[#FFFFFF11] rounded-lg"
            >
              <template #item.name="{ item }">
                <div class="flex items-center gap-2">
                  <span>{{ item.name }}</span>
                  <div v-if="item.isCurrentSession" class="current-session-indicator" />
                </div>
              </template>
              <template #item.dateTimeMs="{ item }">
                {{ item.dateTimeFormatted }}
              </template>
              <template #item.sizeBytes="{ item }">
                {{ item.sizeFormatted }}
              </template>
              <template #item.actions="{ item }">
                <div class="flex justify-center space-x-2">
                  <div class="cursor-pointer icon-btn mdi mdi-download" @click="downloadLog(item.name)" />
                  <div class="cursor-pointer icon-btn mdi mdi-delete" @click="deleteLog(item.name)" />
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

import { parse } from 'date-fns'
import { saveAs } from 'file-saver'
import { onBeforeMount, onBeforeUnmount } from 'vue'
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import {
  type SystemLog,
  cockpitSytemLogsDB,
  getCurrentSessionLogFileName,
  getCurrentSessionLogInfo,
  systemLogDateTimeFormat,
} from '@/libs/system-logging'
import { formatBytes, isElectron } from '@/libs/utils'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'
const devStore = useDevelopmentStore()
const interfaceStore = useAppInterfaceStore()

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
let updateInterval: ReturnType<typeof setInterval> | null = null

/* eslint-disable jsdoc/require-jsdoc */
interface CurrentLogInfo {
  fileName: string
  size: number
}
/* eslint-enable jsdoc/require-jsdoc */

const headers = [
  { title: 'Name', key: 'name', sortable: false },
  { title: 'Date/Time', key: 'dateTimeMs', sortable: true },
  { title: 'Size', key: 'sizeBytes', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false },
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

const downloadLog = async (logName: string): Promise<void> => {
  try {
    if (isRunningInElectron) {
      await downloadLogFromElectron(logName)
    } else {
      await downloadLogFromDB(logName)
    }
  } catch (error) {
    console.error('Error downloading log:', error)
  }
}

const downloadLogFromElectron = async (logName: string): Promise<void> => {
  try {
    const content = await window.electronAPI?.getElectronLogContent(logName)
    if (!content) {
      throw new Error('Failed to get electron log content')
    }

    const logBlob = new Blob([content], { type: 'text/plain' })
    saveAs(logBlob, logName)
  } catch (error) {
    console.error('Error downloading electron log:', error)
    throw error
  }
}

const downloadLogFromDB = async (logName: string): Promise<void> => {
  const log = await cockpitSytemLogsDB.getItem(logName)
  const logParts = JSON.stringify(log, null, 2)
  const logBlob = new Blob([logParts], { type: 'application/json' })
  saveAs(logBlob, logName)
}

const deleteLog = async (logName: string): Promise<void> => {
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

const deleteOldLogs = async (): Promise<void> => {
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
