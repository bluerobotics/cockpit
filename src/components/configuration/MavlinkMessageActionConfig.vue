<template>
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
            theme="dark"
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
import { computed, ref } from 'vue'

import {
  type MavlinkMessageActionConfig,
  deleteMavlinkMessageActionConfig,
  getMavlinkMessageActionConfig,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { messageFieldDefinitions } from '@/libs/actions/mavlink-message-actions-message-definitions'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useAppInterfaceStore } from '@/stores/appInterface'

const emit = defineEmits<{
  (e: 'action-saved'): void
  (e: 'action-deleted'): void
}>()

const interfaceStore = useAppInterfaceStore()

const defaultMessageType = MAVLinkType.COMMAND_LONG
const defaultActionConfig = {
  name: '',
  messageType: defaultMessageType,
  messageConfig: messageFieldDefinitions[defaultMessageType] || '',
}

const actionDialog = ref({ show: false })
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
  emit('action-saved')
  resetNewAction()
}

const saveActionConfig = (): void => {
  createActionConfig()
  closeActionDialog()
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

const deleteAction = (id: string): void => {
  deleteMavlinkMessageActionConfig(id)
  emit('action-deleted')
}

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

const openEditDialog = (id: string): void => {
  const action = getMavlinkMessageActionConfig(id)
  if (action) {
    editMode.value = true
    newActionConfig.value = JSON.parse(JSON.stringify(action)) // Deep copy
    actionDialog.value.show = true
  }
}

const openNewDialog = (): void => {
  resetNewAction()
  actionDialog.value.show = true
}

defineExpose({
  openEditDialog,
  openNewDialog,
  exportAction,
  deleteAction,
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
