<template>
  <div class="flex flex-col w-full mt-2 pb-2">
    <div class="flex flex-col gap-y-2">
      <div class="flex items-center justify-between gap-x-3 flex-wrap">
        <p class="text-md">Import tile archive</p>
        <v-btn
          variant="elevated"
          class="bg-[#FFFFFF22]"
          size="small"
          prepend-icon="mdi-file-plus-outline"
          :loading="importing"
          @click="importArchives"
        >
          Import (.zip, .mbtiles, .pmtiles)
        </v-btn>
      </div>
      <div v-if="!vehicleOnline" class="flex items-start gap-x-2 text-xs opacity-80">
        <v-icon icon="mdi-information-outline" size="16" class="mt-[2px]" />
        <span>
          Archives are saved on this device and uploaded to the vehicle automatically once it's online. URL providers
          and already-cached archives work fully offline.
        </span>
      </div>
      <div v-if="importing" class="flex items-center gap-x-3">
        <v-progress-linear indeterminate color="white" height="6" rounded class="flex-1" />
        <span class="text-xs opacity-80 whitespace-nowrap">Importing…</span>
      </div>
    </div>

    <v-divider class="my-3" />

    <div class="flex flex-col gap-y-2">
      <p class="text-md mb-1">Add provider by URL</p>
      <v-text-field
        v-model="urlForm.name"
        label="Name"
        density="compact"
        variant="outlined"
        hide-details
        theme="dark"
      />
      <v-text-field
        v-model="urlForm.urlTemplate"
        label="Tile URL (e.g. https://host/tiles/{z}/{x}/{y}.png)"
        density="compact"
        variant="outlined"
        hide-details
        theme="dark"
      />
      <div class="flex items-center gap-x-3 flex-wrap">
        <v-text-field
          v-model.number="urlForm.maxZoom"
          label="Max zoom"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          theme="dark"
          class="w-[120px]"
        />
        <v-text-field
          v-model="urlForm.attribution"
          label="Attribution (optional)"
          density="compact"
          variant="outlined"
          hide-details
          theme="dark"
          class="flex-1 min-w-[200px]"
        />
        <v-tooltip location="top" open-delay="400" max-width="280">
          <template #activator="{ props: tmsTooltipProps }">
            <v-checkbox
              v-bind="tmsTooltipProps"
              v-model="urlForm.tms"
              label="TMS"
              density="compact"
              hide-details
              theme="dark"
              class="flex-none"
            />
          </template>
          <span>
            Tile Map Service (TMS) flips the Y axis so row 0 is at the bottom. Enable if your tile server uses TMS
            instead of the more common XYZ (Google/OSM) convention.
          </span>
        </v-tooltip>
        <v-btn
          variant="elevated"
          class="bg-[#FFFFFF22]"
          size="small"
          :prepend-icon="editingProviderId ? 'mdi-content-save' : 'mdi-link-plus'"
          @click="submitUrlProvider"
        >
          {{ editingProviderId ? 'Update' : 'Add' }}
        </v-btn>
        <v-btn v-if="editingProviderId" variant="text" size="small" @click="cancelUrlEdit"> Cancel </v-btn>
      </div>
    </div>

    <v-divider class="my-4" />

    <p v-if="missionStore.customTileProviders.length === 0" class="text-sm opacity-60 py-4 text-center">
      No custom providers yet. Add one by URL or import a tile archive. They appear as selectable base maps in the map's
      layer selector.
    </p>

    <div v-else class="flex flex-col">
      <p class="text-md mb-1">Installed providers</p>
      <div class="flex items-center gap-2 px-3 py-1 text-xs uppercase opacity-60">
        <span class="flex-1">Name</span>
        <span class="w-[30%] text-center">Type</span>
        <span class="w-[24%] text-center">Max zoom</span>
        <span class="w-[56px]" />
      </div>
      <div
        v-for="provider in missionStore.customTileProviders"
        :key="provider.id"
        class="flex items-center gap-2 px-3 py-2 mb-1 rounded bg-[#FFFFFF11]"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <v-text-field
            v-if="renamingProviderId === provider.id"
            :model-value="draftNames[provider.id]"
            density="compact"
            variant="outlined"
            hide-details
            theme="dark"
            autofocus
            class="flex-1"
            @update:model-value="draftNames[provider.id] = $event"
            @blur="commitRename(provider)"
            @keyup.enter="commitRename(provider)"
            @keyup.esc="cancelRename(provider)"
          />
          <span v-else class="truncate">{{ provider.name }}</span>
          <v-tooltip v-if="provider.pendingVehicleSync" location="top" open-delay="300" max-width="240">
            <template #activator="{ props: pendingSyncProps }">
              <v-icon
                v-bind="pendingSyncProps"
                :icon="pendingSyncIcon(provider)"
                size="16"
                class="flex-none opacity-80"
              />
            </template>
            <span>{{ pendingSyncHint(provider) }}</span>
          </v-tooltip>
        </div>
        <span class="w-[30%] truncate text-xs opacity-80 text-center">{{ providerTypeLabel(provider) }}</span>
        <span class="w-[24%] truncate text-xs opacity-80 text-center">{{
          provider.maxZoom != null ? provider.maxZoom : '—'
        }}</span>
        <div class="flex items-center w-[56px] justify-end">
          <v-tooltip location="top" open-delay="300" text="Edit">
            <template #activator="{ props: editProps }">
              <v-btn
                v-bind="editProps"
                icon="mdi-pencil"
                variant="text"
                size="x-small"
                aria-label="Edit"
                @click="editProvider(provider)"
              />
            </template>
          </v-tooltip>
          <v-tooltip location="top" open-delay="300" text="Remove">
            <template #activator="{ props: removeProps }">
              <v-btn
                v-bind="removeProps"
                icon="mdi-trash-can-outline"
                variant="text"
                size="x-small"
                aria-label="Remove"
                @click="removeProvider(provider)"
              />
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import {
  buildUrlTileProvider,
  deleteStoredTileProvider,
  importTileArchiveFile,
  isValidTileUrlTemplate,
  normalizeTileMaxZoom,
  pickTileArchiveFiles,
  tileArchiveFormatFromFile,
} from '@/libs/map/tile-provider-import'
import { cachedTileArchiveIds } from '@/libs/map/tile-provider-storage'
import { messageFromError } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()
const { showDialog, closeDialog } = useInteractionDialog()

