<template>
  <div ref="widgetRef" class="widget" :class="{ draggingWidget, hoveringWidget }" draggable="true">
    <slot class="children"></slot>
    <div v-if="!notHoveringWidget" ref="resizeIconRef" class="resizer" :class="{ hoveringResizer, pressingResizer}">
      <v-icon size="50px">mdi-resize-bottom-right</v-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useMouseInElement, useMousePressed } from '@vueuse/core'
import { type Ref, computed, ref, watch } from 'vue'

import useDrag from '@/composables/drag'

const props = defineProps({
  componentHash: {
    type: String,
    required: true,
  },
  size: {
    type: Object,
    required: true,
  },
  position: {
    type: Object,
    required: true,
  },
})
const emit = defineEmits<{
  (
    e: 'move',
    {
      hash: string,
      position: { x: number, y: number },
    }
  ): void,
  (
    e: 'delete',
    {
      hash: string,
    }
  ): void
  (
    e: 'resize',
    {
      hash: string,
      size: { width: number, height: number }
    }
  ): void
}>()

// Widget
const widgetRef = ref<HTMLElement>()
const resizeIconRef = ref<HTMLElement>()

// Widget sizing
const width = ref(props.size.width)
const height = ref(props.size.height)
const { isOutside: notHoveringResizer } = useMouseInElement(resizeIconRef)
const { pressed: pressingResizer } = useMousePressed({ target: resizeIconRef })

const hoveringResizer = computed(() => !notHoveringResizer)
const widgetSize = computed(() => {
  const truncatedWidth = Math.max(Math.min(width.value, 500), 0)
  const truncatedHeight = Math.max(Math.min(height.value, 500), 0)
  return { width: truncatedWidth, height: truncatedHeight }
})
watch(widgetSize, () => {
  console.log(`${widgetSize.value.width}px`, `${widgetSize.value.height}px`)
  emit('resize', { hash: props.componentHash, size: { width: widgetSize.value.width, height: widgetSize.value.height } })
})
const sizeStyle = computed(() => {
  return { width: `${widgetSize.value.width}px`, height: `${widgetSize.value.height}px` }
})

// Widget positioning
const { x: mouseX, y: mouseY, dragging: draggingComponent, trashed } = useDrag(
  widgetRef as Ref<HTMLElement>,
  props.position.x,
  props.position.y
)
const { isOutside: notHoveringWidget } = useMouseInElement(widgetRef)
const { pressed: pressingWidget } = useMousePressed({ target: widgetRef })

const hoveringWidget = computed(() => !notHoveringWidget)
const mousePosition = computed(() => {
  return { x: mouseX.value, y: mouseY.value }
})
const widgetPosition = computed(() => {
  const top = Math.max(Math.min(mousePosition.value.y, window.innerHeight - height.value), 0)
  const left = Math.max(Math.min(mousePosition.value.x, window.innerWidth - width.value), 0)
  return { x: left, y: top }
})
watch(widgetPosition, () => {
  emit('move', { hash: props.componentHash, position: widgetPosition.value })
})
watch(trashed, () => {
  if (trashed.value) {
    emit('delete', { hash: props.componentHash })
  }
})
const positionStyle = computed(() => {
  return { top: `${widgetPosition.value.y}px`, left: `${widgetPosition.value.x}px` }
})
const draggingWidget = computed(() => draggingComponent.value && !pressingResizer.value)
</script>

<style>
.widget {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  width: v-bind(sizeStyle.width);
  height: v-bind(sizeStyle.height);
  position: absolute;
  cursor: grab;
  top: v-bind('positionStyle.top');
  left: v-bind('positionStyle.left');
}
.hovering {
  outline-style: dashed;
  outline-width: 1px;
  outline-color: rgba(98, 142, 193, 0.7);
}
.dragging {
  outline-style: dashed;
  outline-width: 3px;
  outline-color: rgba(113, 113, 113, 0.7);
}
.children {
  pointer-events: none;
}
.resizer {
  user-select: none;
  position: absolute;
  bottom: 0%;
  right: 0%;
}
.hoveringResizer {
  color: red;
}
.pressingResizer {
  color: blue;
}
</style>
