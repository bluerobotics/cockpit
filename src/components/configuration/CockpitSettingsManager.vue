<template>
  <v-dialog v-model="openConfigDialog" width="800px" persistent>
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        <div class="flex justify-between w-full -mt-1">
          <div class="w-10" />
          Cockpit settings manager
          <v-icon class="self-end" @click="closeConfigDialog">mdi-close</v-icon>
        </div>
      </v-card-title>

      <v-container>
        <div class="flex flex-col h-[70vh] border border-[rgba(255,255,255,0.3)] rounded elevation-3">
          <div class="p-2 border-b border-b-[rgba(255,255,255,0.3)] bg-[rgba(0,0,0,0.15)]">
            <div class="flex flex-col gap-y-2">
              <div class="flex gap-x-2">
                <v-select
                  v-model="selectedUserId"
                  :items="availableUsers"
                  label="User"
                  density="compact"
                  variant="outlined"
                  hide-details
                  theme="dark"
                  class="w-full"
                />
                <v-select
                  v-model="selectedVehicleId"
                  :items="availableVehicles"
                  label="Vehicle"
                  density="compact"
                  variant="outlined"
                  hide-details
                  theme="dark"
                  class="w-full"
                  :disabled="availableVehicles.length === 0"
                />
              </div>
              <div v-if="interfaceStore.pirateMode" class="flex flex-wrap gap-x-4">
                <v-checkbox
                  v-model="showLegacyInternalKeys"
                  label="Show legacy/internal keys"
                  density="compact"
                  hide-details
                />
                <v-checkbox
                  v-model="showAllKeyPairs"
                  label="Show all localStorage key-pairs"
                  density="compact"
                  hide-details
                />
              </div>
            </div>
          </div>

          <div class="flex-none sticky top-0 bg-inherit z-[2]">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-[#00000022]">
                  <th class="text-center border-b border-b-[rgba(255,255,255,0.3)]">Setting</th>
                  <th class="text-center w-[518px] p-2 border-b border-b-[rgba(255,255,255,0.3)]">Value</th>
                </tr>
              </thead>
            </table>
          </div>

          <div class="flex-auto overflow-y-auto">
            <template v-if="!isLoaded">
              <div class="flex flex-row w-full h-full justify-center items-center text-center py-4">
                <v-circular-progress size="40" color="white" />
                <p>Loading settings...</p>
              </div>
            </template>
            <template v-else-if="settingsArray.length === 0">
              <div class="flex flex-row w-full h-full justify-center items-center text-center py-4">
                <p>No settings available for current selection.</p>
              </div>
            </template>
            <template v-else>
              <table class="w-full border-collapse">
                <tbody>
                  <tr v-for="item in filteredSettings" :key="item.originalKey">
                    <td class="text-start align-top p-2 pl-4 w-[300px] border-b border-b-[rgba(255,255,255,0.3)]">
                      {{ displaySettingName(item) }}
                    </td>
                    <td class="text-center border-b border-b-[rgba(255,255,255,0.3)] pr-4">
                      <template v-if="saving[item.originalKey]">
                        <div class="flex w-full justify-center items-center gap-x-2 py-2">
                          <v-progress-circular size="16" width="2" indeterminate />
                          <span class="text-xs opacity-80">Updating...</span>
                        </div>
                      </template>
                      <template v-else-if="isPrimitive(editedValues[item.originalKey])">
                        <div
                          class="text-center py-0 cursor-pointer"
                          :class="{ 'pointer-events-none opacity-70': saving[item.originalKey] }"
                          @dblclick="startEditing(item)"
                        >
                          <template v-if="editing[item.originalKey]">
                            <div class="flex w-full justify-between items-center">
                              <div />
                              <template v-if="editedValues[item.originalKey] === null">
                                <input
                                  v-model="editedValues[item.originalKey]"
                                  placeholder="Enter value"
                                  class="text-right bg-[#00000022] w-[160px] h-[40px] -mr-8"
                                />
                              </template>
                              <template v-else-if="typeof editedValues[item.originalKey] === 'boolean'">
                                <select v-model="editedValues[item.originalKey]" class="bg-[#FFFFFF11] w-[120px]">
                                  <option :value="true" class="bg-[#000000AA]">true</option>
                                  <option :value="false" class="bg-[#000000AA]">false</option>
                                </select>
                              </template>
                              <template v-else-if="typeof editedValues[item.originalKey] === 'number'">
                                <input
                                  v-model.number="editedValues[item.originalKey]"
                                  type="number"
                                  class="text-right bg-[#00000022] w-[120px] -mr-8"
                                />
                              </template>
                              <template v-else-if="typeof editedValues[item.originalKey] === 'string'">
                                <input
                                  v-model="editedValues[item.originalKey]"
                                  placeholder="Enter value"
                                  class="text-right bg-[#00000022] w-[160px] h-[40px] -mr-8"
                                />
                              </template>
                              <div>
                                <v-tooltip location="top" text="Cancel">
                                  <template #activator="{ props: tooltipProps }">
                                    <v-btn
                                      size="x-small"
                                      icon="mdi-close"
                                      variant="text"
                                      class="self-end text-red-300 mb-[3px]"
                                      :disabled="saving[item.originalKey]"
                                      v-bind="tooltipProps"
                                      @click="cancelEditingItem(item)"
                                    />
                                  </template>
                                </v-tooltip>
                                <v-tooltip location="top" text="Save">
                                  <template #activator="{ props: tooltipProps }">
                                    <v-btn
                                      size="x-small"
                                      icon="mdi-content-save"
                                      variant="text"
                                      class="self-end text-green-300 mb-[3px]"
                                      :loading="saving[item.originalKey]"
                                      :disabled="saving[item.originalKey]"
                                      v-bind="tooltipProps"
                                      @click="commitChanges(item)"
                                    />
                                  </template>
                                </v-tooltip>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                            <div class="flex w-full justify-between">
                              <div />
                              <p class="mt-[3px]">{{ editedValues[item.originalKey] }}</p>
                              <v-tooltip location="top" text="Edit value">
                                <template #activator="{ props: tooltipProps }">
                                  <v-btn
                                    v-bind="tooltipProps"
                                    size="x-small"
                                    icon="mdi-pencil"
                                    variant="text"
                                    class="self-end"
                                    :disabled="saving[item.originalKey]"
                                    @click="startEditing(item)"
                                  />
                                </template>
                              </v-tooltip>
                            </div>
                          </template>
                        </div>
                      </template>
                      <template v-else>
                        <div v-if="inlineJsonEditing[item.originalKey]" class="my-2">
                          <textarea
                            v-model="inlineJsonText[item.originalKey]"
                            rows="8"
                            class="bg-[#00000011] w-full p-2"
                            :class="{ 'border-2 border-[#FF000055]': JsonEditError }"
                          />
                          <div class="flex justify-end gap-x-6 pt-[2px]">
                            <v-btn
                              size="x-small"
                              variant="text"
                              class="bgb-transparent"
                              :disabled="saving[item.originalKey]"
                              @click="cancelJsonEditing()"
                            >
                              close
                            </v-btn>
                            <v-btn
                              size="x-small"
                              variant="text"
                              class="bg-[#FFFFFF22]"
                              :loading="saving[item.originalKey]"
                              :disabled="saving[item.originalKey]"
                              @click="finishInlineJsonEditing(item.originalKey)"
                            >
                              Save
                            </v-btn>
                          </div>
                        </div>
                        <div v-else>
                          <div class="flex w-full justify-between">
                            <div />
                            <p class="cursor-pointer mt-1" @dblclick="startInlineJsonEditing(item.originalKey)">
                              {...}
                            </p>
                            <v-tooltip location="top" text="Edit value">
                              <template #activator="{ props: tooltipProps }">
                                <v-btn
                                  v-bind="tooltipProps"
                                  size="x-small"
                                  icon="mdi-pencil"
                                  variant="text"
                                  class="self-end"
                                  :disabled="saving[item.originalKey]"
                                  @click="startInlineJsonEditing(item.originalKey)"
                                />
                              </template>
                            </v-tooltip>
                          </div>
                        </div>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <div
            class="flex flex-row sticky bottom-0 bg-[rgba(0,0,0,0.15)] border-t border-t-[rgba(255,255,255,0.3)] z-[2] p-1 pr-3 justify-between"
          >
            <v-text-field
              v-model="searchTerm"
              placeholder="Search settings"
              variant="plain"
              density="compact"
              hide-details
              class="mt-1"
            >
              <template #prepend>
                <v-icon class="ml-2 mt-[2px]">mdi-magnify</v-icon>
              </template>
              <template #append-inner>
                <v-icon
                  v-if="searchTerm !== ''"
                  class="mx-2 mt-[2px] cursor-pointer opacity-65"
                  @click="searchTerm = ''"
                  >mdi-close</v-icon
                >
              </template>
            </v-text-field>
            <v-divider vertical class="mr-6 my-2" />
            <v-tooltip location="top" text="Upload and apply config file">
              <template #activator="{ props: tooltipProps }">
                <v-btn icon variant="text" class="bg-transparent" v-bind="tooltipProps" @click="uploadConfigFile">
                  <v-icon>mdi-upload-outline</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip location="top" text="Save config file">
              <template #activator="{ props: tooltipProps }">
                <v-btn icon variant="text" class="bg-transparent" v-bind="tooltipProps" @click="downloadConfigFile">
                  <v-icon>mdi-download</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </div>
      </v-container>

      <v-card-actions>
        <div class="flex justify-between items-center p-2 w-full h-full text-[rgba(255,255,255,0.5)]">
          <v-btn @click="resetAllCockpitSettings">Reset to defaults</v-btn>
          <v-btn class="text-white" @click="closeConfigDialog">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { useCurrentUser } from '@/composables/useCurrentUser'
import {
  cockpitLastConnectedUserKey,
  cockpitLastConnectedVehicleKey,
  localOldStyleSettingsKey,
  localSyncedSettingsKey,
  settingsManager,
  vehicleIdKey,
} from '@/libs/settings-management'
import { isEqual } from '@/libs/utils'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { LocalSyncedSettings, SettingsPackage } from '@/types/settings-management'

type SettingsRowSource = 'v2' | 'legacy' | 'all-local-storage'
type SettingsRow = {
  /**
   * The name of the setting
   */
  setting: string
  /**
   * The original key of the setting
   */
  originalKey: string
  /**
   * The storage key of the setting
   */
  storageKey: string
  /**
   * The source of the setting
   */
  source: SettingsRowSource
  /**
   * The v2 setting key of the setting
   */
  v2SettingKey?: string
}
import { Settings } from '@/types/general'

const props = defineProps<{
  /**
   * Whether the dialog is open or not
   */
  openConfigDialog: boolean
}>()
const emits = defineEmits(['update:openConfigDialog'])

const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()
const { currentUser } = useCurrentUser()
const interfaceStore = useAppInterfaceStore()

const openConfigDialog = ref(props.openConfigDialog || false)
const userSettings = ref<Settings>({})
const editedValues = reactive<Settings>({ ...userSettings.value })
const searchTerm = ref('')
const editing = reactive<Record<string, boolean>>({})
const inlineJsonEditing = reactive<Record<string, boolean>>({})
const inlineJsonText = reactive<Record<string, string>>({})
const saving = reactive<Record<string, boolean>>({})
const JsonEditError = ref(false)
const isLoaded = ref(false)
const selectedUserId = ref('')
const selectedVehicleId = ref('')
const showLegacyInternalKeys = ref(false)
const showAllKeyPairs = ref(false)
const legacyInternalKeys = [
  localOldStyleSettingsKey,
  vehicleIdKey,
  cockpitLastConnectedVehicleKey,
  cockpitLastConnectedUserKey,
]
const v2WriteWaitTimeoutMs = 5000
const v2WriteWaitIntervalMs = 100

const localSyncedSettings = ref<LocalSyncedSettings>({})
const localStorageSnapshot = ref<Settings>({})

const availableUsers = computed<string[]>(() => Object.keys(localSyncedSettings.value).sort())
const availableVehicles = computed<string[]>(() =>
  Object.keys(localSyncedSettings.value[selectedUserId.value] ?? {}).sort()
)
const selectedV2Package = computed<SettingsPackage>(
  () => localSyncedSettings.value[selectedUserId.value]?.[selectedVehicleId.value] ?? {}
)

const makeRowOriginalKey = (source: SettingsRowSource, storageKey: string, v2SettingKey?: string): string => {
  if (source === 'v2') return `v2:${selectedUserId.value}:${selectedVehicleId.value}:${v2SettingKey ?? ''}`
  return `local:${storageKey}`
}

const allRows = computed<SettingsRow[]>(() => {
  const rows: SettingsRow[] = Object.keys(selectedV2Package.value)
    .sort()
    .map((settingKey) => ({
      setting: settingKey,
      originalKey: makeRowOriginalKey('v2', localSyncedSettingsKey, settingKey),
      storageKey: localSyncedSettingsKey,
      source: 'v2',
      v2SettingKey: settingKey,
    }))

  if (interfaceStore.pirateMode && showAllKeyPairs.value) {
    Object.keys(localStorageSnapshot.value)
      .sort()
      .forEach((key) =>
        rows.push({
          setting: key,
          originalKey: makeRowOriginalKey('all-local-storage', key),
          storageKey: key,
          source: 'all-local-storage',
        })
      )
    return rows
  }

  if (interfaceStore.pirateMode && showLegacyInternalKeys.value) {
    legacyInternalKeys.forEach((key) => {
      if (!(key in localStorageSnapshot.value)) return
      rows.push({
        setting: key,
        originalKey: makeRowOriginalKey('legacy', key),
        storageKey: key,
        source: 'legacy',
      })
    })
  }

  return rows
})

const settingsArray = computed<SettingsRow[]>(() => allRows.value)

const displaySettingName = (item: SettingsRow): string => {
  if (item.source === 'v2') {
    return item.setting.replace(/^cockpit-/, '')
  }
  return item.setting
}

const filteredSettings = computed<SettingsRow[]>(() => {
  const lowerSearch = searchTerm.value.toLowerCase()
  return settingsArray.value
    .filter((item) => {
      const nameMatch = displaySettingName(item).toLowerCase().includes(lowerSearch)
      const value = editedValues[item.originalKey]
      const valueString = value === undefined ? '' : JSON.stringify(value).toLowerCase()
      const valueMatch = valueString.includes(lowerSearch)
      return nameMatch || valueMatch
    })
    .sort((a, b) => displaySettingName(a).localeCompare(displaySettingName(b)))
})

watch(
  () => props.openConfigDialog,
  (value) => {
    openConfigDialog.value = value
    if (value) {
      loadUserSettings()
    }
  }
)

watch(availableUsers, (users) => {
  if (users.length === 0) {
    selectedUserId.value = ''
    selectedVehicleId.value = ''
    return
  }
  if (!selectedUserId.value || !users.includes(selectedUserId.value)) {
    selectedUserId.value = users[0]
  }
})

watch(availableVehicles, (vehicles) => {
  if (vehicles.length === 0) {
    selectedVehicleId.value = ''
    return
  }
  if (!selectedVehicleId.value || !vehicles.includes(selectedVehicleId.value)) {
    selectedVehicleId.value = vehicles[0]
  }
})

watch(
  [settingsArray, selectedUserId, selectedVehicleId, showLegacyInternalKeys, showAllKeyPairs],
  () => {
    const nextValues: Settings = {}
    settingsArray.value.forEach((row) => {
      if (row.source === 'v2') {
        nextValues[row.originalKey] = selectedV2Package.value[row.v2SettingKey ?? '']?.value
      } else {
        nextValues[row.originalKey] = localStorageSnapshot.value[row.storageKey]
      }
    })
    Object.keys(editedValues).forEach((key) => delete editedValues[key])
    Object.assign(editedValues, nextValues)
    userSettings.value = { ...nextValues }
  },
  { immediate: true }
)

const isPrimitive = (val: any): boolean => val !== Object(val)

const parseStoredItem = (value: string | null): any => {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return value
  }
}

