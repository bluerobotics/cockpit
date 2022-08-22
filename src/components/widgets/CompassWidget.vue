<template>
  <div class="compass">
    <img
      class="compass-ticks"
      src="@/assets/nautic-compass.svg"
      draggable="false"
    />
    <img class="boat" src="@/assets/boat.svg" draggable="false" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useBoatStore } from '@/stores/boat'

const store = useBoatStore()

const angleStyle = computed(() => {
  return `${store.heading}deg`
})
</script>

<style scoped>
.compass {
  position: relative;
}
.compass-ticks {
  transition: -webkit-transform 0.8s;
  transform: rotate(v-bind('angleStyle'));
  user-select: none;
  height: 100%;
  width: 100%;
  opacity: 0.9;
}
.boat {
  position: absolute;
  margin: auto;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  user-select: none;
  height: 55%;
}
</style>
