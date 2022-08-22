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
      <template
        v-for="widget in layer.widgets.slice().reverse()"
        :key="widget.hash"
      >
        <WidgetHugger
          :position="widget.position"
          :size="widget.size"
          :allow-moving="editingMode"
          :allow-resizing="editingMode"
          :allow-ordering="editingMode"
          :allow-deleting="editingMode"
          :snap-to-grid="showGrid"
          :grid-interval="gridInterval"
          @move="(position) => store.updatePosition(widget.hash, position)"
          @resize="(size) => store.updateSize(widget.hash, size)"
          @send-back="store.sendWidgetBack(widget.hash)"
          @bring-front="store.bringWidgetFront(widget.hash)"
          @remove="store.deleteWidget(widget.hash)"
        >
          <template v-if="widget.component === WidgetType.CounterCardComponent">
            <CounterCard />
          </template>
          <template
            v-if="widget.component === WidgetType.CompassWidgetComponent"
          >
            <CompassWidget />
          </template>
          <template
            v-if="widget.component === WidgetType.IndependentReactorComponent"
          >
            <IndependentReactor />
          </template>
          <template
            v-if="widget.component === WidgetType.IndicatorsWidgetComponent"
          >
            <IndicatorsWidget />
          </template>
          <template v-if="widget.component === WidgetType.VideoPlayerComponent">
            <VideoPlayer />
          </template>
          <template v-if="widget.component === WidgetType.MapWidgetComponent">
            <MapWidget />
          </template>
          <!-- <component :is="componentFromName(widget.component)"></component> -->
        </WidgetHugger>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

import EditMenu from '../components/EditMenu.vue'
import SnappingGrid from '../components/SnappingGrid.vue'
import WidgetHugger from '../components/WidgetHugger.vue'
import CompassWidget from '../components/widgets/CompassWidget.vue'
import CounterCard from '../components/widgets/CounterCard.vue'
import IndependentReactor from '../components/widgets/IndependentReactor.vue'
import IndicatorsWidget from '../components/widgets/IndicatorsWidget.vue'
import MapWidget from '../components/widgets/MapWidget.vue'
import VideoPlayer from '../components/widgets/VideoPlayer.vue'

const store = useWidgetManagerStore()

const { x: mouseX } = useMouse()
const showEditButton = ref(false)
const editingMode = ref(false)
const showGrid = ref(false)
const gridInterval = ref(15)

const widgetsPresent = computed(() => {
  return store.layers.some((layer) => layer.widgets.length != 0)
})

watch(mouseX, () => {
  if (mouseX.value < 100 || !widgetsPresent.value) {
    showEditButton.value = true
    return
  }
  showEditButton.value = false
})

// const componentFromName = (componentName: string): AsyncComponentLoader => {
//   return defineAsyncComponent(
//     () => import(`../components/widgets/${componentName}.vue`)
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
