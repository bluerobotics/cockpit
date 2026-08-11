import { type PiperVoiceStatus, type TtsDownloadResult, parsePiperVoiceKey, piperVoiceOptionValue } from '@/types/tts'

import { playWavBuffer } from './audio'
import { type SpeakOptions, type TtsEngine, type TtsVoice } from './types'

/**
 * Speech engine backed by the Piper synthesizer bundled with the desktop build.
 * All platform work (running the binary, managing models) happens in the
 * Electron main process; this engine only talks to it over the preload bridge.
 */
export class NativePiperEngine implements TtsEngine {
  /** @returns {Promise<boolean>} True when the bundled synthesizer can speak. */
  isAvailable(): Promise<boolean> {
    return window.electronAPI?.ttsAvailable?.() ?? Promise.resolve(false)
  }

  /** @returns {Promise<PiperVoiceStatus[]>} Per-voice availability and download state. */
  voiceStatuses(): Promise<PiperVoiceStatus[]> {
    return window.electronAPI?.ttsListVoices?.() ?? Promise.resolve([])
  }

  /**
   * Map already-fetched voice statuses to the selectable voices with a usable model.
   * @param {PiperVoiceStatus[]} statuses - Per-voice availability and download state.
   * @returns {TtsVoice[]} The curated voices that currently have a usable model.
   */
  voicesFromStatuses(statuses: PiperVoiceStatus[]): TtsVoice[] {
    return statuses
      .filter((status) => status.available)
      .map((status) => ({ id: piperVoiceOptionValue(status.key), label: status.label }))
  }

  /** @inheritdoc */
  async speak(voiceId: string, text: string, { volume }: SpeakOptions): Promise<void> {
    const key = parsePiperVoiceKey(voiceId)
    if (!key || !window.electronAPI?.ttsSynthesize) return
    const audio = await window.electronAPI.ttsSynthesize(text, key)
    if (!audio) throw new Error('The bundled synthesizer produced no audio')
    await playWavBuffer(audio, volume)
  }

  /** @returns {Promise<TtsDownloadResult>} How the higher-quality download ended. */
  downloadHdVoices(): Promise<TtsDownloadResult> {
    return window.electronAPI?.ttsDownloadVoices?.() ?? Promise.resolve('failed')
  }

  /** Abort the higher-quality download currently in progress, if any. */
  cancelHdVoicesDownload(): void {
    void window.electronAPI?.ttsCancelDownload?.()
  }

  /** @returns {Promise<boolean>} True when the downloaded models were removed. */
  deleteHdVoices(): Promise<boolean> {
    return window.electronAPI?.ttsDeleteVoices?.() ?? Promise.resolve(false)
  }
}
