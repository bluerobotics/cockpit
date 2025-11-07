<template>
  <div class="scrolling-text-container" :style="{ maxWidth: maxWidth }">
    <div
      ref="textElement"
      class="scrolling-text"
      :class="{ 'animate': shouldAnimate, 'pause-on-hover': pauseOnHover }"
      :style="{ textAlign: align }"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

/**
 * Component props interface
 */
interface Props {
  /** Text content to display */
  text: string
  /** Maximum width of the container */
  maxWidth?: string
  /** Text alignment when not animating */
  align?: 'left' | 'center' | 'right'
  /** Whether to pause animation on hover */
  pauseOnHover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: '100px',
  align: 'center',
  pauseOnHover: true,
})

const textElement = ref<HTMLElement>()
const shouldAnimate = ref(false)

const checkOverflow = (): void => {
  if (!textElement.value || !textElement.value.parentElement) return

  const containerWidth = textElement.value.parentElement.clientWidth
  const textWidth = textElement.value.scrollWidth
  shouldAnimate.value = textWidth > containerWidth

  if (shouldAnimate.value) {
    // Calculate the exact pixel distance needed to show the full text
    const scrollDistance = textWidth - containerWidth

    // Set CSS custom property for the animation in pixels
    textElement.value.style.setProperty('--scroll-distance', `-${scrollDistance}px`)
  }
}

onMounted(() => {
  setTimeout(checkOverflow, 100)
})

watch(
  () => props.text,
  () => {
    setTimeout(checkOverflow, 100)
  }
)
</script>

<style scoped>
.scrolling-text-container {
  overflow: hidden;
  position: relative;
  width: 100%;
}

.scrolling-text {
  white-space: nowrap;
  transition: transform 0.3s ease;
}

.scrolling-text.animate {
  animation: scroll 8s infinite;
}

.scrolling-text.animate.pause-on-hover:hover {
  animation-play-state: paused;
}

@keyframes scroll {
  0%,
  25% {
    transform: translateX(0);
  }

  50%,
  75% {
    transform: translateX(var(--scroll-distance, -50px));
  }

  100% {
    transform: translateX(0);
  }
}
</style>
