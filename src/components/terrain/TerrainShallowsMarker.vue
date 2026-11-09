<template>
  <v-tooltip location="top" max-width="320" open-on-click @update:model-value="onToggle">
    <template #activator="{ props: tooltipProps }">
      <v-btn
        v-bind="tooltipProps"
        icon
        variant="text"
        size="x-small"
        class="!w-[22px] !h-[22px]"
        :aria-label="t`Possible shallow water`"
      >
        <TerrainWarningTriangle :size="18" />
      </v-btn>
    </template>
    <div class="flex flex-col gap-y-1 text-xs">
      <p class="font-semibold">{{ t`Possible shallow water` }}</p>
      <p>{{ description }}</p>
    </div>
  </v-tooltip>
</template>

<script setup lang="ts">
import { t } from 'ttag'

import TerrainWarningTriangle from '@/components/terrain/TerrainWarningTriangle.vue'

defineProps<{
  /**
   * Why the stretch is flagged.
   */
  description: string
}>()

const onToggle = (open: boolean): void => {
  if (open) logUserAction('Opened the possible shallow water details on the terrain profile')
}
</script>
