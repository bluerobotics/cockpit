<template>
  <GlassModal :is-visible="isVisible" position="center">
    <div class="p-4 w-[760px] max-w-[95vw]">
      <div class="flex justify-center items-center mb-4 pb-2">
        <h2 class="text-xl font-semibold">BlueOS Extension Features</h2>
      </div>
      <div class="fixed top-1 right-1">
        <v-btn icon="mdi-close" size="small" variant="text" class="text-lg" @click="closeModal"></v-btn>
      </div>

      <v-tabs v-model="activeTab" class="mb-4">
        <v-tab value="actions">Actions</v-tab>
        <v-tab value="joystick-suggestions">Joystick Mappings</v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Actions Tab -->
        <v-tabs-window-item value="actions">
          <div v-if="filteredActions.length === 0" class="text-center py-8">
            <v-icon size="50" color="grey" class="mb-3">mdi-lightning-bolt-outline</v-icon>
            <p class="text-grey-lighten-1">No new actions available.</p>
          </div>

          <div v-else class="actions-container">
            <p class="mb-4">The following actions are offered to be addedby BlueOS extensions:</p>

            <v-list class="bg-transparent">
              <v-list-item v-for="action in filteredActions" :key="action.id" class="mb-3 p-0">
                <v-card variant="outlined" class="w-full action-card">
                  <v-card-item>
                    <template #prepend>
                      <div class="action-icon-container m-2">
                        <v-icon size="60" :color="getActionTypeColor(action.type)">
                          {{ getActionTypeIcon(action.type) }}
                        </v-icon>
                      </div>
                    </template>
                    <v-card-title class="font-medium pb-0 text-center">{{ action.name }}</v-card-title>
                    <v-card-subtitle class="text-grey-lighten-1 text-center">
                      {{ getActionTypeName(action.type) }}
                    </v-card-subtitle>
                    <v-card-text v-if="getActionDescription(action)" class="pt-2 text-sm text-center">
                      {{ getActionDescription(action) }}
                    </v-card-text>
                    <div class="flex flex-col gap-1 mt-4">
                      <v-btn variant="tonal" prepend-icon="mdi-plus-circle-outline" @click="addAction(action)">
                        Add Action
                      </v-btn>
                      <v-btn variant="text" prepend-icon="mdi-close" @click="ignoreAction(action)"> Ignore </v-btn>
                    </div>
                    <v-card-subtitle class="text-grey-lighten-1 text-center mt-3">
                      from {{ action.extensionName }}
                    </v-card-subtitle>
                  </v-card-item>
                </v-card>
              </v-list-item>
            </v-list>
          </div>
        </v-tabs-window-item>

        <!-- Joystick Suggestions Tab -->
        <v-tabs-window-item value="joystick-suggestions">
          <div
            v-if="
              filteredJoystickSuggestionsByExtension.length === 0 &&
              appliedJoystickSuggestionsByExtension.length === 0 &&
              ignoredJoystickSuggestionsByExtension.length === 0
            "
            class="text-center py-8"
          >
            <v-icon size="50" color="grey" class="mb-3">mdi-gamepad-variant-outline</v-icon>
            <p class="text-grey-lighten-1">No joystick mapping suggestions available.</p>
          </div>

          <div v-else class="actions-container">
            <!-- New Suggestions Section -->
            <div v-if="filteredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="blue">mdi-gamepad-variant-outline</v-icon>
                <h2 class="text-xl font-semibold">New Suggestions</h2>
              </div>
              <p class="mb-4 text-grey-lighten-1">
                The following joystick mappings are suggested by BlueOS extensions:
              </p>

              <!-- Group suggestions by extension -->
              <div
                v-for="extensionGroup in filteredJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container">
                  <!-- Extension header with accept all button -->
                  <div class="flex items-center justify-between mb-4 p-4 bg-slate-700/30 rounded-t-lg">
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="blue">mdi-puzzle-outline</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                      <v-chip size="small" variant="outlined" color="blue">
                        {{ extensionGroup.suggestions.length }} suggestion{{
                          extensionGroup.suggestions.length !== 1 ? 's' : ''
                        }}
                      </v-chip>
                    </div>
                    <v-btn
                      variant="tonal"
                      color="green"
                      prepend-icon="mdi-check-all"
                      size="small"
                      @click="acceptAllSuggestions(extensionGroup.extensionName)"
                    >
                      Accept All
                    </v-btn>
                  </div>

                  <!-- Suggestions grid from this extension -->
                  <div class="p-4 pt-0">
                    <div class="flex flex-wrap gap-4 justify-start">
                      <div
                        v-for="suggestion in extensionGroup.suggestions"
                        :key="suggestion.id"
                        class="suggestion-item-compact p-4 border border-gray-600 rounded-lg bg-gray-800/20 hover:bg-gray-700/30 transition-colors"
                      >
                        <!-- Title and description above SVG -->
                        <div class="text-center mb-3">
                          <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                          <p v-if="suggestion.description" class="text-sm text-grey-lighten-1">
                            {{ suggestion.description }}
                          </p>
                        </div>

                        <!-- Joystick SVG (reduced by 20%) -->
                        <div class="flex justify-center mb-3">
                          <div class="joystick-svg-container-small">
                            <JoystickButtonIndicator
                              :button-number="suggestion.button"
                              :modifier="suggestion.modifier"
                            />
                          </div>
                        </div>

                        <!-- Buttons underneath -->
                        <div class="flex flex-col gap-2">
                          <v-btn
                            variant="tonal"
                            prepend-icon="mdi-plus-circle-outline"
                            size="small"
                            @click="openJoystickSuggestionDialog(suggestion, extensionGroup.extensionName)"
                          >
                            Apply
                          </v-btn>
                          <v-btn
                            variant="text"
                            prepend-icon="mdi-close"
                            size="small"
                            @click="ignoreSuggestion(suggestion)"
                          >
                            Ignore
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </div>
                </v-card>
              </div>
            </div>

            <!-- Applied Suggestions Section -->
            <div v-if="appliedJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="green">mdi-check-circle</v-icon>
                <h2 class="text-xl font-semibold">Applied Mappings</h2>
              </div>
              <p class="mb-4 text-grey-lighten-1">These joystick mappings have been applied from BlueOS extensions:</p>

              <!-- Group applied suggestions by extension -->
              <div
                v-for="extensionGroup in appliedJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container border-green-500/30">
                  <!-- Extension header -->
                  <div
                    class="flex items-center justify-between mb-4 p-4 bg-green-900/20 rounded-t-lg border-b border-green-500/30"
                  >
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="green">mdi-check-circle</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                      <v-chip size="small" variant="outlined" color="green">
                        {{ extensionGroup.suggestions.length }} applied
                      </v-chip>
                    </div>
                  </div>

                  <!-- Applied suggestions grid from this extension -->
                  <div class="p-4 pt-0">
                    <div class="flex flex-wrap gap-4 justify-start">
                      <div
                        v-for="suggestion in extensionGroup.suggestions"
                        :key="suggestion.id"
                        class="suggestion-item-compact p-4 border border-green-500/30 rounded-lg bg-green-900/10"
                      >
                        <!-- Title and description above SVG -->
                        <div class="text-center mb-3">
                          <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                          <p v-if="suggestion.description" class="text-sm text-grey-lighten-1">
                            {{ suggestion.description }}
                          </p>
                        </div>

                        <!-- Joystick SVG (reduced by 20%) -->
                        <div class="flex justify-center mb-3">
                          <div class="joystick-svg-container-small">
                            <JoystickButtonIndicator
                              :button-number="suggestion.button"
                              :modifier="suggestion.modifier"
                            />
                          </div>
                        </div>

                        <!-- Applied status -->
                        <div class="flex justify-center">
                          <v-chip color="green" variant="tonal" prepend-icon="mdi-check" size="small"> Applied </v-chip>
                        </div>
                      </div>
                    </div>
                  </div>
                </v-card>
              </div>
            </div>

            <!-- Ignored Suggestions Section -->
            <div v-if="ignoredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="orange">mdi-close-circle</v-icon>
                <h2 class="text-xl font-semibold">Ignored Mappings</h2>
              </div>
              <p class="mb-4 text-grey-lighten-1">These joystick mappings have been ignored:</p>

              <!-- Group ignored suggestions by extension -->
              <div
                v-for="extensionGroup in ignoredJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container border-orange-500/30">
                  <!-- Extension header -->
                  <div
                    class="flex items-center justify-between mb-4 p-4 bg-orange-900/20 rounded-t-lg border-b border-orange-500/30"
                  >
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="orange">mdi-close-circle</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                      <v-chip size="small" variant="outlined" color="orange">
                        {{ extensionGroup.suggestions.length }} ignored
                      </v-chip>
                    </div>
                    <v-btn
                      variant="tonal"
                      color="blue"
                      prepend-icon="mdi-restore"
                      size="small"
                      @click="restoreAllIgnoredSuggestions(extensionGroup.extensionName)"
                    >
                      Restore All
                    </v-btn>
                  </div>

                  <!-- Ignored suggestions grid from this extension -->
                  <div class="p-4 pt-0">
                    <div class="flex flex-wrap gap-4 justify-start">
                      <div
                        v-for="suggestion in extensionGroup.suggestions"
                        :key="suggestion.id"
                        class="suggestion-item-compact p-4 border border-orange-500/30 rounded-lg bg-orange-900/10"
                      >
                        <!-- Title and description above SVG -->
                        <div class="text-center mb-3">
                          <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                          <p v-if="suggestion.description" class="text-sm text-grey-lighten-1">
                            {{ suggestion.description }}
                          </p>
                        </div>

                        <!-- Joystick SVG (reduced by 20%) -->
                        <div class="flex justify-center mb-3">
                          <div class="joystick-svg-container-small">
                            <JoystickButtonIndicator
                              :button-number="suggestion.button"
                              :modifier="suggestion.modifier"
                            />
                          </div>
                        </div>

                        <!-- Restore button -->
                        <div class="flex justify-center">
                          <v-btn
                            variant="tonal"
                            color="blue"
                            prepend-icon="mdi-restore"
                            size="small"
                            @click="restoreIgnoredSuggestion(suggestion)"
                          >
                            Restore
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </div>
                </v-card>
              </div>
            </div>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>

      <!-- Joystick Suggestion Application Dialog -->
      <v-dialog v-model="joystickSuggestionDialog" max-width="700px">
        <v-card v-if="selectedSuggestion" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-2">
            <h2 class="text-xl font-semibold">Apply Joystick Mapping Suggestion</h2>
          </v-card-title>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute top-2 right-2 text-lg"
            @click="joystickSuggestionDialog = false"
          ></v-btn>

          <v-card-text class="px-6 pb-4">
            <div class="mb-4">
              <p class="text-center text-sm text-gray-300 mb-4">
                <strong>{{ selectedSuggestion.actionName }}</strong> from {{ selectedSuggestion.extensionName }}
              </p>
              <p v-if="selectedSuggestion.description" class="text-center text-xs text-gray-400 mb-4">
                {{ selectedSuggestion.description }}
              </p>
            </div>

            <div class="space-y-3">
              <div class="flex justify-center items-center gap-4 mb-4">
                <h4 class="font-medium">Select profiles to update:</h4>
                <v-btn variant="text" size="small" class="text-xs" @click="toggleSelectAll">
                  {{ allProfilesSelected ? 'Deselect All' : 'Select All' }}
                </v-btn>
              </div>

              <div
                v-for="profile in availableProfiles"
                :key="profile.hash"
                class="flex items-center justify-between p-3 rounded-lg border transition-all duration-200"
                :class="{
                  'border-gray-600 bg-gray-800/20': !selectedProfiles.includes(profile.hash),
                  'border-green-500 bg-green-900/20': selectedProfiles.includes(profile.hash),
                }"
              >
                <div class="flex items-center gap-3">
                  <v-checkbox
                    v-model="selectedProfiles"
                    :value="profile.hash"
                    color="green"
                    hide-details
                    class="flex-shrink-0"
                  ></v-checkbox>

                  <div class="flex items-center gap-2 flex-grow">
                    <span
                      class="font-medium min-w-0 flex-shrink-0"
                      :class="{
                        'text-gray-400': !selectedProfiles.includes(profile.hash),
                        'text-white': selectedProfiles.includes(profile.hash),
                      }"
                    >
                      {{ profile.name }}
                    </span>

                    <span
                      class="text-sm"
                      :class="{
                        'text-gray-500': !selectedProfiles.includes(profile.hash),
                        'text-gray-300': selectedProfiles.includes(profile.hash),
                      }"
                    >
                      {{ getCurrentButtonAction(profile.hash, selectedSuggestion.button, selectedSuggestion.modifier) }}
                    </span>

                    <v-icon
                      size="16"
                      class="mx-2"
                      :class="{
                        'text-gray-500': !selectedProfiles.includes(profile.hash),
                        'text-green-400': selectedProfiles.includes(profile.hash),
                      }"
                    >
                      mdi-arrow-right
                    </v-icon>

                    <span
                      class="text-sm font-medium"
                      :class="{
                        'text-gray-500': !selectedProfiles.includes(profile.hash),
                        'text-green-400': selectedProfiles.includes(profile.hash),
                      }"
                    >
                      {{ selectedSuggestion.actionName }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>

          <div class="flex justify-center w-full px-6 pb-2">
            <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
          </div>

          <v-card-actions class="px-6 pb-4">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="joystickSuggestionDialog = false">Cancel</v-btn>
            <v-btn :disabled="selectedProfiles.length === 0" @click="applyJoystickSuggestion">
              Apply to {{ selectedProfiles.length }} Profile{{ selectedProfiles.length !== 1 ? 's' : '' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Accept All Suggestions Dialog -->
      <v-dialog v-model="acceptAllDialog" max-width="500px">
        <v-card v-if="acceptAllExtensionName" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-2">
            <h2 class="text-xl font-semibold">Accept All Suggestions</h2>
          </v-card-title>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute top-2 right-2 text-lg"
            @click="acceptAllDialog = false"
          ></v-btn>

          <v-card-text class="px-6 pb-4">
            <div class="mb-4">
              <p class="text-center text-sm text-gray-300 mb-4">
                Accept all {{ getExtensionSuggestionCount(acceptAllExtensionName) }} suggestions from
                <strong>{{ acceptAllExtensionName }}</strong
                >?
              </p>
              <p class="text-center text-xs text-gray-400 mb-4">
                This will apply all suggested joystick mappings to your selected profiles.
              </p>
            </div>

            <div class="space-y-3">
              <div class="flex justify-center items-center gap-4 mb-4">
                <h4 class="font-medium">Select profiles to update:</h4>
                <v-btn variant="text" size="small" class="text-xs" @click="toggleSelectAll">
                  {{ allProfilesSelected ? 'Deselect All' : 'Select All' }}
                </v-btn>
              </div>

              <div
                v-for="profile in availableProfiles"
                :key="profile.hash"
                class="flex items-center justify-between p-3 rounded-lg border transition-all duration-200"
                :class="{
                  'border-gray-600 bg-gray-800/20': !selectedProfiles.includes(profile.hash),
                  'border-green-500 bg-green-900/20': selectedProfiles.includes(profile.hash),
                }"
              >
                <div class="flex items-center gap-3">
                  <v-checkbox
                    v-model="selectedProfiles"
                    :value="profile.hash"
                    color="green"
                    hide-details
                    class="flex-shrink-0"
                  ></v-checkbox>

                  <span
                    class="font-medium"
                    :class="{
                      'text-gray-400': !selectedProfiles.includes(profile.hash),
                      'text-white': selectedProfiles.includes(profile.hash),
                    }"
                  >
                    {{ profile.name }}
                  </span>
                </div>
              </div>
            </div>
          </v-card-text>

          <div class="flex justify-center w-full px-6 pb-2">
            <v-divider class="opacity-10 border-[#fafafa]"></v-divider>
          </div>

          <v-card-actions class="px-6 pb-4">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="acceptAllDialog = false">Cancel</v-btn>
            <v-btn :disabled="selectedProfiles.length === 0" @click="applyAllSuggestions">
              Apply All to {{ selectedProfiles.length }} Profile{{ selectedProfiles.length !== 1 ? 's' : '' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import JoystickButtonIndicator from '@/components/JoystickButtonIndicator.vue'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { getAllJavascriptActionConfigs, registerJavascriptActionConfig } from '@/libs/actions/free-javascript'
import { getAllHttpRequestActionConfigs, registerHttpRequestActionConfig } from '@/libs/actions/http-request'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { getActionsFromBlueOS, getJoystickSuggestionsFromBlueOS } from '@/libs/blueos'
import { allAvailableButtons } from '@/libs/joystick/protocols'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { ActionConfig, customActionTypes, customActionTypesNames } from '@/types/cockpit-actions'
import { CockpitModifierKeyOption, JoystickMapSuggestion, JoystickMapSuggestionsFromExtension } from '@/types/joystick'

const { openSnackbar } = useSnackbar()
const controllerStore = useControllerStore()
const interfaceStore = useAppInterfaceStore()

/**
 * Props for the component
 */
const props = defineProps<{
  /**
   * Whether to automatically check for actions on mount
   */
  autoCheckOnMount?: boolean
}>()

/**
 * Emits events from the component
 */
const emit = defineEmits(['close', 'action-added'])

/**
 * Track which actions have been handled (applied or ignored) - persistent
 */
const handledActions = useBlueOsStorage('cockpit-handled-actions', {
  applied: [] as string[],
  ignored: [] as string[],
})

/**
 * Track which joystick suggestions have been handled (applied or ignored) - persistent
 */
const handledSuggestions = useBlueOsStorage('cockpit-handled-joystick-suggestions', {
  applied: [] as string[],
  ignored: [] as string[],
})

/**
 * Computed refs for easier access to applied and ignored actions
 */
const appliedActionIds = computed(() => handledActions.value.applied)
const ignoredActionIds = computed(() => handledActions.value.ignored)

/**
 * Computed refs for easier access to applied and ignored suggestions
 */
const appliedSuggestionIds = computed(() => handledSuggestions.value.applied)
const ignoredSuggestionIds = computed(() => handledSuggestions.value.ignored)

/**
 * Track the visibility of the modal
 */
const isVisible = ref(false)

/**
 * Active tab for the tabs component
 */
const activeTab = ref('actions')

/**
 * Action with extension name
 */
type ActionWithExtensionName = ActionConfig & {
  /**
   * Name of the extension that offered the action
   */
  extensionName: string
}

/**
 * Store discovered actions from BlueOS
 */
const discoveredActions = ref<ActionWithExtensionName[]>([])

/**
 * Store discovered joystick suggestions from BlueOS
 */
const discoveredJoystickSuggestions = ref<JoystickMapSuggestionsFromExtension[]>([])

/**
 * Dialog visibility for joystick suggestion application
 */
const joystickSuggestionDialog = ref(false)

/**
 * Dialog visibility for accepting all suggestions
 */
const acceptAllDialog = ref(false)

/**
 * Extension name for accept all dialog
 */
const acceptAllExtensionName = ref<string | null>(null)

export type JoystickSuggestionWithExtensionName = JoystickMapSuggestion & {
  /**
   * Name of the extension that suggested the suggestion
   */
  extensionName: string
}

/**
 * Currently selected suggestion for application
 */
const selectedSuggestion = ref<JoystickSuggestionWithExtensionName | null>(null)

/**
 * Selected profiles for applying joystick suggestions
 */
const selectedProfiles = ref<string[]>([])

/**
 * Available joystick profiles
 */
const availableProfiles = computed(() => {
  return controllerStore.protocolMappings
})

/**
 * Check if all profiles are selected
 */
const allProfilesSelected = computed(() => {
  return availableProfiles.value.length > 0 && selectedProfiles.value.length === availableProfiles.value.length
})

/**
 * Filter out actions that have already been applied or ignored
 */
const filteredActions = computed(() => {
  return discoveredActions.value.filter(
    (action) => !appliedActionIds.value.includes(action.id) && !ignoredActionIds.value.includes(action.id)
  )
})

/**
 * Filter out joystick suggestions that have already been applied or ignored and group them by extension
 */
const filteredJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((extensionGroup) => ({
      extensionName: extensionGroup.extensionName,
      suggestions: extensionGroup.suggestions.filter(
        (suggestion) =>
          !appliedSuggestionIds.value.includes(suggestion.id) && !ignoredSuggestionIds.value.includes(suggestion.id)
      ),
    }))
    .filter((group) => group.suggestions.length > 0)
})

/**
 * Get applied joystick suggestions grouped by extension
 */
const appliedJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((extensionGroup) => ({
      extensionName: extensionGroup.extensionName,
      suggestions: extensionGroup.suggestions.filter((suggestion) =>
        appliedSuggestionIds.value.includes(suggestion.id)
      ),
    }))
    .filter((group) => group.suggestions.length > 0)
})