const readLocalStorageSnapshot = (): Settings =>
  Object.keys(localStorage).reduce((acc: Settings, key: string) => {
    acc[key] = parseStoredItem(localStorage.getItem(key))
    return acc
  }, {} as Settings)

const readSyncedSettings = (): LocalSyncedSettings => {
  const raw = localStorage.getItem(localSyncedSettingsKey)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as LocalSyncedSettings
  } catch {
    return {}
  }
}

const waitForV2ValueToPersist = async (
  key: string,
  expectedValue: any,
  userId: string,
  vehicleId: string
): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < v2WriteWaitTimeoutMs) {
    const latestSettings = readSyncedSettings()
    const latestValue = latestSettings[userId]?.[vehicleId]?.[key]?.value
    if (isEqual(latestValue, expectedValue)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, v2WriteWaitIntervalMs))
  }
  throw new Error('Timed out while waiting for settings update to be persisted.')
}

const loadUserSettings = (): void => {
  localStorageSnapshot.value = readLocalStorageSnapshot()
  localSyncedSettings.value = readSyncedSettings()
  isLoaded.value = true
}

const closeConfigDialog = (): void => {
  openConfigDialog.value = false
  emits('update:openConfigDialog', false)
}

const startEditing = (item: SettingsRow): void => {
  if (saving[item.originalKey]) return
  editing[item.originalKey] = true
}

