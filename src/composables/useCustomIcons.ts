import { type ComputedRef } from 'vue'

import { createVehicleFileStorage } from '@/composables/useVehicleFileStorage'
import {
  type CustomIcon,
  createCustomIcon,
  idFromCustomIconRef,
  isCustomIconRef,
  validateCustomIconSvg,
} from '@/libs/custom-icons'

// Singleton so every call site shares the same reactive library. The SVG bytes are cached in IndexedDB
// and synced to the vehicle as real files; only the `{ id, name, createdAt }` index rides in settings.
const iconStorage = createVehicleFileStorage<CustomIcon>({
  settingsKey: 'cockpit-custom-icons-v1',
  indexedDbStoreName: 'cockpit-custom-icons',
  vehicleSubfolder: 'custom-icons',
  mimeType: 'image/svg+xml',
  fileExtension: 'svg',
})

/**
 * Outcome of an `addIcon` call: the new icon's id when it was stored, or an error message.
 */
export interface AddIconResult {
  /**
   * The stored icon's id when the upload succeeded.
   */
  id?: string
  /**
   * A user-facing reason the SVG was rejected, when the upload failed.
   */
  error?: string
}

/**
 * Reactive API for managing the user's custom SVG icon library, synced to the vehicle via BlueOS.
 */
export interface CustomIconsApi {
  /**
   * All custom icons currently in the library.
   */
  icons: ComputedRef<CustomIcon[]>
  /**
   * Validates and adds a new custom icon to the library.
   * @param {string} name - User-facing name for the icon.
   * @param {string} svg - Raw SVG markup to validate and store.
   * @returns {Promise<AddIconResult>} The new icon's id on success, or an error message if the SVG is invalid.
   */
  addIcon: (name: string, svg: string) => Promise<AddIconResult>
  /**
   * Reads an uploaded SVG file and adds it to the library, deriving the icon name from the filename.
   * @param {File} file - The user-selected `.svg` file.
   * @returns {Promise<AddIconResult>} The new icon's id on success, or an error message if the SVG is invalid.
   */
  addIconFromFile: (file: File) => Promise<AddIconResult>
  /**
   * Removes a custom icon from the library.
   * @param {string} id - The custom icon's id.
   * @returns {void}
   */
  removeIcon: (id: string) => void
  /**
   * Resolves an `iconName` reference to a renderable URL.
   * @param {string} iconRef - A custom icon reference (as produced by `customIconRefFromId`).
   * @returns {string | undefined} The icon's object URL, or `undefined` if its bytes aren't cached yet.
   */
  resolveIconUrl: (iconRef: string) => string | undefined
}

/**
 * Provides reactive access to the custom SVG icon library shared by all Very Generic Indicators.
 * @returns {CustomIconsApi} Reactive icon list plus add/remove/resolve helpers.
 */
export function useCustomIcons(): CustomIconsApi {
  const addIcon = async (name: string, svg: string): Promise<AddIconResult> => {
    const error = validateCustomIconSvg(svg)
    if (error) return { error }

    const normalizedSvg = svg.replace(/^\uFEFF/, '').trim()
    const icon = createCustomIcon(name)
    await iconStorage.add(icon, normalizedSvg)
    logUserAction(`Uploaded custom icon '${icon.name}'`)
    return { id: icon.id }
  }

  const addIconFromFile = async (file: File): Promise<AddIconResult> => {
    const svg = await file.text()
    return addIcon(file.name.replace(/\.svg$/i, ''), svg)
  }

  const removeIcon = (id: string): void => {
    const icon = iconStorage.entries.value.find((entry) => entry.id === id)
    iconStorage.remove(id).catch((error) => console.error(`Could not remove custom icon '${id}'. ${error}`))
    logUserAction(`Deleted custom icon '${icon?.name ?? id}'`)
  }

  const resolveIconUrl = (iconRef: string): string | undefined => {
    if (!isCustomIconRef(iconRef)) return undefined
    return iconStorage.urlFor(idFromCustomIconRef(iconRef))
  }

  return { icons: iconStorage.entries, addIcon, addIconFromFile, removeIcon, resolveIconUrl }
}
