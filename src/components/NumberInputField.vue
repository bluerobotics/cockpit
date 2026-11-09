<template>
  <InputField
    ref="field"
    :model-value="draft ?? modelValue"
    type="number"
    :label="label"
    :size="size"
    :info="info"
    :unit="unit"
    :min="min"
    :max="max"
    :step="step"
    @update:model-value="onTyped"
    @touchend="onTouchEnd"
  >
    <v-menu
      :model-value="draft !== null"
      :activator="field?.input"
      :open-on-click="false"
      :close-on-content-click="false"
      location="start"
      offset="8"
      theme="dark"
      @update:model-value="onDialToggle"
    >
      <div class="p-2 rounded-full" :style="interfaceStore.globalGlassMenuStyles">
        <RotaryEncoderDial
          :value="draft ?? modelValue"
          :label="label"
          :unit="unit"
          :range-steps="(max - min) / step"
          @turn="onTurn"
          @release="commit(draft ?? modelValue)"
          @type="onType"
        />
      </div>
    </v-menu>
  </InputField>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import InputField from '@/components/InputField.vue'
import RotaryEncoderDial from '@/components/RotaryEncoderDial.vue'
import { stepValue } from '@/libs/rotary-encoder'
import { constrain } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { InputFieldSize } from '@/types/general'

const props = withDefaults(
  defineProps<{
    /**
     * Current value.
     */
    modelValue: number
    /**
     * Field label.
     */
    label: string
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
     * Lowest accepted value.
     */
    min?: number
    /**
     * Highest accepted value.
     */
    max?: number
    /**
     * Size of one step, for the arrows, the keyboard and each dial detent.
     */
    step?: number
  }>(),
  { size: 'regular', info: undefined, unit: undefined, min: -Infinity, max: Infinity, step: 1 }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void
}>()

const interfaceStore = useAppInterfaceStore()
const field = ref<InstanceType<typeof InputField>>()
const draft = ref<number | null>(null)

const commit = (value: number): void => {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}

const onTyped = (text: string): void => {
  const input = field.value?.input
  const value = Number(text)
  const accepted = text === '' || !Number.isFinite(value) ? props.modelValue : constrain(value, props.min, props.max)
  if (input) input.value = String(accepted)
  commit(accepted)
}

// A tap opens the dial instead of the on-screen keyboard, unless the field is already being typed in.
const onTouchEnd = (event: TouchEvent): void => {
  const target = event.target as HTMLElement
  if (document.activeElement === field.value?.input || target.closest('button')) return
  event.preventDefault()
  draft.value = props.modelValue
  logUserAction('Opened the dial of a number field')
}

const onDialToggle = (open: boolean): void => {
  if (open) return
  draft.value = null
  logUserAction('Closed the dial of a number field')
}

const onTurn = (steps: number): void => {
  draft.value = stepValue(draft.value ?? props.modelValue, steps, props.step, props.min, props.max)
}

const onType = (): void => {
  draft.value = null
  field.value?.input?.focus()
  logUserAction('Switched a number field from the dial to typing')
}
</script>
