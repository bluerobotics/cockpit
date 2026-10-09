import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@/composables/settingsSyncer', () => ({ useBlueOsStorage: (_key: string, value: unknown) => ref(value) }))
vi.mock('@/composables/snackbar', () => ({ openSnackbar: vi.fn() }))
vi.mock('@/libs/utils', () => ({ isElectron: () => Boolean(window.electronAPI) }))

let activeUtterance: SpeechSynthesisUtterance | undefined
let spoken: string[]
let playingAudio: Pick<HTMLAudioElement, 'paused' | 'onended' | 'onerror'>[]
const originalAudio = window.Audio
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

const flushSpeech = async (): Promise<void> => {
  await nextTick()
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  setActivePinia(createPinia())
  activeUtterance = undefined
  spoken = []
  playingAudio = []
  vi.stubGlobal('Audio', function () {
    const audio = {
      paused: true,
      onended: null,
      onerror: null,
      play: () => {
        audio.paused = false
        return Promise.resolve()
      },
      pause: () => {
        audio.paused = true
      },
    }
    playingAudio.push(audio)
    return audio
  })
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('SpeechSynthesisUtterance', function (text: string) {
    return { text }
  })
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ name: 'Test voice', lang: 'en-US', default: true }],
    speak: (utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance.text)
      activeUtterance = utterance
    },
    cancel: () => {
      const utterance = activeUtterance
      activeUtterance = undefined
      utterance?.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent)
    },
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance')
  Reflect.deleteProperty(window, 'speechSynthesis')
  Reflect.deleteProperty(window, 'electronAPI')
  window.Audio = originalAudio
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

const enablePiper = (synthesize: (text: string) => Promise<ArrayBuffer>): void => {
  vi.stubGlobal('electronAPI', {
    ttsAvailable: () => Promise.resolve(true),
    ttsListVoices: () => Promise.resolve([{ key: 'amy', label: 'Amy', available: true, hd: false }]),
    ttsSynthesize: synthesize,
  })
}

test('disabling voice stops active speech and keeps old queued alerts silent after re-enabling', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('First')
  await flushSpeech()
  expect(activeUtterance?.text).toBe('First')

  store.pushSuccessAlert('Queued')
  await flushSpeech()
  store.enableVoiceAlerts = false
  expect(activeUtterance).toBeUndefined()

  store.enableVoiceAlerts = true
  store.pushSuccessAlert('Fresh')
  await flushSpeech()
  expect(store.currentAlert.message).toBe('Queued')
  expect(store.isProcessingAlerts).toBe(true)
  vi.advanceTimersByTime(1000)
  await flushSpeech()
  expect(store.currentAlert.message).toBe('Fresh')
  expect(spoken).toEqual(['First', 'Fresh'])
  expect(activeUtterance?.text).toBe('Fresh')
  store.$dispose()
})

test('disabling voice pauses Piper playback and re-enabled alerts can play', async () => {
  enablePiper(() => Promise.resolve(new ArrayBuffer(1)))
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('First')
  await flushSpeech()
  expect(playingAudio[0].paused).toBe(false)

  store.enableVoiceAlerts = false
  expect(playingAudio[0].paused).toBe(true)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  store.enableVoiceAlerts = true
  store.pushSuccessAlert('Fresh')
  await flushSpeech()
  expect(playingAudio).toHaveLength(2)
  expect(playingAudio[1].paused).toBe(false)
  store.$dispose()
})

test('Piper synthesis finishing after voice is disabled cannot start playback or block new speech', async () => {
  let finishSynthesis!: (buffer: ArrayBuffer) => void
  enablePiper((text) =>
    text === 'First' ? new Promise((resolve) => (finishSynthesis = resolve)) : Promise.resolve(new ArrayBuffer(1))
  )
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('First')
  await flushSpeech()
  expect(finishSynthesis).toBeDefined()

  store.enableVoiceAlerts = false
  store.enableVoiceAlerts = true
  store.pushSuccessAlert('Fresh')
  await flushSpeech()
  expect(playingAudio).toHaveLength(1)
  finishSynthesis(new ArrayBuffer(1))
  await flushSpeech()
  expect(playingAudio).toHaveLength(1)
  expect(playingAudio[0].paused).toBe(false)
  store.$dispose()
})

test('a finished Web Speech request cannot cancel a later request through its old signal', async () => {
  const { WebSpeechEngine } = await import('@/libs/tts/webSpeechEngine')
  const engine = new WebSpeechEngine()
  const controller = new AbortController()
  const first = engine.speak('Test voice', 'First', { volume: 1, signal: controller.signal })
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await first

  const second = engine.speak('Test voice', 'Second', { volume: 1 })
  controller.abort()
  expect(activeUtterance?.text).toBe('Second')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await second
})

test('muted alerts still advance the displayed alert without starting speech', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.enableVoiceAlerts = false
  store.pushSuccessAlert('Muted')
  await flushSpeech()
  expect(store.currentAlert.message).toBe('Muted')
  expect(store.isProcessingAlerts).toBe(true)
  vi.advanceTimersByTime(350)
  await flushSpeech()
  expect(store.isProcessingAlerts).toBe(false)
  expect(spoken).toEqual([])
  store.$dispose()
})

