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

import { saveAs } from 'file-saver'
import { onBeforeMount } from 'vue'
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { type SystemLog, cockpitSytemLogsDB } from '@/libs/system-logging'
import { reloadCockpit } from '@/libs/utils'
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

const headers = [
  { title: 'Name', value: 'name' },
  { title: 'Time (initial)', value: 'initialTime' },
  { title: 'Date (initial)', value: 'initialDate' },
  { title: 'events', value: 'nEvents' },
  { title: 'Download', value: 'actions' },
]

onBeforeMount(async () => {
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName) => {
    systemLogsData.value.push({
      name: logName,
      initialTime: log.initialTime,
      initialDate: log.initialDate,
      nEvents: log.events.length,
    })
  })
})

const downloadLog = async (logName: string): Promise<void> => {
  const log = await cockpitSytemLogsDB.getItem(logName)
  const logParts = JSON.stringify(log, null, 2)
  const logBlob = new Blob([logParts], { type: 'application/json' })
  saveAs(logBlob, logName)
}

const deleteLog = async (logName: string): Promise<void> => {
  await cockpitSytemLogsDB.removeItem(logName)
  systemLogsData.value = systemLogsData.value.filter((log) => log.name !== logName)
}

const deleteOldLogs = async (): Promise<void> => {
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
