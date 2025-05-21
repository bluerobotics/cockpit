<template>
  <v-dialog v-model="poiDialogVisible" max-width="500px">
    <v-card :style="interfaceStore.globalGlassMenuStyles" class="p-3">
      <v-card-title class="text-center">{{ editingPoiId ? 'Edit' : 'Add' }} Point of Interest</v-card-title>
      <v-card-text class="poi-dialog-text-fields">
        <v-text-field v-model="newPoiName" label="Name" variant="outlined"></v-text-field>
        <v-text-field v-model="newPoiDescription" label="Description" variant="outlined"></v-text-field>

        <div class="grid grid-cols-2 gap-x-4">
          <v-text-field v-model.number="newPoiLat" label="Latitude" variant="outlined" type="number"></v-text-field>
          <v-text-field v-model.number="newPoiLng" label="Longitude" variant="outlined" type="number"></v-text-field>
        </div>

        <div class="mb-4">
          <div class="flex items-center gap-x-2 mb-4">
            <input v-model="newPoiColor" type="color" class="poi-color-picker flex-shrink-0" />
            <v-text-field v-model="newPoiColor" label="Hex Color" hide-details variant="outlined" class="flex-grow" />
            <v-spacer />
            <div
              class="transition cursor-pointer hover:opacity-80 flex flex-col items-center"
              @click="isIconPickerOpen = !isIconPickerOpen"
            >
              <v-icon :icon="newPoiIcon" size="48" :color="newPoiColor" />
              <span class="text-white opacity-50 mx-2 text-xs mt-1">Click to change icon</span>
            </div>
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
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="editingPoiId" color="red darken-1" text @click="deletePoi">Delete</v-btn>
        <v-spacer></v-spacer>
        <v-btn text @click="closeDialog">Cancel</v-btn>
        <v-btn text @click="savePoi">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { v4 as uuid } from 'uuid'
import { defineExpose, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { PointOfInterest, PointOfInterestCoordinates } from '@/types/mission'

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()
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
  { name: 'Building', value: 'mdi-building' },
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

/**
 * Opens the POI dialog for adding a new POI or editing an existing one.
 * @param {PointOfInterestCoordinates | null} coordinates The geographical coordinates for a new POI. Preferred for new POIs.
 * @param {PointOfInterest | null} poiToEdit The existing POI data to populate the dialog for editing.
 */
const openDialog = (coordinates?: PointOfInterestCoordinates | null, poiToEdit?: PointOfInterest): void => {
  // Reset icon picker state
  isIconPickerOpen.value = false
  iconSearchQuery.value = ''
  filteredIcons.value = availableIcons.value

  if (poiToEdit) {
    editingPoiId.value = poiToEdit.id
    newPoiName.value = poiToEdit.name
    newPoiDescription.value = poiToEdit.description
    newPoiLat.value = Number(poiToEdit.coordinates[0].toFixed(7))
    newPoiLng.value = Number(poiToEdit.coordinates[1].toFixed(7))
    newPoiIcon.value = poiToEdit.icon
    newPoiColor.value = poiToEdit.color
    dialogInitialCoordinates.value = null // Not needed for editing, and clear it
  } else if (coordinates) {
    editingPoiId.value = null
    newPoiName.value = ''
    newPoiDescription.value = ''
    newPoiIcon.value = 'mdi-map-marker'
    newPoiColor.value = '#FF0000'
    newPoiLat.value = Number(coordinates[0].toFixed(7)) // Still useful to pre-fill for potential direct edit
    newPoiLng.value = Number(coordinates[1].toFixed(7)) // Still useful to pre-fill for potential direct edit
    dialogInitialCoordinates.value = [...coordinates] // Store for saving a new POI
  } else {
    showDialog({
      variant: 'error',
      title: 'Error',
      message: 'Cannot open POI dialog without coordinates for a new POI or POI data for editing.',
    })
    console.error('POI Dialog: Insufficient data to open.')
    return
  }
  poiDialogVisible.value = true
}

const closeDialog = (): void => {
  poiDialogVisible.value = false
  editingPoiId.value = null
  dialogInitialCoordinates.value = null
  // Reset form fields to ensure clean state next time
  newPoiName.value = ''
  newPoiDescription.value = ''
  newPoiLat.value = null
  newPoiLng.value = null
  newPoiIcon.value = 'mdi-map-marker'
  newPoiColor.value = '#FF0000'
  isIconPickerOpen.value = false
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

  // For both new and edit, the form fields (newPoiLat, newPoiLng) are the source of truth if the user edits them.
  const currentFormCoordinates: PointOfInterestCoordinates = [newPoiLat.value, newPoiLng.value]

  if (editingPoiId.value) {
    const poiUpdate: Partial<PointOfInterest> = {
      name: newPoiName.value,
      description: newPoiDescription.value,
      coordinates: currentFormCoordinates, // Use coordinates from form fields for edits
      icon: newPoiIcon.value,
      color: newPoiColor.value,
      timestamp: Date.now(),
    }
    missionStore.updatePointOfInterest(editingPoiId.value, poiUpdate)
  } else {
    // For new POIs, prioritize dialogInitialCoordinates if they exist (meaning they were passed on openDialog)
    // Otherwise, use the (potentially user-modified) coordinates from the form.
    const coordinatesToSave = dialogInitialCoordinates.value ?? currentFormCoordinates

    if (!coordinatesToSave) {
      // This case should ideally not be reached if openDialog is called correctly with coordinates for new POIs.
      showDialog({ variant: 'error', title: 'Error', message: 'Cannot save Point of Interest without coordinates.' })
      console.error(
        'Cannot save new POI: coordinatesToSave is null. dialogInitialCoordinates:',
        dialogInitialCoordinates.value,
        'currentFormCoordinates:',
        currentFormCoordinates
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
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  background-color: transparent;
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
  transition: all 0.2s ease;
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
