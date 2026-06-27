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
                <span class="text-sm text-gray-300 cursor-pointer" @click.stop="openExportSettingsDialog">
                  <v-tooltip text="Data export settings">
                    <template #activator="{ props }">
                      <v-icon v-bind="props" size="20">mdi-cog</v-icon>
                    </template>
                  </v-tooltip>
                </span>
              </div>
            </div>
          </template>
          <template #info>
            Raw data lake variables are recorded while Cockpit is running. Select which variables to record from the
            Data Lake table, then download session logs here in JSON or CSV format.
          </template>
          <template #content>
            <div v-if="isLoading" class="flex justify-center items-center py-8">
              <v-progress-circular indeterminate color="white" />
            </div>
            <div v-else-if="sessions.length === 0" class="text-center py-8 text-gray-400">
              No data sessions found. Select variables to record in the Data Lake table.
            </div>
            <v-data-table
              v-else
              :items="sessions"
              density="compact"
              theme="dark"
              :headers="headers"
              :row-props="rowProps"
              class="w-full max-h-[60%] rounded-md bg-[#FFFFFF11]"
            >
              <template #item.dateTimeFormatted="{ item }">
                <div class="flex items-center gap-2" :class="{ 'line-through': isDeleting(item) }">
                  <span>{{ item.dateTimeFormatted }}</span>
                  <div v-if="item.isCurrentSession" class="current-session-indicator" />
                </div>
              </template>
              <template #item.dataPointCount="{ item }">
                <span :class="{ 'line-through': isDeleting(item) }"
                  >{{ item.dataPointCount.toLocaleString() }} points</span
                >
              </template>
              <template #item.durationSeconds="{ item }">
                <span :class="{ 'line-through': isDeleting(item) }">{{ formatDuration(item.durationSeconds) }}</span>
              </template>
              <template #item.actions="{ item }">
                <div class="flex justify-end items-center space-x-2">
                  <v-progress-circular v-if="isDeleting(item)" indeterminate size="20" width="2" color="white" />
                  <template v-else>
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
                  </template>
                </div>
              </template>
            </v-data-table>
          </template>
        </ExpansiblePanel>
      </div>

      <v-dialog v-model="showSettingsDialog" max-width="460px">
        <v-card class="rounded-lg export-settings-card text-white" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="d-flex align-center py-4">
            <span class="text-h6 font-weight-bold">Data export settings</span>
            <v-spacer />
            <v-tooltip location="bottom" max-width="360px">
              <template #activator="{ props }">
                <v-icon v-bind="props" size="small">mdi-information-outline</v-icon>
              </template>
              <div class="text-caption">
                <p class="font-weight-bold mb-1">Column labels</p>
                <p class="mb-1">How each variable's column is named in the exported files.</p>
                <ul class="pl-4 mb-2">
                  <li><strong>Variable ID</strong> — full data-lake path (e.g. /mavlink/1/1/ATTITUDE/roll).</li>
                  <li><strong>Short variable ID</strong> — only the last segment (e.g. roll).</li>
                  <li><strong>Variable name</strong> — human-readable name (e.g. Roll).</li>
                </ul>
                <p class="mb-2">
                  If two variables would end up with the same label, both fall back to their full IDs so columns stay
                  unique.
                </p>
                <p class="font-weight-bold mb-1">Logging interval</p>
                <ul class="pl-4">
                  <li><strong>Raw</strong> — a row is recorded whenever any selected variable changes.</li>
                  <li><strong>Fixed interval</strong> — all selected variables are sampled every N milliseconds.</li>
                </ul>
              </div>
            </v-tooltip>
          </v-card-title>
          <v-card-text class="px-6">
            <p class="text-sm mb-1 font-weight-medium">Column labels</p>
            <p class="text-sm mb-2">How variable columns are labeled in CSV and JSON files.</p>
            <v-radio-group v-model="exportVariableKey" density="compact" hide-details>
              <v-radio label="Variable ID" value="id" />
              <v-radio label="Short variable ID" value="short-id" />
              <v-radio label="Variable name" value="name" />
            </v-radio-group>

            <p class="text-sm mt-5 mb-1 font-weight-medium">Logging interval</p>
            <p class="text-sm mb-2">How often selected variables are recorded.</p>
            <v-radio-group v-model="loggingMode" density="compact" hide-details>
              <v-radio label="Raw (record on every value change)" value="raw" />
              <div class="flex items-center gap-2">
                <v-radio label="Fixed interval" value="interval" />
                <v-text-field
                  v-model.number="intervalMs"
                  type="number"
                  density="compact"
                  hide-details
                  variant="underlined"
                  suffix="ms"
                  class="max-w-[120px]"
                  min="1"
                  :disabled="loggingMode !== 'interval'"
                />
              </div>
            </v-radio-group>
          </v-card-text>
          <v-divider class="mx-6" />
          <v-card-actions class="px-6 pb-4">
            <v-spacer />
            <v-btn variant="text" @click="showSettingsDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
// @ts-nocheck
// TODO: As of now Vuetify does not export the necessary types for VDataTable, so we can't fix the type error.

import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  type DataLakeExportVariableKey,
  type DataLakeSessionInfo,
  DataLakeLogger,
  dataLakeLogger,
} from '@/libs/data-lake-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const sessions = ref<DataLakeSessionInfo[]>([])
const showSettingsDialog = ref(false)
const exportVariableKey = ref<DataLakeExportVariableKey>(dataLakeLogger.exportVariableKey)
watch(exportVariableKey, (value) => {
  dataLakeLogger.exportVariableKey = value
})

