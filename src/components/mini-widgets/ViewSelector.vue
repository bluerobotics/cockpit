<template>
  <div :class="{ 'pointer-events-none': widgetStore.editingMode }">
    <Dropdown
      name-key="translatedName"
      :model-value="currentViewWithTranslation"
      :options="viewsWithTranslation"
      class="min-w-[128px]"
      @update:model-value="onSelectView"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { View } from '@/types/widgets'

import Dropdown from '../Dropdown.vue'

const widgetStore = useWidgetManagerStore()
const { t } = useI18n()

const translateViewName = (viewName: string): string => {
  const nameMap: Record<string, string> = {
    'Video View': t('Video View'),
    'Map View': t('Map View'),
    'HUD View': t('HUD View'),
    'Map view': t('Map View'), // Handle lowercase variant
  }
  return nameMap[viewName] || viewName
}

const viewsWithTranslation = computed(() => {
  return widgetStore.currentProfile.views
    .filter((v) => v.visible)
    .map((v) => ({
      ...v,
      translatedName: translateViewName(v.name),
    }))
})

const currentViewWithTranslation = computed(() => {
  const currentView = widgetStore.currentView
  return {
    ...currentView,
    translatedName: translateViewName(currentView.name),
  }
})

const onSelectView = (
  view: View & {
    /**
ccccccccccccccccccccccccccccccccccccc *
ccccccccccccccccccccccccccccccccccccc
     */
    translatedName?: string
  }
): void => {
  logUserAction(`Selected view '${view.name}'`)
  // Find the original view object by matching the hash
  const originalView = widgetStore.currentProfile.views.find((v) => v.hash === view.hash)
  if (originalView) {
    widgetStore.selectView(originalView)
  }
}
</script>