/**
 * Get ignored joystick suggestions grouped by extension
 */
const ignoredJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((extensionGroup) => ({
      extensionName: extensionGroup.extensionName,
      suggestions: extensionGroup.suggestions.filter((suggestion) =>
        ignoredSuggestionIds.value.includes(suggestion.id)
      ),
    }))
    .filter((group) => group.suggestions.length > 0)
})

/**
 * Get the human-readable name for an action type
 * @param {customActionTypes} type - The action type
 * @returns {string} The human-readable name for the action type
 */
const getActionTypeName = (type: customActionTypes): string => {
  return customActionTypesNames[type] || 'Unknown'
}

/**
 * Get an appropriate icon for the action type
 * @param {customActionTypes} type - The action type
 * @returns {string} The icon name
 */
const getActionTypeIcon = (type: customActionTypes): string => {
  switch (type) {
    case customActionTypes.httpRequest:
      return 'mdi-api'
    case customActionTypes.mavlinkMessage:
      return 'mdi-message-outline'
    case customActionTypes.javascript:
      return 'mdi-code-json'
    default:
      return 'mdi-lightning-bolt'
  }
}

/**
 * Get a color for the action type icon
 * @param {customActionTypes} type - The action type
 * @returns {string} The color name
 */
const getActionTypeColor = (type: customActionTypes): string => {
  switch (type) {
    case customActionTypes.httpRequest:
      return 'blue'
    case customActionTypes.mavlinkMessage:
      return 'green'
    case customActionTypes.javascript:
      return 'amber'
    default:
      return 'grey'
  }
}

