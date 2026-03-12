<template>
  <BaseConfigurationView>
    <template #title>Data Logs</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-4"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <ExpansiblePanel :is-expanded="true" no-top-divider>
          <template #title>
            <div class="flex justify-between items-center w-full">
              <span>Data Sessions</span>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-300 cursor-pointer" @click.stop="refreshSessions">
                  <v-tooltip text="Refresh sessions">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" :class="{ 'animate-spin': isLoading }">mdi-refresh</v-icon>
                    </template>
                  </v-tooltip>
                </span>
                <span class="text-sm text-gray-300 cursor-pointer" @click.stop="deleteOldSessions">
                  <v-tooltip text="Delete sessions older than 24 hours">
                    <template #activator="{ props }">
                      <v-icon v-bind="props">mdi-delete-sweep</v-icon>
                    </template>
                  </v-tooltip>
                </span>
              </div>
            </div>
          </template>
          <template #info>
            Vehicle data is continuously logged while Cockpit is open. Download session logs in JSON or CSV format for
            analysis. <br /><br />
            <strong>Logged variables:</strong> Roll, Pitch, Heading, Depth, Mode, Battery voltage, Battery current, GPS
            satellites, GPS status, Latitude, Longitude, Mission name, Time, Date, Instantaneous power, plus any values
            displayed on Very Generic Indicators.
          </template>
          <template #content>
            <div v-if="isLoading" class="flex justify-center items-center py-8">
              <v-progress-circular indeterminate color="white" />
            </div>
            <div v-else-if="sessions.length === 0" class="text-center py-8 text-gray-400">
              No data sessions found. Data is recorded automatically while Cockpit is connected to a vehicle.
            </div>
            <v-data-table
              v-else
              :items="sessions"
              density="compact"
              theme="dark"
              :headers="headers"
              class="w-full max-h-[60%] rounded-md bg-[#FFFFFF11]"
            >
              <template #item.dateTimeFormatted="{ item }">
                <div class="flex items-center gap-2">
                  <span>{{ item.dateTimeFormatted }}</span>
                  <div v-if="item.isCurrentSession" class="current-session-indicator" />
                </div>
              </template>
              <template #item.dataPointCount="{ item }"> {{ item.dataPointCount.toLocaleString() }} points </template>
              <template #item.durationSeconds="{ item }">
                {{ formatDuration(item.durationSeconds) }}
              </template>
              <template #item.actions="{ item }">
                <div class="flex justify-center space-x-2">
                  <v-menu>
                    <template #activator="{ props }">
                      <div
                        v-bind="props"
                        class="cursor-pointer icon-btn mdi mdi-download"
                        :class="{ 'opacity-50': isDownloading === item.id }"
                      />
                    </template>
                    <v-list density="compact" class="bg-[#333]">
                      <v-list-item @click="downloadSession(item, 'json')">
                        <v-list-item-title class="flex items-center gap-2">
                          <v-icon size="small">mdi-code-json</v-icon>
                          Download as JSON
                        </v-list-item-title>
                      </v-list-item>
                      <v-list-item @click="downloadSession(item, 'csv')">
                        <v-list-item-title class="flex items-center gap-2">
                          <v-icon size="small">mdi-file-delimited</v-icon>
                          Download as CSV
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                  <div
                    class="cursor-pointer icon-btn mdi mdi-delete"
                    :class="{ 'opacity-50 pointer-events-none': item.isCurrentSession }"
                    @click="!item.isCurrentSession && deleteSession(item)"
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
// TODO: As of now Vuetify does not export the necessary types for VDataTable, so we can't fix the type error.

