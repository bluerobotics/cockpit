<template>
  <div>
    <v-icon> mdi-volume-high </v-icon>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { Widget } from '@/types/widgets'

const store = useMainVehicleStore()

const message = computed(() => `${store.statusText.text}`)
const armed = computed(() => (store.isArmed ? 'Armed' : 'Disarmed'))
const mode = computed(() => store.mode)

const synth = window.speechSynthesis
let interval: ReturnType<typeof setInterval> | undefined = undefined

defineProps<{
  /**
   * Widget reference
   */
  // eslint-disable-next-line vue/no-unused-properties
  widget: Widget
}>()

onBeforeUnmount(() => {
  if (interval) {
    clearInterval(interval)
  }
})

// We need to cache these otherwise they get garbage collected...
const utterance_cache: SpeechSynthesisUtterance[] = []

/**
 * Speaks a text out loud using the browsers TTS engine
 *
 * @param {string} text string
 */
function speak(text: string): void {
  const utterThis = new SpeechSynthesisUtterance(text)
  utterance_cache.push(utterThis)
  utterThis.onend = function () {
    delete utterance_cache[utterance_cache.indexOf(utterThis)]
  }
  utterThis.onerror = function (event) {
    console.error(`SpeechSynthesisUtterance error: ${event}`)
  }
  synth.speak(utterThis)
}

const messageRef = ref(message)
watch(messageRef, (text: string) => {
  text ? speak(text) : null
})

const armedRef = ref(armed)
watch(armedRef, (text: string) => {
  text ? speak(text) : null
})

const modeRef = ref(mode)
watch(modeRef, (text) => {
  text ? speak(text) : null
})
</script>
