<template>
  <div class="command-form">
    <div class="flex flex-col gap-2 p-3 bg-[#EEEEEE22] text-white rounded-md">
      <!-- Command Type Selection -->
      <div class="flex w-full gap-x-4 justify-between items-center text-[12px]">
        <p class="w-[120px] text-start">Command Type:</p>
        <v-select
          v-model="selectedCommandType"
          :items="commandTypeOptions"
          item-title="name"
          item-value="value"
          hide-details
          attach
          class="spaced-number right-aligned-input"
          density="compact"
          theme="dark"
          variant="plain"
          @update:model-value="onCommandTypeChange"
        ></v-select>
      </div>

      <!-- MAVLink Command Selection -->
      <div v-if="selectedCommandType" class="flex w-full gap-x-4 justify-between items-center text-[12px]">
        <p class="w-[120px] text-start">MAV Command:</p>
        <v-select
          v-model="selectedMavCommand"
          :items="availableMavCommands"
          item-title="name"
          item-value="value"
          hide-details
          attach
          class="spaced-number right-aligned-input"
          density="compact"
          theme="dark"
          variant="plain"
          @update:model-value="onMavCommandChange"
        ></v-select>
      </div>

      <!-- Parameter Inputs -->
      <div v-if="selectedMavCommand" class="flex flex-col gap-2">
        <v-divider class="border-black w-full" />
        <div class="text-[11px] font-semibold text-center mt-2">Command Parameters</div>

        <!-- Nav Command Parameters (4 params) -->
        <template v-if="selectedCommandType === MissionCommandType.MAVLINK_NAV_COMMAND">
          <div
            v-for="paramNum in 4"
            :key="paramNum"
            class="flex w-full gap-x-4 justify-between items-center text-[12px]"
          >
            <p class="w-[80px] text-start">Param {{ paramNum }}:</p>
            <div class="flex w-full pr-2 h-[35px] items-center">
              <v-text-field
                v-model.number="commandParams[`param${paramNum}`]"
                type="number"
                step="any"
                density="compact"
                variant="plain"
                hide-details
                class="spaced-number right-aligned-input w-[100px] text-right -mr-3"
              ></v-text-field>
            </div>
          </div>
        </template>

        <!-- Non-Nav Command Parameters (7 params) -->
        <template v-if="selectedCommandType === MissionCommandType.MAVLINK_NON_NAV_COMMAND">
          <div
            v-for="paramNum in 7"
            :key="paramNum"
            class="flex w-full gap-x-4 justify-between items-center text-[12px]"
          >
            <p class="w-[120px] text-start">
              Param {{ paramNum }} {{ paramNum === 5 ? '(x)' : paramNum === 6 ? '(y)' : paramNum === 7 ? '(z)' : '' }}:
            </p>
            <div class="flex w-full pr-2 h-[35px] items-center">
              <v-text-field
                v-model.number="
                  commandParams[paramNum <= 4 ? `param${paramNum}` : paramNum === 5 ? 'x' : paramNum === 6 ? 'y' : 'z']
                "
                type="number"
                step="any"
                density="compact"
                variant="plain"
                hide-details
                class="spaced-number right-aligned-input w-[100px] text-right -mr-3"
              ></v-text-field>
            </div>
          </div>
        </template>
      </div>

      <!-- Action Buttons -->
      <div v-if="selectedMavCommand" class="flex gap-2 mt-3">
        <v-btn size="small" variant="outlined" @click="addCommand"> {{ isEditing ? 'Update' : 'Add' }} </v-btn>
        <v-btn size="small" variant="outlined" @click="cancelCommand"> Cancel </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { MissionCommand, MissionCommandType } from '@/types/mission'

const props = defineProps<{
  /**
   * Existing command to edit (optional)
   */
  existingCommand?: MissionCommand
  /**
   * Whether this is an edit operation
   */
  isEditing?: boolean
}>()

const emit = defineEmits<{
  (event: 'commandReady', command: MissionCommand): void
  (event: 'cancel'): void
}>()

const selectedCommandType = ref<MissionCommandType | null>(null)
const selectedMavCommand = ref<MavCmd | null>(null)

const commandParams = reactive<Record<string, number>>({
  param1: 0,
  param2: 0,
  param3: 0,
  param4: 0,
  x: 0,
  y: 0,
  z: 0,
})

const commandTypeOptions = [
  { name: 'MAVLink Navigation Command', value: MissionCommandType.MAVLINK_NAV_COMMAND },
  { name: 'MAVLink Non-Navigation Command', value: MissionCommandType.MAVLINK_NON_NAV_COMMAND },
]

// Helper function to convert MAV_CMD enum to display name
const formatCommandName = (command: string): string => {
  return command.replace('MAV_CMD_', '').replace('NAV_', ' ')
}

// Generate command options from MavCmd enum
const allNavCommands = computed(() => {
  return Object.values(MavCmd)
    .filter((cmd) => cmd.startsWith('MAV_CMD_NAV_'))
    .map((cmd) => ({
      name: formatCommandName(cmd),
      value: cmd,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const allNonNavCommands = computed(() => {
  return Object.values(MavCmd)
    .filter((cmd) => cmd.startsWith('MAV_CMD_') && !cmd.startsWith('MAV_CMD_NAV_'))
    .map((cmd) => ({
      name: formatCommandName(cmd),
      value: cmd,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const availableMavCommands = computed(() => {
  if (selectedCommandType.value === MissionCommandType.MAVLINK_NAV_COMMAND) {
    return allNavCommands.value
  } else if (selectedCommandType.value === MissionCommandType.MAVLINK_NON_NAV_COMMAND) {
    return allNonNavCommands.value
  }
  return []
})

const onCommandTypeChange = (): void => {
  selectedMavCommand.value = null
  resetParams()
}

const onMavCommandChange = (): void => {
  resetParams()
}

const resetParams = (): void => {
  Object.keys(commandParams).forEach((key) => {
    commandParams[key] = 0
  })
}

const addCommand = (): void => {
  if (!selectedCommandType.value || !selectedMavCommand.value) return

  const command: MissionCommand =
    selectedCommandType.value === MissionCommandType.MAVLINK_NAV_COMMAND
      ? {
          type: MissionCommandType.MAVLINK_NAV_COMMAND,
          command: selectedMavCommand.value,
          param1: commandParams.param1,
          param2: commandParams.param2,
          param3: commandParams.param3,
          param4: commandParams.param4,
        }
      : {
          type: MissionCommandType.MAVLINK_NON_NAV_COMMAND,
          command: selectedMavCommand.value,
          param1: commandParams.param1,
          param2: commandParams.param2,
          param3: commandParams.param3,
          param4: commandParams.param4,
          x: commandParams.x,
          y: commandParams.y,
          z: commandParams.z,
        }

  emit('commandReady', command)
  resetForm()
}

const cancelCommand = (): void => {
  emit('cancel')
  resetForm()
}

const resetForm = (): void => {
  selectedCommandType.value = null
  selectedMavCommand.value = null
  resetParams()
}

// Initialize form with existing command if editing
watch(
  () => props.existingCommand,
  (command) => {
    if (command && props.isEditing) {
      selectedCommandType.value = command.type
      selectedMavCommand.value = command.command
      commandParams.param1 = command.param1
      commandParams.param2 = command.param2
      commandParams.param3 = command.param3
      commandParams.param4 = command.param4

      if (command.type === MissionCommandType.MAVLINK_NON_NAV_COMMAND) {
        commandParams.x = command.x
        commandParams.y = command.y
        commandParams.z = command.z
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
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
