<template>
  <video muted loop autoplay>
    <source :src="videoSource" type="video/mp4" disablePictureInPicture />
    Your browser does not support the video tag.
  </video>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const videoSource = ref('')
const sampleVideos = [
  '/src/assets/sample-videos/Big-Buck-Bunny/ElephantsDream.mp4',
  '/src/assets/sample-videos/Big-Buck-Bunny/BigBuckBunny1080p30s.mp4',
]
videoSource.value =
  sampleVideos[Math.floor(Math.random() * sampleVideos.length)]
console.log(videoSource.value)
</script>

<style scoped>
video {
  height: 100%;
  width: 100%;
  object-fit: cover;
  position: absolute;
}
</style>
