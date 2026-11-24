<template>
  <div
    class="flex flex-col gap-y-1 w-[min(600px,calc(100%-24px))] px-3 pt-2 pb-3 rounded-lg text-white select-none"
    :style="[interfaceStore.globalGlassMenuStyles, { translate: `${offset.x}px ${offset.y}px` }]"
    @mousedown.stop
    @touchstart.stop
    @pointerdown.stop
    @dblclick.stop
    @wheel.stop
  >
    <div
      class="flex items-center justify-between cursor-move touch-none"
      @pointerdown="startDrag"
      @pointermove="drag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <p class="text-sm font-medium">{{ t`Terrain along ruler ${rulerNumber}` }}</p>
      <v-tooltip location="top" :text="t`Close the profile`">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-close"
            size="x-small"
            variant="text"
            :aria-label="t`Close the profile`"
            @click="emit('close')"
          />
        </template>
      </v-tooltip>
    </div>
    <v-progress-linear v-if="loading && !profile" indeterminate color="white" height="2" />
    <template v-if="profile">
      <TerrainProfileChart
        :samples="profile.samples"
        :points="profile.points"
        :vehicle-class="terrainVehicleClass(missionStore.effectiveVehicleType)"
        :uncertainty-m="terrainStore.effectiveSource.verticalUncertaintyM"
        :water-level-m="terrainStore.waterLevelNowM()"
        :draft-m="0"
        :tide-range-m="0"
        :shallows="[]"
        :warnings="[]"
        :bands="[]"
        :markers-m="[]"
        :coastline-m="[]"
        :model-ground-m="[]"
        :compare-model="false"
        :over-water="[]"
        :height-px="120"
        :upload-path="[]"
        heights-beside
      />
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <p v-if="profile.endHeightDifferenceM !== null">{{ t`Height difference` }} {{ endHeightDifference }}</p>
        <p v-if="profile.slope">{{ t`Steepest ground` }} {{ steepest }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, ref } from 'vue'

import TerrainProfileChart from '@/components/terrain/TerrainProfileChart.vue'
import type { MeasureProfile } from '@/composables/map/useMeasureProfile'
import { terrainVehicleClass } from '@/libs/terrain/mission-profile'
import { formatValueWithUnit } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'

const props = defineProps<{
  /** The profile to show, null while it is first read. */
  profile: MeasureProfile | null
  /** Whether the profile is being read. */
  loading: boolean
  /** Number of the ruler it follows. */
  rulerNumber: number
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const interfaceStore = useAppInterfaceStore()
const terrainStore = useTerrainStore()
const missionStore = useMissionStore()

const offset = ref({ x: 0, y: 0 })
let grabbedAt: typeof offset.value | null = null
let moved = false

const startDrag = (event: PointerEvent): void => {
  if ((event.target as HTMLElement).closest('button')) return
  grabbedAt = { x: event.clientX - offset.value.x, y: event.clientY - offset.value.y }
  moved = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

const drag = (event: PointerEvent): void => {
  if (!grabbedAt) return
  offset.value = { x: event.clientX - grabbedAt.x, y: event.clientY - grabbedAt.y }
  moved = true
}

const endDrag = (): void => {
  if (!grabbedAt) return
  grabbedAt = null
  if (moved) logUserAction('Moved the terrain profile of the ruler')
}

const endHeightDifference = computed(() => {
  const rawDifferenceM = props.profile?.endHeightDifferenceM ?? 0
  const differenceM = Math.abs(rawDifferenceM) < 0.05 ? 0 : rawDifferenceM
  const sign = differenceM > 0 ? '+' : ''
  return `${sign}${formatValueWithUnit(differenceM, 'm', interfaceStore.displayUnitPreferences)}`
})

const steepest = computed(() => {
  const slope = props.profile?.slope
  if (!slope) return ''
  return `${slope.maxSlopeDeg.toFixed(1)}° (${Math.round(slope.maxGradePercent)}%)`
})
</script>
