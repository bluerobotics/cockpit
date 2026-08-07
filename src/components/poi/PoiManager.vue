<template>
  <InteractionDialog
    v-model="poiDialogVisible"
    :title="`${editingPoiId ? 'Edit' : 'Place'} Point of Interest`"
    variant="text-only"
    max-width="500px"
    :persistent="true"
  >
    <template #content>
      <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
        <v-btn icon :width="34" :height="34" variant="text" class="bg-transparent" @click="closeDialog">
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>
      <div class="p-3">
        <v-text-field v-model="newPoiName" label="Name" variant="outlined" class="mb-2"></v-text-field>
        <div class="flex items-start mb-2">
          <v-text-field
            v-model="newPoiId"
            label="ID"
            variant="outlined"
            :disabled="!!editingPoiId || !isManualIdEnabled"
            :error-messages="idError"
            class="flex-1"
          />
          <v-tooltip location="top" :text="editingPoiId ? `A POI's ID can't be changed after creation` : 'Edit ID'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                class="mt-2"
                variant="text"
                icon="mdi-pencil"
                :color="isManualIdEnabled ? 'white' : 'grey'"
                :disabled="!!editingPoiId"
                @click="toggleManualIdEditing"
              />
            </template>
          </v-tooltip>
        </div>
        <v-text-field v-model="newPoiDescription" label="Description" variant="outlined"></v-text-field>

        <div class="flex flex-col mb-2">
          <DataLakeExpressionInput
            v-if="poiDialogVisible"
            v-model="newPoiLatExpression"
            label="Latitude"
            :variable-filter="isCoordinateVariable"
            class="mb-5"
          >
            <template #hint>
              <p class="text-sm mb-2">
                Enter a fixed coordinate, or an expression that follows live data and updates on the map.
              </p>
              <p class="text-sm">
                Click the field to pick a data-lake variable, or wrap variables in &#123;&#123; &#125;&#125; — e.g.
                &#123;&#123; mavlink/buoy/latitude &#125;&#125; + 0.0001.
              </p>
            </template>
          </DataLakeExpressionInput>
          <DataLakeExpressionInput
            v-if="poiDialogVisible"
            v-model="newPoiLngExpression"
            label="Longitude"
            :variable-filter="isCoordinateVariable"
            class="mb-4"
          >
            <template #hint>
              <p class="text-sm mb-2">
                Enter a fixed coordinate, or an expression that follows live data and updates on the map.
              </p>
              <p class="text-sm">
                Click the field to pick a data-lake variable, or wrap variables in &#123;&#123; &#125;&#125; — e.g.
                &#123;&#123; mavlink/buoy/longitude &#125;&#125; + 0.0001.
              </p>
            </template>
          </DataLakeExpressionInput>
        </div>

        <div class="mb-4">
          <div class="flex items-center gap-x-2 mb-4">
            <div class="flex flex-col">
              <v-btn
                :color="newPoiColor"
                class="color-picker-button flex-shrink-0"
                @click="isColorPickerOpen = !isColorPickerOpen"
              >
                <v-icon>mdi-palette</v-icon>
              </v-btn>
            </div>
            <v-text-field v-model="newPoiColor" label="Hex Color" hide-details variant="outlined" class="flex-grow" />
            <v-spacer />
            <div
              class="cursor-pointer hover:opacity-80 flex flex-col items-center"
              @click="isIconPickerOpen = !isIconPickerOpen"
            >
              <v-icon :icon="newPoiIcon" size="48" :color="newPoiColor" />
              <span class="text-white opacity-50 mx-2 text-xs mt-1">Click to change icon</span>
            </div>
          </div>

          <div v-if="isColorPickerOpen" class="color-picker-container mb-4">
            <v-color-picker v-model="newPoiColor" mode="hex" hide-inputs width="384" theme="dark" />
          </div>

          <div v-if="isIconPickerOpen" class="icon-picker-container">
            <v-text-field
              v-model="iconSearchQuery"
              label="Search icons"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              class="mb-2"
              hide-details
              @update:model-value="searchIcons"
            ></v-text-field>

            <div class="icon-grid">
              <div
                v-for="icon in filteredIcons"
                :key="icon.value"
                class="icon-option"
                :class="{ selected: newPoiIcon === icon.value }"
                @click="newPoiIcon = icon.value"
              >
                <v-icon :icon="icon.value" size="24"></v-icon>
                <div class="icon-name">{{ icon.name }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #actions>
      <v-btn v-if="editingPoiId" text @click="deletePoi">Delete</v-btn>
      <v-spacer></v-spacer>
      <v-btn text @click="savePoi">Save</v-btn>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, defineExpose, ref, watch } from 'vue'