import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { onBeforeMount, onBeforeUnmount, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import { type DataSessionInfo, DataLogger, datalogger } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const sessions = ref<DataSessionInfo[]>([])
const isLoading = ref(false)
const isDownloading = ref<string | null>(null)
let refreshInterval: ReturnType<typeof setInterval> | null = null

const headers = [
  { title: 'Date/Time', key: 'dateTimeFormatted', sortable: true },
  { title: 'Data Points', key: 'dataPointCount', sortable: true },
  { title: 'Duration', key: 'durationSeconds', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false },
]

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const refreshSessions = async (): Promise<void> => {
  isLoading.value = true
  try {
    sessions.value = await DataLogger.getDataSessions()
  } catch (error) {
    console.error('Error loading data sessions:', error)
    openSnackbar({ message: 'Failed to load data sessions', variant: 'error' })
  } finally {
    isLoading.value = false
  }
}

// Light refresh that only updates the current session's data point count
const lightRefresh = async (): Promise<void> => {
  try {
    const updatedSessions = await DataLogger.getDataSessions()
    // Only update if we have sessions
    if (updatedSessions.length > 0 && sessions.value.length > 0) {
      // Find and update the current session
      const currentSession = updatedSessions.find((s) => s.isCurrentSession)
      if (currentSession) {
        const index = sessions.value.findIndex((s) => s.isCurrentSession)
        if (index !== -1) {
          sessions.value[index] = currentSession
        } else {
          // Current session is new, do a full refresh
          sessions.value = updatedSessions
        }
      }
    } else {
      sessions.value = updatedSessions
    }
  } catch (error) {
    // Silently fail on light refresh
  }
}

onBeforeMount(async () => {
  await refreshSessions()
  // Refresh current session info every 5 seconds
  refreshInterval = setInterval(lightRefresh, 5000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

const downloadSession = async (session: DataSessionInfo, formatType: 'json' | 'csv'): Promise<void> => {
  if (isDownloading.value) return

  isDownloading.value = session.id
  try {
    openSnackbar({ message: 'Generating log file...', variant: 'info', duration: 2000 })

    const log = await DataLogger.generateLogFromSession(session)

    if (log.length === 0) {
      openSnackbar({ message: 'No data points found in session', variant: 'warning' })
      return
    }

    let content: string
    let mimeType: string
    let extension: string

    if (formatType === 'json') {
      content = datalogger.toJson(log)
      mimeType = 'application/json'
      extension = 'json'
    } else {
      content = datalogger.toCsv(log)
      mimeType = 'text/csv'
      extension = 'csv'
    }

    const blob = new Blob([content], { type: mimeType })
    const dateStr = format(new Date(session.startTime), 'yyyy-MM-dd_HH-mm-ss')
    const fileName = `Cockpit_Data_Log_${dateStr}.${extension}`
    saveAs(blob, fileName)

    openSnackbar({ message: `Downloaded ${fileName}`, variant: 'success' })
  } catch (error) {
    console.error('Error downloading session:', error)
    openSnackbar({ message: 'Failed to download session', variant: 'error' })
  } finally {
    isDownloading.value = null
  }
}

const deleteSession = async (session: DataSessionInfo): Promise<void> => {
  if (session.isCurrentSession) {
    openSnackbar({ message: 'Cannot delete the current active session', variant: 'warning' })
    return
  }

  try {
    await DataLogger.deleteDataSession(session)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    openSnackbar({ message: 'Session deleted', variant: 'success' })
  } catch (error) {
    console.error('Error deleting session:', error)
    openSnackbar({ message: 'Failed to delete session', variant: 'error' })
  }
}

const deleteOldSessions = async (): Promise<void> => {
  try {
    const deletedCount = await DataLogger.deleteOldDataSessions(1)
    if (deletedCount > 0) {
      await refreshSessions()
      openSnackbar({ message: `Deleted ${deletedCount} old session(s)`, variant: 'success' })
    } else {
      openSnackbar({ message: 'No old sessions to delete', variant: 'info' })
    }
  } catch (error) {
    console.error('Error deleting old sessions:', error)
    openSnackbar({ message: 'Failed to delete old sessions', variant: 'error' })
  }
}
</script>

<style scoped>
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
