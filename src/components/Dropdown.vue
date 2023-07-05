<template>
  <div class="custom-select">
    <select
      v-model="modelValue"
      class="flex items-center justify-center w-full py-1 pl-2 pr-8 text-base font-bold transition-all border-0 rounded-md shadow-inner cursor-pointer h-9 bg-slate-800/60 text-slate-100 hover:bg-slate-600/60"
      :class="{ 'pointer-events-none': disabled }"
      @update:model-value="(newChosenOption: unknown) => emit('update:modelValue', newChosenOption)"
    >
      <option
        v-for="option in options"
        :key="(option as string)"
        :value="valueKey ? (option as Record<string, any>)[valueKey] : option"
      >
        {{ nameKey !== undefined ? (option as any)[nameKey] : option }}
      </option>
    </select>
    <span class="custom-arrow"></span>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

// eslint-disable-next-line jsdoc/require-jsdoc
export interface Props {
  /**
   * The chosen option
   */
  modelValue: unknown | undefined
  /**
   * The dropdown options list
   */
  options: unknown[]
  /**
   * To disable dropdown selection or not
   */
  disabled?: boolean
  /**
   * To disable dropdown selection or not
   */
  nameKey?: string
  /**
   * To disable dropdown selection or not
   */
  valueKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  nameKey: undefined,
  valueKey: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const options = toRefs(props).options
const disabled = toRefs(props).disabled
const modelValue = toRefs(props).modelValue
const nameKey = toRefs(props).nameKey
const valueKey = toRefs(props).valueKey
</script>

<style scoped>
.custom-select {
  position: relative;
  width: 100%;
}
.custom-arrow {
  position: absolute;
  top: 0;
  right: 0;
  background-color: rgb(15, 23, 42);
  display: block;
  height: 100%;
  width: 1.5rem;
  pointer-events: none;
  border-top-right-radius: 0.375rem;
  border-bottom-right-radius: 0.375rem;
}
.custom-arrow::before,
.custom-arrow::after {
  --size: 0.35em;
  --arrow-color: rgb(177, 177, 177);
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  left: 50%;
  transform: translate(-50%, -50%);
}
.custom-arrow::before {
  border-left: var(--size) solid transparent;
  border-right: var(--size) solid transparent;
  border-bottom: var(--size) solid var(--arrow-color);

  top: 35%;
}
.custom-arrow::after {
  border-left: var(--size) solid transparent;
  border-right: var(--size) solid transparent;
  border-top: var(--size) solid var(--arrow-color);

  top: 65%;
}
</style>