import DataLakeExpressionInput from '@/components/DataLakeExpressionInput.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { generatePointOfInterestId, usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { type DataLakeVariable } from '@/libs/actions/data-lake'
import { machinizeString } from '@/libs/utils'
import type { PoiCoordinateSource, PointOfInterest, PointOfInterestCoordinates } from '@/types/mission'

const { pointsOfInterest, addPointOfInterest, updatePointOfInterest, removePointOfInterest } = usePointsOfInterest()
const { showDialog } = useInteractionDialog()

// Number-typed data-lake variables offered in the coordinate dropdowns. POIs' own backing
// variables are excluded to avoid clutter and self-reference.
const isCoordinateVariable = (variable: DataLakeVariable): boolean =>
  variable.type === 'number' && !variable.id.startsWith('cockpit/pois/')

const poiDialogVisible = ref(false)
const newPoiName = ref('')
const newPoiDescription = ref('')
const newPoiIcon = ref('mdi-map-marker')
const newPoiColor = ref('#FF0000')
const editingPoiId = ref<string | null>(null)
const newPoiId = ref('')
const isManualIdEnabled = ref(false)
const newPoiLatExpression = ref('')
const newPoiLngExpression = ref('')
const isIconPickerOpen = ref(false)
const iconSearchQuery = ref('')
const isColorPickerOpen = ref(false)

// Snapshot of the POI as it was when the dialog opened, used to revert unsaved live-preview edits.
const originalPoi = ref<PointOfInterest | null>(null)

// Flag to prevent watcher from firing during dialog initialization
const isInitializingDialog = ref(false)

// Ids of all other POIs, used to keep the edited POI's id unique.
const otherPoiIds = (): string[] =>
  pointsOfInterest.value.filter((poi) => poi.id !== editingPoiId.value).map((poi) => poi.id)

// Validation message for the id field (only editable while creating a POI).
const idError = computed(() => {
  if (editingPoiId.value) return ''
  const id = newPoiId.value.trim()
  if (!id) return 'ID is required'
  if (machinizeString(id) !== id) return 'Only lowercase letters, numbers and dashes are allowed'
  if (otherPoiIds().includes(id)) return 'This ID is already in use'
  return ''
})

const toggleManualIdEditing = (): void => {
  if (editingPoiId.value) return
  isManualIdEnabled.value = !isManualIdEnabled.value
  logUserAction(
    isManualIdEnabled.value ? 'Enabled manual editing of the POI ID' : 'Disabled manual editing of the POI ID'
  )
}

// Auto-derive the id from the name while creating a POI, unless the user is editing it manually.
watch(newPoiName, (name) => {
  if (isManualIdEnabled.value || editingPoiId.value) return
  newPoiId.value = name.trim() ? generatePointOfInterestId(name, otherPoiIds()) : ''
})

// This ref will store the coordinates passed when opening the dialog for a NEW POI.
// It's needed because props.initialCoordinates might change if the user clicks elsewhere on the map
// while the dialog is open for a *new* POI. We need to latch the coordinates at the moment of opening.
const dialogInitialCoordinates = ref<PointOfInterestCoordinates | null>(null)

