<template>
  <video muted loop autoplay>
    <source src="@/assets/bbb.mp4" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const counter = ref(0)
</script>

<style scoped>
video {
  height: 100%;
  width: 100%;
  object-fit: cover;
  position: absolute;
}
</style>
