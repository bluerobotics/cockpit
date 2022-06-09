<template>
  <div ref="outerWidgetRef" class="outerWidget">
    <div
      ref="innerWidgetRef"
      class="innerWidget"
      :class="{ draggingWidget, hoveringWidget }"
    >
      <div ref="actualWidgetRef" class="actualWidget"></div>
      <!-- <slot class="children" ref="actualWidgetRef"></slot> -->
      <!-- <slot></slot> -->
    </div>
    <div
      ref="resizerRef"
      class="resizer"
      :class="{ draggingResizer, hoveringResizer }"
    >
      <!-- <v-icon :size="resizerSize">mdi-resize-bottom-right</v-icon> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, onMounted, ref, watch } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'

const props = defineProps<{
  size: SizeRect2D
  position: Point2D
}>()

const emit = defineEmits<{
  (e: 'move', position: Point2D): void
  (e: 'resize', size: SizeRect2D): void
  (e: 'drop', position: Point2D): void
}>()

const outerWidgetRef = ref<HTMLElement>()
const innerWidgetRef = ref<HTMLElement>()
const actualWidgetRef = ref<HTMLElement>()
const resizerRef = ref<HTMLElement>()

const {
  position: widgetRawPosition,
  dragging: draggingWidget,
  hovering: hoveringWidget,
} = useDragInElement(innerWidgetRef as Ref<HTMLElement>, props.position)

const {
  position: resizerPosition,
  dragging: draggingResizer,
  hovering: hoveringResizer,
} = useDragInElement(resizerRef as Ref<HTMLElement>, {
  x: props.position.x + props.size.width,
  y: props.position.y + props.size.height,
})

onMounted(() => {
  console.log('initial position: ', props.position)
  console.log('initial size: ', props.size)
  const widgetLimits = innerWidgetRef.value.getBoundingClientRect()
  console.log('initial inner widget limits: ', widgetLimits)
  const outerWidgetLimits = outerWidgetRef.value.getBoundingClientRect()
  console.log('initial outer widget limits: ', outerWidgetLimits)
  const actualWidgetLimits = actualWidgetRef.value.getBoundingClientRect()
  console.log('initial actual widget limits: ', actualWidgetLimits)
})

const widgetRawSize = computed(() => {
  if (innerWidgetRef.value === undefined || resizerRef.value === undefined) {
    return props.size
  }
  const widgetLimits = innerWidgetRef.value.getBoundingClientRect()
  return {
    width: resizerPosition.value.x - widgetLimits.left,
    height: resizerPosition.value.y - widgetLimits.top,
  }
})

const widgetFinalPosition = computed((): Point2D => {
  if (innerWidgetRef.value === undefined || resizerRef.value === undefined) {
    return props.position
  }
  const widgetLimits = innerWidgetRef.value.getBoundingClientRect()
  const maxX = window.innerWidth - widgetLimits.width
  const maxY = window.innerHeight - widgetLimits.height
  return {
    x: constrain(widgetRawPosition.value.x, 0, maxX),
    y: constrain(widgetRawPosition.value.y, 0, maxY),
  }
})
const widgetFinalSize = computed((): SizeRect2D => {
  return {
    width: constrain(widgetRawSize.value.width, 30, 300),
    height: constrain(widgetRawSize.value.height, 30, 300),
  }
})

watch(draggingWidget, async (isDragging: boolean, wasDragging: boolean) => {
  if (wasDragging && !isDragging) {
    emit('drop', widgetFinalPosition.value)
  }
})
watch(widgetFinalPosition, () => {
  emit('move', widgetFinalPosition.value)
})
watch(widgetFinalSize, () => {
  emit('resize', widgetFinalSize.value)
})
const sizeStyle = computed(() => {
  return {
    width: `${widgetFinalSize.value.width}px`,
    height: `${widgetFinalSize.value.height}px`,
  }
})
const positionStyle = computed(() => {
  return {
    top: `${widgetFinalPosition.value.y}px`,
    left: `${widgetFinalPosition.value.x}px`,
  }
})
</script>

<style>
.actualWidget {
  background-color: rgb(255, 48, 179);
  width: 150px;
  height: 150px;
}
.innerWidget {
  height: 100%;
  background-color: rebeccapurple;
  display: flex;
  justify-content: center;
  align-items: center;
}
.innerWidget.hoveringWidget {
  outline-style: dashed;
  outline-width: 1px;
  outline-color: rgba(98, 142, 193, 0.7);
}
.innerWidget.draggingWidget {
  outline-style: dashed;
  outline-width: 3px;
  outline-color: rgba(113, 113, 113, 0.7);
}
.outerWidget {
  background-color: blue;
  width: v-bind('sizeStyle.width');
  height: v-bind('sizeStyle.height');
  position: absolute;
  cursor: grab;
  top: v-bind('positionStyle.top');
  left: v-bind('positionStyle.left');
}
.children {
  pointer-events: none;
}
.resizer {
  background-color: black;
  width: 50px;
  height: 50px;
  user-select: none;
  position: absolute;
  left: 100%;
  top: 100%;
}
.resizer.hoveringResizer {
  background-color: red;
}
.resizer.draggingResizer {
  background-color: rgb(9, 255, 0);
}
</style>