const availableIcons = ref([
  { name: 'Map Marker', value: 'mdi-map-marker' },
  { name: 'Star', value: 'mdi-star' },
  { name: 'Heart', value: 'mdi-heart' },
  { name: 'Home', value: 'mdi-home' },
  { name: 'Flag', value: 'mdi-flag' },
  { name: 'Camera', value: 'mdi-camera' },
  { name: 'Information', value: 'mdi-information' },
  { name: 'Warning', value: 'mdi-alert-circle' },
  { name: 'Navigation', value: 'mdi-navigation' },
  { name: 'Anchor', value: 'mdi-anchor' },
  { name: 'Building', value: 'mdi-office-building' },
  { name: 'Restaurant', value: 'mdi-food' },
  { name: 'Gas Station', value: 'mdi-gas-station' },
  { name: 'Hospital', value: 'mdi-hospital' },
  { name: 'School', value: 'mdi-school' },
  { name: 'Shopping', value: 'mdi-shopping' },
  { name: 'Mountain', value: 'mdi-terrain' },
  { name: 'Water', value: 'mdi-water' },
  { name: 'Binoculars', value: 'mdi-binoculars' },
  { name: 'Car', value: 'mdi-car' },
  { name: 'Ferry', value: 'mdi-ferry' },
  { name: 'Lighthouse', value: 'mdi-lighthouse' },
  { name: 'Parking', value: 'mdi-parking' },
  { name: 'Tree', value: 'mdi-tree' },
  { name: 'Bike', value: 'mdi-bike' },
  { name: 'Pier', value: 'mdi-pier' },
  { name: 'Drone', value: 'mdi-quadcopter' },
  { name: 'Hiking', value: 'mdi-hiking' },
  { name: 'Fish', value: 'mdi-fish' },
  { name: 'Boat', value: 'mdi-sail-boat' },
])

const filteredIcons = ref(availableIcons.value)

