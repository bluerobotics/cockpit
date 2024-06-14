<template>
  <div
    v-if="isVisible"
    class="glass-modal"
    :class="interfaceStore.isOnPhoneScreen ? 'rounded-[10px]' : 'rounded-[20px]'"
    :style="modalPositionStyle"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
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
}>()

const isVisible = ref(props.isVisible)
const modalPosition = ref(props.position || 'center')

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
          ? `${interfaceStore.mainMenuWidth - 6}px`
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
  max-height: 85vh;
  overflow: auto;
  border: 1px solid #cbcbcb33;
  background-color: #4f4f4f33;
  backdrop-filter: blur(15px);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
</style>
