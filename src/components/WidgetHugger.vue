<template>
  <div
    ref="widgetOverlay"
    class="widgetOverlay"
    :class="{ draggingWidget, hoveringOverlay }"
  />
  <div ref="outerWidgetRef" class="outerWidget">
    <div ref="innerWidgetRef" class="innerWidget">
      <slot></slot>
    </div>
    <div
      ref="resizerRef"
      class="resizer"
      :class="{ draggingResizer, hoveringResizer, allowResizing }"
    />
    <div v-if="hoveringOverlay" class="editing-buttons">
      <v-menu
        v-if="allowResizing || allowOrdering || allowDeleting"
        location="top"
      >
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" size="x-small" icon="mdi-pencil" />
        </template>
        <v-list>
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
            :icon="isFullScreen ? 'mdi-window-restore' : 'mdi-overscan'"
            @click="toggleFullScreen"
          />
          <v-btn
            v-if="allowDeleting"
            class="ma-1"
            size="x-small"
            icon="mdi-close-thick"
            @click="widgetDeleteDialog.reveal"
          />
        </v-list>
      </v-menu>
    </div>
    <teleport to="body">
      <v-dialog v-model="widgetDeleteDialogRevealed" width="auto">
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
import { useConfirmDialog, useMouseInElement } from '@vueuse/core'
import { type Ref, computed, ref, toRefs, watch } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain, isEqual } from '@/libs/utils'
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
  gridInterval: 0.02,
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
const lastNonFullScreenPosition = ref(props.position)
const lastNonFullScreenSize = ref(props.size)

const widgetOverlay = ref()
const { isOutside: notHoveringOverlay } = useMouseInElement(widgetOverlay)
const hoveringOverlay = computed(() => !notHoveringOverlay.value)

const { position: widgetRawPosition, dragging: draggingWidget } =
  useDragInElement(
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
  const maxX = 1 - widgetLimits.width / window.innerWidth || 1
  const maxY = 1 - widgetLimits.height / window.innerHeight || 1
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
  const widgetLimits = {
    x: outerWidgetRef.value.getBoundingClientRect().x / window.innerWidth || 1,
    y: outerWidgetRef.value.getBoundingClientRect().y / window.innerHeight || 1,
  }
  widgetFinalSize.value = {
    width: constrain(position.x - widgetLimits.x, 0.01, 1),
    height: constrain(position.y - widgetLimits.y, 0.01, 1),
  }
})

const fullScreenPosition = { x: 0, y: 0 }
const fullScreenSize = computed(() => ({
  width: 1,
  height: 1,
}))
const toggleFullScreen = (): void => {
  if (!isFullScreen.value) {
    widgetFinalPosition.value = fullScreenPosition
    widgetFinalSize.value = fullScreenSize.value
    return
  }

  if (
    isEqual(lastNonFullScreenPosition.value, fullScreenPosition) &&
    isEqual(lastNonFullScreenSize.value, fullScreenSize.value)
  ) {
    lastNonFullScreenPosition.value = {
      x: 0.15,
      y: 0.15,
    }
    lastNonFullScreenSize.value = {
      width: 0.7,
      height: 0.7,
    }
  }
  widgetFinalPosition.value = lastNonFullScreenPosition.value
  widgetFinalSize.value = lastNonFullScreenSize.value
}

watch(widgetFinalPosition, () => {
  if (!isFullScreenPosition.value) {
    lastNonFullScreenPosition.value = widgetFinalPosition.value
  }
  emit('move', widgetFinalPosition.value)
})
watch(widgetFinalSize, () => {
  if (!isFullScreenSize.value) {
    lastNonFullScreenSize.value = widgetFinalSize.value
  }
  emit('resize', widgetFinalSize.value)
})

const sizeStyle = computed(() => ({
  width: `${100 * widgetFinalSize.value.width}%`,
  height: `${100 * widgetFinalSize.value.height}%`,
}))

const isFullScreenPosition = computed(() =>
  isEqual(widgetFinalPosition.value, fullScreenPosition)
)
const isFullScreenSize = computed(() =>
  isEqual(widgetFinalSize.value, fullScreenSize.value)
)
const isFullScreen = computed(() => {
  return isFullScreenPosition.value && isFullScreenSize.value
})

const positionStyle = computed(() => ({
  left: `${100 * widgetFinalPosition.value.x}%`,
  top: `${100 * widgetFinalPosition.value.y}%`,
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
const widgetOverlayColor = computed(() =>
  allowMoving.value ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0)'
)

const widgetDeleteDialogRevealed = ref(false)
const widgetDeleteDialog = useConfirmDialog(widgetDeleteDialogRevealed)
widgetDeleteDialog.onConfirm(() => emit('remove'))
</script>

<style>
.widgetOverlay {
  --overlayOverSize: 10px;
  position: absolute;
  left: calc(v-bind('positionStyle.left') - var(--overlayOverSize));
  top: calc(v-bind('positionStyle.top') - var(--overlayOverSize));
  width: calc(v-bind('sizeStyle.width') + 2 * var(--overlayOverSize));
  height: calc(v-bind('sizeStyle.height') + 2 * var(--overlayOverSize));
  user-select: none;
}
.widgetOverlay.hoveringOverlay {
  outline-style: dashed;
  outline-width: 1px;
  outline-color: v-bind('widgetEditingColor');
}
.widgetOverlay.draggingWidget {
  outline-style: solid;
  outline-width: 1px;
  outline-color: v-bind('widgetEditingColor');
}
.outerWidget {
  position: absolute;
  cursor: v-bind('cursorStyle');
  left: v-bind('positionStyle.left');
  top: v-bind('positionStyle.top');
  width: v-bind('sizeStyle.width');
  height: v-bind('sizeStyle.height');
  background-color: v-bind('widgetOverlayColor');
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
.editing-buttons {
  position: absolute;
  left: 5px;
  bottom: 5px;
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
