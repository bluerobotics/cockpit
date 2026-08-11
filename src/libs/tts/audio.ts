/**
 * Play WAV audio bytes and resolve once playback finishes.
 * @param {ArrayBuffer} buffer - WAV audio bytes.
 * @param {number} volume - Playback volume in the [0, 1] range.
 * @returns {Promise<void>} Resolves when playback ends, rejects when it fails.
 */
export const playWavBuffer = (buffer: ArrayBuffer, volume: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
    const audio = new Audio(url)
    audio.volume = volume
    const settle = (error?: unknown): void => {
      URL.revokeObjectURL(url)
      if (error === undefined) resolve()
      else reject(error)
    }
    audio.onended = () => settle()
    audio.onerror = () => settle(new Error('Could not play the synthesized audio'))
    audio.play().catch(settle)
  })
