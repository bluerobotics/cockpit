<template>
  <div
    class="flex items-center justify-start h-full px-4 mr-1 transition-all cursor-pointer hover:bg-slate-200/30 min-w-[20%] select-none"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    @click="configMenuOpen = true"
  >
    <div class="flex items-center overflow-hidden text-lg font-medium text-white whitespace-nowrap">
      <p class="overflow-x-hidden text-ellipsis">
        {{ $t(store.missionName) }}
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
        <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{ t('Mission configuration') }}</v-card-title>
        <v-card-text class="px-8">
          <p class="text-subtitle-1 font-weight-bold mb-2">{{ t('Mission Name') }}</p>
          <v-text-field
            :model-value="stagedName"
            append-inner-icon="mdi-close"
            variant="outlined"
            density="compact"
            theme="dark"
            hide-details
            @update:model-value="onNameInput"
            @click:append-inner="restoreLastMissionName"
          />
          <div class="flex justify-end mt-2">
            <v-btn variant="text" size="small" class="px-0 text-white" @click="generateNewName">
              {{ t('Generate new name') }}
            </v-btn>
          </div>
        </v-card-text>
        <v-divider class="mt-2 mx-10" />
        <v-card-actions>
          <div class="flex justify-between items-center pa-2 w-full h-full">
            <v-btn variant="text" @click="cancel">{{ t('Cancel') }}</v-btn>
            <v-btn :disabled="!hasChanges" @click="save">{{ t('Save') }}</v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
const { t } = useI18n()

const configMenuOpen = computed({
  get: () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  set: (value: boolean) => (widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = value),
})

const stagedName = ref('')
const stagedIsAutomatic = ref(true)

const hasChanges = computed(() => {
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

const restoreLastMissionName = (): void => {
  logUserAction('Restored the last used mission name')
  stagedName.value = store.lastMissionName
  stagedIsAutomatic.value = false
}

const generateNewName = (): void => {
  logUserAction('Generated a new automatic mission name')
  stagedName.value = generateAutomaticMissionName()
  stagedIsAutomatic.value = true
}

const cancel = (): void => {
  logUserAction('Closed the mission configuration menu without saving')
  configMenuOpen.value = false
}

const save = (): void => {
  const name = stagedName.value.trim()
  if (!name || name === store.missionName) {
    configMenuOpen.value = false
    return
  }
  const isAutomatic = stagedIsAutomatic.value
  showDialog({
    title: t('New mission?'),
    message: t('Do you want to start a new mission with this name, or just rename the current mission?'),
    variant: 'info',
    actions: [
      {
        text: t('Cancel'),
        action: () => {
          logUserAction('Cancelled the mission name change')
          closeDialog()
        },
      },
      {
        text: t('Rename current mission'),
        action: () => {
          logUserAction('Renamed the current mission')
          store.applyMissionName(name, { isAutomatic, startNewMission: false })
          closeDialog()
          configMenuOpen.value = false
        },
      },
      {
        text: t('Start new mission'),
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
</script>
