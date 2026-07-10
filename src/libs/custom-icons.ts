import { v4 as uuid } from 'uuid'

import type { VehicleFileMeta } from '@/composables/useVehicleFileStorage'

// Keeps a single icon small so it stays cheap to cache in IndexedDB, upload to the vehicle, and render.
export const MAX_CUSTOM_ICON_SVG_SIZE_BYTES = 50 * 1024

// Distinguishes custom SVG icon references from MDI class names inside `iconName` fields.
const customIconRefPrefix = 'custom:'

/**
 * Metadata for a user-uploaded SVG icon available to Very Generic Indicators. The SVG bytes are not
 * kept here — they live in the local IndexedDB cache and, when connected, on the vehicle's File Browser.
 */
export interface CustomIcon extends VehicleFileMeta {
  /**
   * User-facing name shown in the icon library and pickers.
   */
  name: string
}

/**
 * Checks whether an `iconName` value refers to a custom icon rather than an MDI class.
 * @param {string | undefined} iconName - The value stored in `miniWidget.options.iconName`.
 * @returns {boolean} True if the value is a custom icon reference.
 */
export const isCustomIconRef = (iconName: string | undefined): boolean => {
  return typeof iconName === 'string' && iconName.startsWith(customIconRefPrefix)
}

/**
 * Builds the `iconName` reference for a custom icon id.
 * @param {string} id - The custom icon's id.
 * @returns {string} The `iconName` value to store on a widget's options.
 */
export const customIconRefFromId = (id: string): string => `${customIconRefPrefix}${id}`

/**
 * Extracts the custom icon id from an `iconName` reference.
 * @param {string} iconRef - A value for which `isCustomIconRef` returns true.
 * @returns {string} The custom icon's id.
 */
export const idFromCustomIconRef = (iconRef: string): string => iconRef.slice(customIconRefPrefix.length)

/**
 * Validates that uploaded content is a small, well-formed SVG.
 * @param {string} svg - The raw file content to validate.
 * @returns {string | undefined} An error message if invalid, or `undefined` if the SVG is acceptable.
 */
export const validateCustomIconSvg = (svg: string): string | undefined => {
  // Strip a leading BOM and surrounding whitespace so files exported by editors like Inkscape
  // (which prepend an <?xml ...?> prolog, a DOCTYPE and comments before the root) still validate.
  const content = svg.replace(/^\uFEFF/, '').trim()

  if (!content) {
    return 'The selected file is empty.'
  }

  const sizeBytes = new TextEncoder().encode(content).length
  if (sizeBytes > MAX_CUSTOM_ICON_SVG_SIZE_BYTES) {
    const currentKb = Math.ceil(sizeBytes / 1024)
    const maxKb = MAX_CUSTOM_ICON_SVG_SIZE_BYTES / 1024
    return (
      `Icon is too large (${currentKb} KB, the limit is ${maxKb} KB). SVGs that embed a full raster ` +
      'image (e.g. an imported or traced PNG/JPEG) are usually this big. Export a simplified vector SVG, ' +
      'or shrink the embedded image before uploading.'
    )
  }

  // file.text() decodes bytes as UTF-8, so any binary file (PNG/JPEG/etc.) renamed to .svg ends up
  // containing U+FFFD replacement characters. Genuine SVG is plain text and never does.
  if (content.includes('\uFFFD')) {
    return (
      'This looks like a binary image (e.g. PNG or JPEG), not a text-based SVG. Renaming a .png/.jpg ' +
      'file to .svg does not convert it. In Inkscape, open the image and use File > Save As > "Plain SVG" ' +
      '(or "Optimized SVG") to export a real vector file.'
    )
  }

  // Look for the <svg> root anywhere, not only at the very start, so a leading XML prolog, DOCTYPE
  // or comment does not cause a false rejection.
  if (!/<svg[\s>]/i.test(content)) {
    return (
      'No <svg> element was found in the file, so it is not a valid SVG. Make sure you exported the ' +
      'vector graphic itself — in Inkscape use File > Save As > "Plain SVG" or "Optimized SVG".'
    )
  }

  return undefined
}

/**
 * Creates a new custom icon metadata record.
 * @param {string} name - User-facing name for the icon.
 * @returns {CustomIcon} The new custom icon metadata, with a freshly generated id and timestamp.
 */
export const createCustomIcon = (name: string): CustomIcon => ({
  id: uuid(),
  name,
  createdAt: Date.now(),
})
