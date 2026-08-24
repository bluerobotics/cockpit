// An offer also names the payloads that carry retransmissions and error correction, which every browser
// accepts and which would otherwise read as a codec it can play.
const auxiliaryPayloads = ['rtx', 'red', 'ulpfec', 'flexfec-03']

/**
 * Video codecs an SDP offers, as named in the rtpmap lines of its video sections.
 * @param {string} sdp - Session description to read
 * @returns {string[]} Codec names as the SDP spells them, without the auxiliary payloads
 */
export const offeredVideoCodecs = (sdp: string): string[] => {
  const videoSections = sdp.split(/^m=/m).filter((section) => section.startsWith('video'))

  const names = videoSections.flatMap((section) =>
    [...section.matchAll(/^a=rtpmap:\d+ ([^/\s]+)/gm)].map((match) => match[1])
  )
  return [...new Set(names)].filter((name) => !auxiliaryPayloads.includes(name.toLowerCase()))
}

/**
 * Offered video codecs that this browser cannot receive, and only when it can receive none of them, since a
 * single supported codec is enough for the negotiation to settle on it and the video to play.
 * @param {string} sdp - Session description offered by the camera
 * @param {RTCRtpCodecCapability[]} receivableCodecs - Codecs the browser receives, queried when not given
 * @returns {string[]} Offered codec names, or nothing when one of them can be received
 */
export const unreceivableVideoCodecs = (
  sdp: string,
  receivableCodecs = RTCRtpReceiver.getCapabilities?.('video')?.codecs ?? []
): string[] => {
  const offered = offeredVideoCodecs(sdp)
  if (offered.length === 0) return []

  // An engine that names no codec has told us nothing about what it plays, which is not the same as telling us
  // that it plays nothing.
  if (receivableCodecs.length === 0) return []

  const receivable = receivableCodecs.map((codec) => codec.mimeType.replace(/^video\//i, '').toLowerCase())
  return offered.some((codec) => receivable.includes(codec.toLowerCase())) ? [] : offered
}

/**
 * Codec name spelled as camera settings and datasheets do, so users can match it to what they configure.
 * @param {string} codec - Codec name as an SDP spells it, such as 'H265'
 * @returns {string} Name for the user, such as 'H.265'
 */
export const readableVideoCodecName = (codec: string): string => codec.replace(/^h(26[45])$/i, 'H.$1')
