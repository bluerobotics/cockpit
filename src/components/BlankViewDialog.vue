<template>
  <InteractionDialog
    :show-dialog="isVisible"
    variant="text-only"
    title="Empty view"
    message="Your current view has no widgets. Open edit mode to add video players, indicators, maps, and more."
    max-width="400"
    :actions="actions"
    @update:show-dialog="isVisible = $event"
  >
    <template #content>
      <div class="flex justify-center">
        <v-btn class="bg-[#FFFFFF22] shadow-2 mb-4" variant="flat" append-icon="mdi-pencil" @click="openEditMode">
          Open edit mode
        </v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useWidgetManagerStore } from '@/stores/widgetManager'

import type { Action } from './InteractionDialog.vue'
import InteractionDialog from './InteractionDialog.vue'

const widgetStore = useWidgetManagerStore()

const suppressDialog = useBlueOsStorage('cockpit-suppress-blank-view-dialog', false)
const isVisible = ref(false)

const actions = computed<Action[]>(() => [
  { text: "Don't show again", size: 'small', action: suppressAndDismiss },
  { text: 'Close', size: 'small', action: dismiss },
])

watch(
  () => widgetStore.currentView,
  (view) => {
    if (!view || suppressDialog.value || widgetStore.editingMode) return
    isVisible.value = view.widgets.isEmpty()
  },
  { immediate: true }
)

const dismiss = (): void => {
  isVisible.value = false
}

const suppressAndDismiss = (): void => {
  suppressDialog.value = true
  isVisible.value = false
}

const openEditMode = (): void => {
  isVisible.value = false
  widgetStore.editingMode = true
}
</script>
