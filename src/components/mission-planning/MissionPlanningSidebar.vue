<template>
  <div
    v-show="!interfaceStore.isMainMenuVisible"
    ref="rootEl"
    class="absolute flex flex-col left-10 rounded-[10px] max-h-[80vh] overflow-hidden z-[200]"
    :style="[
      interfaceStore.globalGlassMenuStyles,
      { height: 'auto', maxHeight: calculatedHeight, width: '320px', borderBottom: 'none' },
      pinnedTop !== null ? { top: `${pinnedTop}px` } : {},
    ]"
  >
    <div class="flex flex-row w-full elevation-2 z-10">
      <button
        class="flex-1 h-11 flex items-center justify-center text-base font-medium transition-colors duration-200"
        :class="planningMode === 'mission' ? 'bg-[#3B78A8] text-white' : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF22]'"
        @click="onSelectPlanningMode('mission')"
      >
        <v-icon size="18" class="mr-1">mdi-map-marker-path</v-icon>
        Mission
      </button>
      <div class="w-px bg-[#FFFFFF22]" />
      <button
        class="flex-1 h-11 flex items-center justify-center text-base font-medium transition-colors duration-200"
        :class="planningMode === 'geofence' ? 'bg-[#3B78A8] text-white' : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF22]'"
        @click="onSelectPlanningMode('geofence')"
      >
        <v-icon size="18" class="mr-1">mdi-shield-outline</v-icon>
        GeoFence
      </button>
    </div>
    <div class="flex flex-col w-full h-full p-2 overflow-y-auto">
      <GeoFenceEditor v-if="planningMode === 'geofence'" :map-center="mapCenter" />
      <slot v-if="planningMode === 'mission'" name="mission" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineModel, ref } from 'vue'

import GeoFenceEditor from '@/components/geofence/GeoFenceEditor.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

const planningMode = defineModel<'mission' | 'geofence'>('planningMode', { required: true })

// eslint-disable-next-line jsdoc/require-jsdoc
defineProps<{
  /**
   * Current map center forwarded to the geofence editor so newly
   * created polygons and circles are seeded near the visible area.
   */
  mapCenter: [number, number]
  /**
   * Max height in CSS units for the collapsible shell, computed by
   * the planning view to fit the viewport under the top bar.
   */
  calculatedHeight: string | number
  /**
   * Top offset in pixels the shell is pinned to while an expanding panel
   * inside it should grow downward. Null lets it re-center at rest.
   */
  pinnedTop: number | null
}>()

const interfaceStore = useAppInterfaceStore()

// The planning view measures the shell to decide how far it has to be pinned up.
const rootEl = ref<HTMLElement | null>(null)
defineExpose({ rootEl })

const onSelectPlanningMode = (mode: 'mission' | 'geofence'): void => {
  if (planningMode.value === mode) return
  logUserAction(`Switched planning mode to ${mode === 'mission' ? 'Mission' : 'GeoFence'}`)
  planningMode.value = mode
}
</script>
