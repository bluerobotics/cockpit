<template>
  <v-btn
    v-if="showEditButton"
    class="ml-2 edit-mode-btn"
    icon="mdi-pencil"
    @click="editingMode = !editingMode"
  />
  <SnappingGrid
    v-if="showGrid && editingMode"
    :grid-interval="gridInterval"
    class="snapping-grid"
  />
  <div class="main">
    <EditMenu
      v-if="editingMode"
      v-model:show-grid="showGrid"
      class="edit-menu"
    />
    <div
      v-for="layer in store.layers.slice().reverse()"
      :key="layer.hash"
      class="widget-layer"
    >
      <template v-for="widget in layer.widgets.slice().reverse()" :key="widget">
        <WidgetHugger
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
          <template v-if="widget.component === WidgetType.Compass">
            <Compass :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Indicators">
            <Indicators :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Map">
            <Map :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.PowerSupply">
            <PowerSupply :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.VideoPlayer">
            <VideoPlayer :widget="widget" />
          </template>
          <template v-if="widget.component === WidgetType.Joystick">
            <Joystick />
          </template>
          <!-- TODO: Use the line below instead of the 12 lines above -->
          <!-- <component :is="componentFromType(widget.component)"></component> -->
        </WidgetHugger>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse } from '@vueuse/core'
import {
  // type AsyncComponentLoader,
  computed,
  // defineAsyncComponent,
  ref,
  watch,
} from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import EditMenu from '../components/EditMenu.vue'
import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'
import Compass from '../components/widgets/Compass.vue'
import Indicators from '../components/widgets/Indicators.vue'
import Joystick from '../components/widgets/Joystick.vue'
import Map from '../components/widgets/Map.vue'
import PowerSupply from '../components/widgets/PowerSupply.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

const store = useWidgetManagerStore()

const { x: mouseX } = useMouse()
const showEditButton = ref(false)
const editingMode = ref(false)
const showGrid = ref(false)
const gridInterval = ref(0.01)

const widgetsPresent = computed(() =>
  store.layers.some((layer) => layer.widgets.length != 0)
)

watch(mouseX, () => {
  showEditButton.value = mouseX.value < 100 || !widgetsPresent.value
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
  left: 10;
  top: 50%;
  z-index: 60;
}
.edit-menu {
  z-index: 100;
}
</style>
