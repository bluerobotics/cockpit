<template>
  <GlassModal :is-visible="isVisible" position="center">
    <div class="p-4 w-[550px] max-w-[90vw]">
      <div class="flex justify-center items-center mb-4 pb-2">
        <h2 class="text-xl font-semibold">Available Actions</h2>
      </div>
      <div class="fixed top-1 right-1">
        <v-btn icon="mdi-close" size="small" variant="text" class="text-lg" @click="closeModal"></v-btn>
      </div>

      <div v-if="filteredActions.length === 0" class="text-center py-8">
        <v-icon size="50" color="grey" class="mb-3">mdi-lightning-bolt-outline</v-icon>
        <p class="text-grey-lighten-1">No new actions available.</p>
      </div>

      <div v-else class="actions-container">
        <p class="mb-4">The following actions are available from BlueOS extensions:</p>

        <v-list class="bg-transparent">
          <v-list-item v-for="action in filteredActions" :key="action.id" class="mb-3 p-0">
            <v-card variant="outlined" class="w-full action-card">
              <v-card-item>
                <template #prepend>
                  <div class="mr-3 action-icon-container">
                    <v-icon size="30" :color="getActionTypeColor(action.type)">
                      {{ getActionTypeIcon(action.type) }}
                    </v-icon>
                  </div>
                </template>
                <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                <v-card-subtitle class="text-grey-lighten-1">
                  {{ getActionTypeName(action.type) }}
                </v-card-subtitle>
                <v-card-text v-if="getActionDescription(action)" class="pt-2 text-sm">
                  {{ getActionDescription(action) }}
                </v-card-text>
              </v-card-item>
              <v-card-actions class="pt-0 pb-2 px-4">
                <v-spacer></v-spacer>
                <v-btn variant="tonal" prepend-icon="mdi-plus-circle-outline" @click="addAction(action)">
                  Add Action
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-list-item>
        </v-list>
      </div>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import { useSnackbar } from '@/composables/snackbar'
import { getAllJavascriptActionConfigs, registerJavascriptActionConfig } from '@/libs/actions/free-javascript'
import { getAllHttpRequestActionConfigs, registerHttpRequestActionConfig } from '@/libs/actions/http-request'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { getActionsFromBlueOS } from '@/libs/blueos'
import { ActionConfig, customActionTypes, customActionTypesNames } from '@/types/cockpit-actions'

const { openSnackbar } = useSnackbar()

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
 * Track which actions have been added by the user
 */
const addedActionIds = ref<string[]>([])

/**
 * Track the visibility of the modal
 */
const isVisible = ref(false)

/**
 * Store discovered actions from BlueOS
 */
const discoveredActions = ref<ActionConfig[]>([])

/**
 * Filter out actions that have already been added
 */
const filteredActions = computed(() => {
  return discoveredActions.value.filter((action) => !addedActionIds.value.includes(action.id))
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
 * Add an action to the application
 * @param {ActionConfig} action - The action to add
 */
const addAction = (action: ActionConfig): void => {
  // Handle action by type
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
  }

  // Mark the action as added
  addedActionIds.value.push(action.id)

  // Notify parent component
  emit('action-added', action)

  // Show success notification
  openSnackbar({
    message: `Action "${action.name}" added successfully!`,
    variant: 'success',
  })
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
    const actions = await getActionsFromBlueOS()

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
        // Actions already have extension information attached from getActionsFromBlueOS
        discoveredActions.value = actionsToDisplay
        isVisible.value = true
      }
    }
  } catch (error) {
    console.error('Failed to fetch actions from BlueOS:', error)
  }
}

/**
 * Public method to trigger the action discovery process
 * @returns {Promise<void>} Promise that resolves when the check is complete
 */
const checkForActions = (): Promise<void> => {
  return checkForBlueOSActions()
}

// Check for actions on mount if autoCheckOnMount is true
onMounted(() => {
  if (props.autoCheckOnMount) {
    checkForBlueOSActions()
  }
})

// Expose methods to parent component
defineExpose({
  checkForActions,
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
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}
</style>
