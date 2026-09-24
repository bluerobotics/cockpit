import type { GapFillerStream } from '@/types/video'

// Enough for the notice on it to read as live, and cheap enough to draw while the operator has other worries
const gapFillerFrameRate = 2

/**
 * Builds the stream a recording is fed while its video is gone, so the take keeps wall-clock pace and its
 * telemetry overlay still lines up with the footage that follows the outage.
 * @param {number} width - Width of the recording, in pixels
 * @param {number} height - Height of the recording, in pixels
 * @param {boolean} withAudio - Whether the recording carries audio, which the filler then has to carry too,
 * as segments that disagree on having it cannot be joined without re-encoding the whole recording
 * @returns {GapFillerStream} The stream to record, and the teardown of everything feeding it
 */
export const createGapFillerStream = (width: number, height: number, withAudio: boolean): GapFillerStream => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw the filler for the video outage.')

  let audioContext: AudioContext | undefined
  let audioTracks: MediaStreamTrack[] = []
  if (withAudio) {
    audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    const silence = audioContext.createGain()
    silence.gain.value = 0
    const oscillator = audioContext.createOscillator()
    oscillator.connect(silence)
    silence.connect(destination)
    oscillator.start()
    audioTracks = destination.stream.getAudioTracks()
  }

  const startedAt = new Date()
  const draw = (): void => {
    const secondsLost = Math.round((new Date().getTime() - startedAt.getTime()) / 1000)
    context.fillStyle = '#000000'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#FFFFFF'
    context.font = `${Math.round(height / 20)}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(`Video signal lost for ${secondsLost}s`, width / 2, height / 2)
  }
  draw()

  const stream = canvas.captureStream(gapFillerFrameRate)
  audioTracks.forEach((track) => stream.addTrack(track))

  // A canvas is only captured as it is drawn to, so the notice is redrawn rather than left still, which
  // also keeps frames flowing while nothing about the outage changes
  const redraw = setInterval(draw, 1000 / gapFillerFrameRate)

  const stop = (): void => {
    clearInterval(redraw)
    stream.getTracks().forEach((track) => track.stop())
    audioContext?.close().catch((error) => console.warn('Could not close the audio of the video outage:', error))
  }

  return { stream, stop }
}
