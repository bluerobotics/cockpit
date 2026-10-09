<template>
  <InteractionDialog
    :show-dialog="area !== undefined"
    title="Create geofence exclusion zone"
    variant="text-only"
    max-width="420px"
    @update:show-dialog="(open: boolean) => !open && dismiss()"
  >
    <template #content>
      <div class="flex flex-col gap-4 -mt-6">
        <p class="text-body-2">Keep the vehicle this far from "{{ area?.label }}".</p>
        <v-text-field
          v-model.number="clearanceM"
          type="number"
          label="Clearance (m)"
          variant="outlined"
          density="compact"
          :min="0"
          :max="MAX_HAZARD_CLEARANCE_M"
          :hide-details="isValid"
          :error-messages="isValid ? [] : [`Enter a clearance from 0 to ${MAX_HAZARD_CLEARANCE_M} m.`]"
          @keyup.enter="create"
        />
      </div>
    </template>
    <template #actions>
      <div class="flex justify-between items-center w-full px-2 pb-2">
        <v-btn variant="text" size="small" @click="dismiss">Cancel</v-btn>
        <v-btn size="small" class="bg-[#FFFFFF33] text-white" :disabled="!isValid" @click="create">Create</v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, defineModel, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { MAX_HAZARD_CLEARANCE_M } from '@/libs/hazards/hazard-areas'
import { useHazardStore } from '@/stores/hazards'
import type { HazardArea } from '@/types/hazards'

const hazardStore = useHazardStore()

const area = defineModel<HazardArea | undefined>('area', { required: true })

const clearanceM = ref<number>(hazardStore.settings.proximityMarginMeters)

watch(area, (picked) => {
  if (picked) clearanceM.value = hazardStore.settings.proximityMarginMeters
})

// A cleared number field hands back an empty string rather than a number.
const isValid = computed(
  () => typeof clearanceM.value === 'number' && clearanceM.value >= 0 && clearanceM.value <= MAX_HAZARD_CLEARANCE_M
)

const close = (): void => {
  area.value = undefined
}

const dismiss = (): void => {
  logUserAction(`Dismissed the exclusion zone clearance dialog for "${area.value?.label}"`)
  close()
}

const create = (): void => {
  if (!area.value || !isValid.value) return
  hazardStore.addAreaAsFenceExclusion(area.value.id, clearanceM.value)
  close()
}
</script>
