<template>
  <div v-if="devStore.developmentMode" class="widgetOverlay dev-info">
    <p>Position: {{ round(100 * element.position.x, 2) }} x {{ round(100 * element.position.y, 2) }} %</p>
    <p>Size: {{ round(100 * element.size.width, 2) }} x {{ round(100 * element.size.height, 2) }} %</p>
    <p>Position: {{ round(element.position.x * windowWidth) }} x {{ round(element.position.y * windowHeight) }} px</p>
    <p>Size: {{ round(element.size.width * windowWidth) }} x {{ round(element.size.height * windowHeight) }} px</p>
    <p>Client size: {{ innerElementRef?.clientWidth }} x {{ innerElementRef?.clientHeight }} px</p>
    <p>Offset size: {{ innerElementRef?.offsetWidth }} x {{ innerElementRef?.offsetHeight }} px</p>
    <p>Scroll size: {{ innerElementRef?.scrollWidth }} x {{ innerElementRef?.scrollHeight }} px</p>
    <p v-for="[k, v] in Object.entries(element?.options)" :key="k">{{ k }} (option): {{ v }}</p>
  </div>
  <div ref="widgetOverlay" class="widgetOverlay" :class="{ allowMoving, draggingElement, hoveringElementOrOverlay }" />
  <div ref="outerWidgetRef" class="outerWidget">
    <div ref="innerElementRef" class="innerWidget">
      <slot></slot>
    </div>
    <div class="resize-handle top-left" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle top-right" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle bottom-left" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle bottom-right" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle left" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle right" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle top" :class="{ hoveringElementOrOverlay, allowResizing }" />
    <div class="resize-handle bottom" :class="{ hoveringElementOrOverlay, allowResizing }" />
  </div>
</template>

<script setup lang="ts">
import { useElementHover, useWindowSize } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import { constrain, round } from '@/libs/utils'
import { useDevelopmentStore } from '@/stores/development'

type ElementType = {
  /**
   *
   */
  position: {
    /**
     *
     */
    x: number
    /**
     *
     */
    y: number
  }
  /**
   *
   */
  size: {
    /**
     *
     */
    width: number
    /**
     *
     */
    height: number
  }
  /**
   *
   */
  options: Record<string, unknown>
}

/**
 * Props for the elementHugger component
 */
export interface Props {
  /**
   *
   */
  element: ElementType
  /**
   *
   */
  allowMoving?: boolean
  /**
   *
   */
  allowResizing?: boolean
}

const devStore = useDevelopmentStore()

const props = withDefaults(defineProps<Props>(), {
  allowMoving: true,
  allowResizing: true,
})

const position = ref({ x: props.element.position.x, y: props.element.position.y })
const size = ref({ width: props.element.size.width, height: props.element.size.height })
const allowMoving = ref(props.allowMoving)
const allowResizing = ref(props.allowResizing)
const outerWidgetRef = ref<HTMLElement | undefined>()
const innerElementRef = ref<HTMLElement | undefined>()
const draggingElement = ref(false)
const isResizing = ref(false)
const initialMousePos = ref<{
  /**
   cccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccc
   */
  x: number
  /**
xxxxxxxxxxx *
xxxxxxxxxxx
   */
  y: number
} | null>(null)
const initialElementPos = ref(position.value)
const initialElementSize = ref(size.value)
const resizeHandle = ref<string | null>(null)

const elementContainer = ref<HTMLElement | null>(null)
const elementOverlay = ref<HTMLElement | null>(null)

const outerElementRef = ref<HTMLElement | undefined>()
const { width: windowWidth, height: windowHeight } = useWindowSize()

// Use hover to manage the hover state for the element and overlay
const hoveringOverlay = useElementHover(elementOverlay)
const hoveringElementItself = useElementHover(elementContainer)
const hoveringElementOrOverlay = computed(() => hoveringOverlay.value || hoveringElementItself.value)

const viewSize = computed(() => ({
  width: elementContainer.value?.parentElement?.getBoundingClientRect().width || 1,
  height: elementContainer.value?.parentElement?.getBoundingClientRect().height || 1,
}))

// Start dragging
const handleDragStart = (event: MouseEvent): void => {
  if (!allowMoving.value || isResizing.value) return
  draggingElement.value = true
  initialMousePos.value = { x: event.clientX, y: event.clientY }
  initialElementPos.value = { ...position.value }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', handleEnd)
}

// Handle dragging
const handleDrag = (event: MouseEvent): void => {
  if (!draggingElement.value || !initialMousePos.value) return

  const dx = (event.clientX - initialMousePos.value.x) / viewSize.value.width
  const dy = (event.clientY - initialMousePos.value.y) / viewSize.value.height

  position.value = {
    x: constrain(initialElementPos.value.x + dx, 0, 1 - size.value.width),
    y: constrain(initialElementPos.value.y + dy, 0, 1 - size.value.height),
  }
}

// Start resizing
const handleResizeStart = (event: MouseEvent, handle: string): void => {
  if (!allowResizing.value || draggingElement.value) return
  isResizing.value = true
  resizeHandle.value = handle
  initialMousePos.value = { x: event.clientX, y: event.clientY }
  initialElementSize.value = { ...size.value }
  initialElementPos.value = { ...position.value }

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', handleEnd)
}

// Handle resizing
const handleResize = (event: MouseEvent): void => {
  if (!isResizing.value || !initialMousePos.value) return

  const dx = (event.clientX - initialMousePos.value.x) / viewSize.value.width
  const dy = (event.clientY - initialMousePos.value.y) / viewSize.value.height

  let newWidth = initialElementSize.value.width
  let newHeight = initialElementSize.value.height
  let newLeft = initialElementPos.value.x
  let newTop = initialElementPos.value.y

  switch (resizeHandle.value) {
    case 'top-left':
      newWidth -= dx
      newHeight -= dy
      newLeft += dx
      newTop += dy
      break
    case 'top-right':
      newWidth += dx
      newHeight -= dy
      newTop += dy
      break
    case 'bottom-left':
      newWidth -= dx
      newHeight += dy
      newLeft += dx
      break
    case 'bottom-right':
      newWidth += dx
      newHeight += dy
      break
  }

  // Constrain within parent boundaries
  position.value = {
    x: constrain(newLeft, 0, 1 - size.value.width),
    y: constrain(newTop, 0, 1 - size.value.height),
  }

  size.value = {
    width: constrain(newWidth, 0.05, 1),
    height: constrain(newHeight, 0.05, 1),
  }
}

// End dragging or resizing
const handleEnd = (): void => {
  draggingElement.value = false
  isResizing.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', handleEnd)
}

onMounted(() => {
  elementContainer.value = document.querySelector('.elementContainer')
})
</script>

<style scoped>
.elementContainer {
  position: absolute;
  cursor: grab;
  display: flex;
  justify-content: center;
  align-items: center;
}

.innerElement {
  width: 100%;
  height: 100%;
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid black;
  z-index: 2;
  cursor: nwse-resize;
}

.resize-handle.top-left {
  top: -5px;
  left: -5px;
}

.resize-handle.top-right {
  top: -5px;
  right: -5px;
}

.resize-handle.bottom-left {
  bottom: -5px;
  left: -5px;
}

.resize-handle.bottom-right {
  bottom: -5px;
  right: -5px;
}
</style>
