<template>
  <div
    class="bar"
    :class="position === 'top' ? 'top-bar' : 'bottom-bar'"
    :style="[interfaceStore.globalGlassMenuStyles, interfaceStore.isOnSmallScreen ? scaleStyle : undefined]"
  >
    <slot name="prepend" />
    <template v-if="position === 'top'">
      <div class="flex-1">
        <MiniWidgetContainer :container="containers[0]" :allow-editing="widgetStore.editingMode" align="start" />
      </div>
      <div class="grow" />
      <div class="flex-1">
        <MiniWidgetContainer :container="containers[1]" :allow-editing="widgetStore.editingMode" align="center" />
      </div>
      <div class="grow" />
      <div class="flex-1">
        <MiniWidgetContainer :container="containers[2]" :allow-editing="widgetStore.editingMode" align="end" />
      </div>
    </template>
    <template v-else>
      <MiniWidgetContainer :container="containers[0]" :allow-editing="widgetStore.editingMode" align="start" />
      <div />
      <MiniWidgetContainer :container="containers[1]" :allow-editing="widgetStore.editingMode" align="center" />
      <div />
      <MiniWidgetContainer :container="containers[2]" :allow-editing="widgetStore.editingMode" align="end" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidgetContainer as MiniWidgetContainerType } from '@/types/widgets'

import MiniWidgetContainer from './MiniWidgetContainer.vue'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { width: windowWidth } = useWindowSize()

// eslint-disable-next-line jsdoc/require-jsdoc
interface Props {
  /**
   * The three mini-widget containers to render (left, center, right)
   */
  containers: MiniWidgetContainerType[]
  /**
   * Bar position determines layout variant, CSS class, and scale origin
   */
  position: 'top' | 'bottom'
}

const props = defineProps<Props>()

const originalBarWidth = 1800
const barScale = computed(() => windowWidth.value / originalBarWidth)

const barHeightPixels = computed(() => {
  const px = props.position === 'top' ? widgetStore.currentTopBarHeightPixels : widgetStore.currentBottomBarHeightPixels
  return `${px}px`
})

const scaleStyle = computed(() => ({
  transform: `scale(${barScale.value})`,
  transformOrigin: props.position === 'top' ? 'top left' : 'bottom left',
  width: `${originalBarWidth}px`,
}))
</script>

<style>
.bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  z-index: 60;
  position: absolute;
}

.top-bar {
  top: 0;
  height: v-bind('barHeightPixels');
}

.bottom-bar {
  bottom: 0;
  height: v-bind('barHeightPixels');
}

.top-bar-hamburger {
  outline: none;
}
</style>
