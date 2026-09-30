<template>
  <v-dialog
    :model-value="offer !== undefined"
    max-width="800px"
    @update:model-value="(open: boolean) => !open && emit('choose', 'cancel')"
  >
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">Geofence too large for the vehicle</v-card-title>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        aria-label="Close"
        class="absolute top-3 right-3"
        @click="emit('choose', 'cancel')"
      />
      <v-card-text class="px-8">
        <div v-if="offer" class="flex flex-col gap-4 text-body-1">
          <p v-if="offer.capacityPoints !== undefined">
            There is not enough space on the vehicle to store this fence: it has {{ offer.points }} points, and the
            vehicle has room for about {{ offer.capacityPoints }}.
          </p>
          <p v-else>
            The vehicle refused this fence for lack of space. It has {{ offer.points }} points, and the vehicle did not
            report how many it can hold.
          </p>
          <template v-if="offer.expansion">
            <p>
              You can increase this space by saving the fence data on the vehicle's SD card. This takes up to
              {{ offer.expansion.targetKb }} KB on the card, raises the room to about {{ expandedPoints }} points, and
              does not affect the vehicle's performance or reliability. Click "Expand storage" to change the
              <code>BRD_SD_FENCE</code> parameter from {{ offer.expansion.currentKb }} to
              {{ offer.expansion.targetKb }}. The autopilot then needs a restart, which you confirm next.
            </p>
            <v-btn class="self-center my-3 bg-[#FFFFFF22] text-white" @click="emit('choose', 'expand')">
              Expand storage
            </v-btn>
          </template>
          <p v-if="simplifiedPoints !== undefined">
            {{ offer.expansion ? 'Alternatively, you' : 'You' }} can simplify the fence's geometry so it fits in
            {{ simplifiedPoints }} points. Resolution can be lost in the process, so check the fence on the map after
            simplifying.
          </p>
        </div>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn variant="text" size="small" @click="emit('choose', 'cancel')">Cancel</v-btn>
          <v-btn
            v-if="simplifiedPoints !== undefined"
            size="small"
            class="bg-[#FFFFFF33] text-white"
            @click="emit('choose', 'simplify')"
          >
            Simplify and upload
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { fenceItemCount, fencePointCapacity } from '@/libs/geo-fence'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { FenceTooLargeOffer } from '@/types/geofence'

const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /**
   * Ways to fit the fence on the vehicle. The dialog shows while it is set.
   */
  offer: FenceTooLargeOffer | undefined
}>()

const emit = defineEmits<{
  (e: 'choose', choice: 'expand' | 'simplify' | 'cancel'): void
}>()

const expandedPoints = computed(() =>
  props.offer?.expansion ? fencePointCapacity(props.offer.expansion.capacityBytes) : undefined
)
const simplifiedPoints = computed(() => (props.offer?.coarser ? fenceItemCount(props.offer.coarser) : undefined))
</script>
