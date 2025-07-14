<template>
  <teleport to="body">
    <InteractionDialog v-model="showDialog" max-width="740" variant="text-only">
      <template #content>
        <div class="flex absolute top-0 right-0"><v-btn icon="mdi-close" variant="text" @click="closeDialog" /></div>
        <div class="flex flex-col justify-center align-center w-full h-full">
          <img :src="CockpitLogo" alt="Cockpit Logo" class="w-64 my-4" />
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
                <a :href="app_version.link" target="_blank" class="text-primary hover:underline">
                  {{ app_version.version }}
                </a>
                <br />
                <span class="text-sm text-gray-500">Released: {{ app_version.date }}</span>
              </p>
              <p class="my-3">Created by Blue Robotics</p>
              <p class="mt-1">Licensed under AGPL-3.0-only or LicenseRef-Cockpit-Custom</p>
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
            />
            <v-btn
              class="mx-3"
              variant="text"
              icon="mdi-web"
              size="xs"
              target="_blank"
              href="https://bluerobotics.com"
            />
            <v-btn
              class="mx-3"
              variant="text"
              icon="mdi-file-document-outline"
              size="xs"
              target="_blank"
              href="https://blueos.cloud/cockpit/docs"
            />
          </div>
        </div>
      </template>
      <template #actions
        ><div class="flex w-full justify-end"><v-btn @click="closeDialog">Close</v-btn></div></template
      >
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo.png'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { app_version } from '@/libs/cosmos'

const showDialog = ref(true)
const emit = defineEmits(['update:showAboutDialog'])

const closeDialog = (): void => {
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