const vehicleOnline = computed(() => vehicleStore.isVehicleOnline)

const urlForm = reactive<{
  /**
   * Provider name.
   */
  name: string
  /**
   * XYZ tile URL template.
   */
  urlTemplate: string
  /**
   * Optional maximum native zoom.
   */
  maxZoom: number | undefined
  /**
   * Optional attribution string.
   */
  attribution: string
  /**
   * Whether the URL uses the TMS y-axis convention.
   */
  tms: boolean
}>({ name: '', urlTemplate: '', maxZoom: undefined, attribution: '', tms: false })

const importing = ref(false)
const editingProviderId = ref<string | null>(null)
const renamingProviderId = ref<string | null>(null)

// Editable name per provider, seeded once from the store so a sync arriving mid-edit cannot overwrite what is
// being typed. The store stays the source of truth for every row that is not currently in rename mode.
const draftNames = reactive<Record<string, string>>({})
watch(
  () => missionStore.customTileProviders.map((provider) => [provider.id, provider.name] as const),
  (pairs) => pairs.forEach(([id, name]) => (draftNames[id] = draftNames[id] ?? name)),
  { immediate: true, deep: true }
)

// `pendingVehicleSync` is shared with every topside computer, but only the one holding the bytes can upload
// them, so the row's wording is decided by this computer's cache rather than by the flag alone.
const locallyCachedIds = ref<string[]>([])
const refreshLocallyCachedIds = async (): Promise<void> => {
  locallyCachedIds.value = await cachedTileArchiveIds()
}
watch(
  () => missionStore.customTileProviders.length,
  () => void refreshLocallyCachedIds(),
  { immediate: true }
)

