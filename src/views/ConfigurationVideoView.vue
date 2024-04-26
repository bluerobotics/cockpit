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

      <div class="flex w-[30rem] flex-wrap">
        <v-combobox
          v-model="allowedIceProtocols"
          multiple
          :items="availableICEProtocols"
          label="Allowed WebRTC protocols"
          class="w-full my-3 uri-input"
          variant="outlined"
          chips
          clearable
          hint="Specific protocols allowed to be used for the WebRTC. Blank means any protocol will be supported."
          persistent-hint
        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useVideoStore } from '@/stores/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

/**
 * Available ICE protocols as described in
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/protocol
 */
const availableICEProtocols = ['udp', 'tcp']

const videoStore = useVideoStore()
const { allowedIceIps, allowedIceProtocols, availableIceIps } = storeToRefs(videoStore)
</script>
