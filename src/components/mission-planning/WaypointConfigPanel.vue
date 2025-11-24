<template>
  <div class="flex flex-col h-full w-full justify-start" :style="interfaceStore.globalGlassMenuStyles">
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
        <p class="ml-10 text-center text-[13px] font-normal">
          {{ selectedWaypoint.id === 'home' ? 'Home' : `Waypoint  parameters` }}
        </p>
      </template>
      <template #content>
        <div
          v-if="waypointOnMissionStore?.coordinates"
          class="flex flex-col justify-center w-full items-center py-1 px-2 my-2 bg-[#EEEEEE22] text-white rounded-bl-md rounded-br-md"
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
              class="spaced-number right-aligned-input"
              density="compact"
              theme="dark"
              variant="plain"
            ></v-select>
          </div>
        </div>
      </template>
    </ExpansiblePanel>

    <!-- Commands Section -->
    <ExpansiblePanel
      mark-expanded
      compact
      elevation-effect
      no-bottom-divider
      darken-content
      invert-chevron
      :is-expanded="true"
      class="flex-1 min-h-0"
    >
      <template #title>
        <p class="ml-4 text-center text-[13px] font-normal">
          Waypoint Commands ({{ waypointOnMissionStore?.commands?.length || 0 }})
        </p>
      </template>
      <template #content>
        <div class="flex flex-col -mr-2 pr-1 overflow-y-scroll">
          <!-- Existing Commands -->
          <div v-if="waypointOnMissionStore?.commands?.length" class="flex flex-col gap-2 my-2">
            <div
              v-for="(command, index) in waypointOnMissionStore.commands"
              :key="index"
              class="flex flex-col p-2 bg-[#EEEEEE22] text-white rounded-md"
            >
              <div class="flex justify-between items-center">
                <div class="flex flex-col gap-1 max-w-[80%]">
                  <p class="text-[11px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {{ command.command }}
                  </p>
                  <p class="text-[10px] opacity-75 overflow-hidden text-ellipsis whitespace-nowrap">
                    {{ command.type }}
                  </p>
                  <div class="text-[10px] grid grid-cols-2 gap-1">
                    <span v-if="command.type === MissionCommandType.MAVLINK_NAV_COMMAND">
                      P1: {{ command.param1 }} | P2: {{ command.param2 }}<br />
                      P3: {{ command.param3 }} | P4: {{ command.param4 }}
                    </span>
                    <span v-else-if="command.type === MissionCommandType.MAVLINK_NON_NAV_COMMAND">
                      P1: {{ command.param1 }} | P2: {{ command.param2 }} | P3: {{ command.param3 }}<br />
                      P4: {{ command.param4 }} | P5: {{ command.x }} | P6: {{ command.y }} | P7: {{ command.z }}
                    </span>
                  </div>
                </div>
                <div class="flex flex-col gap-3">
                  <v-btn
                    size="x-small"
                    variant="outlined"
                    icon="mdi-pencil"
                    class="!h-[24px] !w-[24px] !min-w-[24px]"
                    @click="editCommand(index)"
                  />
                  <v-btn
                    size="x-small"
                    variant="outlined"
                    icon="mdi-delete"
                    class="!h-[24px] !w-[24px] !min-w-[24px]"
                    @click="removeCommand(index)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Add New Command Button -->
          <v-btn
            v-if="!showCommandForm"
            class="w-full mb-2 bg-[#62626266] text-white"
            variant="plain"
            size="small"
            prepend-icon="mdi-plus"
            @click="showCommandForm = true"
          >
            Append New Command
          </v-btn>

          <!-- Command Input Form -->
          <CommandInputForm
            v-if="showCommandForm"
            :existing-command="editingCommand"
            :is-editing="editingCommandIndex !== -1"
            @command-ready="handleCommandReady"
            @cancel="handleCommandCancel"
          />
        </div>
      </template>
    </ExpansiblePanel>

    <div class="flex flex-col mt-auto">
      <v-btn
        class="bg-[#00000066] text-white mt-2 mb-1 mx-1"
        variant="plain"
        size="small"
        prepend-icon="mdi-delete"
        @click="handleRemoveWaypoint(selectedWaypoint)"
      >
        Delete waypoint
      </v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import CommandInputForm from '@/components/mission-planning/CommandInputForm.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import {
  AltitudeReferenceType,
  MissionCommand,
  MissionCommandType,
  Waypoint,
  WaypointCoordinates,
} from '@/types/mission'

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
  (event: 'shouldUpdateWaypoints'): void
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

// Command management variables
const showCommandForm = ref(false)
const editingCommand = ref<MissionCommand | undefined>()
const editingCommandIndex = ref(-1)

watch(editableAltitudeRefType, (newType) => {
  if (waypointOnMissionStore.value) {
    waypointOnMissionStore.value.altitudeReferenceType = newType
  }
})

const handleRemoveWaypoint = (waypoint: Waypoint): void => {
  emit('removeWaypoint', waypoint)
  emit('shouldUpdateWaypoints')
}

const availableFrames = Object.values(AltitudeReferenceType).map((value: AltitudeReferenceType) => ({
  name: value,
  value,
}))

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
    handleCommandCancel()
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

const handleCommandReady = (command: MissionCommand): void => {
  if (editingCommandIndex.value >= 0) {
    // Update existing command
    missionStore.updateWaypointCommand(props.selectedWaypoint.id, editingCommandIndex.value, command)
  } else {
    // Add new command
    missionStore.addCommandToWaypoint(props.selectedWaypoint.id, command)
  }
  handleCommandCancel()
}

const handleCommandCancel = (): void => {
  showCommandForm.value = false
  editingCommand.value = undefined
  editingCommandIndex.value = -1
  emit('shouldUpdateWaypoints')
}

const editCommand = (index: number): void => {
  if (!waypointOnMissionStore.value?.commands) return
  editingCommand.value = waypointOnMissionStore.value.commands[index]
  editingCommandIndex.value = index
  showCommandForm.value = true
}

const removeCommand = (index: number): void => {
  missionStore.removeCommandFromWaypoint(props.selectedWaypoint.id, index)
}
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
