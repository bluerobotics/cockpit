<template>
  <transition
    :enter-active-class="enterActiveClass"
    :leave-active-class="leaveActiveClass"
    :enter-from-class="enterFromClass"
    :enter-to-class="enterToClass"
    :leave-from-class="leaveFromClass"
    :leave-to-class="leaveToClass"
  >
    <div v-if="visible" class="fixed shadow-lg" :class="panelPositionClass">
      <v-btn
        v-if="hideButton"
        icon
        size="x-small"
        variant="text"
        class="close_btn bg-transparent text-white"
        @click="closePanel"
      >
        <v-icon class="text-[18px]">{{ `mdi-arrow-${position}` }}</v-icon>
      </v-btn>
      <slot></slot>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, defineProps } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * Panel position
   */
  position?: 'right' | 'bottom' | 'top' | 'left'
  /**
   * hide button
   */
  hideButton?: boolean
}>()

const visible = computed(() => interfaceStore.configPanelVisible)

const closePanel = (): void => {
  interfaceStore.configPanelVisible = false
}

const enterActiveClass = 'transition-transform duration-500 ease-in-out'
const leaveActiveClass = 'transition-transform duration-0 ease-in-out'

const enterFromClass = computed(() => {
  switch (props.position) {
    case 'right':
      return 'translate-x-full opacity-0'
    case 'bottom':
      return 'translate-y-full opacity-0'
    case 'top':
      return '-translate-y-full opacity-0'
    case 'left':
    default:
      return '-translate-x-full opacity-0'
  }
})
const enterToClass = 'translate-x-0 translate-y-0 opacity-100'
const leaveFromClass = 'translate-x-0 translate-y-0 opacity-100'
const leaveToClass = computed(() => {
  switch (props.position) {
    case 'right':
      return 'translate-x-full opacity-0'
    case 'bottom':
      return 'translate-y-full opacity-0'
    case 'top':
      return '-translate-y-full opacity-0'
    case 'left':
    default:
      return '-translate-x-full opacity-0'
  }
})

const panelPositionClass = computed(() => {
  switch (props.position) {
    case 'right':
      return 'right-0 top-0 bottom-0 w-64'
    case 'bottom':
      return 'left-0 right-0 bottom-0 h-64'
    case 'top':
      return 'left-0 right-0 top-0 h-64'
    case 'left':
    default:
      return 'left-0 top-0 bottom-0 w-64'
  }
})
</script>

<style scoped>
.fixed {
  height: 100%;
  z-index: 500;
  pointer-events: all;
}
.close_btn {
  z-index: 500;
  position: absolute;
  margin-top: 3px;
}
</style>
