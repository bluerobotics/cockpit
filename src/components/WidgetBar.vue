<template>
  <div
    ref="barEl"
    class="bar"
    :class="[
      position === 'top' ? 'top-bar' : 'bottom-bar',
      { 'bar-overflow': isOverflowing && widgetStore.editingMode },
    ]"
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
    <div
      v-if="isOverflowing && widgetStore.editingMode"
      class="overflow-indicator"
      :class="position === 'top' ? 'below' : 'above'"
    >
      <v-tooltip
        text="Too many widgets in this bar — some are being cropped or hidden. Consider removing some or moving them to a Collapsible Container or Mini Widgets Bar widget so they are all shown correctly."
        :location="position === 'top' ? 'bottom' : 'top'"
        open-delay="300"
        max-width="350"
      >
        <template #activator="{ props: tooltipProps }">
          <div
            v-bind="tooltipProps"
            class="cursor-pointer rounded-full bg-red-500 icon-pulse flex items-center justify-center w-7 h-7"
          >
            <v-icon icon="mdi-alert-circle-outline" color="white" size="28" />
          </div>
        </template>
      </v-tooltip>
    </div>
    <teleport to="body">
      <div
        v-if="isOverflowing && !widgetStore.editingMode"
        class="overflow-edge"
        :class="overflowSide"
        :style="{ height: barHeightPixels, [position]: '0' }"
      >
        <v-tooltip
          text="There's no available space for all widgets, so some elements are cut off. Open edit-mode to fix that."
          :location="position === 'top' ? 'bottom' : 'top'"
          open-delay="200"
          max-width="300"
        >
          <template #activator="{ props: tooltipProps }">
            <div v-bind="tooltipProps" class="w-full h-full" />
          </template>
        </v-tooltip>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

// Overflow detection
const barEl = ref<HTMLElement>()
const isOverflowing = ref(false)
const overflowSide = ref<'right' | 'left'>('right')

const checkOverflow = (): void => {
  const el = barEl.value
  if (!el) return

  const vw = window.innerWidth
  for (const widget of el.querySelectorAll<HTMLElement>('[data-widget-hash]')) {
    const rect = widget.getBoundingClientRect()
    if (rect.width === 0) continue
    if (rect.right > vw + 1) {
      isOverflowing.value = true
      overflowSide.value = 'right'
      return
    }
    if (rect.left < -1) {
      isOverflowing.value = true
      overflowSide.value = 'left'
      return
    }
  }
  isOverflowing.value = false
}

let rafId: number | undefined
const scheduleCheck = (): void => {
  if (rafId !== undefined) return
  rafId = requestAnimationFrame(() => {
    rafId = undefined
    checkOverflow()
  })
}

let subtreeObserver: MutationObserver | undefined

useResizeObserver(barEl, () => nextTick(checkOverflow))
watch(windowWidth, () => nextTick(checkOverflow))
onMounted(() => {
  nextTick(checkOverflow)
  if (barEl.value) {
    subtreeObserver = new MutationObserver(scheduleCheck)
    subtreeObserver.observe(barEl.value, { childList: true, subtree: true })
  }
})
onBeforeUnmount(() => {
  subtreeObserver?.disconnect()
  if (rafId !== undefined) cancelAnimationFrame(rafId)
})
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

.bar-overflow {
  animation: bar-overflow-pulse 1s ease-in-out infinite;
}

@keyframes bar-overflow-pulse {
  0%,
  100% {
    box-shadow: inset 0 0 12px 0 rgba(239, 68, 68, 0.5);
  }
  50% {
    box-shadow: inset 0 0 12px 0 rgba(239, 68, 68, 0.1);
  }
}

.overflow-indicator {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 61;
}

.overflow-indicator.below {
  top: calc(100% + 6px);
}

.overflow-indicator.above {
  bottom: calc(100% + 6px);
}

.icon-pulse {
  animation: icon-glow-pulse 1s ease-in-out infinite;
}

@keyframes icon-glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.6);
  }
  50% {
    box-shadow: 0 0 4px 1px rgba(239, 68, 68, 0.15);
  }
}

.overflow-edge {
  position: fixed;
  width: 25px;
  z-index: 61;
  cursor: pointer;
}

.overflow-edge.right {
  right: 0;
  background: linear-gradient(to left, rgba(239, 68, 68, 0.5), transparent);
}

.overflow-edge.left {
  left: 0;
  background: linear-gradient(to right, rgba(239, 68, 68, 0.5), transparent);
}
</style>
