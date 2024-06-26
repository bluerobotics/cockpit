<template>
  <div
    v-if="isVisible"
    ref="modal"
    class="glass-modal"
    :class="[interfaceStore.isOnSmallScreen ? 'rounded-[10px]' : 'rounded-[20px]', selectedOverflow]"
    :style="modalPositionStyle"
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
   *
   */
  isVisible: boolean
  /**
   *
   */
  position?: ModalPosition
  /**
   *
   */
  isPersistent?: boolean
  /**
   *
   */
  overflow?: 'auto' | 'hidden' | 'scroll' | 'visible' | 'inherit' | 'initial' | 'unset'
}>()

const emit = defineEmits(['outside-click'])

const isVisible = ref(props.isVisible)
const modalPosition = ref(props.position || 'center')
const selectedOverflow = ref(props.overflow || 'auto')
const isPersistent = ref(props.isPersistent || false)
const modal = ref<HTMLElement | null>(null)

const modalPositionStyle = computed(() => {
  switch (modalPosition.value) {
    case 'left':
      return {
        top: '50%',
        left: '0%',
        transform: 'translateY(-50%)',
      }
    case 'menuitem':
      return {
        top: '50%',
        left: interfaceStore.isOnSmallScreen
          ? `${interfaceStore.mainMenuWidth - 20}px`
          : `${interfaceStore.mainMenuWidth + 30}px`,
        transform: 'translateY(-50%)',
      }
    case 'center':
    default:
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
  }
})

const closeModal = (): void => {
  emit('outside-click')
}

onClickOutside(modal, () => {
  if (!isPersistent.value) {
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
  background-color: #4f4f4f33;
  backdrop-filter: blur(15px);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
</style>