/**
 * Get the description from an action if available
 * @param {ActionConfig} action - The action
 * @returns {string|null} The description or null
 */
const getActionDescription = (action: ActionConfig): string | null => {
  // Handle the description property which might be in different locations depending on the action structure
  return (action as any).description || null
}

/**
 * Get current button action for a profile
 * @param {string} profileHash - Profile hash
 * @param {number} buttonNumber - Button number
 * @param {CockpitModifierKeyOption} modifier - Modifier key option
 * @returns {string} Current action name
 */
const getCurrentButtonAction = (
  profileHash: string,
  buttonNumber: number,
  modifier: CockpitModifierKeyOption = CockpitModifierKeyOption.regular
): string => {
  const profile = availableProfiles.value.find((p) => p.hash === profileHash)
  if (!profile) return 'No Function'

  const buttonMapping = profile.buttonsCorrespondencies[modifier]
  const buttonAction = buttonMapping[buttonNumber as keyof typeof buttonMapping]
  return buttonAction?.action?.name || 'No Function'
}

/**
 * Get the count of suggestions for an extension
 * @param {string} extensionName - Extension name
 * @returns {number} Number of suggestions
 */
const getExtensionSuggestionCount = (extensionName: string): number => {
  const extensionGroup = filteredJoystickSuggestionsByExtension.value.find(
    (group) => group.extensionName === extensionName
  )
  return extensionGroup?.suggestions.length || 0
}

