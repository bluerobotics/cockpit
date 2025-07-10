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
            <template v-if="settingsArray.length === 0">
              <div class="flex flex-row w-full h-full justify-center items-center text-center py-4">
                <v-circular-progress size="40" color="white" />
                <p>Loading settings...</p>
              </div>
            </template>
            <template v-else>
              <table class="w-full border-collapse">
                <tbody>
                  <tr v-for="item in filteredSettings" :key="item.originalKey">
                    <td class="text-start align-top p-2 pl-4 w-[300px] border-b border-b-[rgba(255,255,255,0.3)]">
                      {{ item.setting }}
                    </td>
                    <td class="text-center border-b border-b-[rgba(255,255,255,0.3)] pr-4">
                      <template v-if="isPrimitive(editedValues[item.originalKey])">
                        <div class="text-center py-0 cursor-pointer" @dblclick="startEditing(item)">
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
                                <!-- Save/Cancel buttons -->
                                <v-tooltip location="top" text="Cancel">
                                  <template #activator="{ props: tooltipProps }">
                                    <v-btn
                                      size="x-small"
                                      icon="mdi-close"
                                      variant="text"
                                      class="self-end text-red-300 mb-[3px]"
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
                            <v-btn size="x-small" variant="text" class="bgb-transparent" @click="cancelJsonEditing()">
                              close
                            </v-btn>
                            <v-btn
                              size="x-small"
                              variant="text"
                              class="bg-[#FFFFFF22]"
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
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { reloadCockpit } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { SettingItem, Settings } from '@/types/general'

const props = defineProps<{
  /**
   * Whether the dialog is open or not
   */
  openConfigDialog: boolean
}>()
const emits = defineEmits(['update:openConfigDialog'])

const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()
const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

const openConfigDialog = ref(props.openConfigDialog || false)
const userSettings = ref<Settings>({})
const editedValues = reactive<Settings>({ ...userSettings.value })
const searchTerm = ref('')
const editing = reactive<Record<string, boolean>>({})
const inlineJsonEditing = reactive<Record<string, boolean>>({})
const inlineJsonText = reactive<Record<string, string>>({})
const JsonEditError = ref(false)

const settingsArray = computed<SettingItem[]>(() =>
  Object.keys(editedValues).map((key) => ({
    setting: key.replace(/^cockpit-/, ''),
    originalKey: key,
  }))
)

const filteredSettings = computed<SettingItem[]>(() => {
  const lowerSearch = searchTerm.value.toLowerCase()
  return settingsArray.value
    .filter((item) => {
      const nameMatch = item.setting.toLowerCase().includes(lowerSearch)
      const value = editedValues[item.originalKey]
      const valueString = value ? JSON.stringify(value).toLowerCase() : ''
      const valueMatch = valueString.includes(lowerSearch)
      return nameMatch || valueMatch
    })
    .sort((a, b) => a.setting.localeCompare(b.setting))
})

// Makes userSettings persistent saving to localStorage, thus calling the settingSyncer
watch(
  () => userSettings.value,
  (value) => {
    Object.keys(value).forEach((key) => {
      localStorage.setItem(key, isPrimitive(value[key]) ? value[key] : JSON.stringify(value[key]))
    })
  },
  { deep: true }
)

watch(
  () => props.openConfigDialog,
  (value) => {
    openConfigDialog.value = value
  }
)

const isPrimitive = (val: any): boolean => val !== Object(val)

const loadUserSettings = async (): Promise<void> => {
  const storedSettings: Record<string, any> = Object.keys(localStorage)
    .filter((key) => key.startsWith('cockpit-'))
    .reduce((acc: Record<string, any>, key: string) => {
      const value = localStorage.getItem(key)
      try {
        acc[key] = value ? JSON.parse(value) : null
      } catch {
        acc[key] = value
      }
      return acc
    }, {} as Record<string, any>)
  Object.assign(editedValues, storedSettings)
  userSettings.value = storedSettings
}

const closeConfigDialog = (): void => {
  openConfigDialog.value = false
  emits('update:openConfigDialog', false)
}

const startEditing = (item: SettingItem): void => {
  editing[item.originalKey] = true
}

const cancelEditingItem = (item: SettingItem): void => {
  editing[item.originalKey] = false
  editedValues[item.originalKey] = userSettings.value[item.originalKey]
}

const commitChanges = (item: SettingItem): void => {
  editing[item.originalKey] = false
  userSettings.value = { ...editedValues }
}

const startInlineJsonEditing = (key: string): void => {
  inlineJsonEditing[key] = true
  inlineJsonText[key] = JSON.stringify(editedValues[key], null, 2)
}

const finishInlineJsonEditing = (key: string): void => {
  try {
    const parsed = JSON.parse(inlineJsonText[key])
    editedValues[key] = parsed
    inlineJsonEditing[key] = false
    JsonEditError.value = false
    userSettings.value[key] = parsed
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
  const dataStr = JSON.stringify(userSettings.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const username = missionStore.username !== 'null' ? missionStore.username : 'unnamed'
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
    reader.onload = (e: ProgressEvent<FileReader>) => {
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
        Object.assign(editedValues, json)
        userSettings.value = json
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
          reloadCockpit(3000)
        },
      },
    ],
  })
}

const handleStorageChange = (event: StorageEvent): void => {
  if (event.key && event.key.startsWith('cockpit-')) {
    console.log('Storage change detected for:', event.key)
    loadUserSettings()
  }
}

onMounted(() => {
  loadUserSettings()
  // This will keep checking for changes in localStorage and updates the settings manager if any
  window.addEventListener('storage', handleStorageChange)
})
</script>
