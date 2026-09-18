<template>
  <div class="flex flex-col items-center w-full gap-y-4">
    <p v-if="content" class="text-center">{{ content }}</p>

    <div class="flex items-center w-full gap-x-4 my-1">
      <div class="h-px flex-1 bg-[#FFFFFF22]" />
      <div
        class="relative flex items-center justify-center w-[52px] h-[52px] rounded-full border-[1px] border-[#FFFFFF88] elevation-3"
        :class="active ? 'bg-[#4fa483] glow' : 'bg-[#363636]'"
      >
        <img :src="CockpitLogo" class="w-[34px]" alt="" />
      </div>
      <div class="h-px flex-1 bg-[#FFFFFF22]" />
    </div>

    <p v-if="opposite" class="text-center">{{ opposite }}</p>

    <slot />
  </div>
</template>

<script setup lang="ts">
import CockpitLogo from '@/assets/cockpit-logo-minimal.avif'

defineProps<{
  /**
   * Instruction shown above the divider
   */
  content?: string
  /**
   * Secondary line shown below the divider, above the step's own controls
   */
  opposite?: string
  /**
   * Whether the controller is usable, which lights up the badge
   */
  active: boolean
}>()
</script>

<style scoped>
/* Halo lives on a pseudo-element because Vuetify's elevation classes set box-shadow with !important */
.glow::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: 0 0 18px 6px rgba(79, 164, 131, 0.54);
  animation: glow 3s ease-in-out infinite;
}

@keyframes glow {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.98);
  }

  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}
</style>
