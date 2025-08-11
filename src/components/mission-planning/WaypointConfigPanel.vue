<template>
  <div class="main-panel flex flex-col h-full" :style="interfaceStore.globalGlassMenuStyles">
    <ExpansiblePanel
      mark-expanded
      compact
      elevation-effect
      no-bottom-divider
      darken-content
      invert-chevron
      :is-expanded="true"
    >
      <template #title>
        <p class="ml-4 text-center text-[13px] font-normal">
          {{
            selectedWaypoint.id === 'home'
              ? 'Home'
              : `Waypoint  ${missionStore.getWaypointNumber(selectedWaypoint?.id as string)}
          parameters`
          }}
        </p>
      </template>
      <template #content>
        <div
          v-if="waypointOnMissionStore?.coordinates"
          class="flex flex-col justify-center w-full items-center py-1 px-2 mb-2 bg-[#EEEEEE22] text-white rounded-bl-md rounded-br-md"
        >
          <div class="flex w-full gap-x-4 my-[4px] justify-between text-[12px] text-center mb-[2px]">
            <p class="w-[50px] text-start">Latitude:</p>
            <input
              :value="editableLat"
              class="text-right w-[130px] mt-[2px] bg-transparent h-[15px] border-transparent focus:outline-none text-xs"
              @input="onLatInput"
            />
            <p class="w-[20px]">°</p>
          </div>
          <v-divider class="border-black w-full" />
          <div class="flex w-full gap-x-4 my-[4px] justify-between text-[12px] text-center pt-[1px]">
            <p class="w-[50px] text-start">Longitude:</p>
            <input
              :value="editableLng"
              class="text-right w-[130px] mt-[2px] bg-transparent h-[15px] border-transparent focus:outline-none text-xs"
              @input="onLngInput"
            />
            <p class="w-[20px] mt-[2px]">°</p>
          </div>
          <v-divider class="border-black w-full" />
          <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
            <p class="w-[140px] text-start">Altitude:</p>
            <div class="flex w-full pr-2 h-[35px] items-center">
              <v-text-field
                v-model="waypointOnMissionStore.altitude"
                type="number"
                density="compact"
                variant="plain"
                hide-details
                class="spaced-number right-aligned-input w-[60px] text-right -mr-3"
              ></v-text-field>
              <p class="w-[15px] text-center">m</p>
            </div>
          </div>
          <v-divider class="border-black w-full" />
          <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
            <p class="w-[80px] mt-1 text-start">MAVFrame:</p>
            <v-select
              v-model="waypointOnMissionStore.altitudeReferenceType"
              :items="availableFrames"
              item-title="name"
              item-value="value"
              hide-details
              attach
              class="mb-2 spaced-number right-aligned-input"
              density="compact"
              theme="dark"
              variant="plain"
            ></v-select>
          </div>
          <v-divider class="border-black w-full" />
          <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
            <p class="w-[80px] mt-1 text-start">Type:</p>
            <v-select
              v-model="selectedWaypointType"
              :items="availableWaypointTypes"
              item-title="name"
              item-value="value"
              hide-details
              attach
              class="mb-2 spaced-number right-aligned-input"
              density="compact"
              theme="dark"
              variant="plain"
              @update:model-value="handleWaypointTypeChange"
            ></v-select>
          </div>

          <!-- MAVLink Parameters - only show for generic waypoints -->
          <template v-if="selectedWaypointType === WaypointType.MAVLINK_GENERIC">
            <v-divider class="border-black w-full" />
            <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
              <p class="w-[80px] mt-1 text-start">Command:</p>
              <div class="flex w-full pr-2 h-[35px] items-center">
                <v-text-field
                  v-model="commandValue"
                  type="text"
                  density="compact"
                  variant="plain"
                  hide-details
                  placeholder="MAV_CMD_NAV_WAYPOINT"
                  class="spaced-number right-aligned-input w-[120px] text-right -mr-3"
                  @input="updateParameter('command', $event.target.value)"
                ></v-text-field>
              </div>
            </div>

            <v-divider class="border-black w-full" />
            <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
              <p class="w-[132px] mt-1 text-start">Parameter 1:</p>
              <div class="flex w-full pr-2 h-[35px] items-center">
                <v-text-field
                  v-model="param1Value"
                  type="text"
                  density="compact"
                  variant="plain"
                  hide-details
                  class="spaced-number right-aligned-input w-[60px] text-right -mr-3"
                  @input="updateParameter('param1', $event.target.value)"
                ></v-text-field>
              </div>
            </div>

            <v-divider class="border-black w-full" />
            <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
              <p class="w-[132px] mt-1 text-start">Parameter 2:</p>
              <div class="flex w-full pr-2 h-[35px] items-center">
                <v-text-field
                  v-model="param2Value"
                  type="text"
                  density="compact"
                  variant="plain"
                  hide-details
                  class="spaced-number right-aligned-input w-[60px] text-right -mr-3"
                  @input="updateParameter('param2', $event.target.value)"
                ></v-text-field>
              </div>
            </div>

            <v-divider class="border-black w-full" />
            <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
              <p class="w-[132px] mt-1 text-start">Parameter 3:</p>
              <div class="flex w-full pr-2 h-[35px] items-center">
                <v-text-field
                  v-model="param3Value"
                  type="text"
                  density="compact"
                  variant="plain"
                  hide-details
                  class="spaced-number right-aligned-input w-[60px] text-right -mr-3"
                  @input="updateParameter('param3', $event.target.value)"
                ></v-text-field>
              </div>
            </div>

            <v-divider class="border-black w-full" />
            <div class="flex w-full gap-x-4 h-[30px] justify-between items-center text-[12px] text-center">
              <p class="w-[132px] mt-1 text-start">Parameter 4:</p>
              <div class="flex w-full pr-2 h-[35px] items-center">
                <v-text-field
                  v-model="param4Value"
                  type="text"
                  density="compact"
                  variant="plain"
                  hide-details
                  class="spaced-number right-aligned-input w-[60px] text-right -mr-3"
                  @input="updateParameter('param4', $event.target.value)"
                ></v-text-field>
              </div>
            </div>
          </template>
        </div>
      </template>
    </ExpansiblePanel>
    <v-btn
      class="absolute bg-[#00000066] text-white bottom-2 right-2"
      variant="plain"
      size="small"
      prepend-icon="mdi-delete"
      @click="handleRemoveWaypoint(selectedWaypoint)"
    >
      Delete
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { AltitudeReferenceType, Waypoint, WaypointCoordinates, WaypointType } from '@/types/mission'

