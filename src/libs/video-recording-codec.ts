import { sleep } from '@/libs/utils'

/**
 * Formats Chromium accepts for recording an H.265 stream, in order of preference. Keeping HEVC comes first,
 * as it costs the least and loses the least quality of the two, with H.264 there for machines whose hardware
 * cannot encode HEVC. The `hvc1.<profile>.<compatibility>.<tier><level>` suffix is not optional: Chromium
 * reports a bare `hvc1` as unsupported.
 */
const hevcRecordingMimeTypes = ['video/x-matroska;codecs=hvc1.1.6.L186.B0', 'video/x-matroska;codecs=avc1']

const hevcCodecNames = ['h265', 'hevc']

const codecNameFromMimeType = (mimeType: string | undefined): string | undefined => mimeType?.split('/')[1]

/**
 * Tells whether a codec name refers to H.265, which is reported under more than one name.
 * @param {string | undefined} codec - Codec name, e.g. 'H265'
 * @returns {boolean} True if the codec is H.265
 */
export const isHevcCodec = (codec: string | undefined): boolean => hevcCodecNames.includes(codec?.toLowerCase() ?? '')

/**
 * Reads the video codec a connection is actually receiving out of its statistics report.
 *
 * Codec mime types, such as 'video/H265', come in their own reports, referenced by the stream that uses them.
 * @param {RTCStatsReport} stats - Report as returned by `RTCPeerConnection.getStats()`
 * @returns {string | undefined} The codec name, or undefined while no packet has been processed yet
 */
export const codecNameFromStats = (stats: RTCStatsReport): string | undefined => {
  const codecMimeTypes: Record<string, string> = {}
  let videoCodecId: string | undefined
  stats.forEach((report) => {
    if (report.type === 'codec') codecMimeTypes[report.id] = report.mimeType
    if (report.type === 'inbound-rtp' && report.kind === 'video') videoCodecId = report.codecId
  })

  return videoCodecId ? codecNameFromMimeType(codecMimeTypes[videoCodecId]) : undefined
}

/**
 * Video codecs a connection has negotiated, which are known from the moment the track arrives, unlike the
 * codec in use, and are thus what we have to go on when recording starts before the first packet.
 * @param {RTCPeerConnection} peerConnection - Connection receiving the stream
 * @returns {string[]} Codec names, in the order they were negotiated
 */
export const negotiatedVideoCodecNames = (peerConnection: RTCPeerConnection): string[] =>
  peerConnection
    .getReceivers()
    .filter((receiver) => receiver.track?.kind === 'video')
    .flatMap((receiver) => receiver.getParameters().codecs.map((codec) => codecNameFromMimeType(codec.mimeType)))
    .filter((name): name is string => name !== undefined)

/**
 * Decides the mimeType MediaRecorder should record a stream with, based on the codec the stream carries.
 *
 * Given no mimeType, Chromium copies the incoming frames straight into the file, which is what we want
 * whenever we can have it, as it neither costs CPU nor loses quality. That path skips the codec support
 * check every other path performs, though, and an H.265 stream reaching it takes Electron's renderer
 * process down, so there HEVC has to name its format explicitly and pay for a re-encode.
 *
 * Browsers record the same stream by copy without trouble, so Lite keeps the frames as they come: naming a
 * type there would trade a lossless recording for a re-encoded one and buy nothing.
 * @param {string | undefined} codec - Codec carried by the stream, as reported by the peer connection
 * @param {boolean} crashesOnHevcPassthrough - Whether this runtime is one whose frame-copying path HEVC kills
 * @param {(type: string) => boolean} isTypeSupported - Support check, defaulting to MediaRecorder's own
 * @returns {string | undefined} The mimeType to record with, or undefined to record the frames as they come
 */
