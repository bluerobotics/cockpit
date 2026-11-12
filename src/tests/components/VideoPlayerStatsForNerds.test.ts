import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { reactive } from 'vue'

import VideoPlayerStatsForNerds from '@/components/VideoPlayerStatsForNerds.vue'

vi.mock('@peermetrics/webrtc-stats', () => {
  /**
   * Stand-in for the stats library, keeping the last instance so the test can emit its stats events
   */
  class WebRTCStats {
    static lastInstance: WebRTCStats | undefined
    peersToMonitor: Record<string, unknown> = { peer: {} }
    listeners: Record<string, (event: unknown) => void> = {}
    /**
     * Keeps the instance reachable from the test
     */
    constructor() {
      WebRTCStats.lastInstance = this
    }
    /**
     * Stores the listener for the event
     * @param {string} event - Name of the event
     * @param {(event: unknown) => void} listener - Called when the event is emitted
     */
    on(event: string, listener: (event: unknown) => void): void {
      this.listeners[event] = listener
    }
    /**
     * Does nothing, as nothing is monitored
     */
    destroy(): void {
      return
    }
  }
  return { WebRTCStats }
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

const inboundVideoSample = (bitrate: number, framesPerSecond: number): Record<string, number> => ({
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
  framesPerSecond,
  frameHeight: 720,
})

/**
 * The mocked stats library class
 */
interface MockedWebRTCStats {
  /**
   * Listeners of the last instance created, by event name
   */
  lastInstance: Record<'listeners', Record<string, (event: unknown) => void>>
}

const emitStatsAndDraw = async (bitrate: number, framesPerSecond = 5): Promise<void> => {
  const { WebRTCStats } = await import('@peermetrics/webrtc-stats')
  const stats = (WebRTCStats as unknown as MockedWebRTCStats).lastInstance
  vi.advanceTimersByTime(statsIntervalMs)
  stats.listeners.stats({
    peerId: 'peer',
    data: { video: { inbound: [inboundVideoSample(bitrate, framesPerSecond)] } },
  })
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

test('A 5 FPS stream that stops arriving is shown as a lost connection after 3 frame intervals', async () => {
  const wrapper = mount(VideoPlayerStatsForNerds, { props: { streamName: 'Main' } })
  await emitStatsAndDraw(400_000, 5)

  // The reported framerate drops to 0 once frames stop, so the last non-zero one sets the timeout
  for (let sample = 0; sample < 6; sample++) {
    await emitStatsAndDraw(0, 0)
    expect(textColors['Stream']).toBe('white')
  }
  await emitStatsAndDraw(0, 0)
  expect(textColors['Stream']).toBe('red')

  wrapper.unmount()
})

test('A 30 FPS stream that stops arriving is shown as a lost connection after 500 ms', async () => {
  const wrapper = mount(VideoPlayerStatsForNerds, { props: { streamName: 'Main' } })
  await emitStatsAndDraw(4_000_000, 30)

  for (let sample = 0; sample < 5; sample++) {
    await emitStatsAndDraw(0, 0)
    expect(textColors['Stream']).toBe('white')
  }
  await emitStatsAndDraw(0, 0)
  expect(textColors['Stream']).toBe('red')

  wrapper.unmount()
})

test('A stream that has not reported a framerate is shown as a lost connection after 2 seconds', async () => {
  const wrapper = mount(VideoPlayerStatsForNerds, { props: { streamName: 'Main' } })
  await emitStatsAndDraw(400_000, 0)

  for (let sample = 0; sample < 20; sample++) {
    await emitStatsAndDraw(0, 0)
    expect(textColors['Stream']).toBe('white')
  }
  await emitStatsAndDraw(0, 0)
  expect(textColors['Stream']).toBe('red')

  wrapper.unmount()
})
