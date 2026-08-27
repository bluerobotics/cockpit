<template>
  <teleport to="body">
    <InteractionDialog v-model="showDialog" :max-width="showingNotices ? 900 : 740" variant="text-only">
      <template #content>
        <div class="flex absolute top-0 right-0"><v-btn icon="mdi-close" variant="text" @click="closeDialog" /></div>
        <div v-if="showingNotices" class="flex flex-col w-full h-full text-start">
          <p class="text-[20px] font-bold text-center mb-4">Third-party software</p>
          <p class="text-sm text-gray-400 mb-3">
            Cockpit includes the software listed below. Each component stays under its own license and is not relicensed
            under either arm of Cockpit's license.
          </p>
          <pre
            class="max-h-[60vh] overflow-auto rounded-md bg-[#0000002c] p-4 text-xs font-mono"
            tabindex="0"
            role="region"
            aria-label="Third-party software notices"
            >{{ thirdPartyNotices }}</pre
          >
        </div>
        <div v-else class="flex flex-col justify-center align-center w-full h-full">
          <div class="relative">
            <img :src="CockpitLogo" alt="Cockpit Logo" class="w-64 my-4" />
            <img
              v-if="!isElectron()"
              :src="lite"
              alt="Cockpit lite"
              class="absolute w-24 right-4 bottom-5 rotate-[-20deg] my-4"
            />
          </div>
          <div class="w-[90%] flex justify-between my-6 py-3">
            <div class="w-[45%] flex flex-col text-start">
              <p class="mb-1">
                Cockpit is an intuitive and customizable cross-platform ground control station for remote vehicles of
                all types.
              </p>
              <p class="my-3">It was created by Blue Robotics and is entirely open-source.</p>
              <p class="mt-1">
                It currently supports Ardupilot-based vehicles, but has plans to support any generic vehicle, be it
                communicating MAVLink or not.
              </p>
            </div>
            <div class="w-[45%] flex flex-col justify-end text-end">
              <p class="mb-1">
                Version
                <a
                  :href="app_version.link"
                  target="_blank"
                  class="text-primary hover:underline"
                  @click="openExternalLink('Version changelog')"
                >
                  {{ app_version.version }}
                </a>
                <br />
                <span class="text-sm text-gray-500">Released: {{ app_version.date }}</span>
              </p>
              <p class="my-3">Created by Blue Robotics</p>
              <p class="mt-1">Licensed under AGPL-3.0-only or LicenseRef-Cockpit-Custom</p>
              <v-btn variant="text" size="small" class="mt-2 self-end px-0 text-primary" @click="openNotices">
                Third-party software
              </v-btn>
            </div>
          </div>
          <div class="mb-5 flex justify-center align-center">
            <v-btn
              class="mx-3"
              variant="text"
              icon="mdi-github"
              size="xs"
              target="_blank"
              href="https://github.com/bluerobotics/cockpit"
              @click="openExternalLink('GitHub')"
            />
            <v-btn
              class="mx-3"
              variant="text"
              icon="mdi-web"
              size="xs"
              target="_blank"
              href="https://bluerobotics.com"
              @click="openExternalLink('Blue Robotics website')"
            />
            <v-btn
              class="mx-3"
              variant="text"
              icon="mdi-file-document-outline"
              size="xs"
              target="_blank"
              href="https://blueos.cloud/cockpit/docs"
              @click="openExternalLink('Documentation')"
            />
          </div>
        </div>
      </template>
      <template #actions>
        <div class="flex w-full" :class="showingNotices ? 'justify-between' : 'justify-end'">
          <v-btn v-if="showingNotices" variant="text" prepend-icon="mdi-chevron-left" @click="closeNotices">
            Back
          </v-btn>
          <v-btn @click="closeDialog">Close</v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo.avif'
import lite from '@/assets/lite.avif'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { app_version } from '@/libs/cosmos'
import { isElectron } from '@/libs/utils'

// Bundled as text rather than linked, so the notices travel with every build and stay readable offline,
// which is what the attribution terms of Font Awesome and leaflet.offline actually require.
import thirdPartyNotices from '../../THIRD-PARTY-NOTICES.md?raw'

const showDialog = ref(true)
const showingNotices = ref(false)
const emit = defineEmits(['update:showAboutDialog'])

const openExternalLink = (label: string): void => {
  logUserAction(`Opened '${label}' link from About dialog`)
}

const openNotices = (): void => {
  logUserAction('Opened the third-party software notices')
  showingNotices.value = true
}

const closeNotices = (): void => {
  logUserAction('Closed the third-party software notices')
  showingNotices.value = false
}

const closeDialog = (): void => {
  logUserAction('Closed About dialog')
  showDialog.value = false
  emit('update:showAboutDialog', false)
}

watch(
  () => showDialog.value,
  (newVal) => {
    if (!newVal) {
      emit('update:showAboutDialog', false)
    }
  }
)

onUnmounted(() => {
  showDialog.value = false
})
</script>
