<template>
  <div class="hidden" />
</template>

<script setup lang="ts">
import { useFenceRendering } from '@/composables/map/useFenceRendering'
import type { GeoFencePlan } from '@/types/geofence'

// eslint-disable-next-line jsdoc/require-jsdoc
const props = withDefaults(
  defineProps<{
    /**
     * When true, fences are rendered without drag/edit affordances.
     * Used by the live overlay on the flight Map widget.
     */
    readonly?: boolean
    /**
     * Optional plan to render. When omitted (interactive mode), the layer
     * subscribes to the live `useGeoFenceStore` editor state instead.
     */
    plan?: GeoFencePlan
  }>(),
  { readonly: false, plan: undefined }
)

useFenceRendering({
  get readonly() {
    return props.readonly
  },
  get plan() {
    return props.plan
  },
})
</script>

<!--
  Styling targets DOM that Leaflet injects outside this component's render
  tree (divIcons attached to the map's overlay pane, owned by the parent Map
  component). Vue's `scoped` data-v-* attribute can't reach those elements,
  so the rules below must stay global. The `fence-` prefix is the namespace
  guard against accidental collisions.
-->
<style>
.fence-breach-return-icon {
  background: transparent;
  border: none;
}
.fence-breach-return {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ff8800;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.fence-center-handle-icon {
  background: transparent;
  border: none;
  cursor: move;
}
.fence-center-handle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  color: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: 2px solid #3b78a8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  cursor: move;
}
.fence-center-handle .mdi {
  pointer-events: none;
}
/* `fence-drag-handle` and `fence-add-handle` are passed via Leaflet's
   `L.CircleMarker({ className })`, which Leaflet merges onto the rendered
   SVG `<circle>` element on the overlay pane — so these cursor rules apply
   to the circle node directly, not to a wrapping div. */
.fence-drag-handle {
  cursor: move;
}
.fence-add-handle {
  cursor: copy;
}
</style>