const intervalMs = ref(typeof dataLakeLogger.logInterval === 'number' ? dataLakeLogger.logInterval : 1000)
const loggingMode = ref<'raw' | 'interval'>(dataLakeLogger.logInterval === 'raw' ? 'raw' : 'interval')
watch([loggingMode, intervalMs], () => {
  if (loggingMode.value === 'raw') {
    dataLakeLogger.logInterval = 'raw'
  } else if (intervalMs.value >= 1) {
    dataLakeLogger.logInterval = intervalMs.value
  }
})

const isLoading = ref(false)
const isDownloading = ref<string | null>(null)
const deletingSessionIds = ref<string[]>([])
let refreshInterval: ReturnType<typeof setInterval> | null = null

const isDeleting = (session: DataLakeSessionInfo): boolean => deletingSessionIds.value.includes(session.id)

/**
 * Argument Vuetify's data table passes to its `row-props` callback.
 */
interface SessionRowProps {
  /**
   * The session rendered by the row.
   */
  item: DataLakeSessionInfo
}

const rowProps = ({ item }: SessionRowProps): Record<string, string> => ({
  class: isDeleting(item) ? 'session-row--deleting' : '',
})

const headers = [
  { title: 'Date/Time', key: 'dateTimeFormatted', sortable: true },
  { title: 'Data Points', key: 'dataPointCount', sortable: true },
  { title: 'Duration', key: 'durationSeconds', sortable: true },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
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

const openExportSettingsDialog = (): void => {
  logUserAction('Opened data export settings')
  showSettingsDialog.value = true
}

const refreshSessions = async (): Promise<void> => {
  logUserAction('Refreshed data sessions list')
  isLoading.value = true
  try {
    sessions.value = await DataLakeLogger.getDataSessions()
  } catch (error) {
    openSnackbar({ message: 'Failed to load data sessions', variant: 'error' })
  } finally {
    isLoading.value = false
  }
}

// Background refresh: reads the lightweight sessions table, so a full reassignment is cheap and
// always reflects new/finalized sessions (e.g. after a mode change starts a fresh session).
const lightRefresh = async (): Promise<void> => {
  try {
    sessions.value = await DataLakeLogger.getDataSessions()
  } catch (error) {
    // Silently fail on background refresh
  }
}

onBeforeMount(async () => {
  await refreshSessions()
  refreshInterval = setInterval(lightRefresh, 1000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

const downloadSession = async (session: DataLakeSessionInfo, formatType: 'json' | 'csv'): Promise<void> => {
  if (isDownloading.value) return
  logUserAction(`Downloaded data session as ${formatType.toUpperCase()}`)

  isDownloading.value = session.id
  try {
    openSnackbar({ message: 'Generating log file...', variant: 'info', duration: 2000 })

    const log = await DataLakeLogger.generateLogFromSession(session)

    if (log.length === 0) {
      openSnackbar({ message: 'No data points found in session', variant: 'warning' })
      return
    }

    let content: string
    let mimeType: string
    let extension: string

    if (formatType === 'json') {
      content = dataLakeLogger.toJson(log)
      mimeType = 'application/json'
      extension = 'json'
    } else {
      content = dataLakeLogger.toCsv(log)
      mimeType = 'text/csv'
      extension = 'csv'
    }

    const blob = new Blob([content], { type: mimeType })
    const dateStr = format(new Date(session.startTime), 'yyyy-MM-dd_HH-mm-ss')
    const fileName = `Cockpit_Data_Log_${dateStr}.${extension}`
    saveAs(blob, fileName)

    openSnackbar({ message: `Downloaded ${fileName}`, variant: 'success' })
  } catch (error) {
    openSnackbar({ message: 'Failed to download session', variant: 'error' })
  } finally {
    isDownloading.value = null
  }
}

const deleteSession = async (session: DataLakeSessionInfo): Promise<void> => {
  if (session.isCurrentSession) {
    openSnackbar({ message: 'Cannot delete the current active session', variant: 'warning' })
    return
  }
  logUserAction('Deleted a data session')
  if (isDeleting(session)) return

  deletingSessionIds.value = [...deletingSessionIds.value, session.id]
  try {
    await DataLakeLogger.deleteDataSession(session)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    openSnackbar({ message: 'Session deleted', variant: 'success' })
  } catch (error) {
    openSnackbar({ message: 'Failed to delete session', variant: 'error' })
  } finally {
    deletingSessionIds.value = deletingSessionIds.value.filter((id) => id !== session.id)
  }
}

const deleteOldSessions = async (): Promise<void> => {
  logUserAction('Deleted data sessions older than 24 hours')
  try {
    const deletedCount = await DataLakeLogger.deleteOldDataSessions(1)
    if (deletedCount > 0) {
      await refreshSessions()
      openSnackbar({ message: `Deleted ${deletedCount} old session(s)`, variant: 'success' })
    } else {
      openSnackbar({ message: 'No old sessions to delete', variant: 'info' })
    }
  } catch (error) {
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

.session-row--deleting {
  opacity: 0.5;
}

.export-settings-card,
.export-settings-card :deep(.v-label),
.export-settings-card :deep(.v-selection-control__input),
.export-settings-card :deep(.v-field__input),
.export-settings-card :deep(.v-text-field__suffix) {
  color: #ffffff;
  opacity: 1;
}
</style>
