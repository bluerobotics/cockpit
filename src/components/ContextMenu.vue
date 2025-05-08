<template>
  <teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
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
            <div>
              <div
                v-for="(item, index) in menuItems"
                :key="index"
                class="flex justify-between items-center px-4 h-10 hover:bg-[#FFFFFF11] cursor-pointer text-[14px] border-b-[1px] border-[#FFFFFF11]"
                @click="handleItemClick(item)"
              >
                <p>{{ item.item }}</p>
                <v-icon v-if="item.icon" :icon="item.icon" size="16" class="text-[#FFFFFF88] ml-4" />
              </div>
            </div>
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
   * Whether the context menu is visible or not.
   */
  visible: boolean
  /**
   * The items to be displayed in the context menu.
   */
  menuItems?: ContextMenuItem[]
  /**
   * The width of the context menu.
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
