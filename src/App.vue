<template>
  <v-app>
    <v-main>
      <div id="mainTopBar" class="z-[60] w-full h-12 bg-slate-600/50 absolute flex">
        <button class="flex items-center justify-center h-full aspect-square" @click="showMainMenu(true)">
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
import { SwipeDirection, useDebounceFn, useFullscreen, useMouse, useMouseInElement, useSwipe } from '@vueuse/core'
import gsap from 'gsap'
import {
  // type AsyncComponentLoader,
  computed,
  onBeforeUnmount,
  reactive,
  // defineAsyncComponent,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'

import ConfigurationMenu from '@/components/ConfigurationMenu.vue'
import { CockpitAction, registerActionCallback, unregisterActionCallback } from '@/libs/joystick/protocols'

import { useWidgetManagerStore } from './stores/widgetManager'

const widgetStore = useWidgetManagerStore()

const showConfigurationMenu = ref(false)

// Main menu
const showMainMenu = (show: boolean): void => {
  gsap.to('.main-menu', show ? { x: 370, duration: 0.25 } : { x: -300, duration: 0.25 })
}

const mainMenu = ref()
const { isOutside: notHoveringMainMenu } = useMouseInElement(mainMenu)
watch(notHoveringMainMenu, (isNotHovering) => {
  if (isNotHovering) {
    showMainMenu(false)
  }
})

const route = useRoute()
const routerSection = ref()
const { isSwiping, direction: swipeDirection } = useSwipe(routerSection)
watch(isSwiping, () => {
  if (!isSwiping.value || [SwipeDirection.NONE, null].includes(swipeDirection.value)) return
  if ([SwipeDirection.LEFT, SwipeDirection.RIGHT].includes(swipeDirection.value as SwipeDirection)) {
    showMainMenu(swipeDirection.value === SwipeDirection.RIGHT)
  }
})

// Full screen toggling
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const debouncedToggleFullScreen = useDebounceFn(() => toggleFullscreen(), 500)
const fullScreenCallbackId = registerActionCallback(CockpitAction.TOGGLE_FULL_SCREEN, debouncedToggleFullScreen)
onBeforeUnmount(() => unregisterActionCallback(fullScreenCallbackId))

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-overscan'))
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
  filter: invert(87%) sepia(5%) saturate(2994%) hue-rotate(140deg) brightness(93%) contrast(90%);
}
.main-menu-button-image:active {
  filter: invert(87%) sepia(5%) saturate(4000%) hue-rotate(140deg) brightness(60%) contrast(100%);
}
.main-menu {
  position: absolute;
  left: -400px;
  top: 60px;
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
