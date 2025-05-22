<template>
  <div v-if="devStore.developmentMode" class="widgetOverlay dev-info">
    <p>Position: {{ round(100 * widget.position.x, 2) }} x {{ round(100 * widget.position.y, 2) }} %</p>
    <p>Size: {{ round(100 * widget.size.width, 2) }} x {{ round(100 * widget.size.height, 2) }} %</p>
    <p>Position: {{ round(widget.position.x * windowWidth) }} x {{ round(widget.position.y * windowHeight) }} px</p>
    <p>Size: {{ round(widget.size.width * windowWidth) }} x {{ round(widget.size.height * windowHeight) }} px</p>
    <p>Client size: {{ innerWidgetRef?.clientWidth }} x {{ innerWidgetRef?.clientHeight }} px</p>
    <p>Offset size: {{ innerWidgetRef?.offsetWidth }} x {{ innerWidgetRef?.offsetHeight }} px</p>
    <p>Scroll size: {{ innerWidgetRef?.scrollWidth }} x {{ innerWidgetRef?.scrollHeight }} px</p>
    <p v-for="[k, v] in Object.entries(widget?.options)" :key="k">{{ k }} (option): {{ v }}</p>
  </div>
  <div
    ref="widgetOverlay"
    class="widgetOverlay"
    :class="{ allowMoving, draggingWidget, hoveringWidgetOrOverlay, highlighted }"
  />
  <div ref="outerWidgetRef" class="outerWidget">
    <div
      v-if="widget.options?.blockGenericContextMenu === true"
      class="innerWidget"
      :class="{ 'overflow-hidden': hideOverflow }"
      :style="{ opacity: widget.options.opacity ?? 1 }"
    >
      <slot></slot>
    </div>
    <div
      v-else
      ref="innerWidgetRef"
      v-contextmenu="handleContextMenu"
      class="innerWidget"
      :class="{ 'overflow-hidden': hideOverflow }"
      :style="{ opacity: widget.options.opacity ?? 1 }"
    >
      <slot></slot>
    </div>
    <div class="resize-handle top-left" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle top-right" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle bottom-left" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle bottom-right" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle left" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle right" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle top" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
    <div class="resize-handle bottom" :class="{ hoveringWidgetOrOverlay, allowResizing }" />
  </div>
  <ContextMenu
    ref="contextMenuRef"
    :visible="contextMenuVisible"
    :menu-items="contextMenuItems"
    width="200px"
    @close="contextMenuVisible = false"
  >
    <template #default>
      <div class="flex justify-between items-center pr-4 h-10 hover:bg-[#FFFFFF11] text-[14px]">
        <div class="w-full -ml-1">
          <v-slider
            v-model="opacitySlider"
            color="white"
            min="0.2"
            max="1"
            step="0.01"
            class="scale-75 h-[32px] opacity-75"
          />
        </div>
        <v-icon icon="mdi-circle-opacity" size="16" class="text-[#FFFFFF88] rotate-180" />
      </div>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { useElementHover, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, toRefs, watch } from 'vue'

import { constrain, round } from '@/libs/utils'
import { useDevelopmentStore } from '@/stores/development'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Point2D } from '@/types/general'
import { type Widget, isWidgetConfigurable, WidgetType } from '@/types/widgets'

import ContextMenu from './ContextMenu.vue'

/**
 * Props for the WidgetHugger component
 */
export interface Props {
  /**
   * Widget reference
   */
  widget: Widget
  /**
   * To allow or not the widget to be moved
   */
  allowMoving?: boolean
  /**
   * To allow or not the widget to be resized
   */
  allowResizing?: boolean
  /**
   * To hide or not content that overflows the widget area
   */
  hideOverflow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowMoving: true,
  allowResizing: true,
  hideOverflow: false,
})

const widget = toRefs(props).widget
const { size, position } = toRefs(props.widget)
const allowMoving = toRefs(props).allowMoving
const allowResizing = toRefs(props).allowResizing
const outerWidgetRef = ref<HTMLElement | undefined>()
const innerWidgetRef = ref<HTMLElement | undefined>()
const widgetView = computed(() => outerWidgetRef.value?.parentElement)
const widgetResizeHandles = computed(() => outerWidgetRef.value?.getElementsByClassName('resize-handle'))
const contextMenuRef = ref()
const contextMenuVisible = ref(false)

const opacitySlider = computed({
  get() {
    return widget.value.options?.opacity ?? 1
  },
  set(newValue) {
    if (widget.value.options) {
      widget.value.options.opacity = newValue
    }
  },
})

const handleContextMenu = {
  open: (event: MouseEvent | TouchEvent) => {
    event.preventDefault()
    event.stopPropagation()
    contextMenuRef.value.openAt(event)
    contextMenuVisible.value = true
  },
  close: () => {
    contextMenuVisible.value = false
  },
}

const openWidgetConfig = (): void => {
  widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen = true
}