const { currentPlanningWaypoints } = useMissionStore()

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()

const props = defineProps<{
  /**
   * Waypoint to be edited
   */
  selectedWaypoint: Waypoint
}>()

const emit = defineEmits<{
  (event: 'removeWaypoint', waypoint: Waypoint): void
}>()

const selectedWaypoint = ref(props.selectedWaypoint)

const waypointOnMissionStore = computed(() =>
  missionStore.currentPlanningWaypoints.find((waypoint) => waypoint.id === selectedWaypoint.value.id)
)

const editableLat = ref<string>(selectedWaypoint.value.coordinates[0].toString())
const editableLng = ref<string>(selectedWaypoint.value.coordinates[1].toString())
const editableAltitudeRefType = ref<AltitudeReferenceType>(
  waypointOnMissionStore.value?.altitudeReferenceType || AltitudeReferenceType.RELATIVE_TO_HOME
)
const selectedWaypointType = ref<WaypointType>(waypointOnMissionStore.value?.type || WaypointType.PASS_BY)

// Parameter values for generic MAVLink waypoints
const commandValue = ref<string>('MAV_CMD_NAV_WAYPOINT')
const param1Value = ref<string>('0')
const param2Value = ref<string>('0')
const param3Value = ref<string>('0')
const param4Value = ref<string>('0')

watch(editableAltitudeRefType, (newType) => {
  if (waypointOnMissionStore.value) {
    waypointOnMissionStore.value.altitudeReferenceType = newType
  }
})

const handleRemoveWaypoint = (waypoint: Waypoint): void => {
  emit('removeWaypoint', waypoint)
}

