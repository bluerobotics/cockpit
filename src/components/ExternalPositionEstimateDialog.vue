<template>
  <InteractionDialog
    :show-dialog="showDialog"
    title="Set Position Estimate"
    variant="text-only"
    max-width="500px"
    :actions="dialogActions"
    @update:show-dialog="showDialog = $event"
  >
    <template #content>
      <p class="text-sm mb-8 -mt-6 text-gray-300">
        This feature allows you to set the vehicle's global position estimate. This is especially useful when using
        local position units (such as indoor positioning systems) where you want to define a corresponding global
        position for the EKF (Extended Kalman Filter).
      </p>

      <v-text-field
        v-model.number="latitude"
        label="Latitude"
        type="number"
        step="0.000001"
        suffix="°"
        hint="Latitude in degrees (-90 to 90)"
        persistent-hint
        variant="outlined"
        :rules="[
          (v: number) => v !== null && v !== undefined || 'Latitude is required',
          (v: number) => (v >= -90 && v <= 90) || 'Latitude must be between -90 and 90',
        ]"
        class="mb-6"
      />

      <v-text-field
        v-model.number="longitude"
        label="Longitude"
        type="number"
        step="0.000001"
        suffix="°"
        hint="Longitude in degrees (-180 to 180)"
        persistent-hint
        variant="outlined"
        :rules="[
          (v: number) => v !== null && v !== undefined || 'Longitude is required',
          (v: number) => (v >= -180 && v <= 180) || 'Longitude must be between -180 and 180',
        ]"
        class="mb-2"
      />
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, defineModel, ref, watch } from 'vue'

import InteractionDialog, { type Action } from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import type { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'

const { openSnackbar } = useSnackbar()

const showDialog = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  /**
   * Emitted when the position is set
   */
  'position-set': [latitude: number, longitude: number]
}>()

const props = defineProps<{
  /**
   * The vehicle to set the position estimate for
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
    longitude.value <= 180
  )
})

const closeDialog = (): void => {
  showDialog.value = false
}

const savePosition = async (): Promise<void> => {
  if (!isValid.value || isSaving.value) {
    return
  }

  isSaving.value = true
  try {
    await props.vehicle.setExternalPositionEstimate([latitude.value, longitude.value])
    openSnackbar({ message: 'Position estimate sent to vehicle.', variant: 'success' })
    emit('position-set', latitude.value, longitude.value) // eslint-disable-line
    closeDialog()
  } catch (error) {
    openSnackbar({ message: `Failed to set position estimate: ${error}`, variant: 'error' })
  } finally {
    isSaving.value = false
  }
}

const dialogActions = computed<Action[]>(() => [
  {
    text: 'Cancel',
    action: closeDialog,
    disabled: isSaving.value,
  },
  {
    text: isSaving.value ? 'Saving...' : 'Save',
    disabled: !isValid.value || isSaving.value,
    action: savePosition,
    class: isSaving.value ? 'opacity-70' : '',
  },
])
</script>
