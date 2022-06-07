<template>
  <div class="widget">
    <div ref="widgetRef" :class="{ draggingWidget, hoveringWidget }" draggable="true">
      <slot class="children"></slot>
    </div>
    <div ref="resizerRef" class="resizer" :class="{ hoveringResizer, pressingResizer}" draggable="true">
      <v-icon size="50px">mdi-resize-bottom-right</v-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse, useMouseInElement, useMousePressed } from '@vueuse/core'
import { type Ref, computed, ref, watch } from 'vue'

import useDrag, { useDragInElement } from '@/composables/drag'

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
const resizerRef = ref<HTMLElement>()

// Widget sizing
const width = ref(props.size.width)
const height = ref(props.size.height)
const { isOutside: notHoveringResizer } = useMouseInElement(resizerRef)
const { pressed: pressingResizer } = useMousePressed({ target: resizerRef })

const hoveringResizer = computed(() => !notHoveringResizer.value)
const widgetSize = ref(props.size)
watch(width, () => {
  const truncatedWidth = Math.max(Math.min(width.value, 500), 50)
  const truncatedHeight = Math.max(Math.min(height.value, 500), 50)
  widgetSize.value = { width: truncatedWidth, height: truncatedHeight }
})
watch(widgetSize, () => {
  emit('resize', { hash: props.componentHash, size: { width: widgetSize.value.width, height: widgetSize.value.height } })
})
const sizeStyle = computed(() => {
  return { width: `${widgetSize.value.width}px`, height: `${widgetSize.value.height}px` }
})

// Widget positioning
// const { elementX: widgetX, elementY: widgetY, dragging: draggingComponent, hovering: hoveringComponentNew, trashed: trashed } = useDragInElement(
//   widgetRef as Ref<HTMLElement>,
//   props.position.x,
//   props.position.y
// )
// watch(widgetX, () => {
//   console.log(widgetX.value, widgetY.value, draggingComponent.value, hoveringComponent.value)
// })
const { x: widgetX, y: widgetY, dragging: draggingComponent, trashed } = useDrag(
  widgetRef as Ref<HTMLElement>,
  props.position.x,
  props.position.y
)
// const { elementX, elementY, dragging: draggingComponentNew, hovering: hoveringComponentNew, trashed: trashedNew, mouseX: mouseXNew, mouseY: mouseYNew } = useDragInElement(
//   widgetRef as Ref<HTMLElement>,
//   props.position.x,
//   props.position.y
// )
// watch(elementX, () => {
//   console.log(elementX.value, elementY.value, draggingComponentNew.value, hoveringComponentNew.value)
// })
const { x: mX, y: mY } = useMouse()
const { isOutside: notHoveringWidget } = useMouseInElement(widgetRef)

const hoveringWidget = computed(() => !notHoveringWidget)
const draggingWidget = computed(() => draggingComponent.value && !pressingResizer.value)
const resizingWidget = computed(() => pressingResizer.value)
const widgetPositionWannabe = computed(() => {
  return { x: widgetX.value, y: widgetY.value }
})
const widgetPosition = ref(props.position)
watch(widgetPositionWannabe, () => {
  if (draggingWidget.value) {
    const top = Math.max(Math.min(widgetPositionWannabe.value.y, window.innerHeight - height.value), 0)
    const left = Math.max(Math.min(widgetPositionWannabe.value.x, window.innerWidth - width.value), 0)
    widgetPosition.value = { x: left, y: top }
    return
  }
})
const { x: resizerX, y: resizerY, dragging: draggingResizer } = useDrag(
  resizerRef as Ref<HTMLElement>,
  props.position.x + props.size.width,
  props.position.y + props.size.height
)
watch(draggingResizer, () => {
  const right = resizerX.value
  const bottom = resizerY.value
  const widgetLimits = widgetRef.value?.getBoundingClientRect()
  width.value = right - widgetLimits?.left
  height.value = bottom - widgetLimits?.top
  console.log('---------------')
  console.log(widgetPosition.value.x, widgetPosition.value.y, width.value, height.value)
  return
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
</script>

<style>
.widget {
  background-color: blue;
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
  color: rgb(9, 255, 0);
}
</style>
