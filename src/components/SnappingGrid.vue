<template>
  <div class="grid" />
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

const props = defineProps<{
  /**
   * Distance in pixels beetween each grid line
   */
  gridInterval: number
}>()

const { width: windowWidth, height: windowHeight } = useWindowSize()
const gridIntervalStyleX = computed(() => `${windowWidth.value * props.gridInterval}px`)
const gridIntervalStyleY = computed(() => `${windowHeight.value * props.gridInterval}px`)
</script>

<style scoped>
.grid {
  --grid-color: #b0b0b089;
  position: absolute;
  height: 100%;
  width: 100%;
  background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent calc(v-bind('gridIntervalStyleY') - 1px),
      var(--grid-color) calc(v-bind('gridIntervalStyleY') - 1px),
      var(--grid-color) v-bind('gridIntervalStyleY')
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent calc(v-bind('gridIntervalStyleX') - 1px),
      var(--grid-color) calc(v-bind('gridIntervalStyleX') - 1px),
      var(--grid-color) v-bind('gridIntervalStyleX')
    );
  background-size: v-bind('gridIntervalStyleX') v-bind('gridIntervalStyleY');
  background-repeat: repeat;
}
</style>
