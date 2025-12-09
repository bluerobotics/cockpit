<template>
  <div class="webrtc-debug-console">
    <div class="console-header">
      <div class="console-controls">
        <v-btn
          size="x-small"
          variant="text"
          color="white"
          :disabled="isAtBottom"
          icon="mdi-arrow-down"
          @click="scrollToBottom"
        />
        <v-btn size="x-small" variant="text" color="white" icon="mdi-delete" @click="clearConsole" />
      </div>
    </div>

    <div ref="consoleContainer" class="console-content" @scroll="onScroll">
      <div v-if="messages.length === 0" class="no-messages">No debug messages yet...</div>
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="console-message"
        :class="[`message-${message.type}`]"
      >
        <span class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</span>
        <span class="message-type">[{{ message.type.toUpperCase() }}]</span>
        <span class="message-content">{{ message.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useWebRTCDebugConsole } from '@/composables/webRTCDebugConsole'

const props = defineProps<{
  /**
   * Stream ID to display debug messages for
   */
  streamId: string
}>()

const debugConsole = useWebRTCDebugConsole()
const consoleContainer = ref<HTMLElement>()
const isAtBottom = ref(true)
const autoScroll = ref(true)

const messages = computed(() => {
  return debugConsole.getMessagesForStream(props.streamId)
})

const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const scrollToBottom = (): void => {
  if (consoleContainer.value) {
    consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight
    autoScroll.value = true
  }
}

const clearConsole = (): void => {
  debugConsole.clearMessagesForStream(props.streamId)
}

const onScroll = (): void => {
  if (!consoleContainer.value) return

  const { scrollTop, scrollHeight, clientHeight } = consoleContainer.value
  const threshold = 50 // pixels from bottom to consider "at bottom"

  isAtBottom.value = scrollTop + clientHeight >= scrollHeight - threshold

  // Disable auto-scroll if user manually scrolls up
  if (!isAtBottom.value) {
    autoScroll.value = false
  } else {
    autoScroll.value = true
  }
}

// Auto-scroll to bottom when new messages arrive (if auto-scroll is enabled)
watch(
  messages,
  async () => {
    if (autoScroll.value) {
      await nextTick()
      scrollToBottom()
    }
  },
  { deep: true }
)

onMounted(() => {
  // Initial scroll to bottom
  nextTick(() => {
    scrollToBottom()
  })
})

onUnmounted(() => {
  // Clean up if needed
})
</script>

<style scoped>
.webrtc-debug-console {
  display: flex;
  flex-direction: column;
  height: 250px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  overflow: hidden;
}

.console-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.console-controls {
  display: flex;
  gap: 4px;
}

.console-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  color: white;
  font-size: 11px;
  line-height: 1.5;
}

.console-content::-webkit-scrollbar {
  width: 6px;
}

.console-content::-webkit-scrollbar-track {
  background: transparent;
}

.console-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.console-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.no-messages {
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  padding: 24px;
  font-style: italic;
  font-size: 12px;
}

.console-message {
  display: flex;
  padding: 2px 4px;
  border-radius: 2px;
  margin-bottom: 1px;
}

.message-timestamp {
  color: rgba(255, 255, 255, 0.6);
  margin-right: 8px;
  flex-shrink: 0;
  font-size: 10px;
}

.message-type {
  margin-right: 8px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 10px;
}

.message-signaller .message-type {
  color: #81c784;
}

.message-stream .message-type {
  color: #64b5f6;
}

.message-content {
  flex: 1;
  word-break: break-word;
}

.message-signaller {
  background-color: rgba(129, 199, 132, 0.08);
}

.message-stream {
  background-color: rgba(100, 181, 246, 0.08);
}
</style>
