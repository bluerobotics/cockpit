<template>
  <label class="flex items-center gap-x-1">
    <span class="text-slate-200">{{ label }}</span>
    <InfoTooltip v-if="info" :label="t`${label} information`">{{ info }}</InfoTooltip>
    <span v-if="type === 'number'" class="grow" />
    <span class="flex items-center gap-x-1">
      <input
        ref="input"
        :value="modelValue"
        :type="type"
        :inputmode="type === 'number' ? 'decimal' : undefined"
        :min="min"
        :max="max"
        :step="step"
        class="min-w-0 rounded-sm bg-[#FFFFFF22]"
        :class="[SIZE_CLASSES[size], type === 'number' ? NUMBER_WIDTHS[size] : DATE_CLASSES]"
        @change="onChange"
      />
      <span v-if="unit" class="w-8 text-xs opacity-70">{{ unit }}</span>
    </span>
    <slot />
  </label>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import type { InputFieldSize } from '@/types/general'

const SIZE_CLASSES: Record<InputFieldSize, string> = {
  'regular': 'px-2 py-1 text-base',
  'extra-compact': 'px-1 py-0.5 text-xs',
}

const NUMBER_WIDTHS: Record<InputFieldSize, string> = {
  'regular': 'w-24',
  'extra-compact': 'w-16',
}

// The dark color scheme keeps the browser's date picker icon and popup readable on the dark panels.
const DATE_CLASSES = '[color-scheme:dark]'

withDefaults(
  defineProps<{
    /**
     * Current value.
     */
    modelValue: string | number
    /**
     * Field label.
     */
    label: string
    /**
     * Kind of input; number fields leave parsing and logging to `NumberInputField`.
     */
    type: 'number' | 'date'
    /**
     * How much room the field takes.
     */
    size?: InputFieldSize
    /**
     * Explanation shown from the information icon beside the label.
     */
    info?: string
    /**
     * Unit shown after the input.
     */
    unit?: string
    /**
     * Lowest accepted number, or `yyyy-MM-dd` day for a date field.
     */
    min?: number | string
    /**
     * Highest accepted number, or `yyyy-MM-dd` day for a date field.
     */
    max?: number | string
    /**
     * Number step for the arrows and the keyboard.
     */
    step?: number
  }>(),
  {
    size: 'regular',
    info: undefined,
    unit: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const input = ref<HTMLInputElement>()

const onChange = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

defineExpose({ input })
</script>
