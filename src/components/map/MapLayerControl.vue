<template>
  <div class="hidden">
    <div
      ref="controlElement"
      class="maplibregl-ctrl cockpit-layer-control text-[12px] rounded-[4px]"
      :style="interfaceStore.globalGlassMenuStyles"
      @mouseenter="expanded = true"
      @mouseleave="expanded = false"
      @click.stop
      @dblclick.stop
      @wheel.stop
      @contextmenu.stop
    >
      <button
        v-if="!expanded"
        type="button"
        class="flex items-center justify-center w-[44px] h-[44px]"
        title="Layers"
        aria-label="Map layers"
        @click="expand"
      >
        <v-icon icon="mdi-layers" size="24" />
      </button>
      <div v-else class="px-2 py-[6px] min-w-[160px]">
        <label v-for="layer in baseLayers" :key="layer.id" class="flex items-center gap-[6px] cursor-pointer leading-5">
          <input
            type="radio"
            name="cockpit-base-layer"
            class="cockpit-layer-control__input"
            :checked="layer.active"
            @change="emit('selectBase', layer.id)"
          />
          <span>{{ layer.label }}</span>
        </label>
        <div v-if="baseLayers.length && overlays.length" class="cockpit-layer-control__separator" />
        <template v-for="layer in overlays" :key="layer.id">
          <label
            class="flex items-center gap-[6px] leading-5"
            :class="layer.unavailableReason ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'"
          >
            <input
              type="checkbox"
              class="cockpit-layer-control__input"
              :checked="layer.active"
              :disabled="!!layer.unavailableReason"
              @change="emit('toggleOverlay', layer.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ layer.label }}</span>
          </label>
          <p v-if="layer.unavailableReason" class="max-w-[160px] pl-[19px] text-[10px] leading-3 opacity-70">
            {{ layer.unavailableReason }}
          </p>
        </template>
        <div class="cockpit-layer-control__separator" />
        <button type="button" class="cockpit-layer-control__action" @click="openProviderSettings">
          Add map provider
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { IControl } from 'maplibre-gl'
import { onBeforeUnmount, ref } from 'vue'

import type { MapLayerSelectorEntry } from '@/composables/map/useMapTileLayerSelection'
import { goToMenuPage } from '@/composables/menuRouting'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { SubMenuComponentName } from '@/types/general'

defineProps<{
  /**
   * The base maps to pick one of.
   */
  baseLayers: MapLayerSelectorEntry[]
  /**
   * The overlays to toggle.
   */
  overlays: MapLayerSelectorEntry[]
}>()

const emit = defineEmits<{
  (event: 'selectBase', id: string): void
  (event: 'toggleOverlay', id: string, enabled: boolean): void
}>()

const interfaceStore = useAppInterfaceStore()
const controlElement = ref<HTMLElement>()
const expanded = ref(false)

// Touch has no hover, so a tap on the collapsed button opens the list and a tap anywhere else closes it.
const expand = (): void => {
  expanded.value = true
}
onClickOutside(controlElement, () => (expanded.value = false))

const openProviderSettings = (): void => {
  logUserAction('Opened custom map providers from the map layer selector')
  interfaceStore.mapCustomProvidersExpandRequested = true
  goToMenuPage(SubMenuComponentName.ToolsMap)
}

// The selector is handed to the map as a control, which moves its element into the map's control corner.
const control: IControl = {
  onAdd: () => controlElement.value as HTMLElement,
  onRemove: () => {
    controlElement.value?.remove()
    expanded.value = false
  },
}

onBeforeUnmount(() => controlElement.value?.remove())

defineExpose({ control })
</script>

<style scoped>
.cockpit-layer-control__input {
  accent-color: currentColor;
}

.cockpit-layer-control__separator {
  height: 0;
  border-top: 1px solid #ffffff44;
  margin: 5px -8px 5px -6px;
}

.cockpit-layer-control__action {
  display: block;
  width: 100%;
  padding: 6px 8px;
  margin-top: 6px;
  border-radius: 4px;
  background: #ffffff22;
  color: #fff;
  box-shadow: 1px 1px 2px 0 rgba(0, 0, 0, 0.2);
}
</style>
