/**
 * Asks the browser to keep IndexedDB durable so large data is less likely to be evicted under storage pressure.
 * No-op where unsupported.
 * @returns {Promise<boolean>} True if storage is persisted, false otherwise.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * Estimated remaining IndexedDB bytes for the current origin, used to warn before storing large data.
 * Returns `undefined` where the Storage API is unavailable, meaning "no quota concern".
 * @returns {Promise<number | undefined>} The remaining bytes, or `undefined` when not applicable.
 */
export const getStorageBytesAvailable = async (): Promise<number | undefined> => {
  if (!navigator.storage?.estimate) return undefined
  try {
    const { quota, usage } = await navigator.storage.estimate()
    if (quota === undefined || usage === undefined) return undefined
    return Math.max(0, quota - usage)
  } catch {
    return undefined
  }
}
