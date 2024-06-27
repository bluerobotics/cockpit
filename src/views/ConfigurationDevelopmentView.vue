<template>
  <BaseConfigurationView>
    <template #title>Development configuration</template>
    <template #content>
      <v-switch v-model="devStore.developmentMode" label="Development mode" class="ma-2" color="rgb(0, 20, 80)" />
      <v-switch
        v-model="devStore.enableBlueOsSettingsSync"
        label="BlueOS settings sync"
        class="m-2"
        color="rgb(0, 20, 80)"
        @update:model-value="reloadCockpit"
      />
      <v-switch
        v-model="devStore.enableSystemLogging"
        label="Enable system logging"
        class="m-2"
        color="rgb(0, 20, 80)"
        @update:model-value="reloadCockpit"
      />
      <v-slider
        v-model="devStore.widgetDevInfoBlurLevel"
        label="Dev info blur level"
        min="0"
        max="10"
        class="ma-2 w-25"
        color="rgb(0, 20, 80)"
        step="1"
        thumb-label="always"
      />
      <v-data-table :items="systemLogsData" :headers="headers" class="max-w-[80%] max-h-[60%]">
        <template #item.actions="{ item }">
          <div class="text-center cursor-pointer icon-btn mdi mdi-download" @click="downloadLog(item.name)" />
        </template>
      </v-data-table>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
// @ts-nocheck
// TODO:  As of now Vuetify does not export the necessary types for VDataTable, so we can't fix the type error.

import { saveAs } from 'file-saver'
import { onBeforeMount } from 'vue'
import { ref } from 'vue'

import { type SystemLog, cockpitSytemLogsDB } from '@/libs/system-logging'
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'
const devStore = useDevelopmentStore()

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
  { title: 'N. events', value: 'nEvents' },
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

const reloadCockpit = (): void => location.reload()
</script>
