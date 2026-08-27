<template>
  <input
    ref="inputEl"
    :aria-label="`${label} in meters`"
    class="absolute z-[641] w-[110px] h-[30px] -translate-x-1/2 -translate-y-1/2 bg-transparent text-transparent caret-transparent outline-none"
    :style="{ left: `${left}px`, top: `${top}px` }"
    type="number"
    inputmode="numeric"
    step="1"
    :min="-maxExtentInMeters"
    :max="maxExtentInMeters"
    @input="onInput"
    @change="onChange"
    @keydown="onKeyDown"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { maxExtentInMeters } from '@/libs/map/typed-extent'

const props = defineProps<{
  /**
   * What the field measures, named as it is read out and logged.
   */
  label: string
  /**
   * Distance from the left of the map, in pixels.
   */
  left: number
  /**
   * Distance from the top of the map, in pixels.
   */
  top: number
  /**
   * Extent that has been typed, in meters, or null while the segment is still following the cursor.
   */
  value: number | null
  /**
   * Extent the tag is reading back while nothing has been typed, in meters.
   */
  liveValue: number
  /**
   * Whether the number was typed away, which leaves the field empty on purpose rather than untouched.
   */
  cleared: boolean
  /**
   * Whether the field takes the keyboard as it appears, so a number can be typed without reaching for it.
   */
  autofocus: boolean
  /**
   * Bumped whenever the keyboard is asked for again, since a field already focused sees no prop change.
   */
  focusTicket: number
}>()

const emit = defineEmits<{
  (event: 'update:value', value: number | null): void
  (event: 'apply'): void
  (event: 'close'): void
}>()

const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (props.value !== null) inputEl.value!.value = String(props.value)
  if (props.autofocus) inputEl.value?.focus()
})

watch(
  () => [props.autofocus, props.focusTicket],
  () => {
    if (props.autofocus) inputEl.value?.focus()
  }
)

// Written only when it disagrees with the field: a number input reads a half-typed "-" as empty, and binding the
// value back would wipe the minus sign before the digits after it arrive.
watch(
  () => props.value,
  (value) => {
    const field = inputEl.value
    if (!field) return

    const shown = field.value === '' ? null : Number(field.value)
    if (shown !== value) field.value = value === null ? '' : String(value)
  }
)

const onInput = (event: Event): void => {
  const typed = (event.target as HTMLInputElement).value
  emit('update:value', typed === '' ? null : Number(typed))
}

const onChange = (): void => {
  if (props.value !== null) logUserAction(`Typed ${props.value} m for the ${props.label}`)
}

// The map's own shortcuts sit on the window, where an Enter would generate the survey waypoints and a Delete
// would drop a waypoint, so none of them get to see what is being typed in here.
const onKeyDown = (event: KeyboardEvent): void => {
  event.stopPropagation()
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('apply')
    return
  }
  // An untouched field is a tag still reading the measure back, so a backspace deletes from that number as if it
  // had been typed in. Once the number is gone the field is empty for good, as any other field would be.
  if (event.key === 'Backspace' && !props.cleared && inputEl.value?.value === '') {
    event.preventDefault()
    const kept = String(Math.round(props.liveValue)).slice(0, -1)
    inputEl.value.value = kept
    emit('update:value', kept === '' ? null : Number(kept))
  }
}
</script>

<style scoped>
/* The measurement tag under the field is what reads the number back, so nothing of the field may paint over it,
   flowbite's form reset included: it gives every number field a border and a blue ring once focused. */
input[type='number'],
input[type='number']:focus {
  border: none;
  box-shadow: none;
}
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number']::selection {
  background: transparent;
}
</style>