export const recordingMimeType = (
  codec: string | undefined,
  crashesOnHevcPassthrough: boolean,
  isTypeSupported = (type: string): boolean => MediaRecorder.isTypeSupported(type)
): string | undefined => {
  if (!isHevcCodec(codec) || !crashesOnHevcPassthrough) return undefined

  // Naming a type nothing supports is still better than falling back to copying the frames, as an
  // unsupported type only makes the MediaRecorder constructor throw, which we can catch and report.
  return hevcRecordingMimeTypes.find((type) => isTypeSupported(type)) ?? hevcRecordingMimeTypes[0]
}

// ponytail: fixed bits-per-pixel guess, about what a hardware encoder needs to stay visually clean at the
// 4K this was measured against. The source's own bitrate would be exact, but reading it takes two statistics
// samples spaced in time, which the record button cannot wait for.
const recordingBitsPerPixel = 0.07

// Bits per pixel rises as the picture shrinks, since a frame costs something to code however small it is, and
// against a 320x240 camera the rate above came out eight times under what the camera itself was sending. This
// floor is what a small picture is not allowed to fall below; a large one is budgeted by the rate above.
const minimumRecordingBitsPerSecond = 1_000_000

/**
 * Bitrate to re-encode a recording at, scaled to the picture being recorded.
 *
 * Without one, Chromium encodes at a fixed default that ignores the resolution, so a large camera ends up
 * recorded at a fraction of the quality it was streaming at.
 * @param {MediaTrackSettings} settings - Settings of the video track being recorded
 * @returns {number} Bitrate in bits per second
 */
export const recordingVideoBitsPerSecond = (settings: MediaTrackSettings): number => {
  const width = settings.width ?? 1920
  const height = settings.height ?? 1080
  const frameRate = settings.frameRate ?? 30
  return Math.max(Math.round(width * height * frameRate * recordingBitsPerPixel), minimumRecordingBitsPerSecond)
}

/**
 * Settings of a video track, waited on until it knows the size of the frames it carries.
 *
 * A received track only learns its size from a decoded frame, and recording can start before the first one
 * arrives, in which case the bitrate above would be budgeted from the assumed 1080p rather than the real
 * picture. Gives up on the timeout, as a stream that never delivers a frame must not hold the recording.
 * @param {MediaStreamTrack} track - Video track about to be recorded
 * @param {number} timeoutMs - How long to wait before settling for what the track knows
 * @returns {Promise<MediaTrackSettings>} The track's settings
 */
export const videoTrackSettingsWithSize = async (
  track: MediaStreamTrack,
  timeoutMs = 1000
): Promise<MediaTrackSettings> => {
  const deadline = Date.now() + timeoutMs
  let settings = track.getSettings()
  while (settings.width === undefined && Date.now() < deadline) {
    await sleep(50)
    settings = track.getSettings()
  }
  return settings
}

/**
 * How much of a recording's head the main process needs before it can read the codec out of the Matroska
 * header, and how many chunks it may join to get there. MediaRecorder normally writes that header within the
 * first couple of hundred bytes, but it can emit a first chunk of a single byte, splitting even the EBML magic.
 */
export const minimumRecordingHeadBytes = 16 * 1024
export const maxRecordingHeadChunks = 5

/**
 * A recording's head, and how many of its chunks were joined to make it
 */
export interface RecordingHead {
  /**
   * The joined leading chunks
   */
  head: Blob
  /**
   * How many chunks went into it, and thus how many the caller must not send again
   */
  consumed: number
}

/**
 * Joins a recording's leading chunks until they carry enough of its header to read the codec from.
 * @param {(index: number) => Promise<Blob | undefined>} readChunk - Reads the chunk at an index, in order
 * @returns {Promise<RecordingHead>} The joined head and how many chunks went into it
 */
export const joinRecordingHead = async (
  readChunk: (index: number) => Promise<Blob | undefined>
): Promise<RecordingHead> => {
  const parts: Blob[] = []
  let size = 0
  while (size < minimumRecordingHeadBytes && parts.length < maxRecordingHeadChunks) {
    const chunk = await readChunk(parts.length)
    if (!chunk) break
    parts.push(chunk)
    size += chunk.size
  }
  return { head: new Blob(parts), consumed: parts.length }
}
