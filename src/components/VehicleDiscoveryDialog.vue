<template>
  <InteractionDialog
    v-model="isOpen"
    :title="displaySearching ? $t('Searching for vehicles...') : $t('Vehicle Discovery')"
    :actions="dialogActions"
    :persistent="displaySearching"
    :variant="'text-only'"
  >
    <template #content>
      <div v-if="props.showAutoSearchOption && preventAutoSearch">
        <div class="text-sm mb-4">{{ $t('You can still search for vehicles in the general configuration menu.') }}</div>
      </div>
      <div v-else class="flex flex-col items-center justify-center gap-4 min-w-[300px] min-h-[100px]">
        <div v-if="displaySearching" class="flex flex-col items-center gap-2 mb-2 max-w-[420px]">
          <v-progress-circular class="mb-2" indeterminate />
          <span v-if="vehicles.length === 0">{{ $t('Searching for vehicles in your network...') }}</span>
          <span v-else> Found {{ vehicles.length }} vehicle{{ vehicles.length > 1 ? 's' : '' }} so far... </span>
          <div v-if="progressStatus" class="text-xs opacity-75 text-center">
            <div>{{ progressStatus.headline }}</div>
            <div v-if="progressStatus.detail" class="opacity-75">{{ progressStatus.detail }}</div>
          </div>
        </div>

        <div v-if="vehicles.length > 0" class="flex flex-col gap-2 mb-3">
          <div v-if="!displaySearching" class="h-4 font-weight-bold text-center mb-5">
            {{ $t('Vehicles found!') }}
          </div>
          <div v-for="vehicle in vehicles" :key="vehicle.address" class="flex items-center gap-2">
            <v-btn variant="tonal" class="max-w-[500px] justify-start truncate" @click="selectVehicle(vehicle.address)">
              <span class="max-w-[300px] truncate">{{ vehicle.name }}</span>
              <span class="text-xs ml-2 opacity-50">({{ vehicle.address }})</span>
            </v-btn>
          </div>
        </div>

        <div v-else-if="searched && !displaySearching" class="text-sm">
          {{ $t('No vehicles found in your network.') }}
        </div>

        <div v-if="!displaySearching && !searched" class="flex flex-col gap-2 items-center justify-center text-center">
          <p v-if="props.showAutoSearchOption" class="font-bold">
            {{ $t("It looks like you're not connected to a vehicle!") }}
          </p>
          <p class="max-w-[25rem] mb-2">
            {{ $t('This tool allows you to locate and connect to BlueOS vehicles within your network.') }}
          </p>
        </div>

        <div v-if="!displaySearching" class="flex justify-center items-center">
          <v-btn variant="outlined" :disabled="searching" class="mb-5" @click="searchVehicles">
            {{ searched ? $t('Search again') : $t('Search for vehicles') }}
          </v-btn>
        </div>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSnackbar } from '@/composables/snackbar'
import vehicleDiscover, { DiscoveryProgress, NetworkVehicle } from '@/libs/electron/vehicle-discovery'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import InteractionDialog, { Action } from './InteractionDialog.vue'

const tierLabels: Record<number, string> = {
  0: 'wired Ethernet',
  1: 'Wi-Fi',
  2: 'local network',
  3: 'VPN / overlay network',
}

/**
 * Two-line scan-progress status rendered under the dialog spinner.
 */
interface ProgressStatusLine {
  /**
   * Main status line summarising which tier and interfaces are being scanned.
   */
  headline: string
  /**
   * Optional secondary line with pass and address-count detail.
   */
  detail?: string
}

const props = defineProps<{
  /**
   * `v-model` binding controlling whether the discovery dialog is currently open.
   */
  modelValue: boolean
  /**
   * When true, the dialog also exposes the "Don't show again" action used by the
   * auto-open flow (e.g. on startup when no vehicle is connected).
   */
  showAutoSearchOption?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const { openSnackbar } = useSnackbar()
const mainVehicleStore = useMainVehicleStore()
const discoveryService = vehicleDiscover

const isOpen = ref(props.modelValue)
const searching = ref(false)
const searched = ref(false)
const vehicles = ref<NetworkVehicle[]>([])
const progress = ref<DiscoveryProgress | null>(null)
const searchController = ref<AbortController | null>(null)
const preventAutoSearch = useStorage('cockpit-prevent-auto-vehicle-discovery-dialog', false)

// Stop-button latency is dominated by HTTP probes already in flight (~3s each
// × 100 workers on a tier-3 sweep), so we treat "user stopped" as a separate
// UI state that flips the dialog to its post-search look immediately while
// the underlying scan tidies up in the background.
const userStopped = ref(false)
const displaySearching = computed(() => searching.value && !userStopped.value)

const progressStatus = computed<ProgressStatusLine | null>(() => {
  if (!progress.value) return null
  const { tier, interfaces, passIndex, totalPasses, passTimeoutMs, addressesInPass } = progress.value
  const tierLabel = tierLabels[tier] ?? `tier ${tier}`
  const ifaceList = interfaces.join(', ') || 'no interfaces'
  const headline = `Scanning ${tierLabel} (${ifaceList})`
  const passInfo =
    totalPasses > 1 ? `Pass ${passIndex}/${totalPasses} at ${passTimeoutMs}ms` : `Probe timeout ${passTimeoutMs}ms`
  const detail = `${passInfo} — ${addressesInPass.toLocaleString()} address(es)`
  return { headline, detail }
})

const originalActions = [
  {
    text: t('Close'),
    action: () => {
      logUserAction('Closed Vehicle Discovery dialog')
      isOpen.value = false
    },
  },
]

if (props.showAutoSearchOption) {
  originalActions.unshift({
    text: t("Don't show again"),
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
  logUserAction('Started vehicle discovery scan')
  searching.value = true
  searched.value = false
  userStopped.value = false
  vehicles.value = []
  progress.value = null
  searchController.value = new AbortController()
  showStopAction()
  try {
    await discoveryService.findVehicles(
      (vehicle) => {
        vehicles.value = [...vehicles.value, vehicle]
      },
      (update) => {
        progress.value = update
      },
      searchController.value.signal
    )
  } catch (error) {
    if (!userStopped.value) {
      console.error(`[VehicleDiscoveryDialog] Vehicle discovery failed: ${error}`)
      openSnackbar({ message: `Vehicle discovery failed: ${error}`, variant: 'error', duration: 5000 })
    }
  } finally {
    searching.value = false
    progress.value = null
    searchController.value = null
    userStopped.value = false
    enableButtons()
    searched.value = true
  }
}

const stopSearch = (): void => {
  if (!searchController.value) return
  logUserAction('Stopped vehicle discovery scan')
  userStopped.value = true
  searchController.value.abort()
  progress.value = null
  enableButtons()
  searched.value = true
}

const selectVehicle = async (address: string): Promise<void> => {
  logUserAction(`Selected discovered vehicle at ${address}`)
  mainVehicleStore.globalAddress = address
  isOpen.value = false
  await reloadCockpitAndWarnUser()
  openSnackbar({ message: t('Vehicle address updated'), variant: 'success', duration: 5000 })
}

const preventFutureAutoSearchs = (): void => {
  logUserAction('Disabled automatic vehicle discovery on startup')
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

const showStopAction = (): void => {
  dialogActions.value = [{ text: 'Stop', action: stopSearch }]
}

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) return

  searchController.value?.abort()

  setTimeout(() => {
    vehicles.value = []
    searching.value = false
    searched.value = false
    progress.value = null
    userStopped.value = false
  }, 1000)
})
</script>
