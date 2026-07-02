<template>
  <Teleport to="body">
    <div
      v-if="visible && selectedPoi"
      class="poi-popup-menu fixed z-[99999] flex flex-col rounded-md text-white"
      :style="[
        interfaceStore.globalGlassMenuStyles,
        { background: '#333333EE', border: '1px solid #FFFFFF44' },
        { top: `${position.y}px`, left: `${position.x}px`, width: `${POI_POPUP_WIDTH}px` },
      ]"
      @click.stop
      @contextmenu.stop.prevent
    >
      <div class="flex justify-between items-center pt-1 pb-2 px-2">
        <p class="text-[14px] truncate mr-2">{{ selectedPoi.name }}</p>
        <div class="flex shrink-0 items-center gap-x-3">
          <v-icon
            v-if="!isGotoTarget"
            v-tooltip="{ text: 'GoTo Point of Interest', zIndex: POI_POPUP_TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-crosshairs-gps"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[17px] cursor-pointer mt-1"
            @click="onGotoClick"
          ></v-icon>
          <v-icon
            v-else
            v-tooltip="{
              text: 'Cancel GoTo command (vehicle will hold at current position)',
              zIndex: POI_POPUP_TOOLTIP_Z_INDEX,
            }"
            variant="text"
            icon="mdi-close-circle-multiple-outline"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[17px] cursor-pointer mt-1"
            @click="onCancelGotoClick"
          ></v-icon>
          <v-icon
            v-tooltip="{ text: 'Delete Point of Interest', zIndex: POI_POPUP_TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-trash-can"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[17px] cursor-pointer mt-1"
            @click="onDeleteClick"
          ></v-icon>
          <v-icon
            v-tooltip="{ text: 'Edit Point of Interest', zIndex: POI_POPUP_TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-pencil"
            rounded="full"
            size="x-small"
            color="white"
            class="text-[17px] cursor-pointer mt-1"
            @click="onEditClick"
          ></v-icon>
        </div>
      </div>

      <v-divider />

      <div
        class="flex flex-col justify-center w-full items-center py-1 px-2 bg-[#EEEEEE] text-black rounded-bl-md rounded-br-md"
      >
        <div class="flex w-full items-center gap-x-2 text-[10px] py-[1px] mb-[2px]">
          <v-icon
            v-tooltip="{ text: 'Copy latitude to clipboard', zIndex: POI_POPUP_TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-content-copy"
            size="x-small"
            color="black"
            class="text-[12px] cursor-pointer shrink-0"
            @click="onCopyCoordinate(0)"
          ></v-icon>
          <p class="flex-1">Lat.:</p>
          <p>{{ selectedPoi.coordinates[0].toFixed(7) }}</p>
        </div>
        <v-divider class="border-black w-full" />
        <div class="flex w-full items-center gap-x-2 text-[10px] py-[1px]">
          <v-icon
            v-tooltip="{ text: 'Copy longitude to clipboard', zIndex: POI_POPUP_TOOLTIP_Z_INDEX }"
            variant="text"
            icon="mdi-content-copy"
            size="x-small"
            color="black"
            class="text-[12px] cursor-pointer shrink-0"
            @click="onCopyCoordinate(1)"
          ></v-icon>
          <p class="flex-1">Long.:</p>
          <p>{{ selectedPoi.coordinates[1].toFixed(7) }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { copyToClipboard } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import { type DialogActions } from '@/types/general'
import type { PointOfInterest } from '@/types/mission'

const props = withDefaults(
  defineProps<{
    /**
     * Id of the PoI currently flagged as the active GoTo target, or null/undefined when none. Used to
     * decide whether this popup shows the "GoTo" or the "Cancel GoTo" action for the selected PoI.
     */
    gotoTargetId?: string | null
  }>(),
  { gotoTargetId: null }
)

const emit = defineEmits<{
  /**
   * Emitted when the user requests a GoTo to the selected PoI.
   */
  (event: 'goto', poi: PointOfInterest): void
  /**
   * Emitted when the user cancels the active GoTo for the selected PoI.
   */
  (event: 'cancelGoto', poi: PointOfInterest): void
  /**
   * Emitted when the user requests to edit the selected PoI.
   */
  (event: 'edit', poi: PointOfInterest): void
  /**
   * Emitted after the user confirms deletion of the selected PoI.
   */
  (event: 'delete', poi: PointOfInterest): void
}>()

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { showDialog, closeDialog } = useInteractionDialog()

const POI_POPUP_WIDTH = 221
// Used to keep the popup clamped inside the viewport; bump this if the popup grows taller.
const POI_POPUP_HEIGHT = 110
const POI_POPUP_TOOLTIP_Z_INDEX = 100000

const visible = ref(false)
const position = ref({ x: 0, y: 0 })
const selectedId = ref<string | null>(null)
const selectedPoi = computed(() =>
  selectedId.value === null ? null : missionStore.pointsOfInterest.find((p) => p.id === selectedId.value) ?? null
)
const isGotoTarget = computed(() => selectedId.value !== null && selectedId.value === props.gotoTargetId)

const open = (poi: PointOfInterest, event: MouseEvent): void => {
  const margin = 8
  let x = event.clientX
  let y = event.clientY
  if (x + POI_POPUP_WIDTH > window.innerWidth - margin) x = window.innerWidth - POI_POPUP_WIDTH - margin
  if (y + POI_POPUP_HEIGHT > window.innerHeight - margin) y = window.innerHeight - POI_POPUP_HEIGHT - margin
  if (x < margin) x = margin
  if (y < margin) y = margin

  position.value = { x, y }
  selectedId.value = poi.id
  visible.value = true
  logUserAction(`Opened PoI context menu for "${poi.name}"`)
}

const close = (): void => {
  visible.value = false
  selectedId.value = null
}

const onGotoClick = (): void => {
  const poi = selectedPoi.value
  if (!poi) return
  close()
  logUserAction(`Requested GoTo to PoI "${poi.name}"`)
  emit('goto', poi)
}

const onCancelGotoClick = (): void => {
  const poi = selectedPoi.value
  if (!poi) return
  close()
  logUserAction(`Cancelled GoTo to PoI "${poi.name}"`)
  emit('cancelGoto', poi)
}

const onEditClick = (): void => {
  const poi = selectedPoi.value
  if (!poi) return
  close()
  logUserAction(`Opened edit dialog for PoI "${poi.name}"`)
  emit('edit', poi)
}

const onDeleteClick = (): void => {
  const poi = selectedPoi.value
  if (!poi) return
  close()
  logUserAction(`Opened delete confirmation for PoI "${poi.name}"`)
  showDialog({
    variant: 'warning',
    message: `Delete "${poi.name}"?`,
    persistent: false,
    maxWidth: '350px',
    actions: [
      { text: 'Cancel', color: 'white', action: closeDialog },
      {
        text: 'Delete',
        color: 'white',
        action: () => {
          logUserAction(`Deleted PoI "${poi.name}"`)
          emit('delete', poi)
          closeDialog()
        },
      },
    ] as DialogActions[],
  })
}

const onCopyCoordinate = async (index: 0 | 1): Promise<void> => {
  const poi = selectedPoi.value
  if (!poi) return
  const label = index === 0 ? 'Latitude' : 'Longitude'
  logUserAction(`Copied ${label} of PoI "${poi.name}" to clipboard`)
  try {
    await copyToClipboard(`${poi.coordinates[index]}`)
    openSnackbar({ message: `${label} copied to clipboard.`, variant: 'success' })
  } catch (error) {
    openSnackbar({ message: `Failed to copy ${label.toLowerCase()}: ${(error as Error).message}`, variant: 'error' })
  }
}

const onDocumentClick = (): void => {
  if (visible.value) close()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ open, close })
</script>
