<template>
  <div :class="{ 'pointer-events-none': widgetStore.editingMode }">
    <Dropdown
      name-key="name"
      :model-value="widgetStore.currentView"
      :options="widgetStore.currentProfile.views.filter((v) => v.visible)"
      class="min-w-[128px]"
      @update:model-value="onSelectView"
    />
  </div>
  <v-dialog v-model="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen" width="500">
    <v-card class="pa-4 text-white" style="border-radius: 15px" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">View selector</v-card-title>
      <v-card-text class="flex flex-col gap-y-4">
        <div class="absolute top-2 right-2 z-10">
          <v-btn
            icon
            size="30"
            variant="text"
            class="text-white text-[22px]"
            aria-label="Close"
            @click="widgetStore.miniWidgetManagerVars(miniWidget.hash).configMenuOpen = false"
          >
            <i class="mdi mdi-close"></i>
          </v-btn>
        </div>
        <v-switch
          :model-value="widgetStore.unmountHiddenViews"
          label="Unload hidden views"
          color="white"
          hide-details
          base-color="#FFFFFF33"
          @update:model-value="widgetStore.setUnmountHiddenViews"
        />
        <p class="text-sm opacity-80">
          Only the view you are looking at stays loaded. Widgets on other views start again when you switch to them.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { MiniWidget, View } from '@/types/widgets'

import Dropdown from '../Dropdown.vue'

const props = defineProps<{
  /**
   * Configuration of the widget
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

const onSelectView = (view: View): void => {
  logUserAction(`Selected view '${view.name}'`)
  widgetStore.selectView(view)
}
</script>
