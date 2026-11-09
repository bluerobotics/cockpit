<template>
  <v-tooltip location="top" :max-width="maxWidth">
    <template #activator="{ props: tooltipProps }">
      <v-btn v-bind="tooltipProps" icon variant="text" size="24" :aria-label="label" class="shrink-0">
        <v-icon icon="mdi-information-outline" size="14" />
      </v-btn>
    </template>
    <div class="text-[11px] leading-snug text-left">
      <slot />
    </div>
  </v-tooltip>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /**
     * What the information is about, read by screen readers.
     */
    label: string
    /**
     * Widest the tooltip may grow, in pixels.
     */
    maxWidth?: number
  }>(),
  { maxWidth: 320 }
)
</script>
