<template>
  <div class="text-white w-full">
    <div class="flex flex-col align-start" :class="isElevationEffect && showElevationEffect ? 'elevation-5' : ''">
      <v-divider v-if="!noTopDivider" centered class="opacity-10 border-[#fafafa] w-full" />
      <div
        :class="[
          isPanelExpanded && isMarkExpanded ? 'panel-header-expanded elevation-1' : 'panel-header elevation-0',
          isHoverEffect ? 'hover:bg-[#ffffff11]' : '',
        ]"
        @click="togglePanel"
      >
        <div
          class="flex flex-row w-full align-center"
          :class="isCompact ? 'gap-x-[1vw] py-[0.8vh]' : 'gap-x-[3vw] py-[1.5vh]'"
        >
          <div class="flex flex-col w-full">
            <div
              class="flex flex-row whitespace-nowrap"
              :class="isChevronInverted ? 'justify-between w-full' : 'justify-start'"
            >
              <v-icon
                v-if="!isChevronInverted"
                :size="isCompact ? 20 : 24"
                :icon="isPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                :class="interfaceStore.isOnSmallScreen ? '-mt-[2px] mr-[3px]' : 'mt-[2px] mr-[2px]'"
              />
              <div class="flex w-full flex-col">
                <div
                  class="font-semibold"
                  :class="interfaceStore.isOnSmallScreen ? `text-[${textSize - 4}px]` : `text-[${textSize}px]`"
                >
                  <slot name="title" />
                </div>
              </div>
              <v-icon
                v-if="isChevronInverted"
                :size="isCompact ? 20 : 24"
                :icon="isPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                :class="interfaceStore.isOnSmallScreen ? '-mt-[2px] mr-[3px]' : 'mt-[2px] mr-[2px]'"
              />
            </div>
            <div
              class="font-normal opacity-80"
              :class="interfaceStore.isOnSmallScreen ? `text-[${textSize - 8}px]` : `text-[${textSize - 4}px]`"
            >
              <slot name="subtitle" />
            </div>
          </div>
        </div>
        <div class="flex justify-between ml-4">
          <div v-if="hasInfoSlot" class="flex items-center w-[10%]">
            <v-btn class="ml-auto rounded-full" size="small" color="transparent" elevation="0" @click.stop="toggleInfo">
              <v-icon :size="interfaceStore.isOnSmallScreen ? 15 : 18" color="white" icon="mdi-information-outline" />
            </v-btn>
          </div>
          <div v-if="hasWarningSlot" class="flex justify-end items-center w-[10%] relative">
            <v-btn
              class="ml-auto w-[10px] rounded-full"
              size="small"
              color="transparent"
              elevation="0"
              @click.stop="toggleWarning"
            >
              <v-icon :size="interfaceStore.isOnSmallScreen ? 15 : 18" color="yellow-400" icon="mdi-alert" />
              <div v-if="animateWarning" class="ripple"></div>
            </v-btn>
          </div>
        </div>
      </div>
      <v-divider v-if="!isPanelExpanded && !noBottomDivider" class="opacity-10 border-[#fafafa] w-full" />
    </div>
    <div class="info-container">
      <div
        ref="infoContent"
        :class="['info-content-expand-collapse', { 'info-expanding': isInfoOpen, 'info-collapsing': !isInfoOpen }]"
      >
        <div
          class="bg-[#00000033] py-3 px-5 rounded-[6px] text-white elevation-1 mb-2 mt-1"
          :class="interfaceStore.isOnSmallScreen ? 'text-[12px]' : 'text-[14px]'"
        >
          <slot name="info"></slot>
        </div>
      </div>
    </div>
    <div class="info-container">
      <div
        ref="warningContent"
        :class="[
          'info-content-expand-collapse',
          { 'info-expanding': isWarningOpen, 'info-collapsing': !isWarningOpen },
        ]"
      >
        <div
          class="bg-[#00000033] py-3 px-5 rounded-[6px] text-white elevation-1 mb-2 mt-1"
          :class="interfaceStore.isOnSmallScreen ? 'text-[12px]' : 'text-[14px]'"
        >
          <slot name="warning"></slot>
        </div>
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * Removes the top divider.
   */
  noTopDivider?: boolean
  /**
   * Removes the bottom divider.
   */
  noBottomDivider?: boolean
  /**
   * Whether the panel is expanded.
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
   * Disable hover effect on the panel header.
   */
  hoverEffect?: boolean
  /**
   * Invert horizontal position of the chevron icon.
   */
  invertChevron?: boolean
  /**
   * Elevation effect on the panel header.
   */
  elevationEffect?: boolean
}>()

const slots = useSlots()

const isPanelExpanded = ref(props.isExpanded ?? false)
const noTopDivider = ref(props.noTopDivider ?? false)
const noBottomDivider = ref(props.noBottomDivider ?? false)
const isInfoOpen = ref(false)
const isWarningOpen = ref(false)
const isMarkExpanded = ref(props.markExpanded ?? false)
const isCompact = ref(props.compact ?? false)
const isDarkenContent = ref(props.darkenContent ?? false)
const isHoverEffect = ref(props.hoverEffect ?? false)
const isChevronInverted = ref(props.invertChevron ?? false)
const isElevationEffect = ref(props.elevationEffect ?? false)

const content = ref<HTMLElement | null>(null)
const infoContent = ref<HTMLElement | null>(null)
const warningContent = ref<HTMLElement | null>(null)
const animateWarning = ref(true)
const showElevationEffect = ref(isPanelExpanded.value || false)

const togglePanel = (): void => {
  if (isPanelExpanded.value) {
    isPanelExpanded.value = false
    setTimeout(() => {
      showElevationEffect.value = false
    }, 300)
  } else {
    showElevationEffect.value = true
    isPanelExpanded.value = true
  }
}

const textSize = computed(() => {
  return isCompact.value ? 16 : 18
})

const toggleInfo = (): void => {
  isInfoOpen.value = !isInfoOpen.value
}

const toggleWarning = (): void => {
  animateWarning.value = false
  isWarningOpen.value = !isWarningOpen.value
}

watch(
  () => props.isExpanded,
  (newValue) => {
    isPanelExpanded.value = newValue ?? false
  }
)

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

watch(isInfoOpen, (newValue) => {
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

watch(isWarningOpen, (newValue) => {
  if (warningContent.value) {
    if (newValue) {
      warningContent.value.style.maxHeight = warningContent.value.scrollHeight + 'px'
    } else {
      warningContent.value.style.maxHeight = warningContent.value.scrollHeight + 'px'
      setTimeout(() => {
        warningContent.value!.style.maxHeight = '0px'
      }, 0)
    }
  }
})

onMounted(() => {
  if (content.value && !isPanelExpanded.value) {
    content.value.style.maxHeight = '0px'
  }
  if (infoContent.value && !isInfoOpen.value) {
    infoContent.value.style.maxHeight = '0px'
  }
  if (warningContent.value && !isWarningOpen.value) {
    warningContent.value.style.maxHeight = '0px'
  }
})

const hasInfoSlot = computed(() => !!slots.info?.())
const hasWarningSlot = computed(() => !!slots.warning?.())
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
  width: 100%;
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

.ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 0, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: rippleEffect 1.5s infinite;
}

@keyframes rippleEffect {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.6);
    opacity: 0;
  }
}
</style>
