<template>
  <div class="flex flex-col gap-y-3 text-xs">
    <section v-if="lengthM > 0" class="flex flex-col gap-y-1">
      <div class="flex items-center gap-x-2">
        <span class="flex items-center gap-x-1 font-medium grow">
          {{ t`Ghost run` }}
          <InfoTooltip :label="t`Ghost run information`">
            {{
              t`Previews the mission: play it at ${GHOST_SPEEDUP} times the planned cruise speed, or drag the slider. A marker follows on the profile and on the map, with
                the time into the mission, the distance along it and the clearance under the vehicle at that point. Nothing is sent to the vehicle.`
            }}
          </InfoTooltip>
        </span>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :aria-label="playing ? t`Pause the ghost run` : t`Play the ghost run`"
          @click="onTogglePlay"
        >
          <v-icon :icon="playing ? 'mdi-pause' : 'mdi-play'" size="16" />
          <v-tooltip
            activator="parent"
            location="top"
            :text="playing ? t`Pause the ghost run` : t`Play the ghost run`"
          />
        </v-btn>
      </div>
      <input
        type="range"
        min="0"
        :max="lengthM"
        step="1"
        :value="dock.ghostDistanceM.value ?? 0"
        :aria-label="t`Ghost run position along the mission`"
        class="w-full accent-[#3B78A8]"
        @input="onScrub"
        @change="onScrubEnd"
      />
      <p v-if="dock.ghostSample.value" class="opacity-80">{{ ghostSummary }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { t } from 'ttag'
import { computed, onBeforeUnmount, ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { useMissionStore } from '@/stores/mission'

const GHOST_TICK_MS = 100
// The ghost run plays thirty times faster than the vehicle would fly it.
const GHOST_SPEEDUP = 30
const FALLBACK_SPEED_MS = 5

const missionStore = useMissionStore()
const dock = useTerrainDock()
const playing = ref(false)

const lengthM = computed(() => Math.round(dock.terrain.analysis.value?.profile.lengthM ?? 0))

const ghostSummary = computed(() => {
  const sample = dock.ghostSample.value
  if (!sample) return ''
  const speed = missionStore.plannedCruiseSpeed ?? FALLBACK_SPEED_MS
  const minutes = Math.floor(sample.distanceM / speed / 60)
  const seconds = Math.round((sample.distanceM / speed) % 60)
  const alongM = Math.round(sample.distanceM)
  if (sample.clearanceM === null)
    return t`${minutes} min ${seconds} s into the mission, ${alongM} m along, unknown clearance.`
  const clearanceM = sample.clearanceM.toFixed(1)
  return t`${minutes} min ${seconds} s into the mission, ${alongM} m along, ${clearanceM} m clearance.`
})

const { pause, resume } = useIntervalFn(
  () => {
    const speed = missionStore.plannedCruiseSpeed ?? FALLBACK_SPEED_MS
    const next = (dock.ghostDistanceM.value ?? 0) + (speed * GHOST_SPEEDUP * GHOST_TICK_MS) / 1000
    if (next >= lengthM.value) {
      dock.ghostDistanceM.value = lengthM.value
      playing.value = false
      pause()
      return
    }
    dock.ghostDistanceM.value = next
  },
  GHOST_TICK_MS,
  { immediate: false }
)

const onTogglePlay = (): void => {
  playing.value = !playing.value
  logUserAction(`${playing.value ? 'Played' : 'Paused'} the terrain ghost run`)
  if (!playing.value) {
    pause()
    return
  }
  if ((dock.ghostDistanceM.value ?? 0) >= lengthM.value) dock.ghostDistanceM.value = 0
  resume()
}

const onScrub = (event: Event): void => {
  dock.ghostDistanceM.value = Number((event.target as HTMLInputElement).value)
}

const onScrubEnd = (): void => logUserAction(`Moved the terrain ghost run to ${dock.ghostDistanceM.value} m`)

onBeforeUnmount(() => {
  pause()
  dock.ghostDistanceM.value = null
})
</script>
