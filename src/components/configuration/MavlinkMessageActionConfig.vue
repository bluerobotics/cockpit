<template>
  <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>MAVLink Message Actions</template>
    <template #info>
      <p>View, manage, and create MAVLink message actions.</p>
    </template>
    <template #content>
      <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[640px]">
        <v-data-table
          :items="allActionsConfigs"
          items-per-page="10"
          class="elevation-1 bg-transparent rounded-lg"
          theme="dark"
          :style="interfaceStore.globalGlassMenuStyles"
        >
          <template #headers>
            <tr>
              <th class="text-left">
                <p class="text-[16px] font-bold">Name</p>
              </th>
              <th class="text-center">
                <p class="text-[16px] font-bold">Message Type</p>
              </th>
              <th class="text-right">
                <p class="text-[16px] font-bold">Actions</p>
              </th>
            </tr>
          </template>
          <template #item="{ item }">
            <tr>
              <td>
                <div :id="item.id" class="flex items-center justify-left rounded-xl mx-1 w-[140px]">
                  <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.name }}</p>
                </div>
              </td>
              <td>
                <div :id="item.id" class="flex items-center justify-center rounded-xl mx-1 w-[200px]">
                  <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.messageType }}</p>
                </div>
              </td>
              <td class="w-[200px] text-right">
                <div class="flex items-center justify-center">
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    icon="mdi-pencil"
                    size="x-small"
                    @click="openActionEditDialog(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    icon="mdi-play"
                    size="x-small"
                    @click="runAction(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1 pl-[3px] pt-[1px]"
                    icon="mdi-export"
                    size="x-small"
                    @click="exportAction(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    color="error"
                    icon="mdi-delete"
                    size="x-small"
                    @click="deleteActionConfig(item.id)"
                  />
                </div>
              </td>
            </tr>
          </template>
          <template #bottom>
            <tr class="w-full">
              <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                <v-btn variant="outlined" class="rounded-lg" @click="openNewActionDialog()">
                  <v-icon start>mdi-plus</v-icon>
                  New MAVLink action
                </v-btn>
                <v-btn variant="outlined" class="rounded-lg" @click="importAction">
                  <v-icon start>mdi-import</v-icon>
                  Import action
                </v-btn>
              </td>
            </tr>
          </template>
          <template #no-data>
            <tr>
              <td colspan="3" class="text-center flex items-center justify-center h-[50px] w-full">
                <p class="text-[16px] ml-[170px] w-full">No MAVLink message actions found</p>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </template>
  </ExpansiblePanel>

  <!-- Action Dialog -->
  <v-dialog v-model="actionDialog.show" max-width="500px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ editMode ? 'Edit action' : 'Create new action' }}
      </v-card-title>
      <v-card-text class="px-8">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="saveActionConfig">
          <v-text-field
            v-model="newActionConfig.name"
            label="Action Name"
            required
            variant="outlined"
            density="compact"
          />
          <v-select
            v-model="newActionConfig.messageType"
            :items="availableMessageTypes"
            label="Message Type"
            required
            variant="outlined"
            density="compact"
            @update:model-value="resetActionConfig(newActionConfig.messageType)"
          />

          <div v-if="newActionConfig.messageType" class="mt-4">
            <h3 class="text-subtitle-1 font-weight-bold mb-2">Message Configuration</h3>
            <div v-if="typeof messageFields !== 'string' && Object.keys(messageFields).length > 0">
              <div v-for="(field, key) in messageFields" :key="key" class="mb-1">
                <v-text-field
                  v-model.trim="newActionConfig.messageConfig[key].value"
                  :label="field.description + (field.units ? ` (${field.units})` : '')"
                  :placeholder="field.type"
                  variant="outlined"
                  density="compact"
                  :rules="[field.required ? (v) => !!v || 'This field is required' : () => true]"
                />
              </div>
            </div>
            <div v-else>
              <v-textarea
                v-model="newActionConfig.messageConfig"
                label="Message fields object"
                variant="outlined"
                density="compact"
                hint="Insert a JSON object with the message fields here. Use {{ data_lake_key }} for dynamic values. Use { type: 'ENUM_VALUE' } for enum values (e.g.: MAV_CMD_COMPONENT_ARM_DISARM)."
                persistent-hint
                rows="12"
              />
            </div>
          </div>
        </v-form>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full" style="color: rgba(255, 255, 255, 0.5)">
          <v-btn @click="closeActionDialog">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn @click="resetNewAction">Reset</v-btn>
            <v-btn :disabled="!isFormValid" class="text-white" @click="saveActionConfig">
              {{ editMode ? 'Save' : 'Create' }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { openSnackbar } from '@/composables/snackbar'
import {
  type MavlinkMessageActionConfig,
  deleteMavlinkMessageActionConfig,
  getAllMavlinkMessageActionConfigs,
  getMavlinkMessageActionConfig,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { messageFieldDefinitions } from '@/libs/actions/mavlink-message-actions-message-definitions'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const defaultMessageType = MAVLinkType.COMMAND_LONG
const defaultActionConfig = {
  name: '',
  messageType: defaultMessageType,
  messageConfig: messageFieldDefinitions[defaultMessageType] || '',
}

const actionDialog = ref({ show: false })
const actionsConfigs = reactive<Record<string, MavlinkMessageActionConfig>>({})
const editMode = ref(false)
const newActionConfig = ref<MavlinkMessageActionConfig>(defaultActionConfig)

const availableMessageTypes = Object.values(MAVLinkType)

const messageFields = computed(() => {
  const selectedType = newActionConfig.value.messageType
  return messageFieldDefinitions[selectedType] || ''
})

const isFormValid = computed(() => {
  if (!newActionConfig.value.name || !newActionConfig.value.messageType) {
    return false
  }

  // If the message config is a string, it must be a valid JSON string
  if (typeof newActionConfig.value.messageConfig === 'string') {
    try {
      JSON.parse(newActionConfig.value.messageConfig)
      return true
    } catch (error) {
      return false
    }
  }

  // Check if all required fields are filled
  const fields = messageFieldDefinitions[newActionConfig.value.messageType] || {}
  return Object.entries(fields).every(([key, field]) => {
    return !field.required || newActionConfig.value.messageConfig[key] !== undefined
  })
})

const loadActionsConfigs = (): void => {
  Object.assign(actionsConfigs, getAllMavlinkMessageActionConfigs())
}

const allActionsConfigs = computed(() => {
  return Object.entries(actionsConfigs).map(([id, action]) => ({ id, ...action }))
})

const deleteActionConfig = (id: string): void => {
  delete actionsConfigs[id]
  deleteMavlinkMessageActionConfig(id)
  loadActionsConfigs()
}

const openNewActionDialog = (): void => {
  editMode.value = false
  resetNewAction()
  actionDialog.value.show = true
}

const editActionConfig = (id: string): void => {
  editMode.value = true
  newActionConfig.value = JSON.parse(JSON.stringify(actionsConfigs[id]))
}

const openActionEditDialog = (id: string): void => {
  editActionConfig(id)
  actionDialog.value.show = true
}

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

const resetActionConfig = (messageType: MAVLinkType = defaultMessageType): void => {
  const exampleStringConfig = JSON.stringify(
    {
      target: 1,
      exampleNumberField: 123,
      exampleStringField: 'exampleStringValue',
      exampleEnumField: { type: 'MAV_CMD_NAV_WAYPOINT' },
    },
    null,
    2
  )
  newActionConfig.value.messageConfig = messageFieldDefinitions[messageType] || exampleStringConfig
}

const resetNewAction = (): void => {
  newActionConfig.value = { ...defaultActionConfig }
}

const createActionConfig = (): void => {
  editMode.value = false
  registerMavlinkMessageActionConfig(newActionConfig.value)
  loadActionsConfigs()
  resetNewAction()
}

const saveActionConfig = (): void => {
  createActionConfig()
  closeActionDialog()
}

const runAction = (id: string): void => {
  executeActionCallback(id)
}

const exportAction = (id: string): void => {
  const action = getMavlinkMessageActionConfig(id)
  if (!action) {
    console.error('Action not found')
    return
  }
  const json = JSON.stringify(action, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = `${id}.json`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  a.remove()
}

const importAction = (): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const action = JSON.parse(e.target?.result as string) as MavlinkMessageActionConfig
          registerMavlinkMessageActionConfig(action)
          loadActionsConfigs()
        } catch (error) {
          openSnackbar({ message: `Cannot import action. ${error}`, variant: 'error', duration: 5000 })
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
  input.remove()
}

onMounted(() => {
  loadActionsConfigs()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
