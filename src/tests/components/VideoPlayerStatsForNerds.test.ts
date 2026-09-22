import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import VideoPlayerStatsForNerds from '@/components/VideoPlayerStatsForNerds.vue'
import { useStreamStats } from '@/composables/useStreamStats'
import type { Go2rtcStreamSample, WebRtcFrameDerivedStats } from '@/libs/video/stream-stats'
import type { WebRTCVideoStats } from '@/types/video'

vi.mock('@/composables/useStreamStats', async () => {
  const { reactive: makeReactive } = await import('vue')
  const webRtcStreamStatsSnapshots = makeReactive<Record<string, WebRTCVideoStats | undefined>>({})
  const webRtcDerivedFrameStats = makeReactive<Record<string, WebRtcFrameDerivedStats | undefined>>({})
  const go2rtcStreamSamples = makeReactive<Record<string, Go2rtcStreamSample | undefined>>({})
  return {
    useStreamStats: () => ({
      webRtcStreamStatsSnapshots,
      webRtcDerivedFrameStats,
      go2rtcStreamSamples,
      acquireGo2rtcSampling: (): void => undefined,
      releaseGo2rtcSampling: (): void => undefined,
    }),
  }
})
vi.mock('@/stores/video', () => ({
  useVideoStore: () => ({
    activeStreams: reactive({}),
    getStreamProtocol: () => 'webrtc',
    getStreamPeerConnection: () => undefined,
  }),
}))

const statsIntervalMs = 100
let drawNextFrame: FrameRequestCallback | undefined
let textColors: Record<string, string> = {}

const fakeCanvasContext = {
  fillStyle: '',
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillText(text: string): void {
    textColors[text.split(':')[0]] = this.fillStyle
  },
}

const inboundVideoSample = (bitrate: number): Record<string, number> => ({
  bitrate,
  packetsLost: 0,
  packetsReceived: 100,
  nackCount: 0,
  pliCount: 0,
  firCount: 0,
  totalProcessingDelay: 0,
  framesReceived: 10,
  freezeCount: 0,
  totalFreezesDuration: 0,
  framesDropped: 0,
  jitterBufferDelay: 0,
  jitterBufferEmittedCount: 0,
  framesPerSecond: 5,
  frameHeight: 720,
})

// Stands in for the shared collector publishing one stats sample of the stream
const emitStatsAndDraw = async (bitrate: number): Promise<void> => {
  vi.advanceTimersByTime(statsIntervalMs)
  useStreamStats().webRtcStreamStatsSnapshots.Main = inboundVideoSample(bitrate) as unknown as WebRTCVideoStats
  await nextTick()
  drawNextFrame?.(performance.now())
}

beforeEach(() => {
  vi.useFakeTimers()
  textColors = {}
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    fakeCanvasContext as unknown as CanvasRenderingContext2D
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    drawNextFrame = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('A 5 FPS stream, with no packet in every other stats sample, is not shown as a lost connection', async () => {
  const wrapper = mount(VideoPlayerStatsForNerds, { props: { streamName: 'Main' } })

  for (let sample = 0; sample < 30; sample++) {
    await emitStatsAndDraw(sample % 2 === 0 ? 400_000 : 0)
    expect(textColors['Stream']).toBe('white')
  }

  wrapper.unmount()
})

test('A stream that stops arriving is shown as a lost connection after 2 seconds', async () => {
  const wrapper = mount(VideoPlayerStatsForNerds, { props: { streamName: 'Main' } })
  await emitStatsAndDraw(400_000)

  for (let sample = 0; sample < 20; sample++) {
    await emitStatsAndDraw(0)
    expect(textColors['Stream']).toBe('white')
  }
  await emitStatsAndDraw(0)
  expect(textColors['Stream']).toBe('red')

  wrapper.unmount()
})