/**
 * Toggle select all profiles
 */
const toggleSelectAll = (): void => {
  if (allProfilesSelected.value) {
    selectedProfiles.value = []
  } else {
    selectedProfiles.value = availableProfiles.value.map((profile) => profile.hash)
  }
}

/**
 * Ignore a joystick suggestion
 * @param {JoystickMapSuggestion} suggestion - The suggestion to ignore
 */
const ignoreSuggestion = (suggestion: JoystickMapSuggestion): void => {
  handledSuggestions.value.ignored.push(suggestion.id)
  openSnackbar({
    message: `Suggestion "${suggestion.actionName}" has been ignored.`,
    variant: 'info',
  })
}

/**
 * Open the accept all suggestions dialog
 * @param {string} extensionName - Extension name
 */
const acceptAllSuggestions = (extensionName: string): void => {
  acceptAllExtensionName.value = extensionName
  selectedProfiles.value = []
  acceptAllDialog.value = true
}

/**
 * Apply all suggestions from an extension
 */
const applyAllSuggestions = (): void => {
  if (!acceptAllExtensionName.value || selectedProfiles.value.length === 0) return

  const extensionGroup = filteredJoystickSuggestionsByExtension.value.find(
    (group) => group.extensionName === acceptAllExtensionName.value
  )
  if (!extensionGroup) return

  const availableActions = allAvailableButtons()
  let appliedCount = 0

  // Apply each suggestion
  extensionGroup.suggestions.forEach((suggestion) => {
    const matchingAction = availableActions.find(
      (action) => action.id === suggestion.actionId && action.protocol === suggestion.actionProtocol
    )
    if (matchingAction) {
      // Apply to selected profiles
      selectedProfiles.value.forEach((profileHash) => {
        const profile = controllerStore.protocolMappings.find((p) => p.hash === profileHash)
        if (profile) {
          const buttonKey = suggestion.button as number
          const modifier = suggestion.modifier
          profile.buttonsCorrespondencies[modifier][buttonKey] = {
            action: matchingAction,
          }
        }
      })

      // Mark suggestion as applied
      handledSuggestions.value.applied.push(suggestion.id)
      appliedCount++
    }
  })

  // Close dialog and show success message
  acceptAllDialog.value = false
  acceptAllExtensionName.value = null
  openSnackbar({
    message: `Applied ${appliedCount} joystick mappings from ${extensionGroup.extensionName} to ${selectedProfiles.value.length} profile(s)!`,
    variant: 'success',
  })
}

