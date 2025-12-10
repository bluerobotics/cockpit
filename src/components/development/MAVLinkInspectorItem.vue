<template>
  <div class="mb-4">
    <div class="font-bold mb-2 flex items-center justify-between">
      <span>{{ type }}</span>
      <button
        class="ml-2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#FFFFFF22]"
        title="Stop tracking this message"
        @click="emit('remove', type)"
      >
        <span class="text-sm">✕</span>
      </button>
    </div>
    <div class="ml-1 text-xs text-gray-400 mb-1">Incoming Messages:</div>
    <div v-if="incomingMessage" class="ml-2 text-sm whitespace-pre-wrap">
      <div class="text-xs text-blue-300">Received at: {{ incomingMessage.timestamp }}</div>
      <pre>{{ JSON.stringify(incomingMessage.message, null, 2) }}</pre>
    </div>
    <div v-else class="ml-2 text-sm text-gray-400">No incoming messages</div>
    <div class="ml-1 text-xs text-gray-400 mt-2 mb-1">Outgoing Messages:</div>
    <div v-if="outgoingMessage" class="ml-2 text-sm whitespace-pre-wrap">
      <div class="text-xs text-green-300">Sent at: {{ outgoingMessage.timestamp }}</div>
      <pre>{{ JSON.stringify(outgoingMessage.message, null, 2) }}</pre>
    </div>
    <div v-else class="ml-2 text-sm text-gray-400">No outgoing messages</div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { onMounted, ref } from 'vue'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useMainVehicleStore } from '@/stores/mainVehicle'

/**
 * Represents the data structure for a MAVLink message displayed in the inspector,
 */
interface MessageData {
  /** Formatted timestamp string indicating when the message was captured */
  timestamp: string
  /** The message content, typically a MAVLink payload object */
  message: unknown
}

const props = defineProps<{
  /** The type of MAVLink message to display */
  type: MAVLinkType
}>()

const emit = defineEmits<{
  (e: 'remove', type: MAVLinkType): void
}>()

const mainVehicleStore = useMainVehicleStore()
const incomingMessage = ref<MessageData | null>(null)
const outgoingMessage = ref<MessageData | null>(null)

const setupMessageListeners = (): void => {
  try {
    mainVehicleStore.listenToIncomingMessages(props.type, (pack: Package) => {
      incomingMessage.value = {
        timestamp: format(new Date(), 'LLL dd, yyyy - HH:mm:ss.SSS'),
        message: pack.message,
      }
    })
    mainVehicleStore.listenToOutgoingMessages(props.type, (pack: Package) => {
      outgoingMessage.value = {
        timestamp: format(new Date(), 'LLL dd, yyyy - HH:mm:ss.SSS'),
        message: pack.message,
      }
    })
  } catch (error) {
    console.error(`Failed to setup message listeners for type ${props.type}:`, error)
  }
}

onMounted(setupMessageListeners)
</script>