test('pending alerts follow severity without interrupting speech or reordering history', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const { AlertLevel } = await import('@/types/alert')
  const store = useAlertStore()
  store.enabledAlertLevels.find((level) => level.level === AlertLevel.Info)!.enabled = true
  store.pushSuccessAlert('Active')
  await flushSpeech()

  store.pushSuccessAlert('Success')
  await flushSpeech()
  store.pushInfoAlert('Info', new Date(0))
  await flushSpeech()
  store.pushWarningAlert('Warning first')
  await flushSpeech()
  store.pushWarningAlert('Warning second')
  await flushSpeech()
  store.pushErrorAlert('Error')
  await flushSpeech()
  store.pushCriticalAlert('Critical')
  await flushSpeech()
  expect(spoken).toEqual(['Active'])

  for (const message of ['Critical', 'Error', 'Warning first', 'Warning second', 'Success', 'Info']) {
    activeUtterance?.onend?.({} as SpeechSynthesisEvent)
    await flushSpeech()
    expect(activeUtterance?.text).toBe(message)
    expect(store.currentAlert.message).toBe(message)
  }
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(store.isProcessingAlerts).toBe(false)
  expect(store.sortedAlerts[0].message).toBe('Info')
  expect(store.alerts.map((alert) => alert.message)).toEqual([
    'Cockpit started',
    'Active',
    'Success',
    'Info',
    'Warning first',
    'Warning second',
    'Error',
    'Critical',
  ])
  await flushSpeech()
  expect(spoken).toEqual(['Active', 'Critical', 'Error', 'Warning first', 'Warning second', 'Success', 'Info'])
  store.$dispose()
})

test('same-tick alerts all play once with the highest severity first', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('Success')
  store.pushCriticalAlert('Critical')
  store.pushWarningAlert('Warning')
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Critical')

  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Warning')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Success')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(spoken).toEqual(['Critical', 'Warning', 'Success'])
  expect(store.isProcessingAlerts).toBe(false)
  store.$dispose()
})

test('disabling voice keeps prioritized pending alerts silent after re-enabling', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('Active')
  await flushSpeech()
  store.pushSuccessAlert('Queued')
  store.pushCriticalAlert('Critical')
  await flushSpeech()

  store.enableVoiceAlerts = false
  store.enableVoiceAlerts = true
  store.pushSuccessAlert('Fresh')
  await flushSpeech()
  expect(store.currentAlert.message).toBe('Critical')
  vi.advanceTimersByTime(560)
  await flushSpeech()
  expect(store.currentAlert.message).toBe('Queued')
  vi.advanceTimersByTime(420)
  await flushSpeech()
  expect(spoken).toEqual(['Active', 'Fresh'])
  expect(store.currentAlert.message).toBe('Fresh')
  store.$dispose()
})

test('alerts waiting behind voice previews remain pending for priority selection', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const { useTextToSpeech } = await import('@/composables/useTextToSpeech')
  const store = useAlertStore()
  const { speak } = useTextToSpeech()
  void speak('First preview', 1)
  await flushSpeech()
  store.pushSuccessAlert('Success')
  await flushSpeech()
  void speak('Second preview', 1)
  store.pushCriticalAlert('Critical')
  await flushSpeech()

  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Second preview')
  expect(store.currentAlert.message).toBe('Cockpit started')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Critical')
  expect(store.currentAlert.message).toBe('Critical')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Success')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(spoken).toEqual(['First preview', 'Second preview', 'Critical', 'Success'])
  store.$dispose()
})

test('a newer connection state replaces the older pending announcement, not its history', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const { Alert, AlertLevel } = await import('@/types/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('Active')
  await flushSpeech()
  store.pushAlert(new Alert(AlertLevel.Success, 'Vehicle connected'), 'vehicle-connection')
  await flushSpeech()
  store.pushAlert(new Alert(AlertLevel.Error, 'Vehicle disconnected'), 'vehicle-connection')
  await flushSpeech()
  expect(spoken).toEqual(['Active'])

  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(activeUtterance?.text).toBe('Vehicle disconnected')
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(spoken).toEqual(['Active', 'Vehicle disconnected'])
  expect(store.isProcessingAlerts).toBe(false)
  expect(store.currentAlert.message).toBe('Vehicle disconnected')
  expect(store.alerts.map((alert) => alert.message)).toEqual([
    'Cockpit started',
    'Active',
    'Vehicle connected',
    'Vehicle disconnected',
  ])
  store.$dispose()
})

test('an old queued alert gets a fresh display interval when playback finishes', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const store = useAlertStore()
  store.pushSuccessAlert('Old alert', new Date(0))
  await flushSpeech()
  vi.advanceTimersByTime(12000)
  activeUtterance?.onend?.({} as SpeechSynthesisEvent)
  await flushSpeech()
  expect(store.isProcessingAlerts).toBe(false)
  expect(store.currentAlert.time_created).toEqual(new Date(0))
  expect(store.lastAlertPlaybackFinishedAt).toEqual(new Date())
  store.$dispose()
})

test('sorting alert history does not reorder its arrival sequence', async () => {
  const { useAlertStore } = await import('@/stores/alert')
  const { Alert, AlertLevel } = await import('@/types/alert')
  const store = useAlertStore()
  const initialAlert = store.alerts[0]
  store.alerts.push(new Alert(AlertLevel.Success, 'Older event', new Date(0)))
  expect(store.sortedAlerts.map((alert) => alert.message)).toEqual(['Older event', 'Cockpit started'])
  expect(store.alerts[0]).toBe(initialAlert)
  store.$dispose()
})