/**
 * Open the joystick suggestion dialog
 * @param {JoystickMapSuggestion} suggestion - The suggestion to apply
 * @param {string} extensionName - Extension name
 */
const openJoystickSuggestionDialog = (suggestion: JoystickMapSuggestion, extensionName: string): void => {
  selectedSuggestion.value = {
    ...suggestion,
    extensionName,
  }
  selectedProfiles.value = []
  joystickSuggestionDialog.value = true
}

/**
 * Apply joystick suggestion to selected profiles
 */
const applyJoystickSuggestion = (): void => {
  if (!selectedSuggestion.value || selectedProfiles.value.length === 0) return

  // Find a matching action from available actions
  const availableActions = allAvailableButtons()
  const matchingAction = availableActions.find(
    (action) =>
      action.id === selectedSuggestion.value!.actionId && action.protocol === selectedSuggestion.value!.actionProtocol
  )

  if (!matchingAction) {
    openSnackbar({
      message: `Could not find a matching action for "${selectedSuggestion.value.actionName}". Please add the action first.`,
      variant: 'warning',
    })
    return
  }

  // Apply to selected profiles
  selectedProfiles.value.forEach((profileHash) => {
    const profile = controllerStore.protocolMappings.find((p) => p.hash === profileHash)
    if (profile) {
      const buttonKey = selectedSuggestion.value!.button as number
      const modifier = selectedSuggestion.value!.modifier
      profile.buttonsCorrespondencies[modifier][buttonKey] = {
        action: matchingAction,
      }
    }
  })

  // Mark suggestion as applied
  handledSuggestions.value.applied.push(selectedSuggestion.value.id)

  // Close dialog and show success message
  joystickSuggestionDialog.value = false
  openSnackbar({
    message: `Joystick mapping applied to ${selectedProfiles.value.length} profile(s)!`,
    variant: 'success',
  })
}

