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
        v-if="allowResizing"
        class="ma-1"
        size="x-small"
        icon="mdi-overscan"
        @click="fillScreen"
      />
      <v-btn
        v-if="allowDeleting"
        class="ma-1"
        size="x-small"
        icon="mdi-close-thick"
        @click="widgetDeleteDialog.reveal"
      />
    </div>
    <teleport to="body">
      <v-dialog v-model="widgetDeleteDialogRevealed">
        <v-card class="pa-2">
          <v-card-title>Delete widget?</v-card-title>
          <v-card-actions>
            <v-btn @click="widgetDeleteDialog.confirm">Yes</v-btn>
            <v-btn @click="widgetDeleteDialog.cancel">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { useConfirmDialog } from '@vueuse/core'
import { type Ref, computed, ref, toRefs, watch } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'

/**
 * Props for the WidgetHugger component
 */
export interface Props {
  /**
   * Size of the widget box, in pixels
   */
  size: SizeRect2D
  /**
   * Position of the top-left corner of the widget box
   */
  position: Point2D
  /**
   * To snap or not the widget to the grid while moving it
   */
  snapToGrid?: boolean
  /**
   * The distance between each grid line
   */
  gridInterval?: number
  /**
   * To allow or not the widget to be moved
   */
  allowMoving?: boolean
  /**
   * To allow or not the widget to be resized
   */
  allowResizing?: boolean
  /**
   * To allow or not the widget to be ordered
   */
  allowOrdering?: boolean
  /**
   * To allow or not the widget to be deleted
   */
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
const outerWidgetRef = ref<HTMLElement | undefined>()
const innerWidgetRef = ref<HTMLElement | undefined>()
const resizerRef = ref<HTMLElement>()

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

const widgetFinalPosition = ref(props.position)
watch(widgetRawPosition, (position) => {
  if (innerWidgetRef.value === undefined || resizerRef.value === undefined) {
    return
  }
  const widgetLimits = innerWidgetRef.value.getBoundingClientRect()
  const maxX = window.innerWidth - widgetLimits.width
  const maxY = window.innerHeight - widgetLimits.height
  widgetFinalPosition.value = {
    x: constrain(position.x, 0, maxX),
    y: constrain(position.y, 0, maxY),
  }
})

const widgetFinalSize = ref(props.size)
watch(resizerPosition, (position) => {
  if (outerWidgetRef.value === undefined) {
    return
  }
  const widgetLimits = outerWidgetRef.value.getBoundingClientRect()
  widgetFinalSize.value = {
    width: constrain(position.x - widgetLimits.x, 160, window.innerWidth),
    height: constrain(position.y - widgetLimits.y, 40, window.innerHeight),
  }
})

const fillScreen = (): void => {
  widgetFinalPosition.value = { x: 0, y: 0 }
  widgetFinalSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

watch(widgetFinalPosition, () => emit('move', widgetFinalPosition.value))
watch(widgetFinalSize, () => emit('resize', widgetFinalSize.value))

const sizeStyle = computed(() => ({
  width: `${widgetFinalSize.value.width}px`,
  height: `${widgetFinalSize.value.height}px`,
}))

const positionStyle = computed(() => ({
  left: `${widgetFinalPosition.value.x}px`,
  top: `${widgetFinalPosition.value.y}px`,
}))

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

const widgetDeleteDialogRevealed = ref(false)
const widgetDeleteDialog = useConfirmDialog(widgetDeleteDialogRevealed)
widgetDeleteDialog.onConfirm(() => emit('remove'))
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
  flex-direction: column;
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
  width: 10px;
  height: 10px;
  cursor: se-resize;
  user-select: none;
  position: absolute;
  left: 100%;
  top: 100%;
}
</style>
