<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" class="shrink-0" aria-hidden="true">
    <path d="M12 2L1 21H23Z" fill="#F9A825" stroke="#000000" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M13 14H11V9H13M13 18H11V16H13" fill="#000000" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * Width and height, in pixels.
   */
  size: number
}>()
</script>
