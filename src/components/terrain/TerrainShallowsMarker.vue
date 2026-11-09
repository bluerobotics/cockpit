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
      <p v-if="shallows.loading.value" class="opacity-70">{{ t`Looking for charted shoals in OpenStreetMap...` }}</p>
      <p v-else-if="shallows.error.value" class="text-[#FF8A80]">{{ shallows.error.value }}</p>
      <template v-else-if="shallows.notes.value">
        <p v-if="shallows.notes.value.length === 0" class="opacity-70">
          {{ t`OpenStreetMap charts no shoal, reef, rock or wreck here.` }}
        </p>
        <div v-for="(note, index) in shallows.notes.value" :key="index">
          <p class="font-semibold">{{ note.label }}</p>
          <p v-for="detail in note.details" :key="detail" class="opacity-80">{{ detail }}</p>
        </div>
      </template>
    </div>
  </v-tooltip>
</template>

<script setup lang="ts">
import { t } from 'ttag'

import TerrainWarningTriangle from '@/components/terrain/TerrainWarningTriangle.vue'
import { useShallowsNotes } from '@/composables/terrain/useShallowsNotes'
import type { GeoBbox } from '@/types/general'

const props = defineProps<{
  /**
   * Area around the stretch, to look for charted shallows in.
   */
  bbox: GeoBbox
  /**
   * Why the stretch is flagged.
   */
  description: string
}>()

const shallows = useShallowsNotes(() => props.bbox)

const onToggle = (open: boolean): void => {
  if (!open || shallows.notes.value) return
  logUserAction('Opened the possible shallow water details on the terrain profile')
  void shallows.load()
}
</script>
