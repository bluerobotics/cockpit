<template>
  <Teleport to="body">
    <div
      v-if="store.contextPopupOpen && config.position"
      class="base-station-context-popup fixed z-[99999] flex flex-col rounded-md text-white"
      :style="[
        interfaceStore.globalGlassMenuStyles,
        { background: '#333333EE', border: '1px solid #FFFFFF44' },
        { top: `${position.y}px`, left: `${position.x}px`, width: `${POPUP_WIDTH}px` },
      ]"
      @click.stop
      @contextmenu.stop.prevent
    >
      <div class="flex justify-between items-center pt-1 pb-2 px-2">
        <p class="text-[14px] truncate mr-2">Base station</p>
        <div class="flex shrink-0 items-center gap-x-1">
          <v-btn
            v-tooltip="{ text: signalVisibilityTooltip, zIndex: TOOLTIP_Z_INDEX }"
            :icon="signalVisibilityIcon"
            variant="text"
            size="x-small"
            color="white"
            :aria-label="signalVisibilityTooltip"
            @click="onToggleSignalVisibility"
          />
          <v-btn
            v-tooltip="{ text: 'Remove base station', zIndex: TOOLTIP_Z_INDEX }"
            icon="mdi-trash-can"
            variant="text"
            size="x-small"
            color="white"
            aria-label="Remove base station"
            @click="onDelete"
          />
          <v-btn
            v-tooltip="{ text: 'Configure base station', zIndex: TOOLTIP_Z_INDEX }"
            icon="mdi-cog"
            variant="text"
            size="x-small"
            color="white"
            aria-label="Configure base station"
            @click="onConfigure"
          />
        </div>
      </div>

      <v-divider />

      <div
        class="flex flex-col justify-center w-full items-center py-1 px-2 bg-[#EEEEEE] text-black rounded-bl-md rounded-br-md"
      >
        <div class="flex w-full items-center gap-x-2 text-[10px] py-[1px] mb-[2px]">
          <v-icon
            v-tooltip="{ text: 'Copy latitude to clipboard', zIndex: TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-content-copy"
            size="x-small"
            color="black"
            class="text-[12px] cursor-pointer shrink-0"
            @click="onCopyCoordinate(0)"
          />
          <p class="flex-1">Lat.:</p>
          <p>{{ config.position[0].toFixed(7) }}</p>
        </div>
        <v-divider class="border-black w-full" />
        <div class="flex w-full items-center gap-x-2 text-[10px] py-[1px]">
          <v-icon
            v-tooltip="{ text: 'Copy longitude to clipboard', zIndex: TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-content-copy"
            size="x-small"
            color="black"
            class="text-[12px] cursor-pointer shrink-0"
            @click="onCopyCoordinate(1)"
          />
          <p class="flex-1">Long.:</p>
          <p>{{ config.position[1].toFixed(7) }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

import { confirmRemoveBaseStation, useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { baseStationSignalVisibilityIcon, baseStationSignalVisibilityLabel } from '@/libs/baseStation/menu'
import { copyToClipboard } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

// Approximate rendered popup size in px; used only to clamp the popup inside the viewport.
const POPUP_WIDTH = 221
const POPUP_HEIGHT = 110
const TOOLTIP_Z_INDEX = 100000

// Popup state lives in the store, so the click/keydown listeners are registered once at the
// module level, regardless of how many widgets mount this component.
let activeInstanceCount = 0
let documentClickHandler: ((event: MouseEvent) => void) | null = null
let documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null

const store = useBaseStation()
const interfaceStore = useAppInterfaceStore()
const { showDialog, closeDialog } = useInteractionDialog()

const config = computed(() => store.config)
const signalVisibilityIcon = computed(() => baseStationSignalVisibilityIcon(config.value.showSignalOnMap))
const signalVisibilityTooltip = computed(() => baseStationSignalVisibilityLabel(config.value.showSignalOnMap))

// Clamp the popup inside the viewport so it never opens off-screen near the map edges.
const position = computed(() => {
  const margin = 8
  let x = store.contextPopupPosition.x
  let y = store.contextPopupPosition.y
  if (x + POPUP_WIDTH > window.innerWidth - margin) x = window.innerWidth - POPUP_WIDTH - margin
  if (y + POPUP_HEIGHT > window.innerHeight - margin) y = window.innerHeight - POPUP_HEIGHT - margin
  if (x < margin) x = margin
  if (y < margin) y = margin
  return { x, y }
})

const onDelete = (): void => {
  store.closeContextPopup()
  confirmRemoveBaseStation(showDialog, closeDialog)
}

const onConfigure = (): void => {
  store.configPanelOpen = true
  store.closeContextPopup()
}

const onToggleSignalVisibility = (): void => {
  store.toggleSignalVisibility()
}

const onCopyCoordinate = async (index: 0 | 1): Promise<void> => {
  if (!config.value.position) return
  const label = index === 0 ? 'Latitude' : 'Longitude'
  try {
    await copyToClipboard(`${config.value.position[index]}`)
    logUserAction(`Copied the base station ${label.toLowerCase()} to the clipboard`)
    openSnackbar({ message: `${label} copied to clipboard.`, variant: 'success' })
  } catch (error) {
    openSnackbar({ message: `Failed to copy ${label.toLowerCase()}: ${(error as Error).message}`, variant: 'error' })
  }
}

onMounted(() => {
  if (activeInstanceCount === 0) {
    documentClickHandler = () => {
      if (store.contextPopupOpen) store.closeContextPopup()
    }
    documentKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && store.contextPopupOpen) store.closeContextPopup()
    }
    document.addEventListener('click', documentClickHandler)
    window.addEventListener('keydown', documentKeydownHandler)
  }
  activeInstanceCount++
})

onBeforeUnmount(() => {
  activeInstanceCount--
  if (activeInstanceCount === 0) {
    if (documentClickHandler) document.removeEventListener('click', documentClickHandler)
    if (documentKeydownHandler) window.removeEventListener('keydown', documentKeydownHandler)
    documentClickHandler = null
    documentKeydownHandler = null
  }
})
</script>
