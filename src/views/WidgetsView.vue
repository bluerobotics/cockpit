<template>
  <button class="main-menu-button" @click="showMainMenu(true)" @mouseover="showMainMenu(true)">
    <img class="main-menu-button-image" src="@/assets/blue-robotics-logo.svg" />
  </button>
  <div ref="mainMenu" class="main-menu">
    <div class="main-menu-content">
      <v-btn prepend-icon="mdi-pencil" variant="plain" @click="editingMode = !editingMode">Edit mode</v-btn>
      <v-btn prepend-icon="mdi-cog" variant="plain" @click="showConfigurationMenu = true">Configuration</v-btn>
    </div>
  </div>
  <SnappingGrid v-if="showGrid && editingMode" :grid-interval="gridInterval" class="snapping-grid" />
  <EditMenu v-model:edit-mode="editingMode" v-model:show-grid="showGrid" />
  <div class="widgets-view">
    <div v-for="layer in store.currentProfile.layers.slice().reverse()" :key="layer.hash" class="widget-layer">
      <template v-for="widget in layer.widgets.slice().reverse()" :key="widget">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
          :widget="widget"
          :position="widget.position"
          :size="widget.size"
          :allow-moving="editingMode"
          :allow-resizing="editingMode"
          :allow-ordering="editingMode"
          :allow-deleting="editingMode"
          :snap-to-grid="showGrid"
          :grid-interval="gridInterval"
          @move="(position) => store.updatePosition(widget, position)"
          @resize="(size) => store.updateSize(widget, size)"
          @send-back="store.sendWidgetBack(widget)"
          @bring-front="store.bringWidgetFront(widget)"
          @remove="store.deleteWidget(widget)"
        >
          <template v-if="widget.component === WidgetType.Attitude">
            <Attitude :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Compass">
            <Compass :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.DepthHUD">
            <DepthHUD :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.HudCompass">
            <HudCompass :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Indicators">
            <Indicators :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Map">
            <Map :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.MissionInfo">
            <MissionInfo :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.PowerBar">
            <PowerBar :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.PowerSupply">
            <PowerSupply :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.VideoPlayer">
            <VideoPlayer :widget="widget" />
          </template>
          <!-- TODO: Use the line below instead of the 12 lines above -->
          <!-- <component :is="componentFromType(widget.component)"></component> -->
        </WidgetHugger>
      </template>
    </div>
  </div>
  <teleport to="body">
    <v-dialog v-model="showConfigurationMenu" transition="dialog-bottom-transition" width="100%" height="100%">
      <ConfigurationMenu />
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { useMouse, useMouseInElement } from '@vueuse/core'
import gsap from 'gsap'
import {
  // type AsyncComponentLoader,
  computed,
  reactive,
  // defineAsyncComponent,
  ref,
  watch,
} from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import ConfigurationMenu from '../components/ConfigurationMenu.vue'
import EditMenu from '../components/EditMenu.vue'
import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'
import Attitude from '../components/widgets/Attitude.vue'
import Compass from '../components/widgets/Compass.vue'
import DepthHUD from '../components/widgets/DepthHUD.vue'
import HudCompass from '../components/widgets/HudCompass.vue'
import Indicators from '../components/widgets/Indicators.vue'
import Map from '../components/widgets/Map.vue'
import MissionInfo from '../components/widgets/MissionInfo.vue'
import PowerBar from '../components/widgets/PowerBar.vue'
import PowerSupply from '../components/widgets/PowerSupply.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

const store = useWidgetManagerStore()

const mouse = reactive(useMouse())
const editingMode = ref(false)
const showGrid = ref(true)
const gridInterval = ref(0.01)
const mainMenu = ref()
const showConfigurationMenu = ref(false)

const { isOutside: notHoveringMainMenu } = useMouseInElement(mainMenu)
const mouseNearMainButton = computed(() => mouse.x < 100 && mouse.y < 100)
watch(mouseNearMainButton, (isNear) => showMainMenuButton(isNear))

watch(notHoveringMainMenu, (isNotHovering) => {
  if (isNotHovering) {
    showMainMenu(false)
  }
})

const showMainMenuButton = (show: boolean): void => {
  gsap.to('.main-menu-button', show ? { x: 175, duration: 0.25 } : { x: -200, duration: 0.25 })
}

const showMainMenu = (show: boolean): void => {
  gsap.to('.main-menu', show ? { x: 370, duration: 0.25 } : { x: -300, duration: 0.25 })
}

// TODO: Make this work
// This function allows us to load any component without declaring it in the template, just
// adding it to the WidgetType enum, but it's currently buggy as it re-mounts the component
// anytime a HTML property of it is changes (when someone hovers the element, for example).
// const componentFromType = (componentType: WidgetType): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentType}.vue`)
//   )
// }
</script>

<style scoped>
.widgets-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.snapping-grid {
  z-index: 40;
}
.widget-layer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgb(122, 25, 25);
  z-index: 50;
}
.main-menu-button {
  position: absolute;
  left: -200px;
  top: 0px;
  width: 100px;
  height: 60px;
  background-color: rgba(47, 57, 66, 0.8);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}
.main-menu-button-image {
  margin-left: 20px;
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
