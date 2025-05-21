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
        <v-text-field v-model="newPoiName" label="Name" variant="outlined"></v-text-field>
        <v-text-field v-model="newPoiDescription" label="Description" variant="outlined"></v-text-field>

        <div class="grid grid-cols-2 gap-x-4">
          <v-text-field v-model.number="newPoiLat" label="Latitude" variant="outlined" type="number" step="0.0000001" />
          <v-text-field
            v-model.number="newPoiLng"
            label="Longitude"
            variant="outlined"
            type="number"
            step="0.0000001"
          />
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
import { v4 as uuid } from 'uuid'
import { defineExpose, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useMissionStore } from '@/stores/mission'
import type { PointOfInterest, PointOfInterestCoordinates } from '@/types/mission'

const missionStore = useMissionStore()
const { showDialog } = useInteractionDialog()

const poiDialogVisible = ref(false)
const newPoiName = ref('')
const newPoiDescription = ref('')
const newPoiIcon = ref('mdi-map-marker')
const newPoiColor = ref('#FF0000')
const editingPoiId = ref<string | null>(null)
const newPoiLat = ref<number | null>(null)
const newPoiLng = ref<number | null>(null)
const isIconPickerOpen = ref(false)
const iconSearchQuery = ref('')
const isColorPickerOpen = ref(false)

// Store original values for reverting changes if user cancels
const originalPoiValues = ref<{
  /** Original POI name */
  name: string
  /** Original POI description */
  description: string
  /** Original POI latitude */
  lat: number
  /** Original POI longitude */
  lng: number
  /** Original POI icon */
  icon: string
  /** Original POI color */
  color: string
} | null>(null)

// Flag to prevent watcher from firing during dialog initialization
const isInitializingDialog = ref(false)

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

