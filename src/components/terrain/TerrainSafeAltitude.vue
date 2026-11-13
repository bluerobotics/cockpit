<template>
  <div v-if="message" class="flex items-center gap-x-2 rounded-md px-2.5 py-1 text-xs bg-[#FFFFFF11]">
    <span class="grow opacity-80">{{ message }}</span>
    <v-btn
      v-if="safeAltitude.canRestore.value"
      variant="flat"
      size="x-small"
      class="bg-[#FFFFFF22] rounded-md"
      @click="safeAltitude.restore"
    >
      {{ t`Restore` }}
    </v-btn>
    <LoadingText v-if="offerRaise && safeAltitude.raising.value">{{ t`Raising the waypoints` }}</LoadingText>
    <v-btn
      v-else-if="offerRaise"
      variant="flat"
      size="x-small"
      class="bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
      :disabled="dock.terrain.analyzing.value"
      @click="safeAltitude.raise"
    >
      {{ t`Raise to a safe height` }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed } from 'vue'

import LoadingText from '@/components/LoadingText.vue'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { useTerrainStore } from '@/stores/terrain'

const dock = useTerrainDock()
const { safeAltitude } = dock
const terrainStore = useTerrainStore()

const isAircraft = computed(() => dock.terrain.vehicleClass.value === 'air')
const keepingSafe = computed(() => safeAltitude.keepSafe.value && isAircraft.value)
const offerRaise = computed(() => safeAltitude.needsRaise.value && !keepingSafe.value)

const message = computed(() => {
  const { minimumClearanceM } = terrainStore.settings
  const uncertaintyM = terrainStore.effectiveSource.verticalUncertaintyM
  const targetM = safeAltitude.targetM.value
  if (keepingSafe.value) {
    return t`Keeping each waypoint at its planned height, raised where needed to stay ${targetM} m over the terrain. ${safeAltitude.note.value}`
  }
  if (offerRaise.value) {
    // eslint-disable-next-line vue/max-len
    return t`Raise the waypoints so the whole mission keeps ${targetM} m over the terrain: your ${minimumClearanceM} m safety margin plus the terrain model's ${uncertaintyM} m error.`
  }
  return safeAltitude.canRestore.value ? safeAltitude.note.value : ''
})
</script>
