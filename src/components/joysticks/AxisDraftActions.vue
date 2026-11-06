<template>
  <div class="flex items-center justify-center gap-x-1 w-[88px] min-w-[88px]">
    <div class="flex justify-center w-5">
      <v-tooltip v-if="dirty || rangeIssues?.length" :text="statusTooltip" location="top">
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
    <v-tooltip :text="dirty ? t`Revert changes` : t`No changes to revert`" location="top">
      <template #activator="{ props: tooltipProps }">
        <span v-bind="tooltipProps">
          <v-btn
            icon="mdi-undo"
            size="x-small"
            variant="text"
            :aria-label="t`Revert changes`"
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
            :aria-label="t`Save changes`"
            :disabled="!canSave"
            @click="$emit('save')"
          />
        </span>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed } from 'vue'

import type { AxisRangeIssue } from '@/libs/joystick/default-mappings'

const props = defineProps<{
  /** Whether the axis has unsaved changes */
  dirty: boolean
  /** Whether the pending changes can be saved now */
  canSave: boolean
  /** Axis that still holds the selected function and has to be saved first */
  blockingAxis?: number
  /** What is wrong with the axis range, saved or pending, for the connected vehicle */
  rangeIssues?: AxisRangeIssue[]
}>()

defineEmits<{
  /** Emitted when the user saves the axis */
  (e: 'save'): void
  /** Emitted when the user discards the axis changes */
  (e: 'revert'): void
}>()

const rangeIssueTexts: Record<AxisRangeIssue, string> = {
  'off-center': t`Its center is away from the vehicle default, so the motors can spin with the stick at rest.`,
  'beyond-limits': t`It goes past the vehicle default limits.`,
}

const statusTooltip = computed(() => {
  if (!props.rangeIssues?.length) return t`Unsaved changes`
  const issues = props.rangeIssues.map((issue) => rangeIssueTexts[issue]).join(' ')
  return props.dirty
    ? t`Unsaved range differs from the default. ${issues}`
    : t`Range differs from the default. ${issues}`
})

const saveTooltip = computed(() => {
  if (!props.dirty) return t`No changes to save`
  if (props.blockingAxis === undefined) return t`Save changes`
  return t`Axis ${props.blockingAxis} still uses this function. Save axis ${props.blockingAxis} first.`
})
</script>
