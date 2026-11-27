<template>
  <v-menu
    :model-value="open"
    :close-on-content-click="false"
    location="top end"
    theme="dark"
    @update:model-value="onMenuToggle"
  >
    <template #activator="{ props: menuProps }">
      <v-tooltip location="top" :text="t`Map layers`" :disabled="open">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="{ ...menuProps, ...tooltipProps }"
            class="absolute m-3 rounded-sm shadow-sm bg-slate-50 text-[14px]"
            :style="[interfaceStore.globalGlassMenuStyles, activatorStyle ?? {}]"
            :aria-label="t`Map layers`"
            elevation="2"
            icon="mdi-layers-outline"
            size="x-small"
          />
        </template>
      </v-tooltip>
    </template>

    <div :style="interfaceStore.globalGlassMenuStyles" class="min-w-[220px] rounded-lg p-3">
      <p class="text-xs font-bold opacity-70">{{ t`Base map` }}</p>
      <v-radio-group :model-value="activeBaseId" density="compact" hide-details @update:model-value="selectBase">
        <v-radio v-for="option in baseOptions" :key="option.id" :value="option.id" :label="option.name" />
      </v-radio-group>
      <template v-if="overlayOptions.length > 0">
        <v-divider class="my-2" />
        <p class="text-xs font-bold opacity-70">{{ t`Overlays` }}</p>
        <v-checkbox
          v-for="option in overlayOptions"
          :key="option.id"
          :model-value="option.active"
          :label="option.name"
          density="compact"
          hide-details
          @update:model-value="toggleOverlay(option)"
        />
      </template>
      <v-divider class="my-2" />
      <v-btn block variant="flat" class="bg-[#FFFFFF22] text-white" size="small" @click="openCustomProviders">
        {{ t`Add map provider` }}
      </v-btn>
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { type StyleValue, computed, defineModel, onBeforeUnmount, ref } from 'vue'

import { goToMenuPage } from '@/composables/menuRouting'
import type { MapLayerControl, MapLayerOption } from '@/libs/map/map-layer-control'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { SubMenuComponentName } from '@/types/general'

const props = defineProps<{
  /** Registry of the map's base maps and overlays */
  control: MapLayerControl
  /** Inline style positioning the activator button */
  activatorStyle?: StyleValue
}>()

const open = defineModel<boolean>('open', { default: false })

const interfaceStore = useAppInterfaceStore()

// Layers can change from code (a restored custom provider, a new GeoTIFF), so the list is re-read whenever it opens.
const options = ref<MapLayerOption[]>([])
const refresh = (): void => {
  options.value = props.control.options()
}

// Traffic and hazard overlays are listed and rebuilt from timers and watchers, so an open list follows them.
const stopFollowingLayers = props.control.onChange(() => open.value && refresh())
onBeforeUnmount(stopFollowingLayers)

const baseOptions = computed(() => options.value.filter((option) => !option.overlay))
const overlayOptions = computed(() => options.value.filter((option) => option.overlay))
const activeBaseId = computed(() => baseOptions.value.find((option) => option.active)?.id)

const onMenuToggle = (value: boolean): void => {
  if (value) refresh()
  logUserAction(`${value ? 'Opened' : 'Closed'} the map layer selector`)
  open.value = value
}

const selectBase = (id: unknown): void => {
  if (typeof id !== 'number') return
  props.control.select(id)
  refresh()
}

const toggleOverlay = (option: MapLayerOption): void => {
  props.control.select(option.id)
  refresh()
}

const openCustomProviders = (): void => {
  logUserAction('Opened custom map providers from the map layer selector')
  open.value = false
  interfaceStore.mapCustomProvidersExpandRequested = true
  goToMenuPage(SubMenuComponentName.ToolsMap)
}
</script>