// Live preview functionality - update POI in store when form values change
watch(
  [newPoiName, newPoiDescription, newPoiLat, newPoiLng, newPoiIcon, newPoiColor],
  (newValues, oldValues) => {
    // Only apply live preview for existing POIs being edited and not during initialization
    if (!editingPoiId.value || isInitializingDialog.value) return

    // Get the current POI from store to preserve unchanged values
    const currentPoi = missionStore.pointsOfInterest.find((poi) => poi.id === editingPoiId.value)
    if (!currentPoi) return

    const [newName, newDesc, newLat, newLng, newIcon, newColor] = newValues
    const [oldName, oldDesc, oldLat, oldLng, oldIcon, oldColor] = oldValues || []

    // Build update object with only changed fields
    const updatedPoi: Partial<PointOfInterest> = {
      timestamp: Date.now(),
    }

    // Only update coordinates if they actually changed in the form
    if (newLat !== oldLat || newLng !== oldLng) {
      updatedPoi.coordinates = [newLat ?? 0, newLng ?? 0] as PointOfInterestCoordinates
    }

    // Update other fields if they changed
    if (newName !== oldName) updatedPoi.name = newName
    if (newDesc !== oldDesc) updatedPoi.description = newDesc
    if (newIcon !== oldIcon) updatedPoi.icon = newIcon
    if (newColor !== oldColor) updatedPoi.color = newColor

    // Only update if there are actual changes (besides timestamp)
    if (Object.keys(updatedPoi).length > 1) {
      missionStore.updatePointOfInterest(editingPoiId.value, updatedPoi)
    }
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

  if (poiToEdit) {
    // Get fresh POI data from store instead of using potentially stale passed data
    const freshPoi = missionStore.pointsOfInterest.find((poi) => poi.id === poiToEdit.id)
    if (!freshPoi) {
      showDialog({
        variant: 'error',
        title: 'Error',
        message: 'POI not found in store.',
      })
      console.error('POI not found in store:', poiToEdit.id)
      isInitializingDialog.value = false
      return
    }

    editingPoiId.value = freshPoi.id

    // Store original values for potential reversion (use current store values, not form values)
    originalPoiValues.value = {
      name: freshPoi.name,
      description: freshPoi.description,
      lat: Number(freshPoi.coordinates[0].toFixed(7)),
      lng: Number(freshPoi.coordinates[1].toFixed(7)),
      icon: freshPoi.icon,
      color: freshPoi.color,
    }

    // Set form values using fresh data from store
    newPoiName.value = freshPoi.name
    newPoiDescription.value = freshPoi.description
    newPoiLat.value = Number(freshPoi.coordinates[0].toFixed(7))
    newPoiLng.value = Number(freshPoi.coordinates[1].toFixed(7))
    newPoiIcon.value = freshPoi.icon
    newPoiColor.value = freshPoi.color
    dialogInitialCoordinates.value = null // Not needed for editing, and clear it
  } else if (coordinates) {
    editingPoiId.value = null
    originalPoiValues.value = null // Clear for new POIs
    newPoiName.value = ''
    newPoiDescription.value = ''
    newPoiIcon.value = getRandomIcon()
    newPoiColor.value = getRandomColor()
    newPoiLat.value = coordinates[0] // Still useful to pre-fill for potential direct edit
    newPoiLng.value = coordinates[1] // Still useful to pre-fill for potential direct edit
    dialogInitialCoordinates.value = [...coordinates] // Store for saving a new POI
  } else {
    showDialog({
      variant: 'error',
      title: 'Error',
      message: 'Cannot open POI dialog without coordinates for a new POI or POI data for editing.',
    })
    console.error('POI Dialog: Insufficient data to open.')
    isInitializingDialog.value = false
    return
  }

  poiDialogVisible.value = true

  // Clear initialization flag after a short delay to allow form to settle
  setTimeout(() => {
    isInitializingDialog.value = false
  }, 50)
}

const closeDialog = (): void => {
  // Revert changes if user was editing an existing POI and cancels without saving
  if (editingPoiId.value && originalPoiValues.value) {
    const revertedPoi: Partial<PointOfInterest> = {
      name: originalPoiValues.value.name,
      description: originalPoiValues.value.description,
      coordinates: [originalPoiValues.value.lat, originalPoiValues.value.lng] as PointOfInterestCoordinates,
      icon: originalPoiValues.value.icon,
      color: originalPoiValues.value.color,
      timestamp: Date.now(),
    }
    missionStore.updatePointOfInterest(editingPoiId.value, revertedPoi)
  }

  poiDialogVisible.value = false
  editingPoiId.value = null
  originalPoiValues.value = null
  dialogInitialCoordinates.value = null
  isInitializingDialog.value = false
  // Reset form fields to ensure clean state next time
  newPoiName.value = ''
  newPoiDescription.value = ''
  newPoiLat.value = null
  newPoiLng.value = null
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

  if (newPoiLat.value === null || newPoiLng.value === null || isNaN(newPoiLat.value) || isNaN(newPoiLng.value)) {
    showDialog({
      title: 'Invalid Coordinates',
      message: 'Latitude and Longitude must be valid numbers.',
      variant: 'error',
    })
    return
  }

  if (editingPoiId.value) {
    // Get the current POI from store to preserve current coordinates
    const currentPoi = missionStore.pointsOfInterest.find((poi) => poi.id === editingPoiId.value)
    if (!currentPoi) {
      showDialog({ variant: 'error', title: 'Error', message: 'POI not found in store.' })
      return
    }

    // Check if coordinates were actually changed in the form by comparing with original values
    const coordinatesChanged = originalPoiValues.value
      ? newPoiLat.value !== originalPoiValues.value.lat || newPoiLng.value !== originalPoiValues.value.lng
      : false

    // Clear original values since we're saving the changes
    originalPoiValues.value = null

    const poiUpdate: Partial<PointOfInterest> = {
      name: newPoiName.value,
      description: newPoiDescription.value,
      // Use current store coordinates unless user specifically changed them in the form
      coordinates: coordinatesChanged
        ? ([newPoiLat.value, newPoiLng.value] as PointOfInterestCoordinates)
        : currentPoi.coordinates,
      icon: newPoiIcon.value,
      color: newPoiColor.value,
      timestamp: Date.now(),
    }
    missionStore.updatePointOfInterest(editingPoiId.value, poiUpdate)
  } else {
    // For new POIs, prioritize dialogInitialCoordinates if they exist (meaning they were passed on openDialog)
    // Otherwise, use the (potentially user-modified) coordinates from the form.
    const coordinatesToSave =
      dialogInitialCoordinates.value ?? ([newPoiLat.value, newPoiLng.value] as PointOfInterestCoordinates)

    if (!coordinatesToSave) {
      // This case should ideally not be reached if openDialog is called correctly with coordinates for new POIs.
      showDialog({ variant: 'error', title: 'Error', message: 'Cannot save Point of Interest without coordinates.' })
      console.error(
        'Cannot save new POI: coordinatesToSave is null. dialogInitialCoordinates:',
        dialogInitialCoordinates.value,
        'currentFormCoordinates:',
        [newPoiLat.value, newPoiLng.value]
      )
      return
    }

    const newPoi: PointOfInterest = {
      id: uuid(),
      name: newPoiName.value,
      description: newPoiDescription.value,
      coordinates: coordinatesToSave,
      icon: newPoiIcon.value,
      color: newPoiColor.value,
      timestamp: Date.now(),
    }
    missionStore.addPointOfInterest(newPoi)
  }
  closeDialog()
}

const deletePoi = (): void => {
  if (editingPoiId.value) {
    missionStore.removePointOfInterest(editingPoiId.value)
    closeDialog()
  } else {
    // This case should ideally not be reached if the delete button is only visible when editingPoiId is set.
    showDialog({
      variant: 'error',
      title: 'Error',
      message: 'No Point of Interest selected for deletion.',
    })
    console.error('Delete POI: editingPoiId is null.')
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
