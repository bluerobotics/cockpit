<template>
  <div class="bg-transparent text-white w-full">
    <div class="flex flex-col align-start">
      <v-divider v-if="!noTopDivider" centered class="opacity-10 border-[#fafafa] w-full" />
      <div
        class="flex flex-row align-center gap-x-[3vw] py-[1.5vh] cursor-pointer"
        :class="isPanelExpanded ? 'pt-[2.5vh]' : undefined"
        @click="togglePanel"
      >
        <v-icon :size="24" :icon="isPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
        <div class="flex flex-col">
          <div class="font-semibold" :class="interfaceStore.isOnSmallScreen ? 'text-[14px]' : 'text-[18px]'">
            <slot name="title" />
          </div>
          <div class="font-normal" :class="interfaceStore.isOnSmallScreen ? 'text-[10px]' : 'text-[14px]'">
            <slot name="subtitle" />
          </div>
        </div>
      </div>
      <v-divider v-if="!isPanelExpanded && !noBottomDivider" class="opacity-10 border-[#fafafa] w-full" />
    </div>
    <transition name="expand" @before-enter="beforeEnter" @enter="enter" @leave="leave">
      <div v-show="isPanelExpanded" ref="content" class="overflow-hidden">
        <slot name="content"></slot>
        <v-divider v-if="!noBottomDivider" centered class="opacity-10 border-[#fafafa] w-full" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   *
   */
  noTopDivider?: boolean
  /**
   *
   */
  noBottomDivider?: boolean
  /**
   *
   */
  isExpanded?: boolean
}>()

const isPanelExpanded = ref(props.isExpanded ?? false)
const noTopDivider = ref(props.noTopDivider ?? false)
const noBottomDivider = ref(props.noBottomDivider ?? false)

const togglePanel = (): void => {
  isPanelExpanded.value = !isPanelExpanded.value
}

const beforeEnter = (el: Element): void => {
  const element = el as HTMLElement
  element.style.height = '0'
}

const enter = (el: Element): void => {
  const element = el as HTMLElement
  nextTick(() => {
    element.style.height = element.scrollHeight + 'px'
  })
}

const leave = (el: Element): void => {
  const element = el as HTMLElement
  element.style.height = element.scrollHeight + 'px'
  nextTick(() => {
    element.style.height = '0'
  })
}
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: height 0.3s ease;
}
.expand-enter,
.expand-leave-to {
  height: 0;
  overflow: hidden;
}
</style>
