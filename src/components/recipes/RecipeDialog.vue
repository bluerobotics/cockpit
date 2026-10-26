<template>
  <InteractionDialog
    :show-dialog="modelValue"
    :title="title"
    variant="text-only"
    :max-width="interfaceStore.isOnPhoneScreen ? '95vw' : 920"
    @update:show-dialog="onDialogUpdate"
  >
    <template #content>
      <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
        <v-btn icon :width="34" :height="34" variant="text" aria-label="Close" class="bg-transparent" @click="close">
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>
      <div class="-mt-7 text-white">
        <v-tabs v-model="activeTab" density="compact" show-arrows @update:model-value="onTabChange">
          <v-tab value="general">General</v-tab>
          <v-tab
            v-for="area in areas"
            :key="area.value"
            :value="area.value"
            :disabled="itemsOf(area.value).length === 0"
          >
            {{ area.title }} ({{ selectedOf(area.value).length }}/{{ itemsOf(area.value).length }})
          </v-tab>
        </v-tabs>
        <v-tabs-window v-model="activeTab" class="mt-3 h-[50vh] overflow-y-auto">
          <v-tabs-window-item value="general">
            <div class="flex flex-col gap-y-3">
              <slot name="general" />
              <div
                v-if="Object.keys(missing).length > 0"
                class="flex items-start gap-x-3 rounded-lg bg-[#FFFFFF11] p-3 text-body-2"
              >
                <v-icon size="20" color="amber">mdi-alert-outline</v-icon>
                <span>
                  {{ Object.keys(missing).length }} selected item(s) need others that were left out, and may not work.
                  Their tabs mark which ones.
                </span>
              </div>
            </div>
          </v-tabs-window-item>
          <v-tabs-window-item v-for="area in areas" :key="area.value" :value="area.value">
            <v-data-table
              :model-value="selectedOf(area.value)"
              :items="itemsOf(area.value)"
              :headers="headers"
              item-value="key"
              show-select
              density="compact"
              theme="dark"
              items-per-page="-1"
              hide-default-footer
              class="rounded-md bg-[#FFFFFF11]"
              @update:model-value="(keys: string[]) => onTableSelection(area.value, keys)"
            >
              <template #item.name="{ item }">
                <p>{{ item.name }}</p>
                <p v-if="item.id !== item.name" class="text-xs opacity-60 font-mono">{{ item.id }}</p>
              </template>
              <template #item.notes="{ item }">
                <div class="flex flex-wrap justify-end gap-1">
                  <v-chip v-if="conflicts.includes(item.key)" size="x-small" label>
                    {{ item.area === 'websockets' ? 'Already added' : 'Replaces existing' }}
                  </v-chip>
                  <v-chip v-if="neededBy[item.key]" size="x-small" color="amber" label>
                    Needed by {{ namesOf(neededBy[item.key]) }}
                  </v-chip>
                  <v-chip v-if="missing[item.key]" size="x-small" color="amber" label>
                    Needs {{ namesOf(missing[item.key]) }}
                  </v-chip>
                </div>
              </template>
            </v-data-table>
          </v-tabs-window-item>
        </v-tabs-window>
      </div>
    </template>
    <template #actions>
      <div class="flex w-full px-1 py-2">
        <v-btn variant="text" size="small" @click="close">Cancel</v-btn>
        <v-spacer />
        <v-btn size="small" class="bg-[#FFFFFF33] text-white" :disabled="primaryDisabled" @click="emit('primary')">
          {{ primaryText }}
        </v-btn>
      </div>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import { missingDependencies, withDependencies } from '@/libs/recipes'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { RecipeArea, RecipeItem } from '@/types/recipes'

const props = withDefaults(
  defineProps<{
    /**
     * Whether the dialog is open
     */
    modelValue: boolean
    /**
     * Title of the dialog
     */
    title: string
    /**
     * Every item the user can choose from
     */
    items: RecipeItem[]
    /**
     * Keys of the items each item needs, by item key
     */
    dependencies: Record<string, string[]>
    /**
     * Keys of the chosen items
     */
    selected: string[]
    /**
     * Keys of the items that already exist in this Cockpit
     */
    conflicts?: string[]
    /**
     * Text of the footer's main button
     */
    primaryText: string
    /**
     * Whether the footer's main button is disabled
     */
    primaryDisabled?: boolean
  }>(),
  { conflicts: () => [], primaryDisabled: false }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:selected', value: string[]): void
  (e: 'primary'): void
}>()

const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const areas: {
  /**
   * Part of the recipe the tab lists
   */
  value: RecipeArea
  /**
   * Label shown on the tab
   */
  title: string
}[] = [
  { value: 'dataLake', title: 'Data lake' },
  { value: 'actions', title: 'Actions' },
  { value: 'websockets', title: 'WebSockets' },
  { value: 'diyWidgets', title: 'DIY widgets' },
]
const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'kind' },
  { title: '', key: 'notes', sortable: false, align: 'end' as const },
]

const activeTab = ref<RecipeArea | 'general'>('general')
watch(
  () => props.modelValue,
  (open) => {
    if (open) activeTab.value = 'general'
  }
)

const areaTitle = (area: RecipeArea): string => areas.find((a) => a.value === area)?.title ?? area
const itemsOf = (area: RecipeArea): RecipeItem[] => props.items.filter((item) => item.area === area)
const selectedOf = (area: RecipeArea): string[] => {
  const keys = new Set(itemsOf(area).map((item) => item.key))
  return props.selected.filter((key) => keys.has(key))
}
const namesOf = (keys: string[]): string =>
  keys.map((key) => props.items.find((item) => item.key === key)?.name ?? key).join(', ')

const missing = computed(() => missingDependencies(props.selected, props.dependencies))
const neededBy = computed(() => {
  const result: Record<string, string[]> = {}
  Object.entries(missing.value).forEach(([key, needed]) => needed.forEach((n) => (result[n] ??= []).push(key)))
  return result
})

const onTableSelection = (area: RecipeArea, keys: string[]): void => {
  const areaKeys = new Set(itemsOf(area).map((item) => item.key))
  const chosen = keys.filter((key) => areaKeys.has(key))
  const added = chosen.filter((key) => !props.selected.includes(key))
  const kept = props.selected.filter((key) => !areaKeys.has(key) || chosen.includes(key))
  // Only what was just chosen brings its dependencies along, so items the user left out stay out.
  const next = [...new Set([...kept, ...withDependencies(added, props.dependencies)])]
  const extra = next.length - kept.length - added.length
  logUserAction(`Changed the ${areaTitle(area)} items chosen in the "${props.title}" dialog`)
  if (extra > 0) {
    openSnackbar({ message: `Also selected ${extra} item(s) the selection needs.`, variant: 'info', duration: 3000 })
  }
  emit('update:selected', next)
}

const onTabChange = (tab: unknown): void => {
  const title = tab === 'general' ? 'General' : areaTitle(tab as RecipeArea)
  logUserAction(`Switched to the "${title}" tab of the "${props.title}" dialog`)
}

const close = (): void => {
  logUserAction(`Closed the "${props.title}" dialog`)
  emit('update:modelValue', false)
}

const onDialogUpdate = (value: boolean): void => {
  if (!value && props.modelValue) close()
}
</script>
