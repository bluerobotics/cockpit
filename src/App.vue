<template>
  <v-app>
    <v-main>
      <div id="mainTopBar" class="z-[60] w-full h-12 bg-slate-600/50 absolute flex">
        <button class="flex items-center justify-center h-full aspect-square" @click="showMainMenu = true">
          <img class="main-menu-button-image" src="@/assets/blue-robotics-logo.svg" />
        </button>
      </div>
      <div ref="mainMenu" class="main-menu">
        <div class="main-menu-content">
          <v-btn
            v-if="route.name === 'widgets-view'"
            prepend-icon="mdi-pencil"
            variant="plain"
            @click="widgetStore.editingMode = !widgetStore.editingMode"
          >
            Edit mode
          </v-btn>
          <v-btn v-if="route.name !== 'widgets-view'" prepend-icon="mdi-send" variant="plain" to="/">Flight</v-btn>
          <v-btn
            v-if="route.name !== 'Mission planning'"
            prepend-icon="mdi-map-marker-radius"
            variant="plain"
            to="/mission-planning"
          >
            Mission planning
          </v-btn>
          <v-btn prepend-icon="mdi-cog" variant="plain" @click="showConfigurationMenu = true">Configuration</v-btn>
          <v-btn :prepend-icon="fullScreenToggleIcon" variant="plain" @click="toggleFullscreen">
            {{ isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen' }}
          </v-btn>
        </div>
      </div>
      <teleport to="body">
        <v-dialog v-model="showConfigurationMenu" transition="dialog-bottom-transition" width="100%" height="100%">
          <ConfigurationMenu />
        </v-dialog>
      </teleport>

      <div ref="routerSection">
        <router-view />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onClickOutside, useDebounceFn, useFullscreen } from '@vueuse/core'
import {
  // type AsyncComponentLoader,
  computed,
  onBeforeUnmount,
  // defineAsyncComponent,
  ref,
} from 'vue'
import { useRoute } from 'vue-router'

import ConfigurationMenu from '@/components/ConfigurationMenu.vue'
import { CockpitAction, registerActionCallback, unregisterActionCallback } from '@/libs/joystick/protocols'

import { useWidgetManagerStore } from './stores/widgetManager'

const widgetStore = useWidgetManagerStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = ref(false)

const mainMenu = ref()
onClickOutside(mainMenu, () => (showMainMenu.value = false))

const route = useRoute()
const routerSection = ref()

// Full screen toggling
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const debouncedToggleFullScreen = useDebounceFn(() => toggleFullscreen(), 500)
const fullScreenCallbackId = registerActionCallback(CockpitAction.TOGGLE_FULL_SCREEN, debouncedToggleFullScreen)
onBeforeUnmount(() => unregisterActionCallback(fullScreenCallbackId))

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-overscan'))

const mainMenuOpacity = computed(() => (showMainMenu.value ? '100%' : '0%'))
</script>

<style>
html,
body {
  /* Removes the scrollbar */
  overflow: hidden !important;
}
.main-menu-button-image {
  width: 80%;
  height: 80%;
  filter: invert(100%) sepia(0%) saturate(100%) hue-rotate(0deg) brightness(100%) contrast(100%);
}
.main-menu-button-image:hover {
  filter: invert(100%) sepia(0%) saturate(100%) hue-rotate(0deg) brightness(100%) contrast(90%);
}
.main-menu {
  opacity: v-bind('mainMenuOpacity');
  transition: opacity 0.1s ease-in-out;
  position: absolute;
  top: 50%;
  left: 50%;
  margin-right: -50%;
  transform: translate(-50%, -50%);
  height: 300px;
  width: 300px;
  z-index: 60;
  background-color: rgba(47, 57, 66, 0.8);
  backdrop-filter: blur(1px);
}
.main-menu-content {
  color: white;
  margin-left: 45px;
  padding: 3px;
}
</style>
