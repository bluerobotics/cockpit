import type { VideoStreamProtocol } from '@/types/video'

import { parseRtpUrl } from './rtp-source'

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
