import localforage from 'localforage'
import { type ComputedRef, computed, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import {
  deleteFileFromVehicle,
  downloadFileFromVehicle,
  listVehicleFiles,
  uploadFileToVehicle,
} from '@/libs/blueos-files'

/**
 * Minimal metadata every stored file carries. Consumers extend this with their own fields (e.g. a name).
 */
export interface VehicleFileMeta {
  /**
   * Unique identifier, also used to derive the file name on the vehicle and the IndexedDB key.
   */
  id: string
  /**
   * Epoch milliseconds when the file was created.
   */
  createdAt: number
}

/**
 * Configuration for a vehicle-synced file store instance.
 */
export interface VehicleFileStorageConfig {
  /**
   * Settings key holding the lightweight metadata index. Must start with `cockpit-` so it is tracked
   * and synced across control stations by the settings backend.
   */
  settingsKey: string
  /**
   * IndexedDB store name for the local blob cache.
   */
  indexedDbStoreName: string
  /**
   * Folder under `userdata/cockpit` on the vehicle where the blobs are synced.
   */
  vehicleSubfolder: string
  /**
   * MIME type used when wrapping raw string content into a Blob.
   */
  mimeType: string
  /**
   * Extension (without the dot) appended to each blob's file name on the vehicle.
   */
  fileExtension: string
}

/**
 * Reactive API of a vehicle-synced file store: metadata lives in settings, bytes live in IndexedDB
 * locally and in File Browser on the vehicle.
 */
export interface VehicleFileStore<M extends VehicleFileMeta> {
  /**
   * The metadata entries currently in the store.
   */
  entries: ComputedRef<M[]>
  /**
   * Resolves a stored file's renderable object URL, or `undefined` when its bytes are not cached locally.
   * @param {string} id - The file's id.
   * @returns {string | undefined} A `blob:` URL usable as an `<img>` src, or `undefined`.
   */
  urlFor: (id: string) => string | undefined
  /**
   * Stores a file locally (and pushes it to the vehicle when connected).
   * @param {M} meta - The file's metadata; its `id` keys the stored bytes.
   * @param {Blob | string} content - The file's content.
   * @returns {Promise<void>} Resolves once the bytes and metadata have been persisted locally.
   */
  add: (meta: M, content: Blob | string) => Promise<void>
  /**
   * Removes a file locally (and from the vehicle when connected).
   * @param {string} id - The file's id.
   * @returns {Promise<void>} Resolves once the bytes and metadata have been removed locally.
   */
  remove: (id: string) => Promise<void>
}

// A single `vehicle-sync-complete` listener fans out to every store instance, so adding more asset
// kinds (each with its own store) never stacks additional window listeners on the app singleton.
const vehicleSyncSubscribers = new Set<(vehicleAddress: string) => void>()
let vehicleSyncListenerRegistered = false

const ensureVehicleSyncListener = (): void => {
  if (vehicleSyncListenerRegistered) return
  vehicleSyncListenerRegistered = true
  // Wait for `vehicle-sync-complete` (dispatched after the settings pipeline runs) rather than the raw
  // `vehicle-online`, so the metadata index has already been imported from the vehicle before we
  // reconcile bytes; otherwise a fresh control station wouldn't yet know which files to pull.
  window.addEventListener('vehicle-sync-complete', (event) => {
    const vehicleAddress = (event as CustomEvent).detail?.vehicleAddress
    if (!vehicleAddress) return
    vehicleSyncSubscribers.forEach((notify) => notify(vehicleAddress))
  })
}

/**
 * Creates a reusable store that keeps a set of small files local-first while syncing them to the
 * vehicle's File Browser. Only lightweight metadata is kept in the settings JSON; the bytes live in
 * IndexedDB (so rendering works offline and across vehicles) and as real files under
 * `userdata/cockpit/<subfolder>` on the vehicle (so they are shared across control stations).
 *
 * Intended to be instantiated once per asset kind at module scope (e.g. custom icons, and mission
 * thumbnails in the future), each with its own config.
 * @param {VehicleFileStorageConfig} config - Per-store settings key, IndexedDB store, vehicle folder and file type.
 * @returns {VehicleFileStore<M>} The reactive store API.
 */
export const createVehicleFileStorage = <M extends VehicleFileMeta>(
  config: VehicleFileStorageConfig
): VehicleFileStore<M> => {
  // The map key is the id (single source of truth), so the stored value omits it to avoid duplicating
  // the id in the persisted settings; `entries` re-attaches it from the key.
  const metaById = useBlueOsStorage<Record<string, Omit<M, 'id'>>>(config.settingsKey, {})
  const blobStore = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'Cockpit - Vehicle File Cache',
    storeName: config.indexedDbStoreName,
  })
  const urls = ref<Record<string, string>>({})
  const loadedIds = new Set<string>()

  const fileNameFor = (id: string): string => `${id}.${config.fileExtension}`

  const setUrl = (id: string, blob: Blob): void => {
    if (urls.value[id]) URL.revokeObjectURL(urls.value[id])
    urls.value = { ...urls.value, [id]: URL.createObjectURL(blob) }
  }

  const dropUrl = (id: string): void => {
    if (urls.value[id]) URL.revokeObjectURL(urls.value[id])
    const next = { ...urls.value }
    delete next[id]
    urls.value = next
  }

  // The metadata index is the source of truth (kept in sync across control stations by the settings
  // backend). Keep the local object-URL cache aligned with it: load bytes for new ids, drop removed ones.
  watch(
    () => Object.keys(metaById.value),
    async (ids) => {
      Object.keys(urls.value)
        .filter((id) => !ids.includes(id))
        .forEach((id) => {
          dropUrl(id)
          loadedIds.delete(id)
        })

      for (const id of ids) {
        if (loadedIds.has(id)) continue
        loadedIds.add(id)
        const blob = await blobStore.getItem<Blob>(id)
        if (blob) setUrl(id, blob)
      }
    },
    { immediate: true }
  )

  const add = async (meta: M, content: Blob | string): Promise<void> => {
    const { id, ...rest } = meta
    const blob = typeof content === 'string' ? new Blob([content], { type: config.mimeType }) : content
    await blobStore.setItem(id, blob)
    loadedIds.add(id)
    setUrl(id, blob)
    metaById.value = { ...metaById.value, [id]: rest }
    if (currentVehicleAddress) {
      uploadFileToVehicle(currentVehicleAddress, config.vehicleSubfolder, fileNameFor(id), blob).catch((error) =>
        console.error(`Could not upload '${config.vehicleSubfolder}/${id}' to the vehicle. ${error}`)
      )
    }
  }

  const remove = async (id: string): Promise<void> => {
    dropUrl(id)
    loadedIds.delete(id)
    await blobStore.removeItem(id)
    const next = { ...metaById.value }
    delete next[id]
    metaById.value = next
    if (currentVehicleAddress) {
      deleteFileFromVehicle(currentVehicleAddress, config.vehicleSubfolder, fileNameFor(id)).catch((error) =>
        console.error(`Could not delete '${config.vehicleSubfolder}/${id}' from the vehicle. ${error}`)
      )
    }
  }

  // Reconcile bytes with the vehicle: pull entries whose bytes we lack, push local bytes the vehicle lacks.
  // The metadata index already arrived via settings sync, so it drives which files should exist.
  let currentVehicleAddress: string | undefined
  const syncWithVehicle = async (vehicleAddress: string): Promise<void> => {
    currentVehicleAddress = vehicleAddress
    const remoteFiles = new Set(await listVehicleFiles(vehicleAddress, config.vehicleSubfolder))

    await Promise.all(
      Object.keys(metaById.value).map(async (id) => {
        const localBlob = await blobStore.getItem<Blob>(id)
        const isRemote = remoteFiles.has(fileNameFor(id))
        if (!localBlob && isRemote) {
          const blob = await downloadFileFromVehicle(vehicleAddress, config.vehicleSubfolder, fileNameFor(id))
          await blobStore.setItem(id, blob)
          setUrl(id, blob)
        } else if (localBlob && !isRemote) {
          await uploadFileToVehicle(vehicleAddress, config.vehicleSubfolder, fileNameFor(id), localBlob)
        }
      })
    )
  }

  ensureVehicleSyncListener()
  vehicleSyncSubscribers.add((vehicleAddress) =>
    syncWithVehicle(vehicleAddress).catch((error) =>
      console.error(`Could not sync '${config.vehicleSubfolder}' files with the vehicle. ${error}`)
    )
  )

  return {
    entries: computed<M[]>(() => Object.entries(metaById.value).map(([id, meta]) => ({ ...meta, id } as M))),
    urlFor: (id: string) => urls.value[id],
    add,
    remove,
  }
}
