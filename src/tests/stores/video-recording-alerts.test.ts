import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { markRaw, nextTick, ref } from 'vue'

const pushAlert = vi.fn()
const showDialog = vi.fn()
const availableStreams = ref<Stream[]>([])

vi.mock('@/stores/alert', () => ({ useAlertStore: () => ({ pushAlert }) }))
vi.mock('@/stores/mainVehicle', () => ({ useMainVehicleStore: () => ({ globalAddress: '' }) }))
vi.mock('@/stores/mission', () => ({ useMissionStore: () => ({ missionName: 'Test mission' }) }))
vi.mock('@/composables/settingsSyncer', () => ({ useBlueOsStorage: (_key: string, value: unknown) => ref(value) }))
vi.mock('@/composables/interactionDialog', () => ({
  useInteractionDialog: () => ({ showDialog, closeDialog: vi.fn() }),
}))
vi.mock('@/composables/snackbar', () => ({ useSnackbar: () => ({ openSnackbar: vi.fn() }) }))
vi.mock('@/composables/menuRouting', () => ({ goToMenuPage: vi.fn() }))
vi.mock('@/composables/webRTC', () => ({
  WebRTCManager: class {
    availableStreams = availableStreams
    availableICEIPs = ref([])
    close = vi.fn()
    startStream = (): Pick<ReturnType<WebRTCManager['startStream']>, 'mediaStream' | 'connected'> => ({
      mediaStream: ref(undefined),
      connected: ref(false),
    })
  },
}))
vi.mock('@/libs/blueos', () => ({}))
vi.mock('@/libs/sensors-logging', () => ({ datalogger: { generateLog: async () => undefined } }))
vi.mock('@/libs/external-telemetry/event-tracking', () => ({ default: { capture: vi.fn() } }))
vi.mock('@/libs/videoStorage', () => ({
  tempVideoStorage: { keys: async () => [], setItem: async () => undefined },
  videoStorage: {},
}))

import '@/libs/cosmos'

import { WebRTCManager } from '@/composables/webRTC'
import { cockpitActionsManager, unregisterActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import type { Stream } from '@/libs/webrtc/signalling_protocol'
import { useVideoStore } from '@/stores/video'
import { Alert, AlertLevel } from '@/types/alert'

const externalId = 'rtsp://192.0.2.1:8554/camera'
const originalMediaRecorder = globalThis.MediaRecorder
let activeStore: ReturnType<typeof useVideoStore>

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  localStorage.clear()
  pushAlert.mockReset()
  showDialog.mockReset()
  availableStreams.value = [externalId, 'camera-2'].map((name) => ({
    id: name,
    name,
    encode: 'H264',
    width: 1920,
    height: 1080,
    interval: null,
    source: null,
    created: null,
  }))
  vi.stubGlobal(
    'MediaRecorder',
    class {
      state = 'inactive'
      start = vi.fn(() => {
        this.state = 'recording'
      })
      stop = vi.fn(() => {
        this.state = 'inactive'
      })
    }
  )
})

afterEach(() => {
  activeStore.$dispose()
  unregisterActionCallback('start_recording_all_streams')
  unregisterActionCallback('stop_recording_all_streams')
  unregisterActionCallback('toggle_recording_all_streams')
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.stubGlobal('MediaRecorder', originalMediaRecorder)
  vi.restoreAllMocks()
  delete window.electronAPI
  window.onbeforeunload = null
})

test('stream configuration changes name the camera in the recording-stop dialog', async () => {
  const store = readyStream('Front camera')
  const recorder = markRaw(new MediaRecorder(store.activeStreams[externalId]!.mediaStream!))
  recorder.start()
  store.activeStreams[externalId]!.mediaRecorder = recorder
  store.activeStreams[externalId]!.timeRecordingStart = new Date()
  store.activeStreams[externalId]!.stream = { ...availableStreams.value[0] }
  store.activeStreams[externalId]!.webRtcManager = markRaw(new WebRTCManager('', {}))
  availableStreams.value[0].width = 1280

  vi.advanceTimersByTime(300)

  expect(showDialog).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Stream 'Front camera' has changed. Stopping recording..." })
  )
})

