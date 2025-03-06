<template>
  <teleport to="body">
    <Transition name="fade">
      <div v-if="isContextMenuOpen" class="fixed z-[99999]" :style="positionStyles" @click.stop>
        <div
          class="flex flex-col rounded-md shadow-lg"
          :style="[
            interfaceStore.globalGlassMenuStyles,
            { background: '#33333333', border: '1px solid #FFFFFF44' },
            { width: width },
          ]"
        >
          <template v-if="menuItems">
            <div
              v-for="(item, index) in menuItems"
              :key="index"
              class="flex justify-between items-center px-4 h-10 hover:bg-[#FFFFFF11] cursor-pointer text-[14px]"
              @click="handleItemClick(item)"
            >
              <p class="mb-1">{{ item.item }}</p>
              <v-icon v-if="item.icon" :icon="item.icon" size="16" class="text-[#FFFFFF88] ml-4" />
            </div>
            <v-divider v-if="menuItems.length > 1 || ($slots.default && menuItems.length === 1)" />
          </template>
          <template v-if="$slots.default">
            <slot :close="handleClose" />
          </template>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import {
  computed,
  CSSProperties,
  defineEmits,
  defineExpose,
  defineProps,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { ContextMenuItem } from '@/types/user-interface'

const props = defineProps<{
  /**
   *
   */
  visible: boolean
  /**
   *
   */
  menuItems?: ContextMenuItem[]
  /**
   *
   */
  width?: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

const isContextMenuOpen = ref(false)

watch(
  () => props.visible,
  (newValue) => {
    isContextMenuOpen.value = newValue
  }
)

const internalPosition = reactive({ x: 0, y: 0 })

const positionStyles = computed<CSSProperties>(() => {
  const isAboveCenter = internalPosition.y < window.innerHeight / 2
  const isInLastQuarter = internalPosition.x > window.innerWidth * 0.75

  const style: CSSProperties = {
    userSelect: 'none',
    top: isAboveCenter ? internalPosition.y + 'px' : 'auto',
    bottom: !isAboveCenter ? window.innerHeight - internalPosition.y + 'px' : 'auto',
  }

  if (isInLastQuarter) {
    style.right = window.innerWidth - internalPosition.x + 'px'
  } else {
    style.left = internalPosition.x + 'px'
  }

  return style
})

const width = computed(() => props.width || 'auto')

const handleItemClick = (item: ContextMenuItem): void => {
  item.action?.()
  handleClose()
}

const handleClose = (): void => {
  isContextMenuOpen.value = false
  if (widgetStore.currentContextMenu === instance) {
    widgetStore.currentContextMenu = null
  }
  emit('close')
}

const handleOutsideClick = (): void => {
  handleClose()
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})

const instance = getCurrentInstance()

// Position the context menu at the given coordinates.
const openAt = (event: MouseEvent | TouchEvent): void => {
  let x = 0,
    y = 0
  if ('clientX' in event) {
    x = event.clientX
    y = event.clientY
  } else if (event.touches && event.touches.length) {
    x = event.touches[0].clientX
    y = event.touches[0].clientY
  }
  internalPosition.x = x
  internalPosition.y = y

  if (widgetStore.currentContextMenu && widgetStore.currentContextMenu !== instance) {
    widgetStore.currentContextMenu.exposed?.handleClose()
  }
  widgetStore.currentContextMenu = instance

  isContextMenuOpen.value = true
}

defineExpose({ openAt, handleClose })
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
