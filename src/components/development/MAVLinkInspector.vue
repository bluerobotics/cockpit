<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-row gap-4 mb-4">
      <div class="flex-1">
        <div class="text-lg mb-2">Available Message Types</div>
        <div class="mb-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search messages..."
            class="w-full px-3 py-2 bg-[#FFFFFF22] rounded-md text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="bg-[#FFFFFF11] rounded-md p-2 max-h-[300px] overflow-y-auto">
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
      <div class="flex-1">
        <div class="text-lg mb-2">Message Values</div>
        <div class="bg-[#FFFFFF11] rounded-md p-2 max-h-[340px] overflow-y-auto">
          <div v-for="type in trackedMessageTypes" :key="type" class="mb-2">
            <div class="font-bold">{{ type }}</div>
            <div class="text-xs text-gray-400 mb-1">Incoming Messages:</div>
            <pre class="text-sm whitespace-pre-wrap">{{
              JSON.stringify(messageValues.get(`in:${type}`), null, 2)
            }}</pre>
            <div class="text-xs text-gray-400 mt-2 mb-1">Outgoing Messages:</div>
            <pre class="text-sm whitespace-pre-wrap">{{
              JSON.stringify(messageValues.get(`out:${type}`), null, 2)
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useMainVehicleStore } from '@/stores/mainVehicle'

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
const messageValues = ref<Map<string, unknown>>(new Map())

const toggleMessageTracking = (type: MAVLinkType): void => {
  if (trackedMessageTypes.value.has(type)) {
    trackedMessageTypes.value.delete(type)
    messageValues.value.delete(`in:${type}`)
    messageValues.value.delete(`out:${type}`)
  } else {
    trackedMessageTypes.value.add(type)
    setupMessageListeners(type)
  }
}

const setupMessageListeners = (type: MAVLinkType): void => {
  try {
    mainVehicleStore.listenToIncomingMessages(type, (pack: Package) => {
      messageValues.value.set(`in:${type}`, pack.message)
    })
    mainVehicleStore.listenToOutgoingMessages(type, (pack: Package) => {
      messageValues.value.set(`out:${type}`, pack.message)
    })
  } catch (error) {
    console.error(`Failed to setup message listeners for type ${type}:`, error)
  }
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
