import { expect, test } from 'vitest'

import { buildGo2rtcStreamSample } from '@/libs/video/stream-stats'
import type { Go2RTCStreamInfo } from '@/types/video'

const streamInfo = (bytes: number, packets: number, sampleEpoch: number): Go2RTCStreamInfo => ({
  codec: 'H264',
  fps: '30',
  protocol: 'rtsp+tcp',
  bytes,
  packets,
  sampleEpoch,
})

test('the first sample of a stream publishes the counters but no rates, since no rate is derivable yet', () => {
  const sample = buildGo2rtcStreamSample(streamInfo(1000, 10, 5000), undefined)

  expect(sample.bytes).toBe(1000)
  expect(sample.packets).toBe(10)
  expect(sample.sampleEpoch).toBe(5000)
  expect('bitrateKbps' in sample).toBe(false)
  expect('packetsPerSec' in sample).toBe(false)
})

test('a sample with a real window publishes both counters and rates', () => {
  const previous = streamInfo(1000, 10, 5000)
  const sample = buildGo2rtcStreamSample(streamInfo(126000, 110, 6000), previous)

  expect(sample.bytes).toBe(126000)
  expect(sample.bitrateKbps).toBe(1000)
  expect(sample.packetsPerSec).toBe(100)
})

test('counters that went backwards publish no rates rather than a zero that would read as a stall', () => {
  const previous = streamInfo(126000, 110, 6000)
  const sample = buildGo2rtcStreamSample(streamInfo(500, 5, 7000), previous)

  expect(sample.bytes).toBe(500)
  expect('bitrateKbps' in sample).toBe(false)
  expect('packetsPerSec' in sample).toBe(false)
})
