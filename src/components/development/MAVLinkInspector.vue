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
          <v-tooltip v-for="type in filteredMessageTypes" :key="type" location="top" open-delay="300">
            <template #activator="{ props: tooltipProps }">
              <div
                v-bind="tooltipProps"
                class="cursor-pointer hover:bg-[#FFFFFF22] p-1 rounded"
                :class="{ 'bg-[#FFFFFF33]': trackedMessageTypes.has(type) }"
                @click="toggleMessageTracking(type)"
              >
                {{ type }}
              </div>
            </template>
            <div class="whitespace-pre-line">{{ messageTooltip(type) }}</div>
          </v-tooltip>
          <div v-if="filteredMessageTypes.length === 0" class="text-gray-400 text-center p-2">No messages found</div>
        </div>
      </div>
      <div v-if="trackedMessageTypes.size > 0" class="w-auto mr-2">
        <div class="text-lg mb-2">Message Values</div>
        <div class="bg-[#FFFFFF11] rounded-md p-2 w-[24rem] overflow-y-auto">
          <MAVLinkInspectorItem
            v-for="type in trackedMessageTypes"
            :key="type"
            :type="type"
            @remove="removeMessageTracking"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import mavlinkDefinition from '@/libs/vehicle/mavlink/mavlink-definition'

import MAVLinkInspectorItem from './MAVLinkInspectorItem.vue'

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

const toggleMessageTracking = (type: MAVLinkType): void => {
  if (trackedMessageTypes.value.has(type)) {
    removeMessageTracking(type)
  } else {
    addMessageTracking(type)
  }
}

const resetTrackedMessageTypes = (): void => {
  trackedMessageTypes.value.clear()
}

const addMessageTracking = (type: MAVLinkType): void => {
  trackedMessageTypes.value.add(type)
}

const removeMessageTracking = (type: MAVLinkType): void => {
  trackedMessageTypes.value.delete(type)
}

const messageTooltip = (messageName: string): string => {
  const description = mavlinkDefinition.message(messageName)?.description ?? messageName
  if (description.length > 128) {
    return description.slice(0, 128) + '...'
  }
  return description
}
</script>
