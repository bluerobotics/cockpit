<template>
  <div
    v-if="isVisible"
    ref="modal"
    class="glass-modal"
    :class="[
      interfaceStore.isOnSmallScreen ? 'rounded-[10px]' : 'rounded-[20px]',
      selectedOverflow,
      { 'cursor-move': isDraggable },
    ]"
    :style="[modalPositionStyle, interfaceStore.globalGlassMenuStyles]"
    @click="bringModalUp"
    @mousedown="startDragging"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

type ModalPosition = 'left' | 'center' | 'menuitem'

const props = defineProps<{
  /**
   * Whether the modal is visible or not.
   */
  isVisible: boolean
  /**
   * When set to menuitem, the modal will be positioned about 30px to the right of the main menu.
   * Center is the regular modal positioning, and also th default value.
   * Left can be used as popover to display information and help content.
   */
  position?: ModalPosition
  /**
   * If true, modal will not close by pressing 'esc' or by an outside click.
   */
  isPersistent?: boolean
  /**
   * The overflow property of the modal.
   */
  overflow?: 'auto' | 'hidden' | 'scroll' | 'visible' | 'inherit' | 'initial' | 'unset'
  /**
   * If true, the modal can be dragged around.
   */
  draggable?: boolean
  /**
   * The storage key to save the modal position in localStorage.
   */
  storageKey?: string
}>()

// eslint-disable-next-line
type ModalDraggedPosition = { left: number; top: number }

const emit = defineEmits(['outside-click'])

const isVisible = ref(props.isVisible)
const modalPosition = ref(props.position || 'center')
const selectedOverflow = ref(props.overflow || 'auto')
const isPersistent = ref(props.isPersistent || false)
const modal = ref<HTMLElement | null>(null)
const zIndexToggle = ref(200)
const isAlwaysOnTop = ref(false)
const isDraggable = ref(props.draggable || false)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const modalStartX = ref(0)
const modalStartY = ref(0)
const customPosition = ref<ModalDraggedPosition | null>(null)

const startDragging = (e: MouseEvent): void => {
  if (!isDraggable.value) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY

  const modalElement = modal.value
  if (modalElement) {
    const rect = modalElement.getBoundingClientRect()
    modalStartX.value = rect.left
    modalStartY.value = rect.top
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent): void => {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  const newLeft = modalStartX.value + deltaX
  const newTop = modalStartY.value + deltaY

  customPosition.value = { left: newLeft, top: newTop }

  if (props.storageKey) {
    localStorage.setItem(props.storageKey, JSON.stringify({ left: newLeft, top: newTop }))
  }
}

const onMouseUp = (): void => {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

const bringModalUp = (): void => {
  zIndexToggle.value = 2000
}

watch(
  () => interfaceStore.isGlassModalAlwaysOnTop,
  (val) => {
    if (val === true) {
      isAlwaysOnTop.value = true
      zIndexToggle.value = 5000
      return
    }
    isAlwaysOnTop.value = false
    zIndexToggle.value = 200
  }
)

const modalPositionStyle = computed(() => {
  if (customPosition.value) {
    return {
      top: `${customPosition.value.top}px`,
      left: `${customPosition.value.left}px`,
      transform: 'none',
      zIndex: zIndexToggle.value,
    }
  }

  switch (modalPosition.value) {
    case 'left':
      return {
        top: '50%',
        left: '0%',
        transform: 'translateY(-50%)',
        zIndex: zIndexToggle.value,
      }
    case 'menuitem':
      return {
        top: '50%',
        left: interfaceStore.isOnSmallScreen
          ? `${interfaceStore.mainMenuWidth - 20}px`
          : `${interfaceStore.mainMenuWidth + 30}px`,
        transform: 'translateY(-50%)',
        zIndex: zIndexToggle.value,
      }
    case 'center':
    default:
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: zIndexToggle.value,
      }
  }
})

const closeModal = (): void => {
  if (props.storageKey) {
    localStorage.removeItem(props.storageKey)
  }
  customPosition.value = null
  emit('outside-click')
}

onClickOutside(modal, () => {
  if (!isPersistent.value) {
    closeModal()
  }
  if (!isAlwaysOnTop.value) {
    zIndexToggle.value = 100
  }
})

watch(isVisible, (newVal) => {
  if (newVal) {
    if (props.storageKey) {
      const savedPosition = localStorage.getItem(props.storageKey)
      if (savedPosition) {
        const position = JSON.parse(savedPosition)
        customPosition.value = position
      } else {
        customPosition.value = null
      }
    }
  }
  if (!newVal) {
    closeModal()
  }
})

watch(
  () => props.isVisible,
  (newVal) => {
    isVisible.value = newVal
  }
)
</script>
<style scoped>
.glass-modal {
  position: absolute;
  width: auto;
  max-height: 100vh;
  border: 1px solid #cbcbcb33;
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
</style>
