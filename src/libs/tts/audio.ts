/**
 * Play WAV audio bytes and resolve once playback finishes.
 * @param {ArrayBuffer} buffer - WAV audio bytes.
 * @param {number} volume - Playback volume in the [0, 1] range.
 * @param {AbortSignal} signal - Optional playback cancellation.
 * @returns {Promise<void>} Resolves when playback ends, rejects when it fails.
 */
export const playWavBuffer = (buffer: ArrayBuffer, volume: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
    const audio = new Audio(url)
    audio.volume = volume
    let settled = false
    const settle = (error?: unknown): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', cancel)
      audio.onended = null
      audio.onerror = null
      URL.revokeObjectURL(url)
      if (error === undefined) resolve()
      else reject(error)
    }
    const cancel = (): void => {
      audio.pause()
      settle()
    }
    signal?.addEventListener('abort', cancel, { once: true })
    audio.onended = () => settle()
    audio.onerror = () => settle(new Error('Could not play the synthesized audio'))
    audio.play().catch(settle)
  })
