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
      <template #title
        ><p class="ml-4 text-center text-[13px] font-normal">
          {{
            selectedWaypoint.id === 'home'
              ? 'Home'
              : `Waypoint  ${missionStore.getWaypointNumber(selectedWaypoint?.id as string)}
          parameters`
          }}
        </p></template
      >
      <template #content>
        <div
          v-if="waypointOnMissionStore?.coordinates"
          class="flex flex-col justify-center w-full items-center py-1 px-2 mb-2 bg-[#EEEEEE22] text-white rounded-bl-md rounded-br-md"
        >
          <div class="flex w-full gap-x-4 my-[4px] justify-between text-[12px] text-center mb-[2px]">
            <p class="w-[50px] text-start">Lat.:</p>
            <input
              v-model="waypointOnMissionStore.coordinates[0]"
              class="fixed right-0 w-[170px] bg-transparent ml-auto h-[15px] border-transparent focus:outline-none text-xs"
            />
            <p class="w-[20px]">°</p>
          </div>
          <v-divider class="border-black w-full" />
          <div class="flex w-full gap-x-4 my-[4px] justify-between text-[12px] text-center">
            <p class="w-[50px] text-start">Long.:</p>

            <input
              v-model="waypointOnMissionStore.coordinates[1]"
              class="fixed right-0 w-[170px] bg-transparent ml-auto h-[15px] border-transparent focus:outline-none text-xs"
            />
            <p class="w-[20px]">°</p>
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
import { AltitudeReferenceType, Waypoint } from '@/types/mission'

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

const editableLat = ref(selectedWaypoint.value.coordinates[0])
const editableLng = ref(selectedWaypoint.value.coordinates[1])
const editableAltitudeRefType = ref<AltitudeReferenceType>(
  waypointOnMissionStore.value?.altitudeReferenceType || AltitudeReferenceType.RELATIVE_TO_HOME
)

watch(editableAltitudeRefType, (newType) => {
  if (waypointOnMissionStore.value) {
    waypointOnMissionStore.value.altitudeReferenceType = newType
  }
})

const handleRemoveWaypoint = (waypoint: Waypoint): void => {
  emit('removeWaypoint', waypoint)
}

const availableFrames = [
  { name: 'Mean sea level, abs.', value: AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL },
  { name: 'Home relative', value: AltitudeReferenceType.RELATIVE_TO_HOME },
  { name: 'Terrain relative', value: AltitudeReferenceType.RELATIVE_TO_TERRAIN },
]

// Update the editable fields when the selected waypoint changes
watch(
  () => props.selectedWaypoint,
  (newWaypoint) => {
    selectedWaypoint.value = newWaypoint
    editableLat.value = newWaypoint.coordinates[0]
    editableLng.value = newWaypoint.coordinates[1]
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
