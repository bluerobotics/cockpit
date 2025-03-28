<template>
  <v-form class="d-flex flex-column gap-2">
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
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { type MavlinkMessageActionConfig } from '@/libs/actions/mavlink-message-actions'
import { messageFieldDefinitions } from '@/libs/actions/mavlink-message-actions-message-definitions'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

/**
 * Props for the MavlinkMessageActionConfig component
 */
const props = defineProps<{
  /** The configuration for the MAVLink message action */
  actionConfig: MavlinkMessageActionConfig
}>()

/**
 * Emits for the MavlinkMessageActionConfig component
 */
const emit = defineEmits<{
  /** Emitted when the action configuration is updated */
  (e: 'update:action-config', config: MavlinkMessageActionConfig): void
}>()

const defaultMessageType = MAVLinkType.COMMAND_LONG
const defaultActionConfig = {
  name: '',
  messageType: defaultMessageType,
  messageConfig: messageFieldDefinitions[defaultMessageType] || '',
}
const newActionConfig = ref<MavlinkMessageActionConfig>(defaultActionConfig)

const availableMessageTypes = Object.values(MAVLinkType)

const messageFields = computed(() => {
  const selectedType = newActionConfig.value.messageType
  return messageFieldDefinitions[selectedType] || ''
})

const isValid = computed(() => {
  if (!newActionConfig.value.messageType) {
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
  emit('update:action-config', newActionConfig.value)
}

const reset = (): void => {
  newActionConfig.value = {
    name: '',
    messageType: defaultMessageType,
    messageConfig: messageFieldDefinitions[defaultMessageType] || '',
  }
  emit('update:action-config', newActionConfig.value)
}

// Watch for changes in the parent's actionConfig
watch(
  () => props.actionConfig,
  (newConfig) => {
    if (newConfig) {
      newActionConfig.value = { ...newConfig }
    }
  },
  { immediate: true }
)

// Watch for local changes to emit updates
watch(
  newActionConfig,
  (newValue) => {
    emit('update:action-config', newValue)
  },
  { deep: true }
)

defineExpose({
  isValid,
  reset,
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
