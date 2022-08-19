<template>
  <div ref="outerWidgetRef" class="outerWidget">
    <div
      ref="innerWidgetRef"
      class="innerWidget"
      :class="{ draggingWidget, hoveringWidget }"
    >
      <slot></slot>
    </div>
    <div
      ref="resizerRef"
      class="resizer"
      :class="{ draggingResizer, hoveringResizer, allowResizing }"
    />
    <div v-if="hoveringWidget" class="editing-buttons">
      <v-btn
        v-if="allowOrdering"
        class="ma-1"
        size="x-small"
        icon="mdi-arrow-down-thick"
        @click="emit('send-back')"
      />
      <v-btn
        v-if="allowOrdering"
        class="ma-1"
        size="x-small"
        icon="mdi-arrow-up-thick"
        @click="emit('bring-front')"
      />
      <v-btn
        v-if="allowDeleting"
        class="ma-1"
        size="x-small"
        icon="mdi-close-thick"
        @click="emit('remove')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouse } from '@vueuse/core'
import { type Ref, computed, ref, toRefs, watch } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'

export interface Props {
  size: SizeRect2D
  position: Point2D
  snapToGrid?: boolean
  gridInterval?: number
  allowMoving?: boolean
  allowResizing?: boolean
  allowOrdering?: boolean
  allowDeleting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  snapToGrid: true,
  gridInterval: 15,
  allowMoving: true,
  allowResizing: true,
  allowOrdering: true,
  allowDeleting: true,
})

const emit = defineEmits<{
  (e: 'move', position: Point2D): void
  (e: 'resize', size: SizeRect2D): void
  (e: 'drop', position: Point2D): void
  (e: 'send-back'): void
  (e: 'bring-front'): void
  (e: 'remove'): void
}>()

const allowMoving = toRefs(props).allowMoving
const allowResizing = toRefs(props).allowResizing
const snapToGrid = toRefs(props).snapToGrid
const gridInterval = toRefs(props).gridInterval
const outerWidgetRef = ref<HTMLElement>()
const innerWidgetRef = ref<HTMLElement>()
const resizerRef = ref<HTMLElement>()
const { x: mouseX, y: mouseY } = useMouse()

const {
  position: widgetRawPosition,
  dragging: draggingWidget,
  hovering: hoveringWidget,
} = useDragInElement(
  innerWidgetRef as Ref<HTMLElement>,
  props.position,
  allowMoving,
  snapToGrid,
  gridInterval.value
)

const {
  position: resizerPosition,
  dragging: draggingResizer,
  hovering: hoveringResizer,
} = useDragInElement(
  resizerRef as Ref<HTMLElement>,
  {
    x: props.position.x + props.size.width,
    y: props.position.y + props.size.height,
  },
  allowResizing,
  snapToGrid,
  gridInterval.value
)

// For some reason I can't figure out the boundings of the outerWidget start with
// random values, messing the whole moving/resizing logic. To fix that problem we
// wait for those values to be fixed before using them.
// TODO: Remove this workaround
const x = ref(0)
const widgetRawSize = computed(() => {
  if (x.value < 2 || outerWidgetRef.value === undefined) {
    x.value += 1 // eslint-disable-line vue/no-side-effects-in-computed-properties
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
  if (!allowMoving.value) {
    return 'default'
  }
  if (draggingWidget.value) {
    return 'grabbing'
  }
  return 'grab'
})
const widgetEditingColor = computed(() =>
  allowMoving.value ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)'
)
</script>

<style>
.outerWidget {
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
  outline-color: v-bind('widgetEditingColor');
}
.innerWidget.draggingWidget {
  outline-style: solid;
  outline-width: 1px;
  outline-color: v-bind('widgetEditingColor');
}
.editing-buttons {
  position: absolute;
  left: 0%;
  bottom: 0%;
}
.resizer.allowResizing {
  width: 5px;
  height: 5px;
  cursor: se-resize;
  user-select: none;
  position: absolute;
  left: 100%;
  top: 100%;
}
</style>