test('video-processing failures name the camera rather than its address', async () => {
  const store = readyStream('Front camera')
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Electron')
  window.electronAPI = {
    startVideoRecording: vi.fn(async () => ({ id: 'processor', outputPath: '/videos/recording.mp4' })),
    finalizeVideoRecording: vi.fn(async () => {
      throw new Error('Finalization failed')
    }),
  } as unknown as typeof window.electronAPI
  const start = store.startRecording(externalId)
  vi.advanceTimersByTime(100)
  await start
  const recorder = store.activeStreams[externalId]!.mediaRecorder!
  const chunkEvent = Object.assign(new Event('dataavailable'), {
    data: new Blob(['video'], { type: 'video/webm' }),
    timecode: 0,
  }) as BlobEvent
  await recorder.ondataavailable?.(chunkEvent)
  store.stopRecording(externalId)

  await recorder.onstop?.(new Event('stop'))

  expect(pushAlert).toHaveBeenCalledWith(
    expect.objectContaining({ level: AlertLevel.Error, message: 'Failed to process video for stream Front camera.' })
  )
})

const readyStream = (name: string, externalName = externalId): ReturnType<typeof useVideoStore> => {
  const store = useVideoStore()
  activeStore = store
  store.streamsCorrespondency = [{ name, externalId: externalName }]
  store.activeStreams[externalName] = {
    stream: undefined,
    mediaStream: markRaw({
      active: true,
      getVideoTracks: () => [{ muted: false, getSettings: () => ({ width: 1920, height: 1080 }) }],
    } as unknown as MediaStream),
    connected: true,
    mediaRecorder: undefined,
    timeRecordingStart: undefined,
  }
  return store
}

test('start and stop alerts use the current configured name without changing the recording key', async () => {
  const store = readyStream('Front camera')
  const start = store.startRecording(externalId)
  vi.advanceTimersByTime(100)
  await start

  expect(pushAlert).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: AlertLevel.Success, message: 'Started recording stream Front camera.' })
  )
  const recorder = store.activeStreams[externalId]!.mediaRecorder!
  expect(recorder.state).toBe('recording')
  expect(store.activeStreams['Front camera']).toBeUndefined()

  store.streamsCorrespondency[0].name = 'Renamed camera'
  store.stopRecording(externalId)

  expect(recorder.stop).toHaveBeenCalledOnce()
  expect(pushAlert).toHaveBeenLastCalledWith(
    expect.objectContaining({ level: AlertLevel.Success, message: 'Stopped recording stream Renamed camera.' })
  )
})

test('start and stop alerts fall back to the external name when its mapping is unavailable', async () => {
  const store = readyStream('Front camera')
  store.streamsCorrespondency = []
  const start = store.startRecording(externalId)
  vi.advanceTimersByTime(100)
  await start

  expect(pushAlert).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: `Started recording stream ${externalId}.` })
  )

  store.stopRecording(externalId)

  expect(pushAlert).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: `Stopped recording stream ${externalId}.` })
  )
})

test('stopping an inactive recorder does not report a successful stop', () => {
  const store = readyStream('Front camera')
  const recorder = markRaw(new MediaRecorder(store.activeStreams[externalId]!.mediaStream!))
  store.activeStreams[externalId]!.mediaRecorder = recorder

  store.stopRecording(externalId)

  expect(recorder.stop).not.toHaveBeenCalled()
  expect(pushAlert).not.toHaveBeenCalled()
})

test('record-all summaries use configured names for every stream', async () => {
  const store = readyStream('Front camera')
  const secondId = 'camera-2'
  store.streamsCorrespondency.push({ name: 'Rear camera', externalId: secondId })
  store.activeStreams[secondId] = { ...store.activeStreams[externalId]! }
  await nextTick()

  const summary = new Promise<Alert>((resolve) => {
    pushAlert.mockImplementation((alert: Alert) => {
      if (alert.message.startsWith('Started recording all')) resolve(alert)
    })
  })
  cockpitActionsManager.actionsCallbacks.start_recording_all_streams.callback()
  vi.advanceTimersByTime(100)

  expect((await summary).message).toBe('Started recording all 2 streams: Front camera, Rear camera.')
  await cockpitActionsManager.actionsCallbacks.stop_recording_all_streams.callback()
  expect(pushAlert).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: 'Stopped recording all 2 streams: Front camera, Rear camera.' })
  )
})
