<template>
  <div>
    <Dropdown
      name-key="translatedName"
      :model-value="currentViewWithTranslation"
      :options="viewsWithTranslation"
      class="min-w-[128px]"
      @update:model-value="handleViewChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWidgetManagerStore } from '@/stores/widgetManager'

import Dropdown from '../Dropdown.vue'

const widgetStore = useWidgetManagerStore()
const { t } = useI18n()

const translateViewName = (viewName: string): string => {
  const nameMap: Record<string, string> = {
    'Video View': t('views.ConfigurationVideoView.videoView'),
    'Map View': t('views.ConfigurationVideoView.mapView'),
    'HUD View': t('views.ConfigurationVideoView.hudView'),
    'Map view': t('views.ConfigurationVideoView.mapView'), // Handle lowercase variant
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

const handleViewChange = (newView: any): void => {
  // Find the original view object by matching the hash
  const originalView = widgetStore.currentProfile.views.find((v) => v.hash === newView.hash)
  if (originalView) {
    widgetStore.selectView(originalView)
  }
}
</script>
