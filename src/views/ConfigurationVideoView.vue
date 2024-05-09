<template>
  <BaseConfigurationView>
    <template #title>Video configuration</template>
    <template #content>
      <div
        class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-[40%]"
      >
        <p class="font-bold">
          This is the video configuration page. Here you can configure the behavior of your video streams.
        </p>
        <br />
        <p>
          First of all, it's important that you select the IP (or IPs) that should be allowed to route video streams.
          Those will usually be the ones for your wired connections. This configuration allows Cockpit to block other
          available IPs, like those from WiFi and Hotspot connections, preventing lag and stuttering in your video
          streams.
        </p>
        <br />
        <p>
          Additionally, you can choose specific protocols that will be permitted for use in your video streams. This
          selection allows you to choose protocols that could perform better in your network infrastructure, enhancing
          the quality of your video streams.
        </p>
      </div>

      <div class="flex w-[30rem] flex-wrap">
        <v-combobox
          v-model="allowedIceIps"
          multiple
          :items="availableIceIps"
          label="Allowed WebRTC remote IP Addresses"
          class="w-full my-3 uri-input"
          variant="outlined"
          chips
          clearable
          hint="IP Addresses of the Vehicle allowed to be used for the WebRTC ICE Routing. Usually, the IP of the tether/cabled interface. Blank means any route. E.g: 192.168.2.2"
        />
      </div>

      <p class="text-sm font-bold text-grey-darken-1 bg-grey-lighten-5">Allowed WebRTC protocols:</p>
      <div class="flex items-center justify-start">
        <div v-for="protocol in availableICEProtocols" :key="protocol" class="mx-2">
          <v-checkbox
            v-model="allowedIceProtocols"
            :label="protocol.toUpperCase()"
            :value="protocol"
            :disabled="
              allowedIceProtocols.length === 1 && allowedIceProtocols[0].toLowerCase() === protocol.toLowerCase()
            "
            class="text-sm"
          />
        </div>
      </div>

      <p class="text-sm font-bold text-grey-darken-1 bg-grey-lighten-5">RTP Jitter Buffer (Target) duration:</p>
      <div
        class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-[40%]"
      >
        <p>Increasing this will result in increased video latency, but it can help compensate the network jitter.</p>
        <br />
        <p>Cockpit's default is zero milliseconds, but you can leave it empty to use the browser's default.</p>
      </div>
      <div class="flex items-center justify-start">
        <v-text-field
          v-model.number="jitterBufferTarget"
          placeholder="auto"
          type="number"
          style="width: 100px"
          class="text-sm"
          max="4000"
          min="0"
          :rules="jitterBufferTargetRules"
          @input="handleJitterBufferTargetInput"
        />
        <a class="pl-1">ms</a>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import { useVideoStore } from '@/stores/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

/**
 * Available ICE protocols as described in
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/protocol
 */
const availableICEProtocols = ['udp', 'tcp']

const videoStore = useVideoStore()

onMounted(() => {
  if (allowedIceProtocols.value.length === 0) {
    allowedIceProtocols.value = availableICEProtocols
  }
})

/**
 * Handles the input for setting the jitter buffer target
 * @param {string} input - The input value to be processed
 */
function handleJitterBufferTargetInput(input: InputEvent): void {
  if (input.data === null) {
    jitterBufferTarget.value = null
  }
}

const jitterBufferTargetRules = [
  (value: number | '') => value === '' || value >= 0 || 'Must be >= 0',
  (value: number | '') => value === '' || value <= 4000 || 'Must be <= 4000',
]

const { allowedIceIps, allowedIceProtocols, availableIceIps, jitterBufferTarget } = storeToRefs(videoStore)
</script>
