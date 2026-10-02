<template>
  <div class="flex items-center justify-center gap-x-1 w-[72px] min-w-[72px]">
    <template v-if="dirty">
      <v-tooltip :text="saveTooltip" location="top">
        <template #activator="{ props: tooltipProps }">
          <span v-bind="tooltipProps">
            <v-btn icon="mdi-content-save" size="x-small" variant="text" :disabled="!canSave" @click="$emit('save')" />
          </span>
        </template>
      </v-tooltip>
      <v-tooltip text="Revert changes" location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn v-bind="tooltipProps" icon="mdi-undo" size="x-small" variant="text" @click="$emit('revert')" />
        </template>
      </v-tooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Whether the axis has unsaved changes */
  dirty: boolean
  /** Whether the pending changes can be saved now */
  canSave: boolean
  /** Axis that still holds the selected function and has to be saved first */
  blockingAxis?: number
}>()

defineEmits<{
  /** Emitted when the user saves the axis */
  (e: 'save'): void
  /** Emitted when the user discards the axis changes */
  (e: 'revert'): void
}>()

const saveTooltip = computed(() =>
  props.blockingAxis === undefined
    ? 'Save changes'
    : `Axis ${props.blockingAxis} still uses this function. Save axis ${props.blockingAxis} first.`
)
</script>
