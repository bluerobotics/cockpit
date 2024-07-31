<template>
  <BaseConfigurationView>
    <template #help-icon> </template>
    <template #title>Video configuration</template>
    <template #content>
      <div class="flex-col h-full ml-[1vw] max-w-[500px] max-h-[85vh] overflow-y-auto pr-3">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Allowed WebRTC remote IP Addresses</template>
          <template #info>
            Select the IP addresses to allow connecting to for WebRTC video streaming. For best performance it is
            recommended to only use the most reliable interfaces - e.g. avoid wireless interfaces if there is a
            tethered/wired interface available. If no value is specified, all available routes are allowed.
          </template>
          <template #content>
            <div class="flex justify-center flex-col w-[90%] ml-2">
              <v-combobox
                v-model="allowedIceIps"
                multiple
                :items="availableIceIps"
                label="Allowed WebRTC remote IP Addresses"
                class="uri-input"
                variant="outlined"
                chips
                theme="dark"
                density="compact"
                clearable
                hide-details
              />
              <v-checkbox
                v-model="videoStore.enableAutoIceIpFetch"
                label="Enable auto-retrieval of allowed IP addresses"
                hide-details
                class="mb-2"
              />
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Allowed WebRTC protocols:</template>
          <template #info>
            <li>
              Video stream quality may be enhanced by enforcing a protocol that is well-suited to the available network
              infrastructure.
            </li>
            <li>
              UDP can be lower latency but may drop frames, while TCP enforces frame ordering at the cost of some
              increased latency and jitter.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-start">
              <v-checkbox
                v-for="protocol in availableICEProtocols"
                :key="protocol"
                v-model="allowedIceProtocols"
                :label="protocol.toUpperCase()"
                :value="protocol"
                :disabled="
                  allowedIceProtocols.length === 1 && allowedIceProtocols[0].toLowerCase() === protocol.toLowerCase()
                "
                class="text-sm mx-2"
              />
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>RTP Jitter Buffer (Target) duration:</template>
          <template #info>
            <li>
              Increasing the buffer duration causes additional video latency, but can help to compensate for network
              jitter and provide more consistent frame timing in the display.
            </li>
            <li>
              Cockpit's default is zero milliseconds, but you can set a custom value, or leave the field empty to use
              your browser's default.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-start w-[50%] ml-2">
              <v-text-field
                v-model.number="jitterBufferTarget"
                variant="filled"
                placeholder="auto"
                type="number"
                class="uri-input mt-4"
                theme="dark"
                density="compact"
                max="4000"
                min="0"
                :rules="jitterBufferTargetRules"
                @input="handleJitterBufferTargetInput"
              />
              <a class="ml-3">ms</a>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>File download options:</template>
          <template #info>
            <li>
              Select whether video and subtitle files should be bundled together in a ZIP archive, or downloaded
              individually.
            </li>
            <li>
              Zipping allows a single download of a group of files, but requires waiting for the files to get zipped
              together. Depending on file sizes, the zipping process may complete within seconds or could take minutes.
            </li>
          </template>
          <template #content>
            <div class="flex items-center justify-start w-[50%] ml-2">
              <v-checkbox v-model="videoStore.zipMultipleFiles" label="Zip multiple files" class="text-sm mx-2" />
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useVideoStore } from '@/stores/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

/**
 * Available ICE protocols as described in
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/protocol
 */
const availableICEProtocols = ['udp', 'tcp']

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()

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
<style scoped>
.uri-input {
  width: 95%;
  margin-block: 10px;
}
</style>