const contextMenuItems = computed(() =>
  isWidgetConfigurable[widget.value.component as WidgetType]
    ? [{ item: 'Options', action: openWidgetConfig, icon: 'mdi-cog' }]
    : []
)

const devStore = useDevelopmentStore()

const { width: windowWidth, height: windowHeight } = useWindowSize()

const widgetOverlay = ref()
const hoveringOverlay = useElementHover(widgetOverlay)
const hoveringWidgetItself = useElementHover(outerWidgetRef)
const hoveringWidgetOrOverlay = computed(() => hoveringOverlay.value || hoveringWidgetItself.value)

// Put the widget into highlighted state when in edit-mode and hovering over it
watch([hoveringWidgetOrOverlay, allowMoving], () => {
  widgetStore.widgetManagerVars(widget.value.hash).highlighted = hoveringWidgetOrOverlay.value
})

const draggingWidget = ref(false)
const isResizing = ref(false)
const resizeHandle = ref<EventTarget | null>(null)
const viewSize = computed(() => ({
  width: widgetView.value?.getBoundingClientRect().width || 1,
  height: widgetView.value?.getBoundingClientRect().height || 1,
}))
const initialMousePos = ref<Point2D | undefined>(undefined)
const initialWidgetPos = ref(props.widget.position)
const initialWidgetSize = ref(props.widget.size)

const handleDragStart = (event: MouseEvent): void => {
  if (!allowMoving.value || isResizing.value || !outerWidgetRef.value) return
  draggingWidget.value = true
  initialMousePos.value = { x: event.clientX, y: event.clientY }
  initialWidgetPos.value = position.value
  outerWidgetRef.value.style.cursor = 'grabbing'
  event.stopPropagation()
  event.preventDefault()
}

const handleResizeStart = (event: MouseEvent): void => {
  if (!allowResizing.value || draggingWidget.value || !outerWidgetRef.value) return
  isResizing.value = true
  resizeHandle.value = event.target
  initialMousePos.value = { x: event.clientX, y: event.clientY }
  initialWidgetPos.value = position.value
  initialWidgetSize.value = size.value
  event.stopPropagation()
  event.preventDefault()
}

const handleDrag = (event: MouseEvent): void => {
  if (!draggingWidget.value || !initialMousePos.value) return

  const dx = (event.clientX - initialMousePos.value.x) / viewSize.value.width
  const dy = (event.clientY - initialMousePos.value.y) / viewSize.value.height

  position.value = {
    x: constrain(initialWidgetPos.value.x + dx, 0, 1 - size.value.width),
    y: constrain(initialWidgetPos.value.y + dy, 0, 1 - size.value.height),
  }
}

const handleResize = (event: MouseEvent): void => {
  if (!isResizing.value || !initialMousePos.value || !resizeHandle.value) return

  const dx = (event.clientX - initialMousePos.value.x) / viewSize.value.width
  const dy = (event.clientY - initialMousePos.value.y) / viewSize.value.height

  let newLeft = initialWidgetPos.value.x
  let newTop = initialWidgetPos.value.y
  let newWidth = initialWidgetSize.value.width
  let newHeight = initialWidgetSize.value.height

  if ((resizeHandle.value as HTMLElement).classList.contains('top-left')) {
    newWidth -= dx
    newHeight -= dy
    newLeft += dx
    newTop += dy
  } else if ((resizeHandle.value as HTMLElement).classList.contains('top-right')) {
    newWidth += dx
    newHeight -= dy
    newTop += dy
  } else if ((resizeHandle.value as HTMLElement).classList.contains('bottom-left')) {
    newWidth -= dx
    newHeight += dy
    newLeft += dx
  } else if ((resizeHandle.value as HTMLElement).classList.contains('bottom-right')) {
    newWidth += dx
    newHeight += dy
  } else if ((resizeHandle.value as HTMLElement).classList.contains('left')) {
    newWidth -= dx
    newLeft += dx
  } else if ((resizeHandle.value as HTMLElement).classList.contains('right')) {
    newWidth += dx
  } else if ((resizeHandle.value as HTMLElement).classList.contains('top')) {
    newHeight -= dy
    newTop += dy
  } else if ((resizeHandle.value as HTMLElement).classList.contains('bottom')) {
    newHeight += dy
  }

  position.value = {
    x: constrain(newLeft, 0, 1 - size.value.width),
    y: constrain(newTop, 0, 1 - size.value.height),
  }
  size.value = {
    width: constrain(newWidth, 0.01, 1),
    height: constrain(newHeight, 0.01, 1),
  }
}

const handleEnd = (): void => {
  if (!outerWidgetRef.value) return
  if (draggingWidget.value) {
    draggingWidget.value = false
    outerWidgetRef.value.style.cursor = 'grab'
  } else if (isResizing.value) {
    isResizing.value = false
    resizeHandle.value = null
  }
}

