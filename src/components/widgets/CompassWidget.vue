<template>
  <div class="compass">
    <img class="boat" src="@/assets/boat.svg" height="200" draggable="false" />
    <img class="compass-ticks" src="@/assets/nautic-compass.svg" draggable="false" />
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
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
  z-index: 1;
}
</style>
