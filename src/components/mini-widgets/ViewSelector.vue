<template>
  <div>
    <Dropdown
      name-key="name"
      :model-value="widgetStore.currentView"
      :options="widgetStore.currentProfile.views"
      class="min-w-[128px]"
      @update:model-value="widgetStore.selectView"
    />
  </div>
</template>

<script setup lang="ts">
import { useWidgetManagerStore } from '@/stores/widgetManager'

import Dropdown from '../Dropdown.vue'

const widgetStore = useWidgetManagerStore()
</script>
