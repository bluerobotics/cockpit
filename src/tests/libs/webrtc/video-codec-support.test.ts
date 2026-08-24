import { describe, expect, it } from 'vitest'

import { offeredVideoCodecs, readableVideoCodecName, unreceivableVideoCodecs } from '@/libs/webrtc/video-codec-support'

const capabilities = (mimeTypes: string[]): RTCRtpCodecCapability[] =>
  mimeTypes.map((mimeType) => ({ mimeType, clockRate: 90000 }))

// Trimmed from what mavlink-camera-manager offers for an H.265 camera, which names H.265 as its only video
// payload, alongside the retransmission payload that pairs with it.
const hevcOnlyOffer = [
  'v=0',
  'o=- 0 0 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
  'a=rtpmap:96 H265/90000',
  'a=rtpmap:97 rtx/90000',
  'a=fmtp:97 apt=96',
  'a=sendonly',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'a=rtpmap:111 opus/48000/2',
].join('\r\n')

const hevcAndH264Offer = hevcOnlyOffer.replace(
  'a=rtpmap:96 H265/90000',
  'a=rtpmap:96 H265/90000\r\na=rtpmap:98 H264/90000'
)

const twoVideoSectionsOffer = [hevcOnlyOffer, 'm=video 9 UDP/TLS/RTP/SAVPF 98', 'a=rtpmap:98 H264/90000'].join('\r\n')

// Verbatim offer of an H.265 camera published by mavlink-camera-manager, which bundles a single video
// section and pairs the codec with a retransmission payload.
const cameraHevcOffer =
  'v=0\r\no=- 8756736665354191860 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=ice-options:trickle\r\n' +
  'a=group:BUNDLE video0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96 97\r\nc=IN IP4 0.0.0.0\r\na=setup:actpass\r\n' +
  'a=rtcp-mux\r\na=rtcp-rsize\r\na=sendonly\r\na=rtpmap:96 H265/90000\r\na=rtcp-fb:96 nack\r\n' +
  'a=rtcp-fb:96 nack pli\r\na=rtcp-fb:96 ccm fir\r\na=rtcp-fb:96 transport-cc\r\na=rtpmap:97 rtx/90000\r\n' +
  'a=fmtp:97 apt=96\r\na=mid:video0\r\n'

describe('offeredVideoCodecs', () => {
  it('reads the video codecs an offer names', () => {
    expect(offeredVideoCodecs(hevcOnlyOffer)).toEqual(['H265'])
    expect(offeredVideoCodecs(hevcAndH264Offer)).toEqual(['H265', 'H264'])
    expect(offeredVideoCodecs(cameraHevcOffer)).toEqual(['H265'])
  })

  it('reads every video section of an offer, not only the first', () => {
    expect(offeredVideoCodecs(twoVideoSectionsOffer)).toEqual(['H265', 'H264'])
  })

  it('leaves out the auxiliary payloads, which are not codecs the video can arrive as', () => {
    const offer = hevcOnlyOffer.replace('a=sendonly', 'a=rtpmap:98 red/90000\r\na=rtpmap:99 ulpfec/90000')
    expect(offeredVideoCodecs(offer)).toEqual(['H265'])
  })

  it('reads nothing from an offer without video', () => {
    expect(offeredVideoCodecs('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2')).toEqual([])
    expect(offeredVideoCodecs('')).toEqual([])
  })
})

describe('unreceivableVideoCodecs', () => {
  const withoutHevc = capabilities(['video/VP8', 'video/VP9', 'video/H264', 'video/rtx', 'video/red'])
  const withHevc = capabilities(['video/VP8', 'video/H264', 'video/H265', 'video/rtx'])

  it('names the codec when the browser can receive none of the offered ones', () => {
    expect(unreceivableVideoCodecs(hevcOnlyOffer, withoutHevc)).toEqual(['H265'])
    expect(unreceivableVideoCodecs(cameraHevcOffer, withoutHevc)).toEqual(['H265'])
    expect(unreceivableVideoCodecs(cameraHevcOffer, withHevc)).toEqual([])
  })

  it('stays quiet when the browser can receive an offered codec', () => {
    expect(unreceivableVideoCodecs(hevcOnlyOffer, withHevc)).toEqual([])
    expect(unreceivableVideoCodecs(hevcAndH264Offer, withoutHevc)).toEqual([])
    expect(unreceivableVideoCodecs(twoVideoSectionsOffer, withoutHevc)).toEqual([])
  })

  it('does not take the retransmission payload for a codec it can play', () => {
    expect(unreceivableVideoCodecs(hevcOnlyOffer, capabilities(['video/rtx']))).toEqual(['H265'])
  })

  it('stays quiet when there is no video to play, and when the browser reports no codecs at all', () => {
    expect(unreceivableVideoCodecs('v=0\r\ns=-', withoutHevc)).toEqual([])
    expect(unreceivableVideoCodecs(hevcOnlyOffer, [])).toEqual([])
  })
})

describe('readableVideoCodecName', () => {
  it('spells the codec as camera settings do', () => {
    expect(readableVideoCodecName('H265')).toBe('H.265')
    expect(readableVideoCodecName('h264')).toBe('H.264')
    expect(readableVideoCodecName('VP8')).toBe('VP8')
    expect(readableVideoCodecName('AV1')).toBe('AV1')
  })
})