const cancelEditingItem = (item: SettingsRow): void => {
  if (saving[item.originalKey]) return
  editing[item.originalKey] = false
  editedValues[item.originalKey] = userSettings.value[item.originalKey]
}

const localStorageValueToString = (value: any): string => {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

const commitChanges = async (item: SettingsRow): Promise<void> => {
  if (saving[item.originalKey]) return
  const editedValue = editedValues[item.originalKey]
  const previousValue = userSettings.value[item.originalKey]
  saving[item.originalKey] = true
  try {
    if (item.source === 'v2' && item.v2SettingKey) {
      if (!selectedUserId.value || !selectedVehicleId.value) return
      await settingsManager.setKeyValue(
        item.v2SettingKey,
        editedValue,
        Date.now(),
        selectedUserId.value,
        selectedVehicleId.value
      )
      await waitForV2ValueToPersist(item.v2SettingKey, editedValue, selectedUserId.value, selectedVehicleId.value)
      loadUserSettings()
    } else {
      localStorage.setItem(item.storageKey, localStorageValueToString(editedValue))
      localStorageSnapshot.value[item.storageKey] = editedValue
    }
    editing[item.originalKey] = false
    userSettings.value[item.originalKey] = editedValue
  } catch (error: any) {
    editedValues[item.originalKey] = previousValue
    openSnackbar({
      message: `Failed to update setting: ${error?.message ?? 'Unknown error'}`,
      variant: 'error',
      duration: 5000,
    })
  } finally {
    saving[item.originalKey] = false
  }
}

const startInlineJsonEditing = (key: string): void => {
  if (saving[key]) return
  inlineJsonEditing[key] = true
  inlineJsonText[key] = JSON.stringify(editedValues[key], null, 2)
}

const finishInlineJsonEditing = async (key: string): Promise<void> => {
  try {
    const parsed = JSON.parse(inlineJsonText[key])
    editedValues[key] = parsed
    inlineJsonEditing[key] = false
    JsonEditError.value = false
    const row = settingsArray.value.find((item) => item.originalKey === key)
    if (row) await commitChanges(row)
  } catch (error: any) {
    JsonEditError.value = true
    openSnackbar({ message: 'Invalid JSON: ' + error.message, variant: 'error', duration: 5000 })
  }
}

const cancelJsonEditing = (): void => {
  Object.keys(inlineJsonEditing).forEach((key) => {
    inlineJsonEditing[key] = false
  })
  JsonEditError.value = false
}

const downloadConfigFile = (): void => {
  const exportedData: Settings = {}
  settingsArray.value.forEach((row) => {
    exportedData[row.setting] = editedValues[row.originalKey]
  })
  const dataStr = JSON.stringify(exportedData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const username = currentUser.value !== 'null' ? currentUser.value : 'unnamed'
  const filename = `${username}_config.json`
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const uploadConfigFile = (): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string
        const json = JSON.parse(text)
        if (!json || typeof json !== 'object') {
          openSnackbar({
            message: 'Invalid configuration file: content is not an object.',
            variant: 'warning',
            duration: 5000,
          })
          return
        }
        for (const row of settingsArray.value) {
          if (!(row.setting in json)) continue
          editedValues[row.originalKey] = json[row.setting]
          await commitChanges(row)
        }
        openSnackbar({ message: 'Configuration file applied successfully.', variant: 'success', duration: 5000 })
      } catch (error: any) {
        console.error('Error parsing configuration file: ' + error.message)
        openSnackbar({
          message: 'Error parsing configuration file: ' + error.message,
          variant: 'error',
          duration: 5000,
        })
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const resetAllCockpitSettings = (): void => {
  showDialog({
    message:
      "Are you sure you want to reset Cockpit's stored browser settings to defaults? " +
      'Settings on the vehicle will not be affected - ' +
      'once you connect back to the vehicle, the settings will be restored.',
    variant: 'warning',
    maxWidth: 800,
    actions: [
      {
        text: 'Cancel',
        action: () => closeDialog(),
      },
      {
        text: 'Reset settings',
        action: () => {
          localStorage.clear()
          openSnackbar({ message: 'All settings have been reset to default values.', variant: 'success' })
          closeDialog()
          reloadCockpitAndWarnUser()
        },
      },
    ],
  })
}

const handleStorageChange = (event: StorageEvent): void => {
  console.log('Storage change detected for:', event.key)
  loadUserSettings()
}

onMounted(() => {
  loadUserSettings()
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})
</script>