const availableFrames = Object.values(AltitudeReferenceType).map((value: AltitudeReferenceType) => ({
  name: value,
  value,
}))

const availableWaypointTypes = Object.values(WaypointType).map((value: WaypointType) => ({
  name: value,
  value,
}))

const handleWaypointTypeChange = (newType: WaypointType): void => {
  if (waypointOnMissionStore.value) {
    missionStore.updateWaypointType(selectedWaypoint.value.id, newType)

    // If switching to generic type, ensure parameters are set
    if (newType === WaypointType.MAVLINK_GENERIC) {
      updateParameter('command', commandValue.value)
      updateParameter('param1', param1Value.value)
      updateParameter('param2', param2Value.value)
      updateParameter('param3', param3Value.value)
      updateParameter('param4', param4Value.value)
    }
  }
}

const updateParameter = (paramName: 'command' | 'param1' | 'param2' | 'param3' | 'param4', value: string): void => {
  console.log('updateParameter:')
  console.log(paramName)
  console.log(value)
  console.log('------------------------------------')
  const waypoint = currentPlanningWaypoints.find((w) => w.id === selectedWaypoint.value.id)
  if (waypoint) {
    waypoint[paramName] = value
  }
}

const onLatInput = (event: Event): void => {
  const input = event.target as HTMLInputElement
  editableLat.value = input.value
  commitCoordinates()
}

const onLngInput = (event: Event): void => {
  const input = event.target as HTMLInputElement
  editableLng.value = input.value
  commitCoordinates()
}

const commitCoordinates = (): void => {
  if (isNaN(parseFloat(editableLat.value)) || isNaN(parseFloat(editableLng.value))) {
    return
  }
  missionStore.moveWaypoint(props.selectedWaypoint.id, [
    editableLat.value as unknown as WaypointCoordinates[0],
    editableLng.value as unknown as WaypointCoordinates[1],
  ])
}

watch(
  () => props.selectedWaypoint,
  (newWaypoint) => {
    selectedWaypoint.value = newWaypoint
    editableLat.value = newWaypoint.coordinates[0].toString()
    editableLng.value = newWaypoint.coordinates[1].toString()
    selectedWaypointType.value = newWaypoint.type

    // Update parameter values
    commandValue.value = newWaypoint.command || 'MAV_CMD_NAV_WAYPOINT'
    param1Value.value = newWaypoint.param1 || '0'
    param2Value.value = newWaypoint.param2 || '0'
    param3Value.value = newWaypoint.param3 || '0'
    param4Value.value = newWaypoint.param4 || '0'
  }
)

// Update editable coordinates when waypoint changes by mouse drag
watch(
  () => waypointOnMissionStore.value?.coordinates,
  (newCoords) => {
    if (newCoords) {
      editableLat.value = newCoords[0].toString()
      editableLng.value = newCoords[1].toString()
    }
  }
)

// Update waypoint type when it changes in the store
watch(
  () => waypointOnMissionStore.value?.type,
  (newType) => {
    if (newType) {
      selectedWaypointType.value = newType
    }
  }
)

// Update parameter values when they change in the store
watch(
  () => [
    waypointOnMissionStore.value?.command,
    waypointOnMissionStore.value?.param1,
    waypointOnMissionStore.value?.param2,
    waypointOnMissionStore.value?.param3,
    waypointOnMissionStore.value?.param4,
  ],
  ([command, param1, param2, param3, param4]) => {
    commandValue.value = command || 'MAV_CMD_NAV_WAYPOINT'
    param1Value.value = param1 || '0'
    param2Value.value = param2 || '0'
    param3Value.value = param3 || '0'
    param4Value.value = param4 || '0'
  }
)
</script>
<style>
v-menu__content {
  z-index: 601 !important;
}

.right-aligned-input input {
  text-align: right !important;
  padding-right: 10px !important;
  font-size: 12px !important;
}

.v-field {
  font-size: 14px !important;
  text-align: right !important;
}

.spaced-number input[type='number']::-webkit-inner-spin-button {
  margin-left: 6px;
}
</style>