/**
 * Add an action to the application
 * @param {ActionConfig} action - The action to add
 */
const addAction = (action: ActionConfig): void => {
  try {
    switch (action.type) {
      case customActionTypes.httpRequest:
        registerHttpRequestActionConfig(action.config)
        break
      case customActionTypes.mavlinkMessage:
        registerMavlinkMessageActionConfig(action.config)
        break
      case customActionTypes.javascript:
        registerJavascriptActionConfig(action.config)
        break
      default:
        openSnackbar({
          message: `Unknown action type: ${action.type}`,
          variant: 'error',
        })
        return
    }

    // Mark action as applied
    handledActions.value.applied.push(action.id)

    emit('action-added', action)
    openSnackbar({
      message: `Action "${action.name}" has been added successfully!`,
      variant: 'success',
    })
  } catch (error) {
    openSnackbar({
      message: `Failed to add action "${action.name}": ${error}`,
      variant: 'error',
    })
  }
}

/**
 * Ignore an action
 * @param {ActionConfig} action - The action to ignore
 */
const ignoreAction = (action: ActionConfig): void => {
  handledActions.value.ignored.push(action.id)
  openSnackbar({
    message: `Action "${action.name}" has been ignored.`,
    variant: 'info',
  })
}

/**
 * Restore all ignored suggestions from an extension
 * @param {string} extensionName - Extension name
 */
