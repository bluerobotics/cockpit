<template>
  <div v-if="devStore.developmentMode" class="widgetOverlay dev-info">
    <p>Position: {{ 100 * position.x }} x {{ 100 * position.y }} %</p>
    <p>Size: {{ 100 * size.width }} x {{ 100 * size.height }} %</p>
    <p>Position: {{ position.x * windowWidth }} x {{ position.y * windowHeight }} px</p>
    <p>Size: {{ size.width * windowWidth }} x {{ size.height * windowHeight }} px</p>
    <p>Client size: {{ innerWidgetRef?.clientWidth }} x {{ innerWidgetRef?.clientHeight }} px</p>
    <p>Offset size: {{ innerWidgetRef?.offsetWidth }} x {{ innerWidgetRef?.offsetHeight }} px</p>
    <p>Scroll size: {{ innerWidgetRef?.scrollWidth }} x {{ innerWidgetRef?.scrollHeight }} px</p>
    <p v-for="[k, v] in Object.entries(widget?.options)" :key="k">{{ k }} (option): {{ v }}</p>
  </div>
  <div ref="widgetOverlay" class="widgetOverlay" :class="{ allowMoving, draggingWidget, hoveringWidgetOrOverlay }" />
  <div ref="outerWidgetRef" class="outerWidget">
    <div ref="innerWidgetRef" class="innerWidget">
      <slot></slot>
    </div>
    <div ref="resizerRef" class="resizer" :class="{ draggingResizer, hoveringResizer, allowResizing }" />
    <div v-if="hoveringWidgetOrOverlay || !notHoveringEditMenu" class="editing-buttons">
      <v-menu v-if="allowResizing || allowOrdering || allowDeleting" location="top">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" size="x-small" icon="mdi-pencil" />
        </template>
        <v-list ref="widgetEditMenu">
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
            v-if="allowResizing"
            class="ma-1"
            size="x-small"
            :icon="isFullWidth ? 'mdi-window-restore' : 'mdi-arrow-split-vertical'"
            @click="toggleFullWidth"
          />
          <v-btn
            v-if="allowResizing"
            class="ma-1"
            size="x-small"
            :icon="isFullHeight ? 'mdi-window-restore' : 'mdi-arrow-split-horizontal'"
            @click="toggleFullHeight"
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
import {
  useConfirmDialog,
  useElementBounding,
  useElementHover,
  useElementSize,
  useMouseInElement,
  useWindowSize,
} from '@vueuse/core'
import { type Ref, computed, nextTick, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'

import useDragInElement from '@/composables/drag'
import { constrain, isEqual } from '@/libs/utils'
import { useDevelopmentStore } from '@/stores/development'
import type { Point2D, SizeRect2D } from '@/types/general'
import type { Widget } from '@/types/widgets'

/**
 * Props for the WidgetHugger component
 */
export interface Props {
  /**
   * Widget reference
   */
  widget: Widget
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

const widget = toRefs(props).widget
const allowMoving = toRefs(props).allowMoving
const allowResizing = toRefs(props).allowResizing
const snapToGrid = toRefs(props).snapToGrid
const gridInterval = toRefs(props).gridInterval
const outerWidgetRef = ref<HTMLElement | undefined>()
const innerWidgetRef = ref<HTMLElement | undefined>()
const resizerRef = ref<HTMLElement>()
const lastNonMaximizedX = ref(props.position.x)
const lastNonMaximizedY = ref(props.position.y)
const lastNonMaximizedWidth = ref(props.size.width)
const lastNonMaximizedHeight = ref(props.size.height)

const devStore = useDevelopmentStore()

const { width: windowWidth, height: windowHeight } = useWindowSize()

const widgetOverlay = ref()
const hoveringOverlay = useElementHover(widgetOverlay)
const hoveringWidgetItself = useElementHover(outerWidgetRef)
const hoveringWidgetOrOverlay = computed(() => hoveringOverlay.value || hoveringWidgetItself.value)

const widgetEditMenu = ref()
const { isOutside: notHoveringEditMenu } = useMouseInElement(widgetEditMenu)

const { position: widgetRawPosition, dragging: draggingWidget } = useDragInElement(
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

const resizeWidgetToMinimalSize = async (): Promise<void> => {
  let stillAutoResizing = false
  if (innerWidgetRef.value === undefined) return
  const { scrollWidth, scrollHeight, offsetHeight, offsetWidth } = innerWidgetRef.value
  if (scrollWidth > 1.05 * offsetWidth) {
    widgetFinalSize.value.width = (1.1 * scrollWidth) / window.innerWidth
    stillAutoResizing = true
  }
  if (scrollHeight > 1.05 * offsetHeight) {
    widgetFinalSize.value.height = (1.1 * scrollHeight) / window.innerHeight
    stillAutoResizing = true
  }

  if (stillAutoResizing) nextTick(resizeWidgetToMinimalSize)
}

onMounted(async () => {
  await resizeWidgetToMinimalSize()
  makeWidgetRespectWalls()
})

const { width, height } = useElementSize(innerWidgetRef)
const innerWidgetSize = computed(() => ({
  width: width.value,
  height: height.value,
}))
watch(innerWidgetSize, resizeWidgetToMinimalSize)

const outerBounds = useElementBounding(outerWidgetRef)

const makeWidgetRespectWalls = (): void => {
  for (const bound of [outerBounds.left.value, outerBounds.right.value]) {
    if (bound < 0 || bound > window.innerWidth) {
      widgetFinalPosition.value.x = 1 - widgetFinalSize.value.width
    }
  }
  for (const bound of [outerBounds.top.value, outerBounds.bottom.value]) {
    if (bound < 0 || bound > window.innerHeight) {
      widgetFinalPosition.value.y = 1 - widgetFinalSize.value.height
    }
  }
}

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
  if (!outerWidgetRef.value || !innerWidgetRef.value) {
    return
  }
  const widgetLimits = {
    x: outerWidgetRef.value.getBoundingClientRect().x / window.innerWidth || 1,
    y: outerWidgetRef.value.getBoundingClientRect().y / window.innerHeight || 1,
  }

  const oldSize = widgetFinalSize.value
  widgetFinalSize.value = {
    width: constrain(position.x - widgetLimits.x, 0.01, 1),
    height: constrain(position.y - widgetLimits.y, 0.01, 1),
  }

  const growingWidth = widgetFinalSize.value.width > oldSize.width
  const growingHeight = widgetFinalSize.value.height > oldSize.height

  const { offsetWidth, offsetHeight, scrollWidth, scrollHeight } = innerWidgetRef.value

  if (scrollHeight > offsetHeight && !growingHeight) {
    widgetFinalSize.value.height = oldSize.height
  }

  if (scrollWidth > offsetWidth && !growingWidth) {
    widgetFinalSize.value.width = oldSize.width
  }
})

const fullScreenPosition = { x: 0, y: 0 }
const fullScreenSize = { width: 1, height: 1 }
const toggleFullScreen = (): void => {
  if (!isFullScreen.value) {
    widgetFinalPosition.value = fullScreenPosition
    widgetFinalSize.value = fullScreenSize
    return
  }

  if (lastNonMaximizedX.value === 0) {
    lastNonMaximizedX.value = defaultRestoredPosition().x
  }
  if (lastNonMaximizedY.value === fullScreenPosition.y) {
    lastNonMaximizedY.value = defaultRestoredPosition().y
  }
  if (lastNonMaximizedWidth.value === fullScreenSize.width) {
    lastNonMaximizedX.value = defaultRestoredSize().width
  }
  if (lastNonMaximizedHeight.value === fullScreenSize.height) {
    lastNonMaximizedHeight.value = defaultRestoredSize().height
  }
  widgetFinalPosition.value = {
    x: lastNonMaximizedX.value,
    y: lastNonMaximizedY.value,
  }
  widgetFinalSize.value = {
    width: lastNonMaximizedWidth.value,
    height: lastNonMaximizedHeight.value,
  }
}

const toggleFullWidth = (): void => {
  if (!isFullWidth.value) {
    widgetFinalPosition.value.x = 0
    widgetFinalSize.value.width = 1
    return
  }

  // If last non-maximized X position and width are from a maximized state (X at 0% and
  // width at 100%), use a pre-defined position/width so we can effectively get out of maximized
  // state. This happens, for example, when the initial widget state is maximized.
  if (lastNonMaximizedX.value === 0) {
    lastNonMaximizedX.value = defaultRestoredPosition().x
  }
  if (lastNonMaximizedWidth.value === 1) {
    lastNonMaximizedWidth.value = defaultRestoredSize().width
  }

  widgetFinalPosition.value.x = lastNonMaximizedX.value
  widgetFinalSize.value.width = lastNonMaximizedWidth.value
}

const toggleFullHeight = (): void => {
  if (!isFullHeight.value) {
    widgetFinalPosition.value.y = 0
    widgetFinalSize.value.height = 1
    return
  }

  // If last non-maximized Y position and height are from a maximized state (Y at 0% and
  // height at 100%), use a pre-defined position/height so we can effectively get out of maximized
  // state. This happens, for example, when the initial widget state is maximized.
  if (lastNonMaximizedY.value === 0) {
    lastNonMaximizedY.value = defaultRestoredPosition().y
  }
  if (lastNonMaximizedHeight.value === 1) {
    lastNonMaximizedHeight.value = defaultRestoredSize().height
  }

  widgetFinalPosition.value.y = lastNonMaximizedY.value
  widgetFinalSize.value.height = lastNonMaximizedHeight.value
}

const defaultRestoredPosition = (): Point2D => ({ x: 0.15, y: 0.15 })
const defaultRestoredSize = (): SizeRect2D => ({ width: 0.7, height: 0.7 })

watch(widgetFinalPosition, () => {
  if (!isFullScreenPosition.value) {
    lastNonMaximizedX.value = widgetFinalPosition.value.x
    lastNonMaximizedY.value = widgetFinalPosition.value.y
  }
  emit('move', widgetFinalPosition.value)
})
watch(widgetFinalSize, () => {
  if (!isFullScreenSize.value) {
    lastNonMaximizedWidth.value = widgetFinalSize.value.width
    lastNonMaximizedHeight.value = widgetFinalSize.value.height
  }
  emit('resize', widgetFinalSize.value)
})

const sizeStyle = computed(() => ({
  width: `${100 * widgetFinalSize.value.width}%`,
  height: `${100 * widgetFinalSize.value.height}%`,
}))

const isFullScreenPosition = computed(() => isEqual(widgetFinalPosition.value, fullScreenPosition))
const isFullScreenSize = computed(() => isEqual(widgetFinalSize.value, fullScreenSize))
const isFullScreen = computed(() => {
  return isFullScreenPosition.value && isFullScreenSize.value
})

const isFullWidth = computed(() => {
  return widgetFinalPosition.value.x === 0 && widgetFinalSize.value.width === 1
})

const isFullHeight = computed(() => {
  return widgetFinalPosition.value.y === 0 && widgetFinalSize.value.height === 1
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

const devInfoBlurLevel = computed(() => `${devStore.widgetDevInfoBlurLevel}px`)

const widgetDeleteDialogRevealed = ref(false)
const widgetDeleteDialog = useConfirmDialog(widgetDeleteDialogRevealed)
widgetDeleteDialog.onConfirm(() => emit('remove'))

const wallRespecterInterval = setInterval(makeWidgetRespectWalls, 1000)
onBeforeUnmount(() => clearInterval(wallRespecterInterval))
</script>

<style scoped>
.widgetOverlay {
  --overlayOverSize: 10px;
  position: absolute;
  left: calc(v-bind('positionStyle.left') - var(--overlayOverSize));
  top: calc(v-bind('positionStyle.top') - var(--overlayOverSize));
  width: calc(v-bind('sizeStyle.width') + 2 * var(--overlayOverSize));
  height: calc(v-bind('sizeStyle.height') + 2 * var(--overlayOverSize));
  user-select: none;
}
.dev-info {
  background-color: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(v-bind('devInfoBlurLevel'));
  z-index: 1;
  pointer-events: none;
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: auto;
  text-shadow: 1ch;
  flex-flow: column wrap;
}
.widgetOverlay.allowMoving {
  background-color: rgba(0, 0, 0, 0.1);
}
.widgetOverlay.hoveringWidgetOrOverlay.allowMoving {
  box-shadow: 0 0 0 1px white;
  outline: dashed 1px black;
}
.widgetOverlay.draggingWidget.allowMoving {
  box-shadow: 0 0 0 1px white;
  outline: solid 1px black;
}
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