// Function to generate a random color
const getRandomColor = (): string => {
  const colors = [
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#FFA500',
    '#800080',
    '#FFC0CB',
    '#A52A2A',
    '#808080',
    '#000080',
    '#008000',
    '#800000',
    '#808000',
    '#FF4500',
    '#DA70D6',
    '#32CD32',
    '#FFD700',
    '#DC143C',
    '#00CED1',
    '#FF1493',
    '#1E90FF',
    '#FF6347',
    '#40E0D0',
    '#EE82EE',
    '#90EE90',
    '#F0E68C',
    '#DDA0DD',
    '#87CEEB',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Function to get a random icon
const getRandomIcon = (): string => {
  const randomIndex = Math.floor(Math.random() * availableIcons.value.length)
  return availableIcons.value[randomIndex].value
}

const searchIcons = (): void => {
  if (!iconSearchQuery.value.trim()) {
    filteredIcons.value = availableIcons.value
    return
  }

  const query = iconSearchQuery.value.toLowerCase()
  filteredIcons.value = availableIcons.value.filter(
    (icon) => icon.name.toLowerCase().includes(query) || icon.value.toLowerCase().includes(query)
  )
}

// A coordinate field holding a plain number is stored as a number; anything else is kept as a
// data-lake expression string. Both are backed by a transforming function in the data lake.
const toCoordinateSource = (raw: string): PoiCoordinateSource => {
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : raw
}

/**
 * Builds the coordinate fields of a POI from the current form state. The fallback location is the
 * literal coordinates when both fields are numbers, otherwise the POI's map placement point.
 * @returns {Pick<PointOfInterest, 'latitude' | 'longitude' | 'fallbackCoordinates'> | null} The
 * coordinate fields, or null when the form does not hold valid coordinates.
 */
const buildCoordinateFields = (): Pick<PointOfInterest, 'latitude' | 'longitude' | 'fallbackCoordinates'> | null => {
  // Coerce defensively before trimming, as the bound value may be empty or unset.
  const latRaw = (newPoiLatExpression.value ?? '').toString().trim()
  const lngRaw = (newPoiLngExpression.value ?? '').toString().trim()
  if (latRaw === '' || lngRaw === '') return null

  const latitude = toCoordinateSource(latRaw)
  const longitude = toCoordinateSource(lngRaw)

  const existingFallback = pointsOfInterest.value.find((poi) => poi.id === editingPoiId.value)?.fallbackCoordinates
  const fallbackCoordinates: PointOfInterestCoordinates =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? [latitude, longitude]
      : dialogInitialCoordinates.value ?? existingFallback ?? [0, 0]

  return { latitude, longitude, fallbackCoordinates }
}

// Live preview - reflect form edits on the map while editing an existing POI.
watch(
  [newPoiName, newPoiDescription, newPoiLatExpression, newPoiLngExpression, newPoiIcon, newPoiColor],
  () => {
    if (!editingPoiId.value || isInitializingDialog.value) return

    const update: Partial<PointOfInterest> = {
      name: newPoiName.value,
      description: newPoiDescription.value,
      icon: newPoiIcon.value,
      color: newPoiColor.value,
    }

    const coordinateFields = buildCoordinateFields()
    if (coordinateFields) Object.assign(update, coordinateFields)

    updatePointOfInterest(editingPoiId.value, update)
  },
  { deep: true }
)

/**
 * Opens the POI dialog for adding a new POI or editing an existing one.
 * @param {PointOfInterestCoordinates | null} coordinates The geographical coordinates for a new POI. Preferred for new POIs.
 * @param {PointOfInterest | null} poiToEdit The existing POI data to populate the dialog for editing.
 */
const openDialog = (coordinates?: PointOfInterestCoordinates | null, poiToEdit?: PointOfInterest): void => {
  // Set initialization flag to prevent watcher from firing during setup
  isInitializingDialog.value = true

  // Reset icon picker state
  isIconPickerOpen.value = false
  isColorPickerOpen.value = false
  iconSearchQuery.value = ''
  filteredIcons.value = availableIcons.value
  isManualIdEnabled.value = false
  newPoiId.value = ''

  if (poiToEdit) {
    // Get fresh POI data from the store instead of using potentially stale passed data
    const freshPoi = pointsOfInterest.value.find((poi) => poi.id === poiToEdit.id)
    if (!freshPoi) {
      showDialog({
        variant: 'error',
        title: 'Error',
        message: 'POI not found.',
      })
      isInitializingDialog.value = false
      return
    }

    editingPoiId.value = freshPoi.id

    // Snapshot the original POI so unsaved live-preview edits can be reverted on cancel
    originalPoi.value = { ...freshPoi }

    newPoiName.value = freshPoi.name
    newPoiDescription.value = freshPoi.description
    newPoiLatExpression.value = freshPoi.latitude.toString()
    newPoiLngExpression.value = freshPoi.longitude.toString()
    newPoiIcon.value = freshPoi.icon
    newPoiColor.value = freshPoi.color
    newPoiId.value = freshPoi.id
    dialogInitialCoordinates.value = null
  } else if (coordinates) {
    // Creating a new POI at the specified coordinates
    editingPoiId.value = null
    originalPoi.value = null

    newPoiName.value = ''
    newPoiDescription.value = ''
    newPoiIcon.value = getRandomIcon()
    newPoiColor.value = getRandomColor()
    newPoiLatExpression.value = coordinates[0].toString()
    newPoiLngExpression.value = coordinates[1].toString()
    dialogInitialCoordinates.value = [...coordinates]
  } else {
    // Creating a new POI without coordinates (shouldn't happen in normal flow)
    editingPoiId.value = null
    originalPoi.value = null

    newPoiName.value = ''
    newPoiDescription.value = ''
    newPoiLatExpression.value = ''
    newPoiLngExpression.value = ''
    newPoiIcon.value = getRandomIcon()
    newPoiColor.value = getRandomColor()
    dialogInitialCoordinates.value = null
  }

  // Clear initialization flag after a short delay to allow Vue to process the changes
  setTimeout(() => {
    isInitializingDialog.value = false
  }, 100)

  logUserAction(
    editingPoiId.value
      ? `Opened the "${newPoiName.value}" point of interest for editing`
      : 'Opened the dialog to add a new point of interest'
  )
  poiDialogVisible.value = true
}

const closeDialog = (): void => {
  logUserAction('Closed the point-of-interest dialog')
  // Revert changes if user was editing an existing POI and cancels without saving
  if (editingPoiId.value && originalPoi.value) {
    updatePointOfInterest(editingPoiId.value, originalPoi.value)
  }

  poiDialogVisible.value = false
  editingPoiId.value = null
  originalPoi.value = null
  dialogInitialCoordinates.value = null
  isInitializingDialog.value = false
  // Reset form fields to ensure clean state next time
  newPoiId.value = ''
  isManualIdEnabled.value = false
  newPoiName.value = ''
  newPoiDescription.value = ''
  newPoiLatExpression.value = ''
  newPoiLngExpression.value = ''
  newPoiIcon.value = getRandomIcon()
  newPoiColor.value = getRandomColor()
  isIconPickerOpen.value = false
  isColorPickerOpen.value = false
}

const savePoi = (): void => {
  if (!newPoiName.value.trim()) {
    showDialog({ title: 'Invalid Name', message: 'POI name cannot be empty.', variant: 'error' })
    return
  }

  const coordinateFields = buildCoordinateFields()
  if (!coordinateFields) {
    showDialog({
      title: 'Invalid Coordinates',
      message: 'Latitude and Longitude must be provided.',
      variant: 'error',
    })
    return
  }

  if (!editingPoiId.value && idError.value) {
    showDialog({ title: 'Invalid ID', message: idError.value, variant: 'error' })
    return
  }

  if (editingPoiId.value) {
    // Editing existing POI - prevent revert on close since we're committing the changes
    originalPoi.value = null

    logUserAction(`Saved changes to the "${newPoiName.value}" point of interest`)
    updatePointOfInterest(editingPoiId.value, {
      name: newPoiName.value,
      description: newPoiDescription.value,
      icon: newPoiIcon.value,
      color: newPoiColor.value,
      ...coordinateFields,
    })
  } else {
    const newPoi: PointOfInterest = {
      id: newPoiId.value.trim(),
      name: newPoiName.value,
      description: newPoiDescription.value,
      icon: newPoiIcon.value,
      color: newPoiColor.value,
      timestamp: Date.now(),
      ...coordinateFields,
    }
    logUserAction(`Added the "${newPoiName.value}" point of interest`)
    addPointOfInterest(newPoi)
  }

  closeDialog()
}

const deletePoi = (): void => {
  if (editingPoiId.value) {
    logUserAction(`Deleted the "${newPoiName.value}" point of interest`)
    removePointOfInterest(editingPoiId.value)
    closeDialog()
  } else {
    // This case should ideally not be reached if the delete button is only visible when editingPoiId is set.
    showDialog({
      variant: 'error',
      title: 'Error',
      message: 'No Point of Interest selected for deletion.',
    })
  }
}

defineExpose({
  openDialog,
})
</script>

<style>
/* Styles can be shared or overridden by parent components if necessary */
.poi-dialog-text-fields .v-input__control {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.poi-dialog-text-fields .v-field__input,
.poi-dialog-text-fields .v-label.v-field-label {
  color: #ffffffde !important;
}

.poi-dialog-text-fields .v-select .v-field__input {
  padding-top: 4px;
  padding-bottom: 4px;
}

.poi-color-picker {
  width: 54px;
  height: 54px;
  border-radius: 4px;
  cursor: pointer;
  background-color: transparent;
}

.color-picker-button {
  width: 54px !important;
  height: 54px !important;
  min-width: 54px !important;
  border-radius: 4px !important;
}

.color-picker-container {
  background-color: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 12px;
}

input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type='color']::-webkit-color-swatch {
  border: none;
  border-radius: 3px;
}
input[type='color']::-moz-color-swatch {
  border: none;
  border-radius: 3px;
}

.poi-tooltip {
  background-color: rgba(0, 0, 0, 0.75) !important;
  color: white !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 8px !important;
  font-size: 12px;
}

/* Icon Picker Styles */
.icon-picker-container {
  background-color: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 8px;
  margin-top: 8px;
}

.icon-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: 4px;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.icon-option:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.icon-option.selected {
  background-color: rgba(66, 133, 244, 0.4);
  border: 1px solid rgba(66, 133, 244, 0.8);
}

.icon-name {
  font-size: 10px;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  color: rgba(255, 255, 255, 0.8);
}

/* Custom scrollbar for the icon grid */
.icon-grid::-webkit-scrollbar {
  width: 6px;
}

.icon-grid::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

input[type='color'] {
  appearance: none;
  background-color: #000;
  color: #fff;
}
</style>
