/**
 * Raw RTP over UDP video sources, as emitted by ArduPilot/PX4 companion computers.
 *
 * RTP carries no description of what it transports, so a receiver has to be told the codec and clock rate
 * out of band. We synthesize a minimal SDP for that, the same information QGroundControl hardcodes into its
 * GStreamer caps, and hand it to ffmpeg through the go2rtc sidecar.
 */

import { isValidIpv4Address } from './utils'

export const rtpCodecs = ['h264', 'h265'] as const

export type RtpCodec = (typeof rtpCodecs)[number]

export type RtpSourceConfig = {
  /**
   * Local IPv4 address to listen on, or 0.0.0.0 for every network interface
   */
  host: string
  /**
   * Local UDP port to listen on
   */
  port: number
  /**
   * Codec the sender packetizes into RTP
   */
  codec: RtpCodec
}

// First dynamic RTP payload type, and the default of both ffmpeg's RTP muxer and GStreamer's rtph264pay,
// so it is what companion computers overwhelmingly emit.
const rtpPayloadType = 96

/**
 * Name of the ffmpeg input template that go2rtc.yaml must declare for RTP sources to resolve.
 *
 * go2rtc has no native RTP source, and it refuses sources created through its API that either use the
 * `exec:` scheme or contain whitespace. So the ffmpeg arguments cannot travel in the source string and
 * live in a named template in the config file instead, leaving the per-stream source to just reference it.
 */
export const rtpInputTemplateName = 'cockpit-rtp'

/** ffmpeg input arguments for the template named {@link rtpInputTemplateName}. */
export const rtpInputTemplate = '-fflags nobuffer -flags low_delay -protocol_whitelist data,udp,rtp -f sdp -i {input}'

/**
 * Check whether a config describes a stream Cockpit can actually listen for.
 * @param {RtpSourceConfig} config The config to check
 * @returns {string | undefined} A user-facing description of the problem, or undefined when the config is valid
 */
export const rtpConfigError = (config: RtpSourceConfig): string | undefined => {
  // The SDP describes the listen address as `IN IP4`, so a hostname or IPv6 literal would not be honest there.
  if (!isValidIpv4Address(config.host)) {
    return 'Address must be an IPv4 address, such as 0.0.0.0 to listen on every network interface.'
  }
  // Ports under 1024 need administrator privileges to bind, which would fail with no video and no clear reason.
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
    return 'Port must be a whole number between 1024 and 65535.'
  }
  if (!rtpCodecs.includes(config.codec)) {
    return `Codec must be one of: ${rtpCodecs.join(', ')}.`
  }
  return undefined
}

/**
 * Build the canonical URI that identifies an RTP stream throughout Cockpit.
 * @param {RtpSourceConfig} config The stream to identify
 * @returns {string} A `rtp://host:port?codec=` URI
 */
export const buildRtpUrl = (config: RtpSourceConfig): string =>
  `rtp://${config.host}:${config.port}?codec=${config.codec}`

/**
 * Recover the config behind a URI built by {@link buildRtpUrl}.
 * @param {string} url The URI to parse
 * @returns {RtpSourceConfig | undefined} The config, or undefined if the URI is not a valid RTP source URI
 */
export const parseRtpUrl = (url: string): RtpSourceConfig | undefined => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'rtp:') return undefined

  const config = {
    host: parsed.hostname,
    port: Number(parsed.port),
    codec: parsed.searchParams.get('codec') as RtpCodec,
  }
  return rtpConfigError(config) === undefined ? config : undefined
}

/**
 * Build the SDP that tells ffmpeg where to listen and what it will find there.
 * @param {RtpSourceConfig} config The stream to describe
 * @returns {string} An SDP session description
 */
export const buildRtpSdp = (config: RtpSourceConfig): string =>
  [
    'v=0',
    `o=- 0 0 IN IP4 ${config.host}`,
    's=Cockpit RTP Stream',
    `c=IN IP4 ${config.host}`,
    't=0 0',
    `m=video ${config.port} RTP/AVP ${rtpPayloadType}`,
    `a=rtpmap:${rtpPayloadType} ${config.codec.toUpperCase()}/90000`,
    '',
  ].join('\r\n')

/**
 * Build the go2rtc source string that makes the sidecar ingest an RTP stream through ffmpeg.
 *
 * The SDP travels inline as a `data:` URI rather than as a temp file, because go2rtc rejects sources
 * containing whitespace and so could never reference a path with a space in it.
 *
 * Both codecs are passed through untouched. H.265 reaches the renderer only because `src/electron/main.ts`
 * turns on Chromium's HEVC decoding and WebRTC HEVC switches, so removing those breaks H.265 here too.
 * @param {RtpSourceConfig} config The stream to ingest
 * @returns {string} A go2rtc `ffmpeg:` source string
 */
export const buildRtpGo2rtcSource = (config: RtpSourceConfig): string =>
  `ffmpeg:data:application/sdp;base64,${btoa(buildRtpSdp(config))}#input=${rtpInputTemplateName}#video=copy`
