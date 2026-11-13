<template>
  <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>Survey sensors</template>
    <template #info>
      <strong>Echo sounders:</strong> Sonar that marine surveys can be re-spaced for, fitted with the bracket sold for
      the BlueBoat or the BlueROV2. <br />
      <strong>Imaging sensors:</strong> Camera used to judge photo survey resolution and overlap, and that marine
      surveys can be re-spaced for.
    </template>
    <template #content>
      <div class="flex flex-col gap-y-3 px-4 pb-4 pt-2 text-sm">
        <div class="flex items-center gap-x-1">
          <p class="font-semibold">Echo sounders</p>
          <div class="grow" />
          <v-select
            :model-value="terrainStore.settings.surveySensor.id"
            :items="sensorOptions"
            aria-label="Echo sounder"
            density="compact"
            variant="outlined"
            hide-details
            theme="dark"
            class="w-full max-w-sm"
            @update:model-value="onSelectSensor"
          >
            <template #append-inner>
              <span v-if="sensorSummary.length > 0" @mousedown.stop @click.stop @keydown.stop>
                <InfoTooltip label="Echo sounder mounting information">
                  <p v-for="line in sensorSummary" :key="line">{{ line }}</p>
                </InfoTooltip>
              </span>
            </template>
          </v-select>
        </div>
        <div v-if="isCustomSensor" class="grid gap-x-6 gap-y-2" :class="gridColumns">
          <v-select
            :model-value="terrainStore.settings.surveySensor.custom.facing"
            :items="FACING_OPTIONS"
            label="Looks"
            density="compact"
            variant="outlined"
            hide-details
            theme="dark"
            @update:model-value="onSelectFacing"
          />
        </div>
        <div v-if="SENSOR_FIELDS.some(isFieldShown)" class="grid gap-x-6 gap-y-2" :class="gridColumns">
          <NumberInputField
            v-for="field in SENSOR_FIELDS.filter(isFieldShown)"
            :key="field.key"
            v-bind="limitsOf(field)"
            :model-value="readField(field)"
            @update:model-value="writeField(field, $event)"
          />
        </div>

        <v-divider class="opacity-5" />

        <div class="flex items-center gap-x-1">
          <p class="font-semibold">Imaging sensors</p>
          <div class="grow" />
          <v-select
            :model-value="terrainStore.settings.camera.id"
            :items="cameraOptions"
            aria-label="Imaging sensor"
            density="compact"
            variant="outlined"
            hide-details
            theme="dark"
            class="w-full max-w-sm"
            @update:model-value="onSelectCamera"
          >
            <template #append-inner>
              <span v-if="cameraSummary.length > 0" @mousedown.stop @click.stop @keydown.stop>
                <InfoTooltip label="Imaging sensor mounting information">
                  <p v-for="line in cameraSummary" :key="line">{{ line }}</p>
                </InfoTooltip>
              </span>
            </template>
          </v-select>
        </div>
        <div v-if="CAMERA_FIELDS.some(isCameraFieldShown)" class="grid gap-x-6 gap-y-2" :class="gridColumns">
          <NumberInputField
            v-for="field in CAMERA_FIELDS.filter(isCameraFieldShown)"
            :key="field.key"
            v-bind="limitsOf(field)"
            :model-value="terrainStore.settings.camera[field.key]"
            @update:model-value="terrainStore.settings.camera[field.key] = $event"
          />
        </div>
      </div>
    </template>
  </ExpansiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'
import NumberInputField from '@/components/NumberInputField.vue'
import {
  type SurveySensorMount,
  type SurveySensorPreset,
  CUSTOM_SURVEY_SENSOR,
  ECHO_SOUNDER_PRESETS,
  IMAGING_SENSOR_PRESETS,
  NO_SURVEY_SENSOR,
  SURVEY_VEHICLE_NAMES,
} from '@/libs/terrain/survey-sensors'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useTerrainStore } from '@/stores/terrain'
import type { SurveySensorGeometry, TerrainSurveyCamera, TerrainSurveySensor } from '@/types/terrain'

