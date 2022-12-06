<template>
  <v-menu v-if="showMainMenuButton" location="bottom">
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="menuProps" class="edit-mode-btn" icon="mdi-menu" :disabled="disableMainMenuButton" />
    </template>
    <v-card ref="mainMenu" class="pa-2 ma-2">
      <v-switch :model-value="editingMode" inset hide-details label="Edit mode" @click="editingMode = !editingMode" />
      <v-btn prepend-icon="mdi-cog" flat @click="showConfigurationMenu = true"> Configuration </v-btn>
      <v-checkbox v-model="alwaysShowMainMenuButton" label="Always show menu button" hide-details />
    </v-card>
  </v-menu>
  <SnappingGrid v-if="showGrid && editingMode" :grid-interval="gridInterval" class="snapping-grid" />
  <EditMenu v-model:edit-mode="editingMode" v-model:show-grid="showGrid" />
  <div class="main">
    <div v-for="layer in store.currentProfile.layers.slice().reverse()" :key="layer.hash" class="widget-layer">
      <template v-for="widget in layer.widgets.slice().reverse()" :key="widget">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
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
import {
  // type AsyncComponentLoader,
  computed,
  reactive,
  // defineAsyncComponent,
  ref,
} from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import ConfigurationMenu from '../components/ConfigurationMenu.vue'
import EditMenu from '../components/EditMenu.vue'
import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'
import Attitude from '../components/widgets/Attitude.vue'
import Compass from '../components/widgets/Compass.vue'
import HudCompass from '../components/widgets/HudCompass.vue'
import Indicators from '../components/widgets/Indicators.vue'
import Map from '../components/widgets/Map.vue'
import MissionInfo from '../components/widgets/MissionInfo.vue'
import PowerBar from '../components/widgets/PowerBar.vue'
import PowerSupply from '../components/widgets/PowerSupply.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

const store = useWidgetManagerStore()

const mouse = reactive(useMouse())
const alwaysShowMainMenuButton = ref(false)
const editingMode = ref(false)
const showGrid = ref(true)
const gridInterval = ref(0.01)
const mainMenu = ref()
const showConfigurationMenu = ref(false)

const widgetsPresent = computed(() => store.currentProfile.layers.some((layer) => layer.widgets.length != 0))

const { isOutside: notHoveringMainMenu } = useMouseInElement(mainMenu)
const mouseNearMainButton = computed(() => mouse.x < 100 && mouse.y < 100)
const disableMainMenuButton = computed(() => !mouseNearMainButton.value)
const showMainMenuButton = computed(() => {
  return (
    alwaysShowMainMenuButton.value || mouseNearMainButton.value || !notHoveringMainMenu.value || !widgetsPresent.value
  )
})

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
.main {
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
.edit-mode-btn {
  position: absolute;
  left: 15px;
  top: 15px;
  z-index: 60;
}
</style>
