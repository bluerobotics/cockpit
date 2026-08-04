/** A Chromium command-line switch, stripped of its leading dashes. */
export interface ChromiumSwitch {
  /**
   * Switch name, e.g. "disable-zero-copy-dxgi-video"
   */
  name: string
  /**
   * Value for switches that take one, e.g. "gl" for "use-angle=gl"
   */
  value?: string
}

/**
 * Parse Chromium command-line switches from a persisted list or a whitespace-separated string.
 * Entries are separated by whitespace only, as values like "enable-features=A,B" are comma-separated themselves.
 * @param {string | string[] | undefined} input Switch entries, with or without leading dashes
 * @returns {ChromiumSwitch[]} Parsed switches, skipping entries without a name
 */
export const parseChromiumSwitches = (input: string | string[] | undefined): ChromiumSwitch[] => {
  const entries = typeof input === 'string' ? input.split(/\s+/) : input ?? []
  return entries
    .map((entry) => {
      const normalized = entry.trim().replace(/^-+/, '')
      const separatorIndex = normalized.indexOf('=')
      if (separatorIndex === -1) return { name: normalized }
      return { name: normalized.slice(0, separatorIndex), value: normalized.slice(separatorIndex + 1) }
    })
    .filter(({ name }) => name !== '')
}
