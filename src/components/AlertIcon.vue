<template>
  <div>
    <v-tooltip :text="tooltip" location="top" open-delay="500">
      <template #activator="{ props: tooltipProps }">
        <v-icon
          v-bind="tooltipProps"
          :icon="icon || 'mdi-alert-circle-outline'"
          :color="color || '#fa7f2d'"
          class="bg-[#404040dd] rounded-md border-[1px] elevation-2 pa-3 cursor-pointer"
          :class="animation"
          :style="{
            fontSize: '20px',
            borderColor: color,
            padding: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }"
        />
      </template>
    </v-tooltip>
  </div>
</template>
<script lang="ts" setup>
import { defineProps } from 'vue'

defineProps<{
  /**
   * Mdi icon name
   */
  icon?: string
  /**
   * Icon color
   */
  color?: string
  /**
   * Animation style
   */
  animation?: 'pulse' | 'ping' | 'bounce' | 'spin' | ''
  /**
   * Tooltip text
   */
  tooltip?: string
}>()
</script>
<style scoped>
@keyframes pulse {
  50% {
    transform: scale(0.95);
  }
}
.pulse {
  animation: pulse 800ms cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
.ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(-25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
.bounce {
  animation: bounce 1s infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
