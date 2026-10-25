<template>
  <BaseConfigurationView>
    <template #title>DIY widgets</template>
    <template #content>
      <div class="flex flex-col gap-y-3 py-3" :class="interfaceStore.isOnSmallScreen ? 'w-[80vw]' : 'w-[600px]'">
        <p class="text-sm text-white/70">
          Widgets saved with "Save to library" in a DIY widget's editor. Add them to the current view, or share them
          through a recipe in Tools > Recipes.
        </p>
        <v-data-table
          :items="templateItems"
          :headers="headers"
          items-per-page="10"
          density="compact"
          theme="dark"
          class="rounded-md bg-[#FFFFFF11]"
        >
          <template #item.actions="{ item }">
            <div class="flex justify-end">
              <v-btn
                icon="mdi-plus-box-outline"
                variant="text"
                size="small"
                :aria-label="`Add ${item.name} to the current view`"
                title="Add to the current view"
                @click="addToCurrentView(item.id)"
              />
              <v-btn
                icon="mdi-trash-can-outline"
                variant="text"
                size="small"
                :aria-label="`Remove ${item.name} from the library`"
                title="Remove from the library"
                @click="confirmDelete(item.id)"
              />
            </div>
          </template>
          <template #no-data>
            <p class="py-3">No DIY widgets saved yet</p>
          </template>
        </v-data-table>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import DoItYourselfImg from '@/assets/widgets/DoItYourself.png'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { deleteDiyWidgetTemplate, getAllDiyWidgetTemplates } from '@/libs/diy-widget-library'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { widgetDefaultSizes, WidgetType } from '@/types/widgets'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()
const { showDialog, closeDialog } = useInteractionDialog()
const { openSnackbar } = useSnackbar()

const templates = ref(getAllDiyWidgetTemplates())
const templateItems = computed(() => Object.entries(templates.value).map(([id, template]) => ({ id, ...template })))

const headers = [
  { title: 'Name', key: 'name' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const addToCurrentView = (id: string): void => {
  const { name, ...options } = templates.value[id]
  logUserAction(`Added DIY widget "${name}" from the library to the current view`)
  const view = widgetStore.currentView
  const setup = {
    component: WidgetType.DoItYourself,
    name: widgetStore.uniqueWidgetName(name, view),
    icon: DoItYourselfImg,
    options: { ...options, libraryId: id },
    defaultSize: widgetDefaultSizes[WidgetType.DoItYourself],
  }
  widgetStore.addWidget(setup, view)
  openSnackbar({ message: `Added "${name}" to the current view.`, variant: 'success', duration: 3000 })
}

const confirmDelete = (id: string): void => {
  const { name } = templates.value[id]
  logUserAction(`Opened the dialog to remove DIY widget "${name}" from the library`)
  showDialog({
    title: 'Remove DIY widget',
    variant: 'warning',
    maxWidth: 480,
    message: `Remove "${name}" from the library? Widgets already placed on views are kept.`,
    actions: [
      {
        text: 'Cancel',
        action: () => {
          logUserAction(`Cancelled removing DIY widget "${name}" from the library`)
          closeDialog()
        },
      },
      {
        text: 'Remove',
        class: 'bg-[#FFFFFF33] text-white',
        action: () => {
          logUserAction(`Removed DIY widget "${name}" from the library`)
          closeDialog()
          deleteDiyWidgetTemplate(id)
          templates.value = getAllDiyWidgetTemplates()
          openSnackbar({ message: `Removed "${name}" from the library.`, variant: 'success', duration: 3000 })
        },
      },
    ],
  })
}
</script>