type NumericKey<T> = {
  [K in keyof T]: T[K] extends number ? K : never
}[keyof T]

type FieldLimits = {
  /**
   * Field label.
   */
  label: string
  /**
   * Unit shown after the input.
   */
  unit: string
  /**
   * Lowest accepted value.
   */
  min: number
  /**
   * Highest accepted value.
   */
  max: number
  /**
   * Input step.
   */
  step: number
  /**
   * Explanation shown from the information icon beside the label.
   */
  info?: string
}

type SensorField = FieldLimits &
  (
    | {
        /**
         * Edits the selected sensor's settings.
         */
        scope: 'sensor'
        /**
         * Setting the field edits.
         */
        key: NumericKey<TerrainSurveySensor>
      }
    | {
        /**
         * Edits the custom sensor's geometry.
         */
        scope: 'custom'
        /**
         * Geometry value the field edits.
         */
        key: NumericKey<SurveySensorGeometry>
        /**
         * Directions the field applies to, when it does not apply to all.
         */
        facings?: SurveySensorGeometry['facing'][]
      }
  )

type CameraField = FieldLimits & {
  /**
   * Camera value the field edits.
   */
  key: NumericKey<TerrainSurveyCamera>
  /**
   * Whether the field only describes the custom camera.
   */
  customOnly?: boolean
}

type Option<T> = {
  /**
   * Text shown.
   */
  title: string
  /**
   * Value selected.
   */
  value: T
}

const SENSOR_FIELDS: SensorField[] = [
  {
    scope: 'sensor',
    key: 'rangeM',
    label: 'Sensor range',
    unit: 'm',
    min: 1,
    max: 500,
    step: 1,
    info: "The range set on the sonar, capped at the sonar's maximum. Picking a sonar sets it to its rated range.",
  },
  { scope: 'sensor', key: 'overlapPercent', label: 'Swath overlap', unit: '%', min: 0, max: 90, step: 1 },
  { scope: 'custom', key: 'acrossDeg', label: 'Beam across the track', unit: '°', min: 1, max: 170, step: 1 },
  {
    scope: 'custom',
    key: 'verticalDeg',
    label: 'Vertical beam',
    unit: '°',
    min: 1,
    max: 120,
    step: 1,
    facings: ['forward'],
  },
  {
    scope: 'custom',
    key: 'tiltDeg',
    label: 'Tilt below the horizon',
    unit: '°',
    min: 0,
    max: 90,
    step: 1,
    facings: ['forward', 'port', 'starboard', 'both-sides'],
  },
  { scope: 'custom', key: 'offsetM', label: 'Offset to starboard', unit: 'm', min: -5, max: 5, step: 0.05 },
]

const CAMERA_FIELDS: CameraField[] = [
  { key: 'sensorWidthMm', label: 'Camera sensor width', unit: 'mm', min: 1, max: 100, step: 0.1, customOnly: true },
  { key: 'focalLengthMm', label: 'Camera focal length', unit: 'mm', min: 1, max: 500, step: 0.1, customOnly: true },
  { key: 'imageWidthPx', label: 'Image width', unit: 'px', min: 100, max: 20000, step: 1, customOnly: true },
  { key: 'targetSideOverlapPercent', label: 'Photo side overlap', unit: '%', min: 0, max: 95, step: 1 },
  {
    key: 'visibilityM',
    label: 'Water visibility',
    unit: 'm',
    min: 0.5,
    max: 100,
    step: 0.5,
    info: 'How far the camera sees through the water, for boat and submarine surveys.',
  },
]

const FACING_OPTIONS: Option<SurveySensorGeometry['facing']>[] = [
  { title: 'Down', value: 'down' },
  { title: 'Forward', value: 'forward' },
  { title: 'To port', value: 'port' },
  { title: 'To starboard', value: 'starboard' },
  { title: 'To both sides', value: 'both-sides' },
]

const interfaceStore = useAppInterfaceStore()
const terrainStore = useTerrainStore()

