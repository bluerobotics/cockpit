<template>
  <div class="fixed bottom-[48px] right-0 m-4">
    <div
      v-if="showReminder"
      :class="[animationStage, bgColor, fading ? 'opacity-0' : 'opacity-100']"
      class="flex items-center justify-center overflow-hidden text-white transition-all duration-500 ease-in-out elevation-4"
      :style="{ borderRadius: borderRadius + 'px' }"
    >
      <template v-if="animationStage === 'rectangle'">
        <v-icon icon="mdi-video-check" color="white" class="text-[28px]" />
        <div class="flex justify-between items-center p-4">
          <p class="text-white -mr-4">Don't forget to record your activity!</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const emit = defineEmits(['close'])

const showReminder = ref(true)
const fading = ref(false)
const animationStage = ref('circle')
const bgColor = ref('bg-red-500')
const borderRadius = ref(25)

const initialDelay = 100
const transitionToRectDelay = 1500
const fadingDelay = 5000
const closeDelay = 5500
const startBorderAnimation = 1000
const borderAnimationDelay = 20
const borderRadiusStart = 25
const borderRadiusEnd = 8

const animateBorderRadius = (): void => {
  borderRadius.value = borderRadiusStart
  const interval = setInterval(() => {
    if (borderRadius.value > borderRadiusEnd) {
      borderRadius.value--
    } else {
      clearInterval(interval)
    }
  }, borderAnimationDelay)
}

onMounted(() => {
  setTimeout(() => {
    animationStage.value = 'circle-grow'
  }, initialDelay)

  setTimeout(() => {
    animateBorderRadius()
  }, startBorderAnimation)

  setTimeout(() => {
    animationStage.value = 'rectangle'
    bgColor.value = 'bg-orange-600'
  }, transitionToRectDelay)

  setTimeout(() => {
    fading.value = true
  }, fadingDelay)

  setTimeout(() => {
    showReminder.value = false
    emit('close')
  }, closeDelay)
})
</script>

<style scoped>
.circle {
  width: 0;
  height: 0;
  border-radius: 50%;
}

.circle-grow {
  animation: growWobble 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
}

.rectangle {
  width: 350px;
  height: 50px;
}

@keyframes growWobble {
  0% {
    width: 0;
    height: 0;
  }
  100% {
    width: 50px;
    height: 50px;
  }
}
</style>
