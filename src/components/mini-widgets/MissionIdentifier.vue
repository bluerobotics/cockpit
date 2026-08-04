<template>
  <div
    class="flex items-center justify-start h-full px-4 mr-1 cursor-pointer min-w-[20%] select-none"
    :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'"
    @click="configMenuOpen = true"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="flex items-center overflow-hidden text-lg font-medium text-white whitespace-nowrap">
      <p class="min-w-0 overflow-x-hidden text-ellipsis">{{ store.missionName }}</p>
      <FontAwesomeIcon
        icon="fa-pen-to-square"
        size="1x"
        class="ml-2 shrink-0 text-slate-200/30 mb-1"
        :class="isHovered ? 'opacity-100' : 'opacity-0'"
      />
    </div>
  </div>

  <teleport to="body">
    <v-dialog v-model="configMenuOpen" max-width="624px">
      <v-card class="rounded-lg relative" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-h6 font-weight-bold py-4 text-center">Mission configuration</v-card-title>
        <v-btn icon variant="text" size="small" aria-label="Close" class="absolute top-4 right-4" @click="cancel">
          <v-icon size="22">mdi-close</v-icon>
        </v-btn>
        <v-card-text class="px-8">
          <template v-if="isCloudActive">
            <!-- No mission associated with this cycle yet: choose continue / select / create. -->
            <div v-if="!hasMissionThisCycle" class="py-2">
              <BlueOsCloudMissionDecisionOptions
                :previous-mission="previousCloudMission"
                @continue-previous="continuePreviousMission"
                @select-existing="openExistingMissionPicker"
                @create-new="openCreateMissionForm"
              />
            </div>

            <!-- A mission is associated: show its details (read-only) and its cloud sync status. -->
            <div v-else class="flex flex-col gap-4">
              <div class="flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <p class="text-caption opacity-70 mb-1">Name</p>
                  <p class="text-body-1 font-weight-medium ma-0 truncate">
                    {{ linkedCloudMission?.title || 'Untitled mission' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <v-btn variant="text" size="small" class="text-white" @click="openEditMissionForm"
                    >Edit mission</v-btn
                  >
                  <v-btn variant="text" size="small" class="text-white" @click="finishCloudMission">
                    Reset mission
                  </v-btn>
                </div>
              </div>
              <div class="min-w-0">
                <p class="text-caption opacity-70 mb-1">Description</p>
                <p class="text-body-2 ma-0">{{ linkedCloudMission?.description || 'Not set' }}</p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <p class="text-caption opacity-70 mb-1">Location</p>
                  <p class="text-body-2 ma-0">{{ linkedMissionLocationText }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <v-icon size="18" color="light-blue-lighten-2">{{ cloudIndicatorIcon }}</v-icon>
                  <span class="text-body-2">
                    <template v-if="cloudStore.isLinkedMissionSynced">
                      Synced with BlueOS Cloud ·
                      <a
                        :href="linkedCloudMissionUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-light-blue-lighten-2 hover:underline"
                      >
                        View mission
                      </a>
                    </template>
                    <template v-else>Saved locally · will upload when online.</template>
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- Not signed in to BlueOS Cloud (or not in pirate mode): the classic local mission behavior. -->
          <template v-else>
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
            <v-btn
              v-if="interfaceStore.pirateMode"
              variant="text"
              size="small"
              class="px-0 mt-4 text-white"
              prepend-icon="mdi-cloud-outline"
              @click="openCloudSettings"
            >
              <span class="text-caption normal-case"> Log in to BlueOS Cloud to manage and sync your missions </span>
            </v-btn>
          </template>
        </v-card-text>
        <v-divider class="mt-2 mx-10" />
        <v-card-actions>
          <div class="flex justify-between items-center pa-2 w-full h-full">
            <template v-if="isCloudActive">
              <v-spacer />
              <v-btn variant="text" @click="cancel">Close</v-btn>
            </template>
            <template v-else>
              <v-btn variant="text" @click="cancel">Cancel</v-btn>
              <v-btn
                variant="flat"
                theme="dark"
                class="bg-[#FFFFFF33] text-white disabled:opacity-40"
                :disabled="!canSaveNonCloud"
                @click="save"
              >
                Save
              </v-btn>
            </template>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <BlueOsCloudMissionPicker
      v-model="showExistingMissionPicker"
      title="Select a BlueOS Cloud mission"
      description="Pick a mission to continue logging to."
      @selected="selectExistingMission"
    />
    <BlueOsCloudMissionForm
      v-model="showMissionForm"
      :mode="missionForm.mode"
      :initial-name="missionForm.name"
      :initial-description="missionForm.description"
      :initial-location="missionForm.location"
      @submit="onMissionFormSubmit"
    />
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue'

import BlueOsCloudMissionDecisionOptions from '@/components/blueos-cloud/BlueOsCloudMissionDecisionOptions.vue'
import BlueOsCloudMissionForm from '@/components/blueos-cloud/BlueOsCloudMissionForm.vue'
import BlueOsCloudMissionPicker from '@/components/blueos-cloud/BlueOsCloudMissionPicker.vue'
import { type MissionFormSubmitPayload, useBlueOsCloudMission } from '@/composables/blueos-cloud/useBlueOsCloudMission'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { buildBlueOsCloudMissionUrl } from '@/libs/blueos-cloud/api'
import { generateAutomaticMissionName } from '@/libs/mission/automatic-name'
import { SubMenuComponentName, SubMenuName, useAppInterfaceStore } from '@/stores/appInterface'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { WaypointCoordinates } from '@/types/mission'
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
const cloudStore = useBlueOsCloudStore()
const { showDialog, closeDialog } = useInteractionDialog()
const {
  isCloudActive,
  hasMissionThisCycle,
  previousMission: previousCloudMission,
  ensureLinkedMissionLoaded,
  continuePreviousMission,
  selectExistingMission,
  createMission,
  editLinkedMission,
} = useBlueOsCloudMission()

const configMenuOpen = computed({
  get: () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  set: (value: boolean) => (widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = value),
})

const stagedName = ref('')
const stagedIsAutomatic = ref(true)
const isHovered = ref(false)
const showExistingMissionPicker = ref(false)
const showMissionForm = ref(false)

// Grouped so opening the form in either mode always sets every field it prefills.
const missionForm = ref<{
  /**
   * Whether the form creates a new mission or edits the linked one.
   */
  mode: 'create' | 'edit'
  /**
   * Mission name to prefill.
   */
  name: string
  /**
   * Mission description to prefill.
   */
  description: string
  /**
   * Mission start location to prefill.
   */
  location: WaypointCoordinates | null
}>({ mode: 'create', name: '', description: '', location: null })

const linkedCloudMission = computed(() => cloudStore.linkedMission)

const linkedCloudMissionUrl = computed(() =>
  linkedCloudMission.value ? buildBlueOsCloudMissionUrl(linkedCloudMission.value.id) : ''
)

const linkedMissionLocation = computed<WaypointCoordinates | null>(() => {
  const mission = linkedCloudMission.value
  if (!mission?.start_latitude || !mission?.start_longitude) return null
  const lat = parseFloat(mission.start_latitude)
  const lng = parseFloat(mission.start_longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
})

const linkedMissionLocationText = computed(() => {
  const location = linkedMissionLocation.value
  if (!location) return 'Not set'
  return `${location[0].toFixed(6)}, ${location[1].toFixed(6)}`
})

const cloudIndicatorIcon = computed(() =>
  cloudStore.isLinkedMissionSynced ? 'mdi-cloud-check-outline' : 'mdi-cloud-clock-outline'
)

const canSaveNonCloud = computed(() => {
  const name = stagedName.value.trim()
  return !!name && name !== store.missionName
})

watch(configMenuOpen, (open) => {
  if (!open) return
  logUserAction('Opened the mission configuration menu')
  stagedName.value = store.missionName
  stagedIsAutomatic.value = store.missionNameIsAutomatic
  if (isCloudActive.value) void ensureLinkedMissionLoaded()
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

const openExistingMissionPicker = (): void => {
  logUserAction('Opened the BlueOS Cloud mission picker')
  showExistingMissionPicker.value = true
}

const openCreateMissionForm = (): void => {
  logUserAction('Opened the BlueOS Cloud mission creation form')
  missionForm.value = { mode: 'create', name: '', description: '', location: null }
  showMissionForm.value = true
}

const openEditMissionForm = (): void => {
  logUserAction('Opened the BlueOS Cloud mission edit form')
  missionForm.value = {
    mode: 'edit',
    name: linkedCloudMission.value?.title ?? '',
    description: linkedCloudMission.value?.description ?? '',
    location: linkedMissionLocation.value,
  }
  showMissionForm.value = true
}

const onMissionFormSubmit = (payload: MissionFormSubmitPayload): void => {
  if (missionForm.value.mode === 'edit') {
    editLinkedMission(payload)
  } else {
    createMission(payload)
  }
}

const finishCloudMission = (): void => {
  confirmMissionReset(() => {
    logUserAction('Reset the BlueOS Cloud mission')
    store.applyMissionName(generateAutomaticMissionName(), { isAutomatic: true, startNewMission: true })
    cloudStore.finishMission()
  })
}

const openCloudSettings = (): void => {
  logUserAction('Opened the Cloud settings from the mission configuration menu')
  configMenuOpen.value = false
  interfaceStore.isMainMenuVisible = true
  interfaceStore.mainMenuCurrentStep = 2
  interfaceStore.currentSubMenuName = SubMenuName.settings
  interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsCloud
}
</script>
