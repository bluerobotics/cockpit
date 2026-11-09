<template>
  <div
    v-show="!interfaceStore.isMainMenuVisible"
    ref="rootEl"
    class="absolute flex flex-col left-10 rounded-[10px] overflow-hidden z-[200] select-none transition-[width] duration-300 ease-out"
    :style="[
      interfaceStore.globalGlassMenuStyles,
      {
        height: 'auto',
        maxHeight: calculatedHeight,
        width: collapsed ? `${STRIP_WIDTH_PX}px` : `${PANEL_WIDTH_PX}px`,
        ...(collapsed && expandedHeightPx !== null ? { height: `${expandedHeightPx}px` } : {}),
        borderBottom: 'none',
        top: `${topOffset}px`,
      },
    ]"
  >
    <div v-if="collapsed" class="flex flex-col items-center shrink-0 w-10 gap-y-1 px-1 pt-1 pb-[11px]">
      <v-btn icon variant="text" size="x-small" :aria-label="toggleLabel" @click="onToggleCollapsed">
        <v-icon icon="mdi-chevron-right" size="18" />
        <v-tooltip activator="parent" location="right" :text="toggleLabel" />
      </v-btn>
      <p class="flex items-center gap-2 mt-1 whitespace-nowrap [writing-mode:vertical-rl]">
        <v-icon :icon="currentMode.icon" size="16" class="opacity-80 rotate-90" />
        <span class="text-sm font-medium">{{ currentMode.label }}</span>
      </p>
    </div>
    <div v-show="!collapsed" class="flex flex-col min-h-0" :style="{ width: `${PANEL_WIDTH_PX}px` }">
      <div class="flex flex-row w-full elevation-2 z-10">
        <div class="flex items-center justify-center w-[38px] bg-[#FFFFFF11]">
          <v-btn icon variant="text" size="x-small" :aria-label="toggleLabel" @click="onToggleCollapsed">
            <v-icon icon="mdi-chevron-left" size="18" />
            <v-tooltip activator="parent" location="top" :text="toggleLabel" />
          </v-btn>
        </div>
        <div class="w-px bg-[#FFFFFF22]" />
        <button
          class="flex-1 h-11 flex items-center justify-center text-base font-medium transition-colors duration-200"
          :class="planningMode === 'mission' ? 'bg-[#3B78A8] text-white' : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF22]'"
          @click="onSelectPlanningMode('mission')"
        >
          <v-icon size="18" class="mr-1">mdi-map-marker-path</v-icon>
          {{ t`Mission` }}
        </button>
        <div class="w-px bg-[#FFFFFF22]" />
        <button
          class="flex-1 h-11 flex items-center justify-center text-base font-medium transition-colors duration-200"
          :class="planningMode === 'geofence' ? 'bg-[#3B78A8] text-white' : 'bg-[#FFFFFF11] hover:bg-[#FFFFFF22]'"
          @click="onSelectPlanningMode('geofence')"
        >
          <v-icon size="18" class="mr-1">mdi-shield-outline</v-icon>
          {{ t`GeoFence` }}
        </button>
      </div>
      <OverflowIndicatorArrows class="w-full" content-class="flex flex-col w-full p-2" align="right">
        <GeoFenceEditor v-if="planningMode === 'geofence'" :map-center="mapCenter">
          <template #below-fence-lists>
            <HazardAdvisoryPanel />
          </template>
        </GeoFenceEditor>
        <slot v-if="planningMode === 'mission'" name="mission" />
      </OverflowIndicatorArrows>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, defineModel, ref, watch } from 'vue'

import GeoFenceEditor from '@/components/geofence/GeoFenceEditor.vue'
import HazardAdvisoryPanel from '@/components/hazards/HazardAdvisoryPanel.vue'
import OverflowIndicatorArrows from '@/components/OverflowIndicatorArrows.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'

type PlanningMode = 'mission' | 'geofence'

const PANEL_WIDTH_PX = 352
const STRIP_WIDTH_PX = 42

const MODE_TITLES = {
  mission: { label: t`Mission`, icon: 'mdi-map-marker-path' },
  geofence: { label: t`GeoFence`, icon: 'mdi-shield-outline' },
}

const planningMode = defineModel<PlanningMode>('planningMode', { required: true })
const collapsed = defineModel<boolean>('collapsed', { default: false })
const currentMode = computed(() => MODE_TITLES[planningMode.value])

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
   * Top offset in pixels the shell is placed at, computed by the planning
   * view so it stays centered between the top and bottom bars.
   */
  topOffset: number
}>()

const interfaceStore = useAppInterfaceStore()

// The planning view measures the shell to center it between the top and bottom bars.
const rootEl = ref<HTMLElement | null>(null)
defineExpose({ rootEl })

// The collapsed strip keeps the panel's height, so it stays where it was instead of re-centering.
const expandedHeightPx = ref<number | null>(null)
watch(collapsed, (isCollapsed) => {
  // Hidden behind the main menu the panel measures 0, which would pin the strip at no height.
  if (isCollapsed) expandedHeightPx.value = rootEl.value?.offsetHeight || null
})

const toggleLabel = computed(() => (collapsed.value ? t`Expand the planning panel` : t`Collapse the planning panel`))

const onToggleCollapsed = (): void => {
  logUserAction(`${collapsed.value ? 'Expanded' : 'Collapsed'} the planning panel`)
  collapsed.value = !collapsed.value
}

const onSelectPlanningMode = (mode: PlanningMode): void => {
  if (planningMode.value === mode) return
  logUserAction(`Switched planning mode to ${mode === 'mission' ? 'Mission' : 'GeoFence'}`)
  planningMode.value = mode
}
</script>
