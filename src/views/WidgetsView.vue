<template>
  <SnappingGrid v-if="store.showGrid && store.editingMode" :grid-interval="store.gridInterval" class="snapping-grid" />
  <div class="widgets-view">
    <div v-for="view in store.viewsToShow" :key="view.hash" class="widget-view">
      <template v-for="widget in view.widgets.slice().reverse()" :key="widget.hash">
        <WidgetHugger
          v-if="Object.values(WidgetType).includes(widget.component)"
          :widget="widget"
          :allow-moving="widget.managerVars.allowMoving"
          :allow-resizing="store.editingMode"
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
          <template v-if="widget.component === WidgetType.CompassHUD">
            <CompassHUD :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.IFrame">
            <IFrame :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.ImageViewer">
            <ImageView :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Map">
            <Map :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.MiniWidgetsBar">
            <MiniWidgetsBar :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.URLVideoPlayer">
            <URLVideoPlayer :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.VideoPlayer">
            <VideoPlayer :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.VirtualHorizon">
            <VirtualHorizon :widget="widget" />
          </template>
          <!-- TODO: Use the line below instead of the 12 lines above -->
          <!-- <component :is="componentFromType(widget.component)"></component> -->
        </WidgetHugger>
      </template>
      <div class="w-full h-full bg-slate-500" />
    </div>
  </div>
</template>

<script setup lang="ts">
// import { type AsyncComponentLoader, defineAsyncComponent } from 'vue'

import ImageView from '@/components/widgets/ImageView.vue'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'
import Attitude from '../components/widgets/Attitude.vue'
import Compass from '../components/widgets/Compass.vue'
import CompassHUD from '../components/widgets/CompassHUD.vue'
import DepthHUD from '../components/widgets/DepthHUD.vue'
import IFrame from '../components/widgets/IFrame.vue'
import Map from '../components/widgets/Map.vue'
import MiniWidgetsBar from '../components/widgets/MiniWidgetsBar.vue'
import URLVideoPlayer from '../components/widgets/URLVideoPlayer.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'
import VirtualHorizon from '../components/widgets/VirtualHorizon.vue'

const store = useWidgetManagerStore()

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
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}
.snapping-grid {
  z-index: 40;
}
.widget-view {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgb(122, 25, 25);
  z-index: 50;
}
</style>
