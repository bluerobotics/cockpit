<template>
  <div>
    <v-label class="mx-2" :text="t`Transparency`" />
    <v-range-slider
      v-model="curve"
      color="white"
      :min="0"
      :max="1"
      :step="0.01"
      strict
      hide-details
      @end="emit('end', $event)"
    />
    <div class="mx-2 text-xs">
      <div class="mesh-transparency-preview h-2 rounded" :style="{ background: previewBackground }" />
      <div class="flex justify-between mt-1">
        <span>{{ t`Hide below` }} {{ Math.round(curve[0] * 100) }}%</span>
        <span>{{ t`Opaque above` }} {{ Math.round(curve[1] * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, defineModel } from 'vue'

const curve = defineModel<[number, number]>({ required: true })

const emit = defineEmits<{
  /** Emitted with the range when the user lets go of a handle */
  (e: 'end', curve: [number, number]): void
}>()

const checkerboard = 'conic-gradient(#ffffff40 25%, #00000040 0 50%, #ffffff40 0 75%, #00000040 0) 0 0 / 8px 8px'

// The bar's mx-2 matches Vuetify's 8px margin-inline on a horizontal slider, so it spans exactly the track.
// Equal stops make the hard cut drawn when opaqueAbove is not above hideBelow.
const previewBackground = computed(() => {
  const hideBelow = curve.value[0] * 100
  const opaqueAbove = Math.max(curve.value[1] * 100, hideBelow)
  const ramp = `transparent ${hideBelow}%, white ${opaqueAbove}%`
  return `linear-gradient(to right, transparent 0%, ${ramp}, white 100%), ${checkerboard}`
})
</script>
