<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-row gap-4 mb-4 flex-wrap">
      <div>
        <div class="text-lg mb-2">Available Message Types</div>
        <div class="mb-2 flex items-center">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search messages..."
            class="w-full px-3 py-2 bg-[#FFFFFF22] rounded-md text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <v-btn variant="outlined" class="rounded-md ml-2" @click="resetTrackedMessageTypes">Reset</v-btn>
        </div>
        <div class="bg-[#FFFFFF11] rounded-md p-2 max-h-[320px] overflow-y-auto">
          <div
            v-for="type in filteredMessageTypes"
            :key="type"
            class="cursor-pointer hover:bg-[#FFFFFF22] p-1 rounded"
            :class="{ 'bg-[#FFFFFF33]': trackedMessageTypes.has(type) }"
            @click="toggleMessageTracking(type)"
          >
            {{ type }}
          </div>
          <div v-if="filteredMessageTypes.length === 0" class="text-gray-400 text-center p-2">No messages found</div>
        </div>
      </div>
      <div v-if="trackedMessageTypes.size > 0" class="w-auto mr-2">
        <div class="text-lg mb-2">Message Values</div>
        <div class="bg-[#FFFFFF11] rounded-md p-2 w-[24rem] overflow-y-auto">
          <div v-for="type in trackedMessageTypes" :key="type" class="mb-4">
            <div class="font-bold mb-2 flex items-center justify-between">
              <span>{{ type }}</span>
              <button
                class="ml-2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#FFFFFF22]"
                title="Stop tracking this message"
                @click="removeMessageTracking(type)"
              >
                <span class="text-sm">✕</span>
              </button>
            </div>
            <div class="ml-1 text-xs text-gray-400 mb-1">Incoming Messages:</div>
            <div v-if="messageValues.has(`in:${type}`)" class="ml-2 text-sm whitespace-pre-wrap">
              <div class="text-xs text-blue-300">Received at: {{ messageValues.get(`in:${type}`)?.timestamp }}</div>
              <pre>{{ JSON.stringify(messageValues.get(`in:${type}`)?.message, null, 2) }}</pre>
            </div>
            <div v-else class="ml-2 text-sm text-gray-400">No incoming messages</div>
            <div class="ml-1 text-xs text-gray-400 mt-2 mb-1">Outgoing Messages:</div>
            <div v-if="messageValues.has(`out:${type}`)" class="ml-2 text-sm whitespace-pre-wrap">
              <div class="text-xs text-green-300">Sent at: {{ messageValues.get(`out:${type}`)?.timestamp }}</div>
              <pre>{{ JSON.stringify(messageValues.get(`out:${type}`)?.message, null, 2) }}</pre>
            </div>
            <div v-else class="ml-2 text-sm text-gray-400">No outgoing messages</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useMainVehicleStore } from '@/stores/mainVehicle'

/**
 * Interface representing a MAVLink message with timestamp information
 * @interface MessageData
 * @property {string} timestamp - ISO timestamp when the message was received/sent
 * @property {unknown} message - The actual message content
 */
interface MessageData {
  /**
   * Human-friendly timestamp when the message was received/sent
   */
  timestamp: string
  /**
   * The actual message content
   */
  message: unknown
}

const mainVehicleStore = useMainVehicleStore()
const searchQuery = ref('')

const availableMessageTypes = computed(() => {
  return Object.values(MAVLinkType).filter((type) => typeof type === 'string')
})

const filteredMessageTypes = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return availableMessageTypes.value
  return availableMessageTypes.value.filter((type) => type.toLowerCase().includes(query))
})

const trackedMessageTypes = ref<Set<MAVLinkType>>(new Set())
const messageValues = ref<Map<string, MessageData>>(new Map())

const toggleMessageTracking = (type: MAVLinkType): void => {
  if (trackedMessageTypes.value.has(type)) {
    removeMessageTracking(type)
  } else {
    addMessageTracking(type)
  }
}

const setupMessageListeners = (type: MAVLinkType): void => {
  try {
    mainVehicleStore.listenToIncomingMessages(type, (pack: Package) => {
      messageValues.value.set(`in:${type}`, {
        timestamp: format(new Date(), 'LLL dd, yyyy - HH:mm:ss.SSS'),
        message: pack.message,
      })
    })
    mainVehicleStore.listenToOutgoingMessages(type, (pack: Package) => {
      messageValues.value.set(`out:${type}`, {
        timestamp: format(new Date(), 'LLL dd, yyyy - HH:mm:ss.SSS'),
        message: pack.message,
      })
    })
  } catch (error) {
    console.error(`Failed to setup message listeners for type ${type}:`, error)
  }
}

const resetTrackedMessageTypes = (): void => {
  trackedMessageTypes.value.clear()
  messageValues.value.clear()
}

const addMessageTracking = (type: MAVLinkType): void => {
  trackedMessageTypes.value.add(type)
  setupMessageListeners(type)
}

const removeMessageTracking = (type: MAVLinkType): void => {
  trackedMessageTypes.value.delete(type)
  messageValues.value.delete(`in:${type}`)
  messageValues.value.delete(`out:${type}`)
}

// Set up listeners for any already tracked message types
onMounted(() => {
  trackedMessageTypes.value.forEach(setupMessageListeners)
})

// Clean up when component is unmounted
onUnmounted(() => {
  trackedMessageTypes.value.clear()
  messageValues.value.clear()
})
</script>