const isArchiveAvailableLocally = (provider: CustomTileProviderMeta): boolean =>
  locallyCachedIds.value.includes(provider.id)

const pendingSyncIcon = (provider: CustomTileProviderMeta): string =>
  isArchiveAvailableLocally(provider) ? 'mdi-cloud-clock-outline' : 'mdi-cloud-off-outline'

const pendingSyncHint = (provider: CustomTileProviderMeta): string =>
  isArchiveAvailableLocally(provider)
    ? "Saved on this computer. Will upload to the vehicle once it's online."
    : 'Imported on another computer. It cannot be shown here until that computer uploads it to the vehicle.'

const providerTypeLabel = (provider: CustomTileProviderMeta): string => {
  if (provider.type === 'url') return 'URL'
  return provider.format?.toUpperCase() ?? 'ARCHIVE'
}

const clearUrlForm = (): void => {
  urlForm.name = ''
  urlForm.urlTemplate = ''
  urlForm.maxZoom = undefined
  urlForm.attribution = ''
  urlForm.tms = false
}

const cancelUrlEdit = (): void => {
  editingProviderId.value = null
  clearUrlForm()
}

const submitUrlProvider = (): void => {
  try {
    if (editingProviderId.value) {
      const name = urlForm.name.trim()
      const urlTemplate = urlForm.urlTemplate.trim()
      if (!name) throw new Error('Provider name is required.')
      if (!isValidTileUrlTemplate(urlTemplate)) {
        throw new Error('Tile URL must contain the {z}, {x} and {y} placeholders.')
      }
      missionStore.updateCustomTileProvider(editingProviderId.value, {
        name,
        urlTemplate,
        maxZoom: normalizeTileMaxZoom(urlForm.maxZoom),
        tms: urlForm.tms || undefined,
        attribution: urlForm.attribution.trim() || undefined,
      })
      draftNames[editingProviderId.value] = name
      logUserAction('Updated a custom map provider')
      openSnackbar({ message: 'Custom map provider updated.', variant: 'success', duration: 3000 })
      cancelUrlEdit()
      return
    }

    missionStore.addCustomTileProvider(
      buildUrlTileProvider({
        name: urlForm.name,
        urlTemplate: urlForm.urlTemplate,
        maxZoom: urlForm.maxZoom,
        tms: urlForm.tms,
        attribution: urlForm.attribution,
      })
    )
    logUserAction('Added a custom map provider by URL')
    openSnackbar({ message: 'Custom map provider added.', variant: 'success', duration: 3000 })
    clearUrlForm()
  } catch (error) {
    openSnackbar({ message: messageFromError(error), variant: 'error', duration: 5000 })
  }
}

const importArchives = async (): Promise<void> => {
  const files = await pickTileArchiveFiles()
  if (files.length === 0) return

  importing.value = true
  const failures: string[] = []
  let addedCount = 0
  for (const file of files) {
    if (!tileArchiveFormatFromFile(file)) {
      failures.push(`"${file.name}" is not a .zip, .mbtiles or .pmtiles file.`)
      continue
    }
    try {
      const provider = await importTileArchiveFile(file)
      missionStore.addCustomTileProvider(provider)
      addedCount += 1
    } catch (error) {
      failures.push(`"${file.name}" could not be imported: ${messageFromError(error)}`)
    }
  }
  importing.value = false

  // One message for the whole selection, so picking several wrong files does not stack a snackbar per file.
  if (failures.length > 0) {
    openSnackbar({ message: failures.join(' '), variant: 'error', duration: 6000 })
  }

  if (addedCount > 0) {
    logUserAction('Imported a custom map tile archive')
    // When online the sync composable uploads immediately and shows its own confirmation; offline, tell the user
    // the archive is saved locally and will sync later.
    const plural = addedCount > 1 ? 's' : ''
    const message = vehicleOnline.value
      ? `${addedCount} custom map provider${plural} added.`
      : `${addedCount} custom map provider${plural} added. Will upload to the vehicle once it's online.`
    openSnackbar({ message, variant: 'success', duration: 3000 })
  }
}

