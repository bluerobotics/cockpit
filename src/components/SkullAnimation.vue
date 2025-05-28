<template>
  <Transition name="skull-animation" appear>
    <div v-if="isVisible" class="skull-animation-container" @animationend="onAnimationEnd">
      <v-icon class="skull-icon">mdi-pirate</v-icon>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Component properties for SkullAnimation
 * @interface Props
 * @property {boolean} isVisible - Whether the skull animation is visible
 */
defineProps<{
  /**
   * Whether the skull animation is visible
   */
  isVisible: boolean
}>()

const emit = defineEmits(['animationComplete'])

/**
 * Handle animation end event
 */
const onAnimationEnd = (): void => {
  emit('animationComplete')
}
</script>

<style scoped>
.skull-animation-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: none;
}

.skull-icon {
  font-size: 4rem;
  color: #ffffff;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
  animation: skull-grow-fade 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes skull-grow-fade {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  30% {
    opacity: 1;
    transform: scale(2);
  }
  100% {
    opacity: 0;
    transform: scale(6);
  }
}
</style>
