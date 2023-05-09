<template>
  <SnappingGrid v-if="showGrid && store.editingMode" :grid-interval="gridInterval" class="snapping-grid" />
  <EditMenu v-model:edit-mode="store.editingMode" v-model:show-grid="showGrid" />
  <div class="widgets-view">
    <div v-for="layer in store.currentProfile.layers.slice().reverse()" :key="layer.hash" class="widget-layer">
      <template v-for="widget in layer.widgets.slice().reverse()" :key="widget">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
          :widget="widget"
          :allow-moving="store.editingMode"
          :allow-resizing="store.editingMode"
          :allow-ordering="store.editingMode"
          :allow-deleting="store.editingMode"
          :snap-to-grid="showGrid"
          :grid-interval="gridInterval"
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
          <template v-if="widget.component === WidgetType.VideoRecorder">
            <VideoRecorder :widget="widget" />
          </template>
          <!-- TODO: Use the line below instead of the 12 lines above -->
          <!-- <component :is="componentFromType(widget.component)"></component> -->
        </WidgetHugger>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  // type AsyncComponentLoader,
  // defineAsyncComponent,
  ref,
} from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

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
import VideoRecorder from '../components/widgets/VideoRecorder.vue'

const store = useWidgetManagerStore()

const showGrid = ref(true)
const gridInterval = ref(0.01)

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
</style>
