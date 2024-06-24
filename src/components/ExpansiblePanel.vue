<template>
  <div class="text-white w-full">
    <div class="flex flex-col align-start">
      <v-divider v-if="!noTopDivider" centered class="opacity-10 border-[#fafafa] w-full" />
      <div
        :class="[
          isPanelExpanded && isMarkExpanded ? 'panel-header-expanded elevation-1' : 'panel-header elevation-0',
          isHoverEffect ? 'hover:bg-[#ffffff11]' : '',
        ]"
        @click="togglePanel"
      >
        <div
          class="flex flex-row align-center"
          :class="isCompact ? 'gap-x-[1vw] py-[0.8vh]' : 'gap-x-[3vw] py-[1.5vh]'"
        >
          <div>
            <div class="flex flex-row">
              <v-icon
                :size="isCompact ? 20 : 24"
                :icon="isPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                :class="
                  interfaceStore.isOnSmallScreen
                    ? isCompact
                      ? '-mt-[2px] mr-[3px]'
                      : '-mt-[3px] mr-[3px]'
                    : 'mt-[2px] mr-[2px]'
                "
              />
              <div class="flex flex-col">
                <div
                  class="font-semibold"
                  :class="interfaceStore.isOnSmallScreen ? `text-[${textSize - 4}px]` : `text-[${textSize}px]`"
                >
                  <slot name="title" />
                </div>
              </div>
            </div>
            <div
              class="font-normal"
              :class="interfaceStore.isOnSmallScreen ? `text-[${textSize - 8}px]` : `text-[${textSize - 4}px]`"
            >
              <slot name="subtitle" />
            </div>
          </div>
        </div>
        <div v-if="hasInfoSlot" class="flex items-center w-[10%]">
          <v-btn
            icon="mdi-information-outline"
            class="ml-auto"
            size="small"
            color="transparent"
            elevation="0"
            @click="toggleInfo"
          />
        </div>
      </div>
      <v-divider v-if="!isPanelExpanded && !noBottomDivider" class="opacity-10 border-[#fafafa] w-full" />
    </div>
    <div class="info-container">
      <div
        ref="infoContent"
        :class="[
          'info-content-expand-collapse',
          { 'info-expanding': isBottomSheetOpen, 'info-collapsing': !isBottomSheetOpen },
        ]"
      >
        <div
          class="bg-[#ffffff11] py-3 px-5 rounded-[6px] text-white elevation-1 mb-2 mt-1"
          :class="interfaceStore.isOnSmallScreen ? 'text-[12px]' : 'text-[14px]'"
        >
          <slot name="info"></slot>
        </div>
      </div>
    </div>
    <div
      ref="content"
      :class="[
        'content-expand-collapse',
        { expanding: isPanelExpanded, collapsing: !isPanelExpanded },
        isDarkenContent ? 'bg-[#00000015]' : 'bg-transparent',
        interfaceStore.isOnPhoneScreen ? 'px-1' : 'px-2',
      ]"
    >
      <slot name="content"></slot>
      <v-divider v-if="!noBottomDivider" centered class="opacity-10 border-[#fafafa] w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'

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
  /**
   * Mark the panel header as expanded.
   */
  markExpanded?: boolean
  /**
   * Compact mode.
   */
  compact?: boolean
  /**
   * Darken the content background.
   */
  darkenContent?: boolean
  /**
   * Disable hover effect on panel header.
   */
  hoverEffect?: boolean
}>()

const slots = useSlots()

const isPanelExpanded = ref(props.isExpanded ?? false)
const noTopDivider = ref(props.noTopDivider ?? false)
const noBottomDivider = ref(props.noBottomDivider ?? false)
const isBottomSheetOpen = ref(false)
const isMarkExpanded = ref(props.markExpanded ?? false)
const isCompact = ref(props.compact ?? false)
const isDarkenContent = ref(props.darkenContent ?? false)
const isHoverEffect = ref(props.hoverEffect ?? false)

const content = ref<HTMLElement | null>(null)
const infoContent = ref<HTMLElement | null>(null)

const togglePanel = (): void => {
  isPanelExpanded.value = !isPanelExpanded.value
}

const textSize = computed(() => {
  if (isCompact.value) {
    return 16
  }
  return 18
})

const toggleInfo = (): void => {
  isBottomSheetOpen.value = !isBottomSheetOpen.value
}

watch(isPanelExpanded, (newValue) => {
  if (content.value) {
    if (newValue) {
      content.value.style.maxHeight = content.value.scrollHeight + 'px'
    } else {
      content.value.style.maxHeight = content.value.scrollHeight + 'px'
      setTimeout(() => {
        content.value!.style.maxHeight = '0px'
      }, 0)
    }
  }
})

watch(isBottomSheetOpen, (newValue) => {
  if (infoContent.value) {
    if (newValue) {
      infoContent.value.style.maxHeight = infoContent.value.scrollHeight + 'px'
    } else {
      infoContent.value.style.maxHeight = infoContent.value.scrollHeight + 'px'
      setTimeout(() => {
        infoContent.value!.style.maxHeight = '0px'
      }, 0)
    }
  }
})

onMounted(() => {
  if (content.value && !isPanelExpanded.value) {
    content.value.style.maxHeight = '0px'
  }
  if (infoContent.value && !isBottomSheetOpen.value) {
    infoContent.value.style.maxHeight = '0px'
  }
})

const hasInfoSlot = computed(() => !!slots.info?.())
</script>

<style scoped>
.panel-header {
  display: flex;
  flex-direction: row;
  justify-content: start;
  background-color: transparent;
  width: 100%;
  padding-left: 5px;
  cursor: pointer;
}
.panel-header-expanded {
  display: flex;
  flex-direction: row;
  justify-content: start;
  background-color: rgba(255, 255, 255, 0.1);
  width: 100%;
  padding-left: 5px;
  cursor: pointer;
}
.content-expand-collapse {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.info-container {
  overflow: hidden;
}

.info-content-expand-collapse {
  overflow: hidden;
  transition: max-height 0.3s ease;
}
</style>