const editProvider = (provider: CustomTileProviderMeta): void => {
  logUserAction('Started editing a custom map provider')
  renamingProviderId.value = null
  if (provider.type === 'url') {
    editingProviderId.value = provider.id
    urlForm.name = provider.name
    urlForm.urlTemplate = provider.urlTemplate ?? ''
    urlForm.maxZoom = provider.maxZoom
    urlForm.attribution = provider.attribution ?? ''
    urlForm.tms = provider.tms ?? false
    return
  }
  // File providers have immutable archives; edit only renames the display name.
  cancelUrlEdit()
  draftNames[provider.id] = provider.name
  renamingProviderId.value = provider.id
}

const cancelRename = (provider: CustomTileProviderMeta): void => {
  draftNames[provider.id] = provider.name
  renamingProviderId.value = null
}

const commitRename = (provider: CustomTileProviderMeta): void => {
  const name = (draftNames[provider.id] ?? '').trim()
  renamingProviderId.value = null
  if (!name || name === provider.name) {
    draftNames[provider.id] = provider.name
    return
  }
  missionStore.updateCustomTileProvider(provider.id, { name })
  draftNames[provider.id] = name
  logUserAction('Renamed a custom map provider')
}

const performRemoveProvider = async (provider: CustomTileProviderMeta): Promise<void> => {
  logUserAction('Removed a custom map provider')
  if (editingProviderId.value === provider.id) cancelUrlEdit()
  if (renamingProviderId.value === provider.id) renamingProviderId.value = null
  missionStore.removeCustomTileProvider(provider.id)
  delete draftNames[provider.id]
  if (missionStore.userLastCustomMapProviderId === provider.id) missionStore.userLastCustomMapProviderId = null
  try {
    // Matches what the confirmation dialog promised: the vehicle copy is only touched when it can be reached.
    await deleteStoredTileProvider(provider, vehicleStore.isVehicleOnline ? vehicleStore.globalAddress : undefined)
  } catch (error) {
    // The entry is already gone from the list, so the user has to be told its bytes were left behind.
    const reason = messageFromError(error)
    const message = `"${provider.name}" was removed, but its stored data could not be deleted: ${reason}`
    openSnackbar({ message, variant: 'error', duration: 6000 })
  }
}

// What removal does to the vehicle-stored archive, which depends on whether it ever reached the vehicle and on
// the vehicle being reachable now, since only a live connection can actually delete it.
const archiveRemovalNote = (provider: CustomTileProviderMeta): string => {
  if (provider.type !== 'file' || provider.pendingVehicleSync) return ''
  if (!vehicleStore.globalAddress || !vehicleStore.isVehicleOnline) {
    return ' The copy stored on the vehicle is kept, since no vehicle is connected to delete it from.'
  }
  return ' This also deletes the archive stored on the vehicle, which cannot be undone.'
}

const removeProvider = (provider: CustomTileProviderMeta): void => {
  const archiveNote = archiveRemovalNote(provider)
  showDialog({
    variant: 'warning',
    title: 'Remove map provider?',
    message: `Remove "${provider.name}"?${archiveNote}`,
    actions: [
      { text: 'Cancel', size: 'small', action: closeDialog },
      {
        text: 'Remove',
        size: 'small',
        action: () => {
          closeDialog()
          void performRemoveProvider(provider)
        },
      },
    ],
  })
}
</script>
