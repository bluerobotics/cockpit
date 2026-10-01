<template>
  <div class="flex items-center justify-center gap-x-1 w-[88px] min-w-[88px]">
    <div class="flex justify-center w-5">
      <v-tooltip v-if="dirty" :text="statusTooltip" location="top">
        <template #activator="{ props: tooltipProps }">
          <v-icon
            v-bind="tooltipProps"
            :size="rangeIssues?.length ? 20 : 12"
            class="text-yellow-400"
            :aria-label="statusTooltip"
          >
            {{ rangeIssues?.length ? 'mdi-alert' : 'mdi-circle' }}
          </v-icon>
        </template>
      </v-tooltip>
    </div>
    <v-tooltip :text="dirty ? 'Revert changes' : 'No changes to revert'" location="top">
      <template #activator="{ props: tooltipProps }">
        <span v-bind="tooltipProps">
          <v-btn
            icon="mdi-undo"
            size="x-small"
            variant="text"
            aria-label="Revert changes"
            :disabled="!dirty"
            @click="$emit('revert')"
          />
        </span>
      </template>
    </v-tooltip>
    <v-tooltip :text="saveTooltip" location="top">
      <template #activator="{ props: tooltipProps }">
        <span v-bind="tooltipProps">
          <v-btn
            icon="mdi-content-save"
            size="x-small"
            variant="text"
            aria-label="Save changes"
            :disabled="!canSave"
            @click="$emit('save')"
          />
        </span>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { AxisRangeIssue } from '@/libs/joystick/default-mappings'

const props = defineProps<{
  /** Whether the axis has unsaved changes */
  dirty: boolean
  /** Whether the pending changes can be saved now */
  canSave: boolean
  /** Axis that still holds the selected function and has to be saved first */
  blockingAxis?: number
  /** What is wrong with the pending range for the connected vehicle */
  rangeIssues?: AxisRangeIssue[]
}>()

defineEmits<{
  /** Emitted when the user saves the axis */
  (e: 'save'): void
  /** Emitted when the user discards the axis changes */
  (e: 'revert'): void
}>()

const rangeIssueTexts: Record<AxisRangeIssue, string> = {
  'off-center': 'Its center is away from the vehicle default, so the motors can spin with the stick at rest.',
  'beyond-limits': 'It goes past the vehicle default limits.',
}

const statusTooltip = computed(() =>
  props.rangeIssues?.length
    ? `Unsaved range far from the default. ${props.rangeIssues.map((issue) => rangeIssueTexts[issue]).join(' ')}`
    : 'Unsaved changes'
)

const saveTooltip = computed(() => {
  if (!props.dirty) return 'No changes to save'
  if (props.blockingAxis === undefined) return 'Save changes'
  return `Axis ${props.blockingAxis} still uses this function. Save axis ${props.blockingAxis} first.`
})
</script>
