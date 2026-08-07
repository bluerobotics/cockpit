import { describe, expect, test } from 'vitest'

import {
  type RtpSourceConfig,
  buildRtpGo2rtcSource,
  buildRtpSdp,
  buildRtpUrl,
  parseRtpUrl,
  rtpConfigError,
} from '@/libs/rtp-source'

const h264: RtpSourceConfig = { host: '0.0.0.0', port: 5600, codec: 'h264' }
const h265: RtpSourceConfig = { host: '192.168.2.1', port: 5601, codec: 'h265' }

describe('URI build and parse', () => {
  test('round-trips every valid config', () => {
    for (const config of [h264, h265]) {
      expect(parseRtpUrl(buildRtpUrl(config))).toEqual(config)
    }
  })

  test('builds the canonical form', () => {
    expect(buildRtpUrl(h264)).toBe('rtp://0.0.0.0:5600?codec=h264')
  })

  test('rejects malformed input', () => {
    const invalid = [
      '',
      'not a url',
      'rtsp://0.0.0.0:5600',
      'rtp://0.0.0.0:5600', // no codec
      'rtp://0.0.0.0:5600?codec=vp8', // unsupported codec
      'rtp://0.0.0.0?codec=h264', // no port
      'rtp://0.0.0.0:80?codec=h264', // privileged port
      'rtp://0.0.0.0:70000?codec=h264', // out of range port
      'rtp://example.com:5600?codec=h264', // hostname instead of an IPv4 address
      'rtp://999.1.1.1:5600?codec=h264',
    ]
    for (const url of invalid) {
      expect(parseRtpUrl(url), url).toBeUndefined()
    }
  })
})

describe('config validation', () => {
  test('accepts valid configs', () => {
    expect(rtpConfigError(h264)).toBeUndefined()
    expect(rtpConfigError(h265)).toBeUndefined()
  })

  test('explains what is wrong', () => {
    expect(rtpConfigError({ ...h264, host: 'localhost' })).toMatch(/IPv4/)
    expect(rtpConfigError({ ...h264, port: 5600.5 })).toMatch(/whole number/)
    expect(rtpConfigError({ ...h264, codec: 'av1' as never })).toMatch(/h264, h265/)
  })
})

describe('SDP', () => {
  test('describes the listen address, port and codec', () => {
    const sdp = buildRtpSdp(h264)
    expect(sdp).toContain('c=IN IP4 0.0.0.0')
    expect(sdp).toContain('m=video 5600 RTP/AVP 96')
    expect(sdp).toContain('a=rtpmap:96 H264/90000')
    expect(sdp.startsWith('v=0\r\n')).toBe(true)
  })

  test('names the H.265 codec so ffmpeg depacketizes it correctly', () => {
    expect(buildRtpSdp(h265)).toContain('a=rtpmap:96 H265/90000')
    expect(buildRtpSdp(h265)).toContain('m=video 5601 RTP/AVP 96')
  })
})

describe('go2rtc source', () => {
  test('carries the SDP inline', () => {
    const source = buildRtpGo2rtcSource(h264)
    expect(source).toContain('#input=cockpit-rtp')
    const sdp = atob(source.slice('ffmpeg:data:application/sdp;base64,'.length, source.indexOf('#')))
    expect(sdp).toBe(buildRtpSdp(h264))
  })

  test('passes both codecs through without re-encoding', () => {
    for (const config of [h264, h265]) {
      expect(buildRtpGo2rtcSource(config), config.codec).toContain('#video=copy')
    }
  })

  test('never contains whitespace, which go2rtc would reject', () => {
    for (const config of [h264, h265]) {
      expect(buildRtpGo2rtcSource(config)).not.toMatch(/\s/)
    }
  })
})
