<template>
  <div
    ref="dial"
    role="slider"
    :aria-label="label"
    :aria-valuenow="value"
    class="relative flex items-center justify-center w-32 h-32 rounded-full border border-[#FFFFFF33] bg-[#FFFFFF11] touch-none select-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <span
      v-for="detent in DETENTS_PER_TURN"
      :key="detent"
      class="absolute inset-0 pointer-events-none"
      :style="{ transform: `rotate(${(detent * 360) / DETENTS_PER_TURN}deg)` }"
    >
      <span class="absolute left-1/2 top-1 w-px h-1.5 -translate-x-1/2 bg-white/30" />
    </span>
    <span class="absolute inset-0 pointer-events-none" :style="{ transform: `rotate(${indicatorDeg}deg)` }">
      <span class="absolute left-1/2 top-3 w-3 h-3 -translate-x-1/2 rounded-full bg-white" />
    </span>
    <div class="flex flex-col items-center">
      <span class="text-base font-medium leading-5">{{ value }}</span>
      <span v-if="unit" class="text-[10px] leading-3 opacity-70">{{ unit }}</span>
      <v-btn
        icon
        variant="text"
        size="x-small"
        class="!w-[24px] !h-[24px]"
        :aria-label="t`Type a value`"
        @pointerdown.stop
        @click="emit('type')"
      >
        <v-icon icon="mdi-keyboard-outline" size="14" />
        <v-tooltip activator="parent" location="bottom" :text="t`Type a value`" />
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { ref } from 'vue'

import { type RotaryEncoder, DETENTS_PER_TURN, newRotaryEncoder, turnRotaryEncoder } from '@/libs/rotary-encoder'

const props = defineProps<{
  /**
   * Value shown in the middle of the dial.
   */
  value: number
  /**
   * What the dial sets, read by screen readers.
   */
  label: string
  /**
   * Unit shown under the value.
   */
  unit?: string
  /**
   * Steps between the lowest and highest value, so a quick spin never sweeps far past them.
   */
  rangeSteps?: number
}>()

const emit = defineEmits<{
  (event: 'turn', steps: number): void
  (event: 'release'): void
  (event: 'type'): void
}>()

const dial = ref<HTMLElement>()
const indicatorDeg = ref(0)
let encoder: RotaryEncoder | null = null
let center = { x: 0, y: 0 }

const turn = (event: PointerEvent): void => {
  if (!encoder) return
  const dx = event.clientX - center.x
  const dy = event.clientY - center.y
  const { steps, deltaRad } = turnRotaryEncoder(encoder, dx, dy, event.timeStamp, props.rangeSteps)
  indicatorDeg.value += (deltaRad * 180) / Math.PI
  if (steps === 0) return
  navigator.vibrate?.(4)
  emit('turn', steps)
}

const onPointerDown = (event: PointerEvent): void => {
  if (!dial.value) return
  dial.value.setPointerCapture(event.pointerId)
  const box = dial.value.getBoundingClientRect()
  center = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  encoder = newRotaryEncoder()
  turn(event)
}

const onPointerMove = (event: PointerEvent): void => turn(event)

const onPointerUp = (): void => {
  if (!encoder) return
  encoder = null
  emit('release')
}
</script>
