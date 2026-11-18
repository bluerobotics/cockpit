<template>
  <svg class="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
    <filter :id="interfaceStore.glassToneFilter.id" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR type="table" :tableValues="interfaceStore.glassToneFilter.table" />
        <feFuncG type="table" :tableValues="interfaceStore.glassToneFilter.table" />
        <feFuncB type="table" :tableValues="interfaceStore.glassToneFilter.table" />
      </feComponentTransfer>
    </filter>
  </svg>
</template>

<script setup lang="ts">
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()
</script>
