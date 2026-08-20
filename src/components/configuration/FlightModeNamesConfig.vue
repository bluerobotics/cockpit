<template>
  <div class="flex flex-col w-full px-2 pt-3 pb-4">
    <div class="flex flex-row items-center justify-between w-full mb-4">
      <v-select
        :model-value="selectedVehicleType"
        :items="vehicleTypesWithNames"
        label="Vehicle"
        variant="filled"
        density="compact"
        hide-details
        theme="dark"
        class="max-w-[200px]"
        @update:model-value="setSelectedVehicleType"
      />
      <v-btn variant="text" size="small" :disabled="!hasCustomNames" @click="resetModeNamesToDefault">
        Reset names to ArduPilot defaults
      </v-btn>
    </div>
    <div class="grid gap-x-8 gap-y-2" :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'">
      <div v-for="modeName in modeNamesToShow" :key="modeName" class="flex flex-row items-center">
        <div class="w-[45%] text-sm opacity-70 truncate">{{ modeName }}</div>
        <v-text-field
          :model-value="editedNames[modeName] ?? displayNameOf(modeName)"
          variant="filled"
          density="compact"
          hide-details
          theme="dark"
          class="w-[55%]"
          @update:model-value="(value: string) => (editedNames[modeName] = value)"
          @change="setModeName(modeName)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { humanizeString } from '@/libs/utils'
import { defaultFlightModeNames, flightModeName } from '@/libs/vehicle/ardupilot/mode-names'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const interfaceStore = useAppInterfaceStore()
const mainVehicleStore = useMainVehicleStore()

const vehicleTypesWithNames = Object.keys(defaultFlightModeNames).map((type) => ({
  title: humanizeString(type),
  value: type as VehicleType,
}))

const selectedVehicleType = ref<VehicleType>(mainVehicleStore.ardupilotVehicleType ?? VehicleType.Sub)

// What is being typed on each name field, dropped once saved so the field goes back to showing the resolved name
const editedNames = ref<Record<string, string>>({})

const modeNamesToShow = computed(() => Object.keys(defaultFlightModeNames[selectedVehicleType.value] ?? {}))

const customNamesForSelectedVehicle = computed(
  () => mainVehicleStore.customFlightModeNames[selectedVehicleType.value] ?? {}
)

const hasCustomNames = computed(() => Object.keys(customNamesForSelectedVehicle.value).length > 0)

const displayNameOf = (modeName: string): string => {
  return flightModeName(modeName, selectedVehicleType.value, mainVehicleStore.customFlightModeNames)
}

const saveCustomNames = (customNames: Record<string, string>): void => {
  const allCustomNames = { ...mainVehicleStore.customFlightModeNames, [selectedVehicleType.value]: customNames }
  if (Object.keys(customNames).length === 0) delete allCustomNames[selectedVehicleType.value]
  mainVehicleStore.customFlightModeNames = allCustomNames
  editedNames.value = {}
}

const setSelectedVehicleType = (value: unknown): void => {
  logUserAction(`Switched the flight mode names to the ones of the ${humanizeString(value as string)}`)
  selectedVehicleType.value = value as VehicleType
  editedNames.value = {}
}

const setModeName = (modeName: string): void => {
  const newName = (editedNames.value[modeName] ?? '').trim()
  const isArdupilotName = newName === '' || newName === defaultFlightModeNames[selectedVehicleType.value]?.[modeName]
  const customNames = { ...customNamesForSelectedVehicle.value }

  if (isArdupilotName) {
    delete customNames[modeName]
    logUserAction(`Reset the name of the '${modeName}' flight mode`)
  } else {
    customNames[modeName] = newName
    logUserAction(`Renamed the '${modeName}' flight mode to '${newName}'`)
  }

  saveCustomNames(customNames)
}

const resetModeNamesToDefault = (): void => {
  const vehicleName = humanizeString(selectedVehicleType.value)
  logUserAction(`Reset the flight mode names of the ${vehicleName} to the ArduPilot ones`)
  saveCustomNames({})
}
</script>
