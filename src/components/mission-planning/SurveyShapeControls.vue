<template>
  <div class="flex flex-col">
    <div class="flex items-center justify-between mx-5 my-2">
      <p class="overflow-visible text-sm text-slate-200">Survey format</p>
      <div class="flex items-center gap-x-4">
        <v-tooltip v-for="format in formats" :key="format.value" :text="formatHint(format)" location="bottom">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" class="flex">
              <v-btn
                :icon="format.icon"
                :aria-pressed="shape === format.value"
                :disabled="locked && shape !== format.value"
                :class="
                  shape === format.value
                    ? 'bg-[#3B78A8] hover:bg-[#3B78A8]'
                    : 'bg-[#FFFFFF22] hover:bg-[#FFFFFF33] active:bg-[#FFFFFF44]'
                "
                class="rounded-[6px] text-[16px] elevation-1"
                theme="dark"
                size="x-small"
                variant="text"
                @click="emit('update:shape', format.value)"
              />
            </span>
          </template>
        </v-tooltip>
      </div>
    </div>

    <template v-if="dimensions">
      <p class="m-1 overflow-visible text-sm text-slate-200">Length (m)</p>
      <input
        v-model.number="length"
        class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
        type="number"
        min="1"
        @change="commitDimensions"
      />
      <p class="m-1 overflow-visible text-sm text-slate-200">Width (m)</p>
      <input
        v-model.number="width"
        class="px-2 py-1 m-1 mx-5 rounded-sm bg-[#FFFFFF22]"
        type="number"
        min="1"
        @change="commitDimensions"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import type { SurveyDrawShape, SurveyRectangleDimensions } from '@/composables/map/useSurveyRectangleDrawing'

const props = defineProps<{
  /**
   * Shape the next survey polygon is drawn as.
   */
  shape: SurveyDrawShape
  /**
   * Whether a survey is already being drawn, which holds it to the format it was started in.
   */
  locked: boolean
  /**
   * Extents of the draft rectangle, or null when the draft is not a rectangle.
   */
  dimensions: SurveyRectangleDimensions | null
}>()

const emit = defineEmits<{
  (event: 'update:shape', shape: SurveyDrawShape): void
  (event: 'update:dimensions', dimensions: SurveyRectangleDimensions): void
}>()

/** A selectable survey format and how it is presented. */
interface SurveyFormatOption {
  /** Shape this option selects. */
  value: SurveyDrawShape
  /** Name shown in the tooltip and read out by assistive technology. */
  label: string
  /** Material Design Icon identifier. */
  icon: string
}

const formats: SurveyFormatOption[] = [
  { value: 'free-form', label: 'Free form', icon: 'mdi-vector-polygon' },
  { value: 'rectangle', label: 'Rectangle', icon: 'mdi-rectangle-outline' },
]

// A format the draft cannot be switched to says so where the user is already looking for the format's name.
const formatHint = (format: SurveyFormatOption): string =>
  props.locked && format.value !== props.shape ? `Clear Path to switch to ${format.label.toLowerCase()}` : format.label

const length = ref<number | null>(null)
const width = ref<number | null>(null)

const readDimensions = (): void => {
  length.value = props.dimensions ? Number(props.dimensions.length.toFixed(1)) : null
  width.value = props.dimensions ? Number(props.dimensions.width.toFixed(1)) : null
}

watch(() => props.dimensions, readDimensions, { immediate: true })

const commitDimensions = async (): Promise<void> => {
  if (length.value == null || width.value == null) return
  emit('update:dimensions', { length: length.value, width: width.value })
  // The polygon is the only record of its extents, so an entry it clamped or refused must not be left on screen
  // as if it had been taken.
  await nextTick()
  readDimensions()
}
</script>
