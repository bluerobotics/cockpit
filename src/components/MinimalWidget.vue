<template>
  <div id="outerWidgetRef" ref="outerWidgetRef" class="outerWidget">
    <div
      id="innerWidgetRef"
      ref="innerWidgetRef"
      class="innerWidget"
      :class="{ draggingWidget, hoveringWidget }"
    >
      <div ref="actualWidgetRef" class="actualWidget"></div>
      <!-- <slot ref="actualWidgetRef" class="children"></slot> -->
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
import { useMouse } from '@vueuse/core';

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
const { x: mouseX, y: mouseY } = useMouse()

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
  const outerWidgetLimits = outerWidgetRef.value.getBoundingClientRect()
  console.log('initial outer widget limits: ', outerWidgetLimits)
  const widgetLimits = innerWidgetRef.value.getBoundingClientRect()
  console.log('initial inner widget limits: ', widgetLimits)
  const actualWidgetLimits = actualWidgetRef.value.getBoundingClientRect()
  console.log('initial actual widget limits: ', actualWidgetLimits)
  const resizerLimits = resizerRef.value.getBoundingClientRect()
  console.log('initial resizer limits: ', resizerLimits)
})

// Chuncho do demo
// Por algum motivo quando a tela eh iniciada os valores da bouding rect do outerWidget tao cagadas e nao da pra usar
const x = ref(0)
const widgetRawSize = computed(() => {
  if (x.value < 2 || outerWidgetRef.value === undefined) {
    x.value += 1
    if (document.getElementById('outerWidgetRef') !== null) {
      console.log('outerWidget id limits before: ', document.getElementById('outerWidgetRef').getBoundingClientRect())
    } else {
      console.log('outer widget null')
    }
    if (outerWidgetRef.value !== undefined) {
      console.log('outerWidget ref limits before: ', outerWidgetRef.value.getBoundingClientRect())
    } else {
      console.log('outer widget ref undefined')
    }
    return {
      width: resizerPosition.value.x - widgetFinalPosition.value.x,
      height: resizerPosition.value.y - widgetFinalPosition.value.y,
    }
  }
  console.log('outerWidgetRef limits after: ', document.getElementById('outerWidgetRef').getBoundingClientRect())
  const widgetLimits = outerWidgetRef.value.getBoundingClientRect()
  return {
    width: resizerPosition.value.x - widgetLimits.x,
    height: resizerPosition.value.y - widgetLimits.y,
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
    width: constrain(widgetRawSize.value.width, 50, 300),
    height: constrain(widgetRawSize.value.height, 50, 300),
  }
})
const mousePosition = computed(() => {
  return {
    x: mouseX.value,
    y: mouseY.value,
  }
})

watch(widgetFinalPosition, () => {
  emit('move', widgetFinalPosition.value)
})
// watch(resizerPosition, () => {
//   console.log('resizerPosition', resizerPosition.value)
// })
watch(widgetFinalSize, () => {
  emit('resize', widgetFinalSize.value)
})
watch(draggingWidget, async (isDragging: boolean, wasDragging: boolean) => {
  if (wasDragging && !isDragging) {
    emit('drop', mousePosition.value)
  }
})

const sizeStyle = computed(() => {
  return {
    width: `${widgetFinalSize.value.width}px`,
    height: `${widgetFinalSize.value.height}px`,
  }
})
const positionStyle = computed(() => {
  return {
    left: `${widgetFinalPosition.value.x}px`,
    top: `${widgetFinalPosition.value.y}px`,
  }
})
</script>

<style>
.outerWidget {
  background-color: blue;
  position: absolute;
  cursor: grab;
  left: v-bind('positionStyle.left');
  top: v-bind('positionStyle.top');
  width: v-bind('sizeStyle.width');
  height: v-bind('sizeStyle.height');
}
.innerWidget {
  width: 100%;
  height: 100%;
  background-color: rebeccapurple;
  overflow: hidden;
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
.actualWidget {
  background-color: rgb(255, 48, 179);
  width: 150px;
  height: 150px;
}
.children {
  pointer-events: none;
}
.resizer {
  background-color: rgba(0, 0, 0, 0.118);
  width: 20px;
  height: 20px;
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
