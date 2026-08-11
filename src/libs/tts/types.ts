/**
 * A voice offered to the user, normalized across every engine so the UI and the
 * selection state never need to know which engine produced it.
 */
export interface TtsVoice {
  /**
   * Stable value persisted as the selected voice and used to route speech.
   * Web Speech voices use the raw voice name; Piper voices use the `piper:` prefixed key.
   */
  id: string
  /** Human-readable label for the dropdown. */
  label: string
}

/** Options for a single speak request. */
export interface SpeakOptions {
  /** Playback volume in the [0, 1] range. 0 keeps timing but stays silent. */
  volume: number
}

/**
 * A speech engine: the ability to speak with one of its voices. Implementations
 * keep their platform specifics (Web Speech API, Electron IPC) internal so the
 * manager stays runtime-agnostic.
 */
export interface TtsEngine {
  /**
   * Speak text with one of the engine's voices, resolving when playback ends.
   * @param {string} voiceId - The {@link TtsVoice.id} to speak with.
   * @param {string} text - The text to speak.
   * @param {SpeakOptions} options - Playback options.
   * @returns {Promise<void>} Resolves when playback finishes or cannot start.
   */
  speak(voiceId: string, text: string, options: SpeakOptions): Promise<void>
}

/**
 * Clamp a volume into the [0, 1] range accepted by the audio backends.
 * @param {number} volume - Requested volume.
 * @returns {number} The volume clamped to [0, 1].
 */
export const clampVolume = (volume: number): number => Math.min(Math.max(volume, 0), 1)
