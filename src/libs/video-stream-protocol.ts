import type { VideoStreamProtocol } from '@/types/video'

import { parseRtpUrl } from './rtp-source'

/**
 * How a protocol is shown wherever a stream is listed
 */
interface StreamProtocolChip {
  /**
   * Name of the protocol as the user reads it
   */
  label: string
  /**
   * Colour of the chip carrying that name
   */
  color: string
}

export const streamProtocolChips: Record<VideoStreamProtocol, StreamProtocolChip> = {
  webrtc: { label: 'WebRTC', color: '#3498db' },
  rtsp: { label: 'RTSP', color: '#e67e22' },
  rtp: { label: 'UDP', color: '#16a085' },
}

/**
 * Infer which protocol an external stream id refers to, from the id alone.
 *
 * Needed wherever no correspondency entry exists to carry the protocol, such as the ignored-streams list.
 * @param {string} externalId - The external stream identifier
 * @returns {VideoStreamProtocol} The protocol the id describes
 */
export const protocolFromExternalId = (externalId: string): VideoStreamProtocol => {
  if (externalId.startsWith('rtsp://') || externalId.startsWith('rtsps://')) return 'rtsp'
  if (parseRtpUrl(externalId) !== undefined) return 'rtp'
  return 'webrtc'
}
