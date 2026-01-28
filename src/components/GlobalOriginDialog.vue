<template>
  <InteractionDialog
    :show-dialog="showDialog"
    :title="$t('globalOrigin.title')"
    variant="text-only"
    max-width="500px"
    :actions="dialogActions"
    @update:show-dialog="showDialog = $event"
  >
    <template #content>
      <p class="text-sm mb-8 -mt-6 text-gray-300">
        {{ $t('globalOrigin.description') }}
      </p>

      <div class="flex items-center gap-2 mb-6">
        <v-text-field
          v-model.number="latitude"
          :label="$t('globalOrigin.latitude')"
          type="number"
          step="0.000001"
          :hint="$t('globalOrigin.latitudeHint')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('globalOrigin.latitudeRequired'),
            (v: number) => (v >= -90 && v <= 90) || $t('globalOrigin.latitudeRange'),
          ]"
          class="flex-1"
        />
        <span class="text-white text-lg font-medium mb-6 w-4">°</span>
      </div>

      <div class="flex items-center gap-2 mb-6">
        <v-text-field
          v-model.number="longitude"
          :label="$t('globalOrigin.longitude')"
          type="number"
          step="0.000001"
          :hint="$t('globalOrigin.longitudeHint')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('globalOrigin.longitudeRequired'),
            (v: number) => (v >= -180 && v <= 180) || $t('globalOrigin.longitudeRange'),
          ]"
          class="flex-1"
        />
        <span class="text-white text-lg font-medium mb-6 w-4">°</span>
      </div>

      <div class="flex items-center gap-2 mb-2">
        <v-text-field
          v-model.number="altitude"
          :label="$t('globalOrigin.altitude')"
          type="number"
          step="0.1"
          :hint="$t('globalOrigin.altitudeHint')"
          persistent-hint
          variant="outlined"
          :rules="[
            (v: number) => v !== null && v !== undefined || $t('globalOrigin.altitudeRequired'),
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

  if (
    props.vehicle === undefined ||
    props.vehicle.dateLastHeartbeat() === undefined ||
    props.vehicle.dateLastHeartbeat()! > new Date(Date.now() - 5000)
  ) {
    openSnackbar({ message: t('errors.cannotSetGlobalOriginOffline'), variant: 'error' })
    return
  }

  isSaving.value = true
  try {
    props.vehicle.setGlobalOrigin([latitude.value, longitude.value], altitude.value)
    openSnackbar({ message: t('success.globalOriginSet'), variant: 'success' })
    emit('origin-set', latitude.value, longitude.value) // eslint-disable-line
    closeDialog()
  } catch (error) {
    openSnackbar({ message: t('errors.failedToSetGlobalOrigin', { error }), variant: 'error' })
  } finally {
    isSaving.value = false
  }
}

const dialogActions = computed<Action[]>(() => [
  {
    text: t('common.cancel'),
    action: closeDialog,
    disabled: isSaving.value,
  },
  {
    text: isSaving.value ? t('globalOrigin.saving') : t('common.save'),
    disabled: !isValid.value || isSaving.value,
    action: saveGlobalOrigin,
    class: isSaving.value ? 'opacity-70' : '',
  },
])
</script>
