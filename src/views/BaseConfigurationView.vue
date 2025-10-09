<template>
  <div class="bg-transparent text-white px-4 pb-3">
    <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
      <slot name="help-icon"></slot>
      <v-btn
        v-if="!hasNoCloseIcon"
        icon
        :width="38"
        :height="34"
        variant="text"
        class="bg-transparent mt-0.5 -mr-1"
        @click="closeModal"
      >
        <v-icon
          :size="interfaceStore.isOnSmallScreen ? 22 : 26"
          :class="interfaceStore.isOnSmallScreen ? '-mr-[10px] -mt-[10px]' : '-mr-[2px]'"
          >mdi-close</v-icon
        >
      </v-btn>
    </div>
    <div
      class="font-semibold flex-centered mt-3"
      :style="{ fontSize: interfaceStore.isOnSmallScreen ? '14px' : '20px' }"
    >
      <slot name="title"></slot>
    </div>
    <div class="flex-center flex-column">
      <slot name="content"></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * Removes the close icon on the top right corner of the config page.
   */
  noCloseIcon?: boolean
}>()

const hasNoCloseIcon = ref(props.noCloseIcon || false)

const closeModal = (): void => {
  interfaceStore.configModalVisibility = false
  interfaceStore.currentSubMenuComponentName = null
}
</script>
