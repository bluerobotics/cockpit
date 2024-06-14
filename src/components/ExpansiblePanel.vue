<template>
  <div class="bg-transparent text-white w-full">
    <div class="flex flex-col align-start">
      <v-divider v-if="!noTopDivider" centered class="opacity-10 border-[#fafafa] w-full" />
      <div class="flex flex-row w-full justify-between">
        <div class="flex flex-row align-center gap-x-[3vw] pb-[1.5vh] pt-[1.2vh] cursor-pointer" @click="togglePanel">
          <div>
            <div class="flex flex-row">
              <v-icon
                :size="24"
                :icon="isPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                class="mr-2 mt-[1px]"
              />
              <div class="flex flex-col">
                <div class="font-semibold" :class="interfaceStore.isOnSmallScreen ? 'text-[14px]' : 'text-[18px]'">
                  <slot name="title" />
                </div>
              </div>
            </div>
            <div class="font-light opacity-50" :class="interfaceStore.isOnSmallScreen ? 'text-[10px]' : 'text-[14px]'">
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
            @click="toggleAlert"
          />
        </div>
      </div>
      <v-divider v-if="!isPanelExpanded && !noBottomDivider" class="opacity-10 border-[#fafafa] w-full" />
    </div>
    <div class="alert-container">
      <div
        ref="alertContent"
        :class="[
          'alert-expand-collapse',
          { 'alert-expanding': isBottomSheetOpen, 'alert-collapsing': !isBottomSheetOpen },
        ]"
      >
        <div
          class="bg-[#ffffff11] py-3 px-5 rounded-[6px] text-white elevation-1 mb-2"
          :class="interfaceStore.isOnSmallScreen ? 'text-[12px]' : 'text-[14px]'"
        >
          <slot name="info"></slot>
        </div>
      </div>
    </div>
    <div ref="content" :class="['expand-collapse', { expanding: isPanelExpanded, collapsing: !isPanelExpanded }]">
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
}>()

const slots = useSlots()

const isPanelExpanded = ref(props.isExpanded ?? false)
const noTopDivider = ref(props.noTopDivider ?? false)
const noBottomDivider = ref(props.noBottomDivider ?? false)
const isBottomSheetOpen = ref(false)

const content = ref<HTMLElement | null>(null)
const alertContent = ref<HTMLElement | null>(null)

const togglePanel = (): void => {
  isPanelExpanded.value = !isPanelExpanded.value
}

const toggleAlert = (): void => {
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
  if (alertContent.value) {
    if (newValue) {
      alertContent.value.style.maxHeight = alertContent.value.scrollHeight + 'px'
    } else {
      alertContent.value.style.maxHeight = alertContent.value.scrollHeight + 'px'
      setTimeout(() => {
        alertContent.value!.style.maxHeight = '0px'
      }, 0)
    }
  }
})

onMounted(() => {
  if (content.value && !isPanelExpanded.value) {
    content.value.style.maxHeight = '0px'
  }
  if (alertContent.value && !isBottomSheetOpen.value) {
    alertContent.value.style.maxHeight = '0px'
  }
})

const hasInfoSlot = computed(() => !!slots.info?.())
</script>

<style scoped>
.expand-collapse {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.alert-container {
  overflow: hidden;
}

.alert-expand-collapse {
  overflow: hidden;
  transition: max-height 0.3s ease;
}
</style>