const gridColumns = computed(() => (interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'))
const isCustomSensor = computed(() => terrainStore.settings.surveySensor.id === CUSTOM_SURVEY_SENSOR)
const isCustomCamera = computed(() => terrainStore.settings.camera.id === CUSTOM_SURVEY_SENSOR)

const optionsOf = (presets: SurveySensorPreset[], customLabel: string): Option<string>[] => [
  { title: 'None', value: NO_SURVEY_SENSOR },
  ...presets.map((preset) => ({ title: preset.label, value: preset.id })),
  { title: customLabel, value: CUSTOM_SURVEY_SENSOR },
]

const sensorOptions = optionsOf(ECHO_SOUNDER_PRESETS, 'Custom echo sounder')
const cameraOptions = optionsOf(IMAGING_SENSOR_PRESETS, 'Custom camera')

const mountText = (vehicle: string, mount: SurveySensorMount): string =>
  'unsuitedReason' in mount ? `${vehicle}: ${mount.bracket}. ${mount.unsuitedReason}` : `${vehicle}: ${mount.bracket}.`

const mountSummary = (presets: SurveySensorPreset[], id: string): string[] => {
  const preset = presets.find((entry) => entry.id === id)
  if (!preset) return []
  return Object.entries(SURVEY_VEHICLE_NAMES).flatMap(([vehicleClass, vehicle]) => {
    const mount = preset.mounts[vehicleClass as keyof typeof preset.mounts]
    return mount ? [mountText(vehicle, mount)] : [`${vehicle}: no mount.`]
  })
}

const sensorSummary = computed<string[]>(() =>
  isCustomSensor.value
    ? ['Survey lines are spaced for the echo sounder described below, on any vehicle.']
    : mountSummary(ECHO_SOUNDER_PRESETS, terrainStore.settings.surveySensor.id)
)

const cameraSummary = computed<string[]>(() =>
  isCustomCamera.value
    ? ['The camera described below, on any vehicle. Underwater, it is taken to look through a flat port.']
    : mountSummary(IMAGING_SENSOR_PRESETS, terrainStore.settings.camera.id)
)

const isFieldShown = (field: SensorField): boolean =>
  field.scope === 'custom'
    ? isCustomSensor.value && (field.facings?.includes(terrainStore.settings.surveySensor.custom.facing) ?? true)
    : terrainStore.settings.surveySensor.id !== NO_SURVEY_SENSOR

const isCameraFieldShown = (field: CameraField): boolean =>
  field.customOnly ? isCustomCamera.value : terrainStore.settings.camera.id !== NO_SURVEY_SENSOR

const onSelectSensor = (id: string): void => {
  terrainStore.settings.surveySensor.id = id
  const mounts = Object.values(ECHO_SOUNDER_PRESETS.find((entry) => entry.id === id)?.mounts ?? {})
  const ratedRanges = mounts.flatMap((mount) => ('maxRangeM' in mount && mount.maxRangeM ? [mount.maxRangeM] : []))
  if (ratedRanges.length > 0) terrainStore.settings.surveySensor.rangeM = Math.max(...ratedRanges)
  logUserAction(`Selected the "${sensorOptions.find((option) => option.value === id)?.title}" echo sounder`)
}

const onSelectFacing = (facing: SurveySensorGeometry['facing']): void => {
  terrainStore.settings.surveySensor.custom.facing = facing
  logUserAction(`Set the custom echo sounder direction to "${facing}"`)
}

const onSelectCamera = (id: string): void => {
  terrainStore.settings.camera.id = id
  logUserAction(`Selected the "${cameraOptions.find((option) => option.value === id)?.title}" imaging sensor`)
}

const limitsOf = ({ label, unit, min, max, step, info }: FieldLimits): FieldLimits => ({
  label,
  unit,
  min,
  max,
  step,
  info,
})

const readField = (field: SensorField): number =>
  field.scope === 'sensor'
    ? terrainStore.settings.surveySensor[field.key]
    : terrainStore.settings.surveySensor.custom[field.key]

const writeField = (field: SensorField, value: number): void => {
  if (field.scope === 'sensor') terrainStore.settings.surveySensor[field.key] = value
  else terrainStore.settings.surveySensor.custom[field.key] = value
}
</script>