const resizeWidgetToMinimalSize = (): void => {
  let stillAutoResizing = false
  if (innerWidgetRef.value === undefined) return
  const { clientHeight, clientWidth, scrollWidth, scrollHeight } = innerWidgetRef.value
  if (scrollWidth > 1.05 * clientWidth) {
    size.value.width = (1.1 * scrollWidth) / windowWidth.value
    stillAutoResizing = true
  }
  if (scrollHeight > 1.05 * clientHeight) {
    size.value.height = (1.1 * scrollHeight) / windowHeight.value
    stillAutoResizing = true
  }

  if (stillAutoResizing) nextTick(resizeWidgetToMinimalSize)
}

onMounted(async () => {
  if (widgetStore.widgetManagerVars(widget.value.hash).everMounted === false) {
    resizeWidgetToMinimalSize()
  }
  widgetStore.widgetManagerVars(widget.value.hash).everMounted = true

  if (widgetResizeHandles.value) {
    for (let i = 0; i < widgetResizeHandles.value.length; i++) {
      const handle = widgetResizeHandles.value[i]
      // @ts-ignore
      handle.addEventListener('mousedown', handleResizeStart)
    }
  }

  outerWidgetRef.value?.addEventListener('mousedown', function (event: MouseEvent) {
    if (event.button === 0) {
      handleDragStart(event)
    }
  })

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', handleEnd)
})

// Change cursor when moving is allowed or disallowed, preventing the cursor to be a grab on exit of edit-mode
watch(allowMoving, (isAllowing, wasAllowing) => {
  if (wasAllowing && !isAllowing) {
    outerWidgetRef.value?.style.setProperty('cursor', 'default')
  } else if (!wasAllowing && isAllowing) {
    outerWidgetRef.value?.style.setProperty('cursor', 'grab')
  }
})

const widgetStore = useWidgetManagerStore()
const temporaryPosition = computed(() => {
  let tempPos = { x: position.value.x, y: position.value.y }
  const clearanceOffset = widgetStore.visibleAreaMinClearancePixels

  const barClearances = widgetStore.widgetClearanceForVisibleArea(widget.value)

  // If the widget is under both bars, dont touch it, as it could be full screened by purpose, and if we apply the rules below, it will keep jumping
  if (barClearances.top < clearanceOffset && barClearances.bottom < clearanceOffset) return tempPos

  // If the widget is partially under the top or bottom bar, move it so that it gets fully visible
  if (barClearances.top < clearanceOffset) {
    tempPos.y = (widgetStore.currentTopBarHeightPixels + clearanceOffset) / windowHeight.value
  } else if (barClearances.bottom < clearanceOffset) {
    const maxBottomEdgePosition = (widgetStore.currentBottomBarHeightPixels + clearanceOffset) / windowHeight.value
    tempPos.y = 1 - maxBottomEdgePosition - size.value.height
  }

  // Use grid to snap to grid
  if (widgetStore.snapToGrid) {
    tempPos.x = Math.round(tempPos.x / widgetStore.gridInterval) * widgetStore.gridInterval
    tempPos.y = Math.round(tempPos.y / widgetStore.gridInterval) * widgetStore.gridInterval
  }

  return tempPos
})

const sizeStyle = computed(() => ({
  width: `${100 * size.value.width}%`,
  height: `${100 * size.value.height}%`,
}))

const positionStyle = computed(() => ({
  left: `${100 * temporaryPosition.value.x}%`,
  top: `${100 * temporaryPosition.value.y}%`,
}))

const overlayDisplayStyle = computed(() => {
  return allowMoving.value || allowResizing.value ? 'block' : 'none'
})

const userInteractionStyle = computed(() => {
  return allowMoving.value || allowResizing.value ? 'none' : ''
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

const devInfoBlurLevel = computed(() => `${devStore.widgetDevInfoBlurLevel}px`)

const highlighted = computed(() => widgetStore.widgetManagerVars(widget.value.hash).highlighted)
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
  display: v-bind('overlayDisplayStyle');
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
.widgetOverlay.allowMoving.highlighted {
  background-color: rgba(255, 255, 255, 0.3);
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
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  user-select: v-bind('userInteractionStyle');
}
.editing-buttons {
  position: absolute;
  left: calc(50% - 16px);
  bottom: calc(50% - 16px);
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 1px solid black;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.resize-handle.hoveringWidgetOrOverlay.allowResizing {
  opacity: 1;
}

.resize-handle.top-left.allowResizing {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}

.resize-handle.top-right.allowResizing {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}

.resize-handle.bottom-left.allowResizing {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}

.resize-handle.bottom-right.allowResizing {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}

.resize-handle.left.allowResizing {
  top: 50%;
  left: -5px;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.resize-handle.right.allowResizing {
  top: 50%;
  right: -5px;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.resize-handle.top.allowResizing {
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.resize-handle.bottom.allowResizing {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}
</style>
