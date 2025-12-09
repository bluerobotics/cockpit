import { ref } from 'vue'

/**
 * WebRTC debug message interface
 */
export interface WebRTCDebugMessage {
  /**
   * Timestamp of the message
   */
  timestamp: Date
  /**
   * Stream ID of the message
   */
  streamId: string
  /**
   * Type of the message
   */
  type: 'signaller' | 'stream'
  /**
   * Message content
   */
  message: string
}

// Module-level state - shared across all consumers
const messages = ref<{ [streamId: string]: WebRTCDebugMessage[] }>({})

// Maximum number of messages to keep per stream (to prevent memory issues)
const maxMessagesPerStream = 1000

const addMessage = (streamId: string, type: 'signaller' | 'stream', message: string): void => {
  if (!messages.value[streamId]) {
    messages.value[streamId] = []
  }

  const debugMessage: WebRTCDebugMessage = {
    timestamp: new Date(),
    streamId,
    type,
    message,
  }

  messages.value[streamId].push(debugMessage)

  // Keep only the most recent messages
  if (messages.value[streamId].length > maxMessagesPerStream) {
    messages.value[streamId] = messages.value[streamId].slice(-maxMessagesPerStream)
  }
}

const getMessagesForStream = (streamId: string): WebRTCDebugMessage[] => {
  return messages.value[streamId] || []
}

const clearMessagesForStream = (streamId: string): void => {
  if (messages.value[streamId]) {
    messages.value[streamId] = []
  }
}

const clearAllMessages = (): void => {
  messages.value = {}
}

/**
 * Composable for WebRTC debug console functionality
 * @returns {object} The WebRTC debug console functionality
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useWebRTCDebugConsole = () => {
  return {
    messages,
    addMessage,
    getMessagesForStream,
    clearMessagesForStream,
    clearAllMessages,
  }
}
