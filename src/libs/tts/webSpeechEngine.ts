import { type SpeakOptions, type TtsEngine, type TtsVoice } from './types'

/**
 * Speech engine backed by the browser's Web Speech API. Available on every
 * platform, using whatever voices the host OS/browser exposes.
 */
export class WebSpeechEngine implements TtsEngine {
  private readonly synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  // Utterances are cached until they finish so the browser does not garbage-collect them mid-speech.
  private readonly pending = new Set<SpeechSynthesisUtterance>()

  /** @returns {SpeechSynthesisVoice[]} The raw host voices, or an empty list. */
  private rawVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? []
  }

  /** @returns {TtsVoice[]} The host voices normalized for the shared picker. */
  listVoices(): TtsVoice[] {
    return this.rawVoices().map((voice) => ({ id: voice.name, label: `${voice.name} (${voice.lang})` }))
  }

  /**
   * Register a callback for when the host voice list becomes available or changes.
   * @param {() => void} callback - Invoked on every `voiceschanged` event.
   */
  onVoicesChanged(callback: () => void): void {
    if (this.synth) this.synth.onvoiceschanged = callback
  }

  /**
   * Pick a sensible default host voice: the one the platform itself marks as
   * default, then any voice matching the interface language.
   * @returns {string | undefined} The chosen voice id, or undefined when none exist.
   */
  defaultVoiceId(): string | undefined {
    const voices = this.rawVoices()
    const preferred = voices.find((voice) => voice.default) ?? voices.find((voice) => voice.lang === navigator.language)
    return (preferred ?? voices[0])?.name
  }

  /** @inheritdoc */
  speak(voiceId: string, text: string, { volume }: SpeakOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('This system has no speech synthesis support'))
        return
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = volume
      const voice = this.rawVoices().find((candidate) => candidate.name === voiceId)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      }
      this.pending.add(utterance)
      const finish = (): void => {
        this.pending.delete(utterance)
      }
      utterance.onend = (): void => {
        finish()
        resolve()
      }
      utterance.onerror = (event): void => {
        finish()
        // Interruptions are a normal outcome, not a failing speech stack.
        if (event.error === 'canceled' || event.error === 'interrupted') resolve()
        else reject(new Error(`Speech synthesis failed: ${event.error}`))
      }
      this.synth.speak(utterance)
    })
  }
}
