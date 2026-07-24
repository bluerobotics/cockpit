<template>
  <InteractionDialog
    :show-dialog="showDialog"
    :title="$t('Set Global Origin')"
    variant="text-only"
    max-width="500px"
    :actions="dialogActions"
    @update:show-dialog="showDialog = $event"
  >
    <template #content>
      <p class="text-sm mb-8 -mt-6 text-gray-300">
        {{
          $t(
            "This feature allows you to set the GNSS coordinates of the vehicle's local origin (0,0,0). This is useful when using local position units (such as indoor positioning systems or DVLs) where you want to define a corresponding global position."
          )
        }}
      </p>

      <div class="flex items-center gap-2 mb-6">
        <v-text-field
          v-model.number="latitude"
          :label="$t('Latitude')"
          type="number"
          step="0.000001"
          :hint="$t('Latitude in degrees (-90 to 90)')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('Latitude is required'),
            (v: number) => (v >= -90 && v <= 90) || $t('Latitude must be between -90 and 90'),
          ]"
          class="flex-1"
        />
        <span class="text-white text-lg font-medium mb-6 w-4">°</span>
      </div>

      <div class="flex items-center gap-2 mb-6">
        <v-text-field
          v-model.number="longitude"
          :label="$t('Longitude')"
          type="number"
          step="0.000001"
          :hint="$t('Longitude in degrees (-180 to 180)')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('Longitude is required'),
            (v: number) => (v >= -180 && v <= 180) || $t('Longitude must be between -180 and 180'),
          ]"
          class="flex-1"
        />
        <span class="text-white text-lg font-medium mb-6 w-4">°</span>
      </div>

      <div class="flex items-center gap-2 mb-2">
        <v-text-field
          v-model.number="altitude"
          :label="$t('Altitude')"
          type="number"
          step="0.1"
          :hint="$t('Altitude in meters (MSL)')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('Altitude is required'),
          ]"
          class="flex-1"
        />
        <span class="text-white text-lg font-medium mb-6 w-4">m</span>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, defineModel, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import InteractionDialog, { type Action } from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import type { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'

const { openSnackbar } = useSnackbar()
const { t } = useI18n()

const showDialog = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  /**
   * Emitted when the global origin is set
   */
  'origin-set': [latitude: number, longitude: number]
}>()

const props = defineProps<{
  /**
   * The vehicle to set the global origin for
   */
  vehicle: MAVLinkVehicle<string>
  /**
   * Initial latitude value
   */
  initialLatitude: number
  /**
   * Initial longitude value
   */
  initialLongitude: number
}>()

const latitude = ref<number>(props.initialLatitude)
const longitude = ref<number>(props.initialLongitude)
const altitude = ref<number>(0)
const isSaving = ref(false)

// Watch for changes in props to update the local values
watch(
  () => [props.initialLatitude, props.initialLongitude],
  ([newLat, newLon]) => {
    latitude.value = newLat
    longitude.value = newLon
  }
)

const isValid = computed(() => {
  return (
    latitude.value !== null &&
    latitude.value !== undefined &&
    latitude.value >= -90 &&
    latitude.value <= 90 &&
    longitude.value !== null &&
    longitude.value !== undefined &&
    longitude.value >= -180 &&
    longitude.value <= 180 &&
    altitude.value !== null &&
    altitude.value !== undefined
  )
})

const closeDialog = (): void => {
  showDialog.value = false
}

const saveGlobalOrigin = (): void => {
  if (!isValid.value || isSaving.value) {
    return
  }
  logUserAction('Set vehicle global origin')

  if (
    props.vehicle === undefined ||
    props.vehicle.dateLastHeartbeat() === undefined ||
    props.vehicle.dateLastHeartbeat()! > new Date(Date.now() - 5000)
  ) {
    openSnackbar({ message: t('Cannot set global origin while offline'), variant: 'error' })
    return
  }

  isSaving.value = true
  try {
    props.vehicle.setGlobalOrigin([latitude.value, longitude.value], altitude.value)
    openSnackbar({ message: t('Global origin set successfully.'), variant: 'success' })
    emit('origin-set', latitude.value, longitude.value) // eslint-disable-line
    closeDialog()
  } catch (error) {
    openSnackbar({ message: t('Failed to set global origin: {error}', { error }), variant: 'error' })
  } finally {
    isSaving.value = false
  }
}

const dialogActions = computed<Action[]>(() => [
  {
    text: t('Cancel'),
    action: closeDialog,
    disabled: isSaving.value,
  },
  {
    text: isSaving.value ? t('Saving...') : t('Save'),
    disabled: !isValid.value || isSaving.value,
    action: saveGlobalOrigin,
    class: isSaving.value ? 'opacity-70' : '',
  },
])
</script>
