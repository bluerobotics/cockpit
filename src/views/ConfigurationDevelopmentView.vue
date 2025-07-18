<template>
  <BaseConfigurationView>
    <template #title>Development configuration</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-4"
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
              @update:model-value="reloadCockpit"
            />
            <v-switch
              v-model="devStore.enableUsageStatisticsTelemetry"
              label="Usage statistics telemetry"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpit"
            />
            <v-switch
              v-model="devStore.enableSystemLogging"
              label="Enable system logging"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpit"
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
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
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
              class="w-full max-h-[60%] rounded-md bg-[#FFFFFF11]"
            >
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
import { onBeforeMount } from 'vue'
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { type SystemLog, cockpitSytemLogsDB, systemLogDateTimeFormat } from '@/libs/system-logging'
import { isElectron, reloadCockpit } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'
const devStore = useDevelopmentStore()
const interfaceStore = useAppInterfaceStore()

/* eslint-disable jsdoc/require-jsdoc */
interface SystemLogsData {
  name: string
  initialTime: string
  initialDate: string
  nEvents: number
}
/* eslint-enable jsdoc/require-jsdoc */

const systemLogsData = ref<SystemLogsData[]>([])
const isRunningInElectron = isElectron()

const headers = [
  { title: 'Name', value: 'name' },
  { title: 'Time (initial)', value: 'initialTime' },
  { title: 'Date (initial)', value: 'initialDate' },
  { title: 'events', value: 'nEvents' },
  { title: 'Download', value: 'actions' },
]

onBeforeMount(async () => {
  if (isRunningInElectron) {
    await loadElectronLogs()
  } else {
    await loadIndexedDBLogs()
  }
})

const loadElectronLogs = async (): Promise<void> => {
  try {
    const electronLogs = await window.electronAPI?.getElectronLogs()
    if (electronLogs) {
      const logs = electronLogs.map((log) => ({
        name: log.path,
        initialTime: log.initialTime,
        initialDate: log.initialDate,
        nEvents: log.content.split('\n').filter((line) => line.trim()).length,
      }))
      systemLogsData.value = getSortedLogs(logs)
    }
  } catch (error) {
    console.error('Error loading electron logs:', error)
  }
}

const loadIndexedDBLogs = async (): Promise<void> => {
  const logs = []
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName) => {
    logs.push({
      name: logName,
      initialTime: log.initialTime,
      initialDate: log.initialDate,
      nEvents: log.events.length,
    })
  })
  systemLogsData.value = getSortedLogs(logs)
}

const getSortedLogs = (logs: SystemLogsData[]): SystemLogsData[] => {
  return logs.sort((a, b) => {
    const dateTimeFormatWithoutOffset = systemLogDateTimeFormat.replace(' O', '')
    const stringDateTimeA = a.name.split('(')[1].split(' GMT')[0]
    const stringDateTimeB = b.name.split('(')[1].split(' GMT')[0]
    const dateTimeA = parse(stringDateTimeA, dateTimeFormatWithoutOffset, new Date())
    const dateTimeB = parse(stringDateTimeB, dateTimeFormatWithoutOffset, new Date())
    return dateTimeB.getTime() - dateTimeA.getTime()
  })
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
</style>
