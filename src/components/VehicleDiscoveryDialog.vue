<template>
  <InteractionDialog
    v-model="isOpen"
    :title="searching ? 'Searching for vehicles...' : 'Vehicle Discovery'"
    :actions="dialogActions"
    :persistent="searching"
    :variant="'text-only'"
  >
    <template #content>
      <div v-if="props.showAutoSearchOption && preventAutoSearch">
        <div class="text-sm mb-4">You can still search for vehicles in the general configuration menu.</div>
      </div>
      <div v-else class="flex flex-col items-center justify-center gap-4 min-w-[300px] min-h-[100px]">
        <div v-if="searching" class="flex flex-col items-center gap-2 mb-2">
          <v-progress-circular class="mb-2" indeterminate />
          <span>Searching for vehicles in your network...</span>
        </div>

        <div v-else-if="vehicles.length > 0" class="flex flex-col gap-2 mb-3">
          <div class="h-4 font-weight-bold mb-5">Vehicles found!</div>
          <div v-for="vehicle in vehicles" :key="vehicle.address" class="flex items-center gap-2">
            <v-btn variant="tonal" class="w-full justify-start" @click="selectVehicle(vehicle.address)">
              {{ vehicle.name }}
              <span class="text-xs ml-2 opacity-50">({{ vehicle.address }})</span>
            </v-btn>
          </div>
        </div>

        <div v-else-if="searched" class="text-sm">No vehicles found in your network.</div>

        <div v-if="!searching && !searched" class="flex flex-col gap-2 items-center justify-center text-center">
          <p v-if="props.showAutoSearchOption" class="font-bold">It looks like you're not connected to a vehicle!</p>
          <p class="max-w-[25rem] mb-2">
            This tool allows you to locate and connect to BlueOS vehicles within your network.
          </p>
        </div>

        <div v-if="!searching" class="flex justify-center items-center">
          <v-btn variant="outlined" :disabled="searching" class="mb-5" @click="searchVehicles">
            {{ searched ? 'Search again' : 'Search for vehicles' }}
          </v-btn>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import vehicleDiscover, { NetworkVehicle } from '@/libs/electron/vehicle-discovery'
import { reloadCockpit } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import InteractionDialog, { Action } from './InteractionDialog.vue'

const props = defineProps<{
  /**
   *
   */
  modelValue: boolean
  /**
   *
   */
  showAutoSearchOption?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { showSnackbar } = useSnackbar()
const mainVehicleStore = useMainVehicleStore()
const discoveryService = vehicleDiscover

const isOpen = ref(props.modelValue)
const searching = ref(false)
const searched = ref(false)
const vehicles = ref<NetworkVehicle[]>([])
const preventAutoSearch = useStorage('cockpit-prevent-auto-vehicle-discovery-dialog', false)

const originalActions = [
  {
    text: 'Close',
    action: () => {
      isOpen.value = false
    },
  },
]

if (props.showAutoSearchOption) {
  originalActions.unshift({
    text: "Don't show again",
    action: () => preventFutureAutoSearchs(),
  })
}

const dialogActions = ref<Action[]>(originalActions)

watch(
  () => props.modelValue,
  (value) => {
    isOpen.value = value
  }
)

watch(isOpen, (value) => {
  emit('update:modelValue', value)
})

const searchVehicles = async (): Promise<void> => {
  searching.value = true
  disableButtons()
  vehicles.value = await discoveryService.findVehicles()
  searching.value = false
  enableButtons()
  searched.value = true
}

const selectVehicle = async (address: string): Promise<void> => {
  mainVehicleStore.globalAddress = address
  isOpen.value = false
  await reloadCockpit()
  showSnackbar({ message: 'Vehicle address updated', variant: 'success', duration: 5000 })
}

const preventFutureAutoSearchs = (): void => {
  preventAutoSearch.value = true
  disableButtons()
  setTimeout(() => {
    isOpen.value = false
  }, 5000)
}

const disableButtons = (): void => {
  dialogActions.value = originalActions.map((action) => ({ ...action, disabled: true }))
}

const enableButtons = (): void => {
  dialogActions.value = originalActions
}

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) return

  setTimeout(() => {
    vehicles.value = []
    searching.value = false
    searched.value = false
  }, 1000)
})
</script>