const restoreAllIgnoredSuggestions = (extensionName: string): void => {
  const extensionGroup = ignoredJoystickSuggestionsByExtension.value.find(
    (group) => group.extensionName === extensionName
  )
  if (!extensionGroup) return

  const suggestionsToRestore = extensionGroup.suggestions

  if (suggestionsToRestore.length === 0) {
    openSnackbar({
      message: `No ignored suggestions found for ${extensionName}.`,
      variant: 'info',
    })
    return
  }

  const confirmed = confirm(
    `Are you sure you want to restore all ${suggestionsToRestore.length} ignored joystick mappings from ${extensionName}? They will appear in the New Suggestions section.`
  )

  if (confirmed) {
    suggestionsToRestore.forEach((suggestion) => {
      handledSuggestions.value.ignored = handledSuggestions.value.ignored.filter((id) => id !== suggestion.id)
    })
    openSnackbar({
      message: `Restored ${suggestionsToRestore.length} ignored joystick mappings from ${extensionName}.`,
      variant: 'success',
    })
  }
}

/**
 * Restore a single ignored suggestion
 * @param {JoystickMapSuggestion} suggestion - The suggestion to restore
 */
const restoreIgnoredSuggestion = (suggestion: JoystickMapSuggestion): void => {
  // Find the extension name from the grouped data
  const extensionGroup = ignoredJoystickSuggestionsByExtension.value.find((group) =>
    group.suggestions.some((s) => s.id === suggestion.id)
  )
  const extensionName = extensionGroup?.extensionName || 'Unknown Extension'

  const confirmed = confirm(
    `Are you sure you want to restore the ignored joystick mapping "${suggestion.actionName}" from ${extensionName}? It will appear in the New Suggestions section.`
  )

  if (confirmed) {
    handledSuggestions.value.ignored = handledSuggestions.value.ignored.filter((id) => id !== suggestion.id)
    openSnackbar({
      message: `Restored ignored joystick mapping "${suggestion.actionName}" from ${extensionName}.`,
      variant: 'success',
    })
  }
}

