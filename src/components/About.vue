<template>
  <teleport to="body">
    <InteractionDialog :show-dialog="showDialog" max-width="740" variant="text-only">
      <template #content>
        <div class="flex flex-col justify-center align-center w-full h-full">
          <img :src="CockpitLogo" alt="Cockpit Logo" class="w-64 my-4" />
          <div class="w-[90%] flex justify-between my-8 py-3">
            <div class="w-[45%] flex flex-col text-start">
              <p>
                Cockpit is an intuitive and customizable cross-platform ground control station for remote vehicles of
                all types.
              </p>
              <p class="my-3">It was created by Blue Robotics and is entirely open-source.</p>
              <p>
                It currently supports Ardupilot-based vehicles, but has plans to support any generic vehicle, be it
                communicating MAVLink or not.
              </p>
            </div>
            <div class="w-[45%] flex flex-col text-end">
              <p>Version:</p>
              <p class="mb-3">1.0.0</p>
              <p>Author:</p>
              <p class="mb-3">Blue Robotics</p>
              <p>Maintainers:</p>
              <p v-for="(maintainer, i) in maintainers" :key="i" class="mb-0.5">{{ maintainer.name }}</p>
              <p class="mt-3">Licensed under AGPL-3.0-only or LicenseRef-Cockpit-Custom</p>
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
              href="https://docs.bluerobotics.com/ardusub-zola/software/control-station/Cockpit-1.0/overview"
            />
          </div>
        </div>
      </template>
      <template #actions></template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import CockpitLogo from '@/assets/cockpit-logo.png'
import InteractionDialog from '@/components/InteractionDialog.vue'

const showDialog = ref(true)

const maintainers = [
  {
    name: 'Rafael Araujo Lehmkuhl',
    email: 'rafael.lehmkuhl93@gmail.com',
  },
  {
    name: 'Patrick José Pereira',
    email: '',
  },
  {
    name: 'Arturo Manzoli',
    email: '',
  },
]
</script>
