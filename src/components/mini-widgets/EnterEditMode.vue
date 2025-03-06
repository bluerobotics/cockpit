<template>
  <div>
    <v-tooltip :text="widgetStore.editingMode ? 'Exit edit mode' : 'Enter edit mode'" location="bottom">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps" class="relative cursor-pointer mr-2 scale-75" @click="toggleEditMode">
          <FontAwesomeIcon icon="fa-solid fa-pencil" size="xl" class="text-white mb-1" />
          <FontAwesomeIcon
            :icon="widgetStore.editingMode ? 'fa-square-caret-down' : 'fa-square-caret-up'"
            size="lg"
            class="absolute right-[2px] mt-[13px] -mr-2"
          />
        </div>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useWidgetManagerStore } from '@/stores/widgetManager'

const widgetStore = useWidgetManagerStore()

const toggleEditMode = (): void => {
  widgetStore.editingMode = !widgetStore.editingMode
}
</script>