/**
 * Close the modal
 */
const closeModal = (): void => {
  isVisible.value = false
  emit('close')
}

/**
 * Check for available actions from BlueOS.
 */
const checkForBlueOSActions = async (): Promise<void> => {
  try {
    const actionsFromExtensions = await getActionsFromBlueOS()

    const actions = actionsFromExtensions.flatMap((extension) =>
      extension.actionConfigs.map((action) => ({
        extensionName: extension.extensionName,
        ...action,
      }))
    )

    if (actions.length > 0) {
      // Get all existing actions from the app
      const existingHttpActions = getAllHttpRequestActionConfigs()
      const existingMavlinkActions = getAllMavlinkMessageActionConfigs()
      const existingJavascriptActions = getAllJavascriptActionConfigs()

      // Extract names of existing actions
      const existingActionNames = new Set([
        ...Object.values(existingHttpActions).map((action) => action.name),
        ...Object.values(existingMavlinkActions).map((action) => action.name),
        ...Object.values(existingJavascriptActions).map((action) => action.name),
      ])

      // Filter out actions that have the same name as existing ones
      const actionsToDisplay = actions.filter((action) => !existingActionNames.has(action.name))

      if (actionsToDisplay.length > 0) {
        // Actions now include extension names from the getActionsFromBlueOS function
        discoveredActions.value = actionsToDisplay
      }
    }
  } catch (error) {
    console.error('Failed to fetch actions from BlueOS:', error)
  }
}

/**
 * Check for available joystick suggestions from BlueOS.
 */
const checkForBlueOSJoystickSuggestions = async (): Promise<void> => {
  try {
    const suggestions = await getJoystickSuggestionsFromBlueOS()
    discoveredJoystickSuggestions.value = suggestions
  } catch (error) {
    console.error('Failed to fetch joystick suggestions from BlueOS:', error)
  }
}

/**
 * Check for both actions and joystick suggestions
 */
const checkForBlueOSFeatures = async (): Promise<void> => {
  await Promise.all([checkForBlueOSActions(), checkForBlueOSJoystickSuggestions()])

  // Show modal if there are any features available
  if (filteredActions.value.length > 0 || filteredJoystickSuggestionsByExtension.value.length > 0) {
    isVisible.value = true
    // Set active tab based on what's available
    if (filteredJoystickSuggestionsByExtension.value.length > 0 && filteredActions.value.length === 0) {
      activeTab.value = 'joystick-suggestions'
    }
  }
}

// Check for features on mount if autoCheckOnMount is true
onMounted(() => {
  if (props.autoCheckOnMount) {
    checkForBlueOSFeatures()
  }
})
</script>

<style scoped>
.actions-container {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.actions-container::-webkit-scrollbar {
  width: 6px;
}

.actions-container::-webkit-scrollbar-thumb {
  background: rgba(200, 200, 200, 0.3);
  border-radius: 3px;
}

.action-card {
  margin-top: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.action-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150px;
  height: 150px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.joystick-svg-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 360px;
  height: 220px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.joystick-svg-container-small {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 288px; /* 20% smaller than 360px */
  height: 176px; /* 20% smaller than 220px */
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.extension-container {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 280px;
  transition: all 0.2s ease;
}

.suggestion-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.suggestion-item-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: fit-content;
  min-width: 320px;
  max-width: 380px;
  transition: all 0.2s ease;
}

.suggestion-item-compact:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.suggestion-item-compact .text-center {
  width: 100%;
  max-width: 300px;
}

.suggestion-item-compact .text-center h4 {
  word-wrap: break-word;
  hyphens: auto;
}

.suggestion-item-compact .text-center p {
  word-wrap: break-word;
  hyphens: auto;
}
</style>
