<template>
  <BaseConfigurationView>
    <template #help-icon> </template>
    <template #title>Video configuration</template>
    <template #content>
      <div class="flex-col h-full ml-[1vw] max-w-[500px]">
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Allowed WebRTC remote IP Addresses</template>
          <template #info>
            IP Addresses of the Vehicle allowed to be used for the WebRTC ICE Routing. Usually, the IP of the
            tether/cabled interface. Blank means any route. E.g: 192.168.2.2.
            <br />
            <br />
            If you enable the auto-retrieval, Cockpit will try to fetch from BlueOS information about the available IP
            addresses, and auto-choose those associated with wired interfaces.
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
            Specific protocols can perform better in some network infrastructures, enhancing video stream quality.
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
            Increasing this value will result in increased video latency, but it can help to compensate the network
            jitter.
            <br />
            Cockpit's default is zero milliseconds, but you can leave it empty to use the browser's default.
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
            Specifies wether Cockpit should create a zip file when downloading multiple videos or subtitle files.
            <br />
            Keep in mind that, specially for long videos, this will add a delay on the download, since the files need to
            be zipped first. This can take just a couple seconds or even minutes, depending on the files sizes.
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
