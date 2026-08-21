/**
 * Formats Chromium accepts for recording an H.265 stream, in order of preference. Keeping HEVC comes first,
 * as it costs the least and loses no quality, with H.264 there for machines whose hardware cannot encode
 * HEVC. The `hvc1.<profile>.<compatibility>.<tier><level>` suffix is not optional: Chromium reports a bare
 * `hvc1` as unsupported.
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
 * check every other path performs, though, and an H.265 stream reaching it takes the whole renderer process
 * down, so HEVC has to name its format explicitly and pay for a re-encode.
 * @param {string | undefined} codec - Codec carried by the stream, as reported by the peer connection
 * @param {(type: string) => boolean} isTypeSupported - Support check, defaulting to MediaRecorder's own
 * @returns {string | undefined} The mimeType to record with, or undefined to record the frames as they come
 */
export const recordingMimeType = (
  codec: string | undefined,
  isTypeSupported = (type: string): boolean => MediaRecorder.isTypeSupported(type)
): string | undefined => {
  if (!isHevcCodec(codec)) return undefined

  // Naming a type nothing supports is still better than falling back to copying the frames, as an
  // unsupported type only makes the MediaRecorder constructor throw, which we can catch and report.
  return hevcRecordingMimeTypes.find((type) => isTypeSupported(type)) ?? hevcRecordingMimeTypes[0]
}
