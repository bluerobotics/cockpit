<template>
  <v-dialog v-model="dialog.show" max-width="500px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">Link Action to Variables</v-card-title>
      <v-card-text class="px-8">
        <div v-if="dialog.action" class="mb-4">
          <p class="text-subtitle-1 font-weight-bold">Action: {{ dialog.action.name }}</p>
          <p class="text-caption">Type: {{ humanizeString(dialog.action.type) }}</p>
        </div>

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
          v-model="dialog.selectedVariables"
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
          v-model="dialog.minInterval"
          label="Minimum interval between calls (ms)"
          type="number"
          min="0"
          variant="outlined"
          density="compact"
          class="mt-4"
        />

        <div class="mt-4">
          <p class="text-caption">
            The action will be called whenever any of the selected variables change, respecting the minimum interval
            between consecutive calls.
          </p>
        </div>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn :disabled="!isFormValid" @click="saveConfig">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { getActionLink, removeActionLink, saveActionLink } from '@/libs/actions/action-links'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import { humanizeString } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { ActionConfig } from '@/types/cockpit-actions'

const interfaceStore = useAppInterfaceStore()
const searchQuery = ref('')
const menuOpen = ref(false)

const emit = defineEmits<{
  (e: 'save', action: ActionConfig, variables: string[], minInterval: number): void
}>()

const defaultDialogConfig = {
  show: false,
  action: null as ActionConfig | null,
  selectedVariables: [] as string[],
  minInterval: 1000,
}

const dialog = ref(defaultDialogConfig)

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
  return dialog.value.action && dialog.value.minInterval >= 0
})

const openDialog = (item: ActionConfig): void => {
  const existingLink = getActionLink(item.id)
  dialog.value = {
    show: true,
    action: item,
    selectedVariables: existingLink?.variables || [],
    minInterval: existingLink?.minInterval || 1000,
  }
}

const closeDialog = (): void => {
  dialog.value = defaultDialogConfig
}

const saveConfig = (): void => {
  if (!dialog.value.action) return

  // Always remove the existing link first
  removeActionLink(dialog.value.action.id)

  // Only create a new link if variables are selected
  if (dialog.value.selectedVariables.length > 0) {
    saveActionLink(
      dialog.value.action.id,
      dialog.value.action.type,
      dialog.value.selectedVariables,
      dialog.value.minInterval
    )
  }

  emit('save', dialog.value.action, dialog.value.selectedVariables, dialog.value.minInterval)
  closeDialog()
}

defineExpose({
  openDialog,
})
</script>
