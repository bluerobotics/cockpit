<template>
  <v-tooltip location="top" text="Finish polygon fence">
    <template #activator="{ props: tooltipProps }">
      <div
        v-if="fenceDraft.isDrawingPolygon && polygonVertexes.length >= 3"
        v-bind="tooltipProps"
        :style="confirmButtonStyle"
        class="absolute text-[22px] -ml-[10px] -mt-[10px] bg-transparent rounded-full cursor-pointer elevation-4"
        variant="text"
        @click="onFinish"
      >
        <v-icon color="green" class="border-2 rounded-full bg-white">mdi-check-circle</v-icon>
      </div>
    </template>
  </v-tooltip>
  <v-tooltip location="top" text="Discard polygon fence">
    <template #activator="{ props: tooltipProps }">
      <div
        v-if="fenceDraft.isDrawingPolygon && polygonVertexes.length >= 1"
        v-bind="tooltipProps"
        :style="confirmButtonStyle"
        class="absolute text-[14px] mt-[40px] -ml-[7px] bg-transparent rounded-full cursor-pointer elevation-4"
        variant="text"
        @click="onDiscard"
      >
        <div color="white" class="border-2 rounded-full bg-red text-[18px] pa-1">
          <svg width="16" height="16" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import type L from 'leaflet'
import { onBeforeUnmount, ref, watch } from 'vue'

import { useMapContext } from '@/composables/map/useMapContext'
import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import { pickBestPosition, screenBounds } from '@/libs/mission/confirm-button-placement'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{
  /**
   * Current in-progress polygon vertexes from the fence drawing
   * composable. Kept as a prop rather than re-instantiating the
   * composable so the parent stays the single owner of the drawing
   * state.
   */
  polygonVertexes: L.LatLng[]
}>()

const emit = defineEmits<{
  /**
   * Fired when the user commits the drawn polygon by clicking the
   * check-mark button. The parent should forward this to the fence
   * drawing composable's `finishPolygonDrawing` action.
   */
  (event: 'finish'): void
}>()

const fenceDraft = useGeoFenceEditorDraft()
// Read the Leaflet map from the shared map context instead of a prop.
// The parent's own `planningMap` ref shares its name with a template
// ref on the map container `<div>`, so Vue's ref-binding transiently
// writes the DOM element into that ref during re-renders. Consuming
// the map through the dedicated `mapContext.map` shallowRef — which is
// only written once from the parent's `onMounted` — sidesteps the
// collision and keeps this component from seeing a non-map value.
const { map: mapRef } = useMapContext()

const confirmButtonStyle = ref<Record<string, string>>({})

// Anchor + visual sizing constants tuned so the check-mark and trash
// buttons sit right of the polygon by default, with the trash button
// stacked under the check-mark. See `pickBestPosition` for the fallback
// candidate ordering (right, left, below, above the polygon bounds).
const ANCHOR_TO_LEFT = 30
const ANCHOR_TO_RIGHT = 30
const ANCHOR_TO_TOP = 10
const ANCHOR_TO_BOTTOM = 80
const VISUAL_W = ANCHOR_TO_LEFT + ANCHOR_TO_RIGHT
const VISUAL_H = ANCHOR_TO_TOP + ANCHOR_TO_BOTTOM
const GAP = 20
const MARGIN = 8

const updateConfirmButtonPosition = (): void => {
  const map = mapRef.value
  if (!map) return

  if (fenceDraft.isDrawingPolygon && props.polygonVertexes.length >= 3) {
    const container = map.getContainer()
    const cw = container.clientWidth
    const ch = container.clientHeight

    const pts = props.polygonVertexes.map((ll) => map.latLngToContainerPoint(ll))
    const bounds = screenBounds(pts)

    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2

    const pos = pickBestPosition(
      [
        { x: bounds.maxX + GAP, y: cy - VISUAL_H / 2 },
        { x: bounds.minX - GAP - VISUAL_W, y: cy - VISUAL_H / 2 },
        { x: cx - VISUAL_W / 2, y: bounds.maxY + GAP },
        { x: cx - VISUAL_W / 2, y: bounds.minY - GAP - VISUAL_H },
      ],
      VISUAL_W,
      VISUAL_H,
      bounds,
      cw,
      ch,
      MARGIN
    )

    confirmButtonStyle.value = {
      left: `${pos.x + ANCHOR_TO_LEFT}px`,
      top: `${pos.y + ANCHOR_TO_TOP}px`,
    }
  } else {
    confirmButtonStyle.value = { display: 'none' }
  }
}

watch([() => props.polygonVertexes, () => fenceDraft.isDrawingPolygon], () => updateConfirmButtonPosition(), {
  immediate: true,
  deep: true,
})

watch(
  mapRef,
  (map, prevMap) => {
    prevMap?.off('drag', updateConfirmButtonPosition)
    prevMap?.off('zoom', updateConfirmButtonPosition)
    map?.on('drag', updateConfirmButtonPosition)
    map?.on('zoom', updateConfirmButtonPosition)
    updateConfirmButtonPosition()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  mapRef.value?.off('drag', updateConfirmButtonPosition)
  mapRef.value?.off('zoom', updateConfirmButtonPosition)
})

const onFinish = (): void => {
  logUserAction('Confirmed the in-progress polygon fence drawing')
  emit('finish')
}

const onDiscard = (): void => {
  logUserAction('Discarded the in-progress polygon fence drawing')
  fenceDraft.cancelDrawingPolygon()
}
</script>
