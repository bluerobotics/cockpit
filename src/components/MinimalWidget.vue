<template>
  <div id="outerWidgetRef" ref="outerWidgetRef" class="outerWidget">
    <div
      id="innerWidgetRef"
      ref="innerWidgetRef"
      class="innerWidget"
      :class="{ draggingWidget, hoveringWidget }"
    >
      <slot></slot>
    </div>
    <template v-if="!locked">
      <div
        ref="resizerRef"
        class="resizer"
        :class="{ draggingResizer, hoveringResizer }"
      />
      <v-btn flat icon small @click="emit('send-back')"
        ><v-icon>mdi-arrow-down-thick</v-icon></v-btn
      >
      <v-btn flat icon small @click="emit('bring-front')"
        ><v-icon>mdi-arrow-up-thick</v-icon></v-btn
      >
      <v-btn flat icon small @click="emit('remove')"
        ><v-icon>mdi-close-thick</v-icon></v-btn
      >
    </template>
  </div>
</template>

<script setup lang="ts">
import { useMouse } from '@vueuse/core'
import { type Ref, computed, ref, watch, toRefs } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'

const props = defineProps<{
  size: SizeRect2D
  position: Point2D
  locked: boolean
}>()

const emit = defineEmits<{
  (e: 'move', position: Point2D): void
  (e: 'resize', size: SizeRect2D): void
  (e: 'drop', position: Point2D): void
  (e: 'send-back'): void
  (e: 'bring-front'): void
  (e: 'remove'): void
}>()

const locked = toRefs(props).locked
const outerWidgetRef = ref<HTMLElement>()
const innerWidgetRef = ref<HTMLElement>()
const resizerRef = ref<HTMLElement>()
const { x: mouseX, y: mouseY } = useMouse()

const {
  position: widgetRawPosition,
  dragging: draggingWidget,
  hovering: hoveringWidget,
} = useDragInElement(innerWidgetRef as Ref<HTMLElement>, props.position, locked)

const {
  position: resizerPosition,
  dragging: draggingResizer,
  hovering: hoveringResizer,
} = useDragInElement(resizerRef as Ref<HTMLElement>, {
  x: props.position.x + props.size.width,
  y: props.position.y + props.size.height,
}, locked)

// Chuncho do demo
// Por algum motivo quando a tela eh iniciada os valores da bouding rect do outerWidget tao cagadas e nao da pra usar
const x = ref(0)
const widgetRawSize = computed(() => {
  if (x.value < 2 || outerWidgetRef.value === undefined) {
    x.value += 1
    return {
      width: resizerPosition.value.x - widgetFinalPosition.value.x,
      height: resizerPosition.value.y - widgetFinalPosition.value.y,
    }
  }
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
    width: widgetRawSize.value.width,
    height: widgetRawSize.value.height,
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
const cursorStyle = computed(() => {
  if (locked.value) {
    return 'default'
  }
  if (draggingWidget.value) {
    return 'grabbing'
  }
  return 'grab'
})
</script>

<style>
.outerWidget {
  background-color: rgba(0, 0, 0, 0.1);
  position: absolute;
  cursor: v-bind('cursorStyle');
  left: v-bind('positionStyle.left');
  top: v-bind('positionStyle.top');
  width: v-bind('sizeStyle.width');
  height: v-bind('sizeStyle.height');
}
.innerWidget {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.innerWidget.hoveringWidget {
  outline-style: dashed;
  outline-width: 1px;
  outline-color: rgba(0, 0, 0, 0.3);
}
.innerWidget.draggingWidget {
  outline-style: dashed;
  outline-width: 3px;
  outline-color: rgba(0, 0, 0, 0.1);
}
.resizer {
  width: 5px;
  height: 5px;
  cursor: se-resize;
  user-select: none;
  position: absolute;
  left: 100%;
  top: 100%;
}
</style>
