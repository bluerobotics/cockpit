// Machine-local, like the page localStorage widgets used before running in a frame; not a synced setting.
const widgetStorageKey = 'cockpit-diy-widget-storage'

/**
 * Size, in characters of the stored text, that every DIY widget's localStorage shares, kept well under what the
 * browser allows Cockpit's whole origin so Cockpit's own settings always fit
 */
export const diyWidgetStorageLimit = 1_000_000

type AllStorage = Record<string, Record<string, string>>

// Read once and kept, since only this module writes the key: another tab's write drops the copy through the storage
// event, which fires only in the other documents, and clearing Cockpit's storage reloads the app.
let loaded: AllStorage | undefined

window.addEventListener('storage', (event) => {
  if (event.key === widgetStorageKey || event.key === null) loaded = undefined
})

const readAll = (): AllStorage => {
  if (loaded !== undefined) return loaded
  try {
    const stored = JSON.parse(localStorage.getItem(widgetStorageKey) ?? '{}')
    loaded = typeof stored === 'object' && stored !== null ? stored : {}
  } catch {
    loaded = {}
  }
  return loaded as AllStorage
}

// ponytail: every write stringifies all widgets' items (up to the 1 MB cap) on the main thread, which suits widgets
// saving now and then; one saving per frame would want per-widget keys or writes coalesced into an idle callback.
const writeAll = (all: AllStorage): boolean => {
  const serialized = Object.keys(all).length === 0 ? null : JSON.stringify(all)
  if (serialized !== null && serialized.length > diyWidgetStorageLimit) return false
  try {
    if (serialized === null) localStorage.removeItem(widgetStorageKey)
    else localStorage.setItem(widgetStorageKey, serialized)
    loaded = all
    return true
  } catch {
    return false
  }
}

/**
 * The localStorage items of one DIY widget
 * @param {string} widgetId - The widget's hash
 * @returns {Record<string, string>} A copy of its items
 */
export const diyWidgetStorage = (widgetId: string): Record<string, string> =>
  Object.fromEntries(Object.entries(readAll()[widgetId] ?? {}).filter(([, value]) => typeof value === 'string'))

/**
 * Replace the localStorage items of one DIY widget
 * @param {string} widgetId - The widget's hash
 * @param {Record<string, string>} items - Its items
 * @returns {boolean} False when they do not fit or could not be written, leaving what was stored untouched
 */
export const saveDiyWidgetStorage = (widgetId: string, items: Record<string, string>): boolean => {
  const others = Object.fromEntries(Object.entries(readAll()).filter(([id]) => id !== widgetId))
  return writeAll(Object.keys(items).length === 0 ? others : { ...others, [widgetId]: { ...items } })
}

/**
 * Drop the localStorage items of every DIY widget no layout holds any more
 * @param {Set<string>} widgetIds - The hashes of every DIY widget some layout on this computer still holds
 */
export const keepOnlyDiyWidgetStorage = (widgetIds: Set<string>): void => {
  const all = readAll()
  if (Object.keys(all).every((id) => widgetIds.has(id))) return
  writeAll(Object.fromEntries(Object.entries(all).filter(([id]) => widgetIds.has(id))))
}

/**
 * Give a DIY widget's new hash the items of its old one, which other layouts may still hold until the sweep drops them
 * @param {string} from - The old hash
 * @param {string} to - The new hash
 */
export const copyDiyWidgetStorage = (from: string, to: string): void => {
  const { [from]: items, ...others } = readAll()
  if (items === undefined) return
  // ponytail: a copy that does not fit under the cap moves the items, so the edited widget keeps them at the cost of
  // another layout holding the old hash; counting shared items once would let both keep them.
  if (!writeAll({ ...others, [from]: items, [to]: items })) writeAll({ ...others, [to]: items })
}
