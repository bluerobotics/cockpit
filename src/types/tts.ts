/**
 * A curated Piper voice offered for alert speech on the Standalone build.
 */
export interface PiperVoice {
  /** Stable speaker key used in dropdown option values and IPC (e.g. `amy`). */
  key: string
  /** Label shown in the alert-voice dropdown. */
  label: string
  /**
   * Model basename shipped inside the build (without extension), or undefined
   * when the voice is only available after the higher-quality download.
   */
  bundledModel?: string
  /** Higher-quality model basename fetched by the in-app download. */
  hdModel: string
}

/**
 * Curated voices for the bundled synthesizer. Only Amy ships in the build (at
 * low quality); the higher-quality Amy model and the other three voices are
 * fetched on demand by the in-app download. Every `en_US` Piper model is ~63 MB
 * regardless of quality tier, so the whole set is ~250 MB.
 */
export const piperVoices: PiperVoice[] = [
  {
    key: 'amy',
    label: 'Amy (US English, female)',
    bundledModel: 'en_US-amy-low',
    hdModel: 'en_US-amy-medium',
  },
  { key: 'lessac', label: 'Lessac (US English, female)', hdModel: 'en_US-lessac-medium' },
  { key: 'ryan', label: 'Ryan (US English, male)', hdModel: 'en_US-ryan-medium' },
  { key: 'joe', label: 'Joe (US English, male)', hdModel: 'en_US-joe-medium' },
]

/** Voice selected by default whenever the bundled synthesizer is available. */
export const defaultPiperVoiceKey = 'amy'

const piperOptionPrefix = 'piper:'

/**
 * Build the dropdown value that routes speech through the bundled Piper voice.
 * @param {string} key - The Piper speaker key.
 * @returns {string} The prefixed option value stored as the selected voice.
 */
export const piperVoiceOptionValue = (key: string): string => `${piperOptionPrefix}${key}`

/**
 * Extract the Piper speaker key from a selected-voice value, when it is one.
 * @param {string | undefined} value - The persisted selected-voice value.
 * @returns {string | undefined} The speaker key, or undefined for host voices.
 */
export const parsePiperVoiceKey = (value: string | undefined): string | undefined =>
  value?.startsWith(piperOptionPrefix) ? value.slice(piperOptionPrefix.length) : undefined

/**
 * Progress of the in-app higher-quality voice download.
 */
export interface TtsDownloadProgress {
  /** Number of curated voices finished downloading. */
  completed: number
  /** Total number of curated voices to download. */
  total: number
  /** Fraction in [0, 1] of the voice currently downloading. */
  voiceProgress: number
}

/** Outcome of an in-app higher-quality voice download. */
export type TtsDownloadResult = 'ok' | 'failed' | 'cancelled' | 'busy'

/**
 * Availability of a curated Piper voice on the current install.
 */
export interface PiperVoiceStatus {
  /** Stable speaker key. */
  key: string
  /** Label shown in the alert-voice dropdown. */
  label: string
  /** A model (bundled or downloaded) is present to synthesize this voice. */
  available: boolean
  /** The higher-quality model has been downloaded. */
  hd: boolean
}
