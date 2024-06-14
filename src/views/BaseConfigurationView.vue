<template>
  <div class="bg-transparent text-white px-[1vw] pb-[2vh]">
    <div class="absolute top-0 right-0 py-2 pr-3">
      <slot name="help-icon"></slot>
    </div>
    <div
      class="font-semibold flex-centered mt-3"
      :style="{ fontSize: interfaceStore.isOnSmallScreen ? '16px' : '20px' }"
    >
      <slot name="title"></slot>
    </div>
    <div class="flex-center flex-column">
      <slot name="content"></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useAppInterfaceStore } from '@/stores/appInterface'
const interfaceStore = useAppInterfaceStore()
</script>
