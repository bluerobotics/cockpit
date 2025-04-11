<template>
  <v-dialog v-model="dialog.show" max-width="800px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ editMode ? 'Edit action' : 'Create new action' }}
      </v-card-title>
      <v-card-text class="px-4">
        <v-tabs v-model="currentTab" grow>
          <v-tab value="general">General</v-tab>
          <v-tab value="specific">{{ dialog.action?.type ? customActionTypesNames[dialog.action.type] : '' }}</v-tab>
        </v-tabs>

        <v-window v-model="currentTab" class="mt-4">
          <!-- General Tab -->
          <v-window-item value="general">
            <div class="p-4">
              <v-text-field
                v-model="actionConfig.name"
                label="Action Name"
                required
                variant="outlined"
                density="compact"
                class="mb-4"
              />

              <!-- Link to Variables Section -->
              <div class="mt-6">
                <h3 class="text-subtitle-1 font-weight-bold mb-4">Link to Variables</h3>
                <v-text-field
                  v-model="searchQuery"
                  label="Search variables"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-magnify"
                  class="mb-2"
                  clearable
                  @update:model-value="menuOpen = true"
                  @click:clear="menuOpen = false"
                  @update:focused="(isFocused: boolean) => (menuOpen = isFocused)"
                />

                <v-select
                  v-model="selectedVariables"
                  :items="filteredDataLakeVariables"
                  label="Data Lake Variables"
                  multiple
                  chips
                  variant="outlined"
                  density="compact"
                  theme="dark"
                  closable-chips
                  :menu-props="{ modelValue: menuOpen }"
                  @update:menu="menuOpen = $event"
                />

                <v-text-field
                  v-model="minInterval"
                  label="Minimum interval between calls (ms)"
                  type="number"
                  min="0"
                  variant="outlined"
                  density="compact"
                  class="mt-4"
                />

                <div class="mt-4">
                  <p class="text-caption">
                    The action will be called whenever any of the selected variables change, respecting the minimum
                    interval between consecutive calls.
                  </p>
                </div>
              </div>
            </div>
          </v-window-item>

          <!-- Specific Tab -->
          <v-window-item value="specific">
            <div class="p-4">
              <component
                :is="specificConfigComponent"
                ref="specificConfigRef"
                :action-config="actionConfig"
                @update:action-config="updateActionConfig"
              />
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn variant="text" @click="resetConfig">Reset</v-btn>
            <v-btn :disabled="!isFormValid" @click="saveConfig">
              {{ editMode ? 'Save' : 'Create' }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { getActionLink, removeActionLink, saveActionLink } from '@/libs/actions/action-links'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { ActionConfig, customActionTypes, customActionTypesNames } from '@/types/cockpit-actions'

import HttpRequestActionConfig from '../configuration/HttpRequestActionConfig.vue'
import JavascriptActionConfig from '../configuration/JavascriptActionConfig.vue'
import MavlinkMessageActionConfig from '../configuration/MavlinkMessageActionConfig.vue'

const interfaceStore = useAppInterfaceStore()

const emit = defineEmits<{
  (e: 'action-saved'): void
}>()

const dialog = ref({
  show: false,
  action: null as ActionConfig | null,
})

const editMode = ref(false)
const currentTab = ref('general')
const searchQuery = ref('')
const menuOpen = ref(false)
const selectedVariables = ref<string[]>([])
const minInterval = ref(1000)
const actionConfig = ref<any>({})
const specificConfigRef = ref()

const specificConfigComponent = computed(() => {
  if (!dialog.value.action) return null
  switch (dialog.value.action.type) {
    case customActionTypes.httpRequest:
      return HttpRequestActionConfig
    case customActionTypes.mavlinkMessage:
      return MavlinkMessageActionConfig
    case customActionTypes.javascript:
      return JavascriptActionConfig
    default:
      return null
  }
})

const availableDataLakeVariables = computed(() => {
  const variables = getAllDataLakeVariablesInfo()
  return Object.values(variables).map((variable) => ({
    title: variable.id,
    value: variable.id,
  }))
})

const filteredDataLakeVariables = computed(() => {
  const variables = availableDataLakeVariables.value
  if (!searchQuery.value) return variables

  const query = searchQuery.value.toLowerCase()
  return variables.filter((variable) => variable.title.toLowerCase().includes(query))
})

const isFormValid = computed(() => {
  return actionConfig.value.name && (!specificConfigRef.value || specificConfigRef.value.isValid)
})

const updateActionConfig = (newConfig: any): void => {
  actionConfig.value = { ...actionConfig.value, ...newConfig }
}

const openDialog = (item: ActionConfig): void => {
  dialog.value.action = item
  editMode.value = true

  // Load existing link configuration
  const existingLink = getActionLink(item.id)
  selectedVariables.value = existingLink?.variables || []
  minInterval.value = existingLink?.minInterval || 1000

  // Load action specific configuration
  actionConfig.value = { ...item.config, name: item.name }
  dialog.value.show = true
}

const closeDialog = (): void => {
  dialog.value.show = false
  dialog.value.action = null
  editMode.value = false
  currentTab.value = 'general'
  resetConfig()
}

const resetConfig = (): void => {
  actionConfig.value = {}
  selectedVariables.value = []
  minInterval.value = 1000
  searchQuery.value = ''
  if (specificConfigRef.value?.reset) {
    specificConfigRef.value.reset()
  }
}

const saveConfig = (): void => {
  if (!dialog.value.action) return

  // Save the action link configuration
  removeActionLink(dialog.value.action.id)
  if (selectedVariables.value.length > 0) {
    saveActionLink(dialog.value.action.id, dialog.value.action.type, selectedVariables.value, minInterval.value)
  }

  // Save the action specific configuration
  if (specificConfigRef.value?.save) {
    specificConfigRef.value.save(actionConfig.value)
  }

  emit('action-saved')
  closeDialog()
}

defineExpose({
  openDialog,
})
</script>
