<template>
  <div class="flex flex-col w-full mt-2 pb-2">
    <div class="flex flex-col gap-y-2">
      <div class="flex items-center justify-between gap-x-3 flex-wrap">
        <p class="text-md">{{ t`Import tile archive` }}</p>
        <v-btn
          variant="elevated"
          class="bg-[#FFFFFF22]"
          size="small"
          prepend-icon="mdi-file-plus-outline"
          :loading="importing"
          @click="importArchives"
        >
          {{ t`Import (.zip, .mbtiles, .pmtiles)` }}
        </v-btn>
      </div>
      <div v-if="!vehicleOnline" class="flex items-start gap-x-2 text-xs opacity-80">
        <v-icon icon="mdi-information-outline" size="16" class="mt-[2px]" />
        <span>
          {{
            t`Archives are saved on this device and uploaded to the vehicle automatically once it's online. URL providers and already-cached archives work fully offline.`
          }}
        </span>
      </div>
      <div v-if="importing" class="flex items-center gap-x-3">
        <v-progress-linear indeterminate color="white" height="6" rounded class="flex-1" />
        <span class="text-xs opacity-80 whitespace-nowrap">{{ t`Importing…` }}</span>
      </div>
    </div>

    <v-divider class="my-3" />

    <div class="flex flex-col gap-y-2">
      <p class="text-md mb-1">{{ t`Add provider by URL` }}</p>
      <v-text-field
        v-model="urlForm.name"
        :label="t`Name`"
        density="compact"
        variant="outlined"
        hide-details
        theme="dark"
      />
      <v-text-field
        v-model="urlForm.urlTemplate"
        :label="t`Tile URL (e.g. https://host/tiles/{z}/{x}/{y}.png)`"
        density="compact"
        variant="outlined"
        hide-details
        theme="dark"
      />
      <div class="flex items-center gap-x-3 flex-wrap">
        <v-text-field
          v-model.number="urlForm.maxZoom"
          :label="t`Max zoom`"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          theme="dark"
          class="w-[120px]"
        />
        <v-text-field
          v-model="urlForm.attribution"
          :label="t`Attribution (optional)`"
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
            {{
              t`Tile Map Service (TMS) flips the Y axis so row 0 is at the bottom. Enable if your tile server uses TMS instead of the more common XYZ (Google/OSM) convention.`
            }}
          </span>
        </v-tooltip>
        <v-btn
          variant="elevated"
          class="bg-[#FFFFFF22]"
          size="small"
          :prepend-icon="editingProviderId ? 'mdi-content-save' : 'mdi-link-plus'"
          @click="submitUrlProvider"
        >
          {{ editingProviderId ? t`Update` : t`Add` }}
        </v-btn>
        <v-btn v-if="editingProviderId" variant="text" size="small" @click="cancelUrlEdit">{{ t`Cancel` }}</v-btn>
      </div>
    </div>

    <v-divider class="my-4" />

    <p v-if="missionStore.customTileProviders.length === 0" class="text-sm opacity-60 py-4 text-center">
      {{
        t`No custom providers yet. Add one by URL or import a tile archive. They appear as selectable base maps in the map's layer selector.`
      }}
    </p>

    <div v-else class="flex flex-col">
      <p class="text-md mb-1">{{ t`Installed providers` }}</p>
      <div class="flex items-center gap-2 px-3 py-1 text-xs uppercase opacity-60">
        <span class="flex-1">{{ t`Name` }}</span>
        <span class="w-[30%] text-center">{{ t`Type` }}</span>
        <span class="w-[24%] text-center">{{ t`Max zoom` }}</span>
        <span class="w-[84px]" />
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
        <div class="flex items-center w-[84px] justify-end">
          <v-menu
            :close-on-content-click="false"
            location="bottom end"
            theme="dark"
            @update:model-value="logDisplayMenuToggle"
          >
            <template #activator="{ props: displayProps }">
              <v-tooltip location="top" open-delay="300" :text="t`Brightness and contrast`">
                <template #activator="{ props: displayTooltipProps }">
                  <v-btn
                    v-bind="{ ...displayProps, ...displayTooltipProps }"
                    icon="mdi-brightness-6"
                    variant="text"
                    size="x-small"
                    :aria-label="t`Brightness and contrast`"
                  />
                </template>
              </v-tooltip>
            </template>
            <div
              class="flex flex-col p-3 rounded-lg w-[290px] text-white"
              :style="interfaceStore.globalGlassMenuStyles"
            >
              <v-slider
                :model-value="provider.brightness ?? 1"
                :label="t`Brightness`"
                :min="tileDisplayAdjustmentRange.min"
                :max="tileDisplayAdjustmentRange.max"
                :step="0.05"
                color="white"
                density="compact"
                hide-details
                @update:model-value="missionStore.updateCustomTileProvider(provider.id, { brightness: $event })"
                @end="logAdjustment('brightness', provider)"
                @keyup="logAdjustment('brightness', provider)"
              >
                <template #append>
                  <span class="text-xs w-10 text-right">{{ adjustmentLabel(provider.brightness) }}</span>
                </template>
              </v-slider>
              <v-slider
                :model-value="provider.contrast ?? 1"
                :label="t`Contrast`"
                :min="tileDisplayAdjustmentRange.min"
                :max="tileDisplayAdjustmentRange.max"
                :step="0.05"
                color="white"
                density="compact"
                hide-details
                @update:model-value="missionStore.updateCustomTileProvider(provider.id, { contrast: $event })"
                @end="logAdjustment('contrast', provider)"
                @keyup="logAdjustment('contrast', provider)"
              >
                <template #append>
                  <span class="text-xs w-10 text-right">{{ adjustmentLabel(provider.contrast) }}</span>
                </template>
              </v-slider>
              <v-btn
                variant="text"
                size="x-small"
                class="self-end mt-1"
                :disabled="!isDisplayAdjusted(provider)"
                @click="resetDisplayAdjustments(provider)"
              >
                {{ t`Reset` }}
              </v-btn>
            </div>
          </v-menu>
          <v-tooltip location="top" open-delay="300" :text="t`Edit`">
            <template #activator="{ props: editProps }">
              <v-btn
                v-bind="editProps"
                icon="mdi-pencil"
                variant="text"
                size="x-small"
                :aria-label="t`Edit`"
                @click="editProvider(provider)"
              />
            </template>
          </v-tooltip>
          <v-tooltip location="top" open-delay="300" :text="t`Remove`">
            <template #activator="{ props: removeProps }">
              <v-btn
                v-bind="removeProps"
                icon="mdi-trash-can-outline"
                variant="text"
                size="x-small"
                :aria-label="t`Remove`"
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
import { msgid, ngettext, t } from 'ttag'
import { computed, reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { tileDisplayAdjustmentRange } from '@/composables/map/useCustomTileProviderLayer'
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
import { isBlueOsSettingsSyncEnabled } from '@/libs/settings-management'
import { messageFromError } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

const missionStore = useMissionStore()
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
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

const pendingSyncHint = (provider: CustomTileProviderMeta): string => {
  if (!isArchiveAvailableLocally(provider)) {
    return t`Imported on another computer. It cannot be shown here until that computer uploads it to the vehicle.`
  }
  return isBlueOsSettingsSyncEnabled()
    ? t`Saved on this computer. Will upload to the vehicle once it's online.`
    : t`Saved on this computer. BlueOS settings sync is off, so it is not uploaded to the vehicle.`
}

const providerTypeLabel = (provider: CustomTileProviderMeta): string => {
  if (provider.type === 'url') return 'URL'
  return provider.format?.toUpperCase() ?? t`ARCHIVE`
}

const adjustmentLabel = (value = 1): string => `${Math.round(value * 100)}%`

const isDisplayAdjusted = (provider: CustomTileProviderMeta): boolean =>
  (provider.brightness ?? 1) !== 1 || (provider.contrast ?? 1) !== 1

// Release covers a drag and key-up covers the arrow keys, so the last logged value is kept to stop an
// adjustment that fires both from being logged twice.
const lastLoggedAdjustments: Record<string, number> = {}

const adjustmentLogKey = (id: string, property: 'brightness' | 'contrast'): string => `${id}:${property}`

const logAdjustment = (property: 'brightness' | 'contrast', provider: CustomTileProviderMeta): void => {
  const value = provider[property] ?? 1
  const entryKey = adjustmentLogKey(provider.id, property)
  if (lastLoggedAdjustments[entryKey] === value) return
  lastLoggedAdjustments[entryKey] = value
  logUserAction(`Set the ${property} of a custom map provider to ${adjustmentLabel(value)}`)
}

const logDisplayMenuToggle = (open: boolean): void =>
  logUserAction(`${open ? 'Opened' : 'Closed'} the brightness and contrast controls of a custom map provider`)

const resetDisplayAdjustments = (provider: CustomTileProviderMeta): void => {
  missionStore.updateCustomTileProvider(provider.id, { brightness: 1, contrast: 1 })
  lastLoggedAdjustments[adjustmentLogKey(provider.id, 'brightness')] = 1
  lastLoggedAdjustments[adjustmentLogKey(provider.id, 'contrast')] = 1
  logUserAction('Reset the brightness and contrast of a custom map provider')
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
      if (!name) throw new Error(t`Provider name is required.`)
      if (!isValidTileUrlTemplate(urlTemplate)) {
        throw new Error(t`Tile URL must contain the {z}, {x} and {y} placeholders.`)
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
      openSnackbar({ message: t`Custom map provider updated.`, variant: 'success', duration: 3000 })
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
    openSnackbar({ message: t`Custom map provider added.`, variant: 'success', duration: 3000 })
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
      failures.push(t`"${file.name}" is not a .zip, .mbtiles or .pmtiles file.`)
      continue
    }
    try {
      const provider = await importTileArchiveFile(file)
      missionStore.addCustomTileProvider(provider)
      addedCount += 1
    } catch (error) {
      const reason = messageFromError(error)
      failures.push(t`"${file.name}" could not be imported: ${reason}`)
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
    const message = vehicleOnline.value
      ? ngettext(
          msgid`${addedCount} custom map provider added.`,
          `${addedCount} custom map providers added.`,
          addedCount
        )
      : ngettext(
          msgid`${addedCount} custom map provider added. Will upload to the vehicle once it's online.`,
          `${addedCount} custom map providers added. Will upload to the vehicle once it's online.`,
          addedCount
        )
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
    await deleteStoredTileProvider(provider, vehicleStorageAddress.value)
  } catch (error) {
    // The entry is already gone from the list, so the user has to be told its bytes were left behind.
    const reason = messageFromError(error)
    const message = t`"${provider.name}" was removed, but its stored data could not be deleted: ${reason}`
    openSnackbar({ message, variant: 'error', duration: 6000 })
  }
}

// What removal does to the vehicle-stored archive, which depends on whether it ever reached the vehicle and on
// the vehicle being reachable now, since only a live connection can actually delete it.
const vehicleStorageAddress = computed(() =>
  vehicleStore.isVehicleOnline && isBlueOsSettingsSyncEnabled() ? vehicleStore.globalAddress || undefined : undefined
)

const archiveRemovalNote = (provider: CustomTileProviderMeta): string => {
  if (provider.type !== 'file' || provider.pendingVehicleSync) return ''
  if (!isBlueOsSettingsSyncEnabled()) {
    return ` ${t`The copy stored on the vehicle is kept, since BlueOS settings sync is off on this computer.`}`
  }
  if (!vehicleStorageAddress.value) {
    return ` ${t`The copy stored on the vehicle is kept, since no vehicle is connected to delete it from.`}`
  }
  return ` ${t`This also deletes the archive stored on the vehicle, which cannot be undone.`}`
}

const removeProvider = (provider: CustomTileProviderMeta): void => {
  const archiveNote = archiveRemovalNote(provider)
  showDialog({
    variant: 'warning',
    title: t`Remove map provider?`,
    message: `${t`Remove "${provider.name}"?`}${archiveNote}`,
    actions: [
      { text: t`Cancel`, size: 'small', action: closeDialog },
      {
        text: t`Remove`,
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
