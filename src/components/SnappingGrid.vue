<template>
  <div class="grid" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /**
   * Distance in pixels beetween each grid line
   */
  gridInterval: number
}>()

const gridIntervalStop = computed(() => `${props.gridInterval}px`)
const gridIntervalStart = computed(() => `${props.gridInterval - 1}px`)
</script>

<style>
.grid {
  position: absolute;
  height: 100%;
  width: 100%;
  background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStop')
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStart'),
      #88f v-bind('gridIntervalStop')
    );
  background-size: v-bind('gridIntervalStop') v-bind('gridIntervalStop');
  background-repeat: repeat;
}
</style>
