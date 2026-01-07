<template>
  <div>
    <select
      :value="widgetStore.currentView.hash"
      class="flex items-center justify-center w-full py-1 pl-2 pr-8 text-base font-bold transition-all border-0 rounded-md shadow-inner cursor-pointer h-9 bg-slate-800/60 text-slate-100 hover:bg-slate-600/60 min-w-[128px]"
      @change="handleViewChange"
    >
      <option v-for="view in visibleViews" :key="view.hash" :value="view.hash">
        {{ translateViewName(view.name) }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWidgetManagerStore } from '@/stores/widgetManager'

const widgetStore = useWidgetManagerStore()
const { t } = useI18n()

const visibleViews = computed(() => widgetStore.currentProfile.views.filter((v) => v.visible))

// Helper function to translate view names
const translateViewName = (name: string): string => {
  // Try direct translation with the exact name
  const directKey = `views.${name}`
  if (t(directKey) !== directKey) {
    return t(directKey)
  }
  
  // Return original name if no translation found
  return name
}

const handleViewChange = (event: Event): void => {
  const target = event.target as HTMLSelectElement
  const selectedHash = target.value
  const selectedView = widgetStore.currentProfile.views.find((v) => v.hash === selectedHash)
  if (selectedView) {
    widgetStore.selectView(selectedView)
  }
}
</script>
