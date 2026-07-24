<template>
  <div
    class="flex items-center justify-start h-full px-4 mr-1 transition-all cursor-pointer hover:bg-slate-200/30 min-w-[20%] select-none"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    @click="configMenuOpen = true"
  >
    <div class="flex items-center overflow-hidden text-lg font-medium text-white whitespace-nowrap">
      <p class="overflow-x-hidden text-ellipsis">
        {{ store.missionName }}
        <FontAwesomeIcon
          v-if="store.missionNameIsAutomatic"
          icon="fa-pen-to-square"
          size="1x"
          class="ml-2 text-slate-200/30"
        />
      </p>
    </div>
  </div>

  <teleport to="body">
    <v-dialog v-model="configMenuOpen" max-width="624px">
      <v-card class="rounded-lg relative" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-h6 font-weight-bold py-4 text-center">Mission configuration</v-card-title>
        <v-btn icon variant="text" size="small" class="absolute top-4 right-4" @click="cancel">
          <v-icon size="22">mdi-close</v-icon>
        </v-btn>
        <v-card-text class="px-8">
          <p class="text-subtitle-1 font-weight-bold mb-2">Mission Name</p>
          <v-text-field
            :model-value="stagedName"
            variant="outlined"
            density="compact"
            theme="dark"
            hide-details
            @update:model-value="onNameInput"
          />
          <div class="flex justify-between items-center mt-2">
            <v-btn variant="text" size="small" class="px-0 text-white" @click="finishCurrentMission">
              Reset current mission
            </v-btn>
            <v-btn variant="text" size="small" class="px-0 text-white" @click="generateNewName">
              Generate new name
            </v-btn>
          </div>
        </v-card-text>
        <v-divider class="mt-2 mx-10" />
        <v-card-actions>
          <div class="flex justify-between items-center pa-2 w-full h-full">
            <v-btn variant="text" @click="cancel">Cancel</v-btn>
            <v-btn :disabled="!canSave" @click="save">Save</v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { generateAutomaticMissionName } from '@/libs/mission/automatic-name'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget } from '@/types/widgets'

/**
 * Props for the MissionIdentifier component
 */
const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const store = useMissionStore()
const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { showDialog, closeDialog } = useInteractionDialog()

const configMenuOpen = computed({
  get: () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  set: (value: boolean) => (widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = value),
})

const stagedName = ref('')
const stagedIsAutomatic = ref(true)

const canSave = computed(() => {
  const name = stagedName.value.trim()
  return !!name && name !== store.missionName
})

watch(configMenuOpen, (open) => {
  if (!open) return
  logUserAction('Opened the mission configuration menu')
  stagedName.value = store.missionName
  stagedIsAutomatic.value = store.missionNameIsAutomatic
})

const onNameInput = (value: string): void => {
  stagedName.value = value
  stagedIsAutomatic.value = false
}

const generateNewName = (): void => {
  logUserAction('Generated a new automatic mission name')
  stagedName.value = generateAutomaticMissionName()
  stagedIsAutomatic.value = true
}

// Resetting closes the running mission and starts a new cycle, which cannot be undone, so it always asks first.
const confirmMissionReset = (reset: () => void): void => {
  showDialog({
    title: 'Reset mission?',
    message: 'The current mission will be closed and a new one started with a new automatic name.',
    variant: 'warning',
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction('Cancelled the mission reset')
          closeDialog()
        },
      },
      {
        text: 'Reset mission',
        action: () => {
          closeDialog()
          reset()
        },
      },
    ],
  })
}

const finishCurrentMission = (): void => {
  confirmMissionReset(() => {
    logUserAction('Reset the current mission')
    const newName = generateAutomaticMissionName()
    store.applyMissionName(newName, { isAutomatic: true, startNewMission: true })
    stagedName.value = newName
    stagedIsAutomatic.value = true
  })
}

const cancel = (): void => {
  logUserAction('Closed the mission configuration menu without saving')
  configMenuOpen.value = false
}

const saveLocalMissionName = (name: string, isAutomatic: boolean): void => {
  showDialog({
    title: 'New mission?',
    message: 'Do you want to start a new mission with this name, or just rename the current mission?',
    variant: 'info',
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction('Cancelled the mission name change')
          closeDialog()
        },
      },
      {
        text: 'Rename current mission',
        action: () => {
          logUserAction('Renamed the current mission')
          store.applyMissionName(name, { isAutomatic, startNewMission: false })
          closeDialog()
          configMenuOpen.value = false
        },
      },
      {
        text: 'Start new mission',
        action: () => {
          logUserAction('Started a new mission from the mission name change')
          store.applyMissionName(name, { isAutomatic, startNewMission: true })
          closeDialog()
          configMenuOpen.value = false
        },
      },
    ],
  })
}

const save = (): void => {
  const name = stagedName.value.trim()
  if (!name || name === store.missionName) {
    configMenuOpen.value = false
    return
  }
  saveLocalMissionName(name, stagedIsAutomatic.value)
}
</script>
