import { computed, ref, shallowRef, watch } from 'vue'

import { NativePiperEngine } from '@/libs/tts/nativePiperEngine'
import { type TtsEngine, type TtsVoice, clampVolume } from '@/libs/tts/types'
import { WebSpeechEngine } from '@/libs/tts/webSpeechEngine'
import { isElectron } from '@/libs/utils'
import {
  type PiperVoiceStatus,
  type TtsDownloadProgress,
  type TtsDownloadResult,
  defaultPiperVoiceKey,
  parsePiperVoiceKey,
  piperVoiceOptionValue,
  piperVoices,
} from '@/types/tts'

import { useBlueOsStorage } from './settingsSyncer'
import { openSnackbar } from './snackbar'

const webSpeechEngine = new WebSpeechEngine()
const nativePiperEngine = new NativePiperEngine()

// Module-level state so the store and the settings view share one selection and one voice list.
// The key is vehicle-synced, so it can name a voice another topside machine has and this one does not.
const storedVoiceId = useBlueOsStorage<string | null>('cockpit-selected-alert-speech-voice', null)
const showOsVoices = useBlueOsStorage('cockpit-show-os-alert-voices', false)
const voices = shallowRef<TtsVoice[]>([])
const hostVoices = shallowRef<TtsVoice[]>([])
const piperAvailable = ref(false)
const piperVoiceStatuses = shallowRef<PiperVoiceStatus[]>([])
const downloadingHdVoices = ref(false)
const hdDownloadProgress = ref<TtsDownloadProgress>({ completed: 0, total: 0, voiceProgress: 0 })

// Serializes playback so alerts never overlap, whichever engine speaks them.
let speakQueue: Promise<void> = Promise.resolve()

// Resolves once the offered voices are known. The availability probe synthesizes a word to prove Piper
// works, so an alert raised in the first second would otherwise be handed to the host default: the wrong
// voice on Windows and macOS, and nothing at all on a Linux desktop with no speech backend.
let voicesReady: Promise<void> = Promise.resolve()

// Bound on that wait, so a probe that never answers delays the first alert rather than muting every one.
const voicesReadyTimeoutMs = 25000

// Chromium reports an empty voice list until `voiceschanged` fires, and a machine with no bundled runtime
// answers the probe in milliseconds with nothing known yet, so the wait ends on the first listing that
// actually found a voice rather than on the first listing at all.
let announceVoicesFound: (() => void) | undefined
const firstVoicesFound = new Promise<void>((resolve) => {
  announceVoicesFound = resolve
})

// The bundled voices are only known once the availability probe answers, and the host list is an
// in-process enumeration that routinely beats it, so a list published before then is provisional: acting
// on it would hand the first alerts to the host default on a machine that ships a bundled voice.
const voiceListSettled = ref(false)

// Long enough for any alert sentence. Past it the utterance is treated as lost,
// since a stuck one would otherwise hold the queue for the rest of the session.
const speechTimeoutMs = 30000

// Rough pace of synthesized speech, used to make a muted alert take about as
// long as a spoken one: the Alerter widget advances its display when the
// previous alert finishes speaking.
// ponytail: a flat per-character guess. Measuring the real rate would mean
// synthesizing the audio we are trying not to synthesize.
const mutedSpeechPacePerCharMs = 70
const maxMutedSpeechMs = 10000

const engineForVoice = (voiceId: string | undefined): TtsEngine =>
  parsePiperVoiceKey(voiceId) ? nativePiperEngine : webSpeechEngine

// The voice this machine actually speaks with: the stored choice while it is offered here, then the
// bundled voice, then the host default. Resolving instead of rewriting keeps the stored choice intact
// for the machines that can play it, and makes the bundled voice win wherever it exists.
const selectedVoiceId = computed<string | undefined>({
  get: () => {
    const ids = voices.value.map((voice) => voice.id)
    const preferences = [
      storedVoiceId.value,
      piperVoiceOptionValue(defaultPiperVoiceKey),
      webSpeechEngine.defaultVoiceId(),
    ]
    return preferences.find((id) => id != null && ids.includes(id)) ?? ids[0]
  },
  set: (value) => {
    storedVoiceId.value = value ?? null
  },
})

// Only the control that can actually produce the missing voice is worth naming: the checkbox lists this
// computer's own voices, which will never bring back a curated one that was never downloaded here.
const wayBackTo = (stored: string): string => {
  if (parsePiperVoiceKey(stored)) {
    return piperAvailable.value ? ' The Alerts settings can download the higher-quality voices.' : ''
  }
  const canListHostVoices = piperAvailable.value && hostVoices.value.length > 0 && !showOsVoices.value
  return canListHostVoices ? " The Alerts settings can list this computer's own voices again." : ''
}

// The stored choice survives untouched when this machine cannot offer it, so an operator who had picked a
// voice hears a different one with nothing to explain it. Said once, naming both voices and the way back.
let reportedVoiceOverride = false
const reportVoiceOverride = (): void => {
  const stored = storedVoiceId.value
  if (reportedVoiceOverride || stored === null || voices.value.length === 0) return
  if (voices.value.some((voice) => voice.id === stored)) return
  reportedVoiceOverride = true
  const speaking = voices.value.find((voice) => voice.id === selectedVoiceId.value)?.label
  const chosen = piperVoices.find((voice) => piperVoiceOptionValue(voice.key) === stored)?.label ?? stored
  const wayBack = wayBackTo(stored)
  openSnackbar({
    message: `Alerts are now read by ${speaking}, because ${chosen} is not offered on this computer.${wayBack}`,
    variant: 'info',
    duration: 8000,
  })
}

// A refresh awaits the main process midway, so a later one can finish first and
// leave the stale list behind. Only the newest is allowed to publish.
let refreshGeneration = 0

/**
 * Rebuild the offered voice list. The host voices are hidden by default whenever
 * the bundled ones are usable, since they vary per machine, are unpredictable in
 * language and quality, and bury the curated voices in a list of dozens.
 * @returns {Promise<void>} Resolves once the offered voices are refreshed.
 */
const refreshVoices = async (): Promise<void> => {
  const generation = ++refreshGeneration
  const statuses = piperAvailable.value ? await nativePiperEngine.voiceStatuses() : []
  if (generation !== refreshGeneration) return

  piperVoiceStatuses.value = statuses
  const bundled = nativePiperEngine.voicesFromStatuses(statuses)
  hostVoices.value = webSpeechEngine.listVoices()
  const hideHostVoices = bundled.length > 0 && !showOsVoices.value
  voices.value = hideHostVoices ? bundled : [...bundled, ...hostVoices.value]
  if (!voiceListSettled.value) return
  if (voices.value.length > 0) {
    announceVoicesFound?.()
    announceVoicesFound = undefined
  }
  reportVoiceOverride()
}

let initialized = false
const init = (): void => {
  if (initialized) return
  initialized = true

  webSpeechEngine.onVoicesChanged(() => void refreshVoices())
  watch(showOsVoices, () => void refreshVoices())

  if (isElectron()) {
    void nativePiperEngine
      .isAvailable()
      .then((available) => {
        piperAvailable.value = available
      })
      .catch((error) => console.error(`Could not check bundled voice availability: ${error}`))
      .then(() => {
        voiceListSettled.value = true
        return refreshVoices()
      })
      .catch((error) => console.error(`Could not list the alert voices: ${error}`))
    window.electronAPI?.onTtsDownloadProgress?.((info) => {
      hdDownloadProgress.value = info
    })
  } else {
    voiceListSettled.value = true
    void refreshVoices()
  }

  const cap = new Promise<void>((resolve) => setTimeout(resolve, voicesReadyTimeoutMs))
  voicesReady = Promise.race([firstVoicesFound, cap])
}

// A broken speech stack fails on every single alert, so it is reported once.
let reportedSpeechFailure = false
const reportSpeechFailure = (error: unknown): void => {
  if (reportedSpeechFailure) return
  reportedSpeechFailure = true
  console.error(`Text-to-speech failed: ${error}`)
  openSnackbar({
    message: 'Voice system not working. Check the alert voice in the Alerts settings.',
    variant: 'error',
    duration: 6000,
  })
}

/**
 * Wait about as long as speaking the text would have taken, without synthesizing
 * anything.
 * @param {string} text - The text that is not being spoken.
 * @returns {Promise<void>} Resolves once the estimated duration elapsed.
 */
const waitAsIfSpoken = (text: string): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.min(text.length * mutedSpeechPacePerCharMs, maxMutedSpeechMs)))

/**
 * Give up on speech that never finishes. A Piper child that never exits, a
 * stalled audio element or a Web Speech utterance whose `onend` never fires
 * would otherwise block every later alert.
 * @param {Promise<void>} speech - The in-flight utterance.
 * @returns {Promise<void>} The utterance, rejected once it overruns.
 */
const withSpeechTimeout = (speech: Promise<void>): Promise<void> =>
  new Promise((resolve, reject) => {
    const overrun = new Error(`Speech did not finish within ${speechTimeoutMs} ms`)
    const timeout = setTimeout(() => reject(overrun), speechTimeoutMs)
    speech.then(resolve, reject).finally(() => clearTimeout(timeout))
  })

/**
 * Speak text once the voice list is known, so the voice is resolved against the real list rather than
 * against the empty one the first alert of a session would otherwise see.
 * @param {string} text - The text to speak.
 * @param {number} volume - Playback volume in (0, 1].
 * @returns {Promise<void>} Resolves when the utterance finishes playing.
 */
const speakWithSelectedVoice = async (text: string, volume: number): Promise<void> => {
  await voicesReady
  const voiceId = selectedVoiceId.value
  await withSpeechTimeout(engineForVoice(voiceId).speak(voiceId ?? '', text, { volume }))
}

/**
 * Speak text with the currently selected voice, serialized behind any speech
 * already in flight.
 * @param {string} text - The text to speak.
 * @param {number} volume - Playback volume in [0, 1]; 0 skips synthesis but keeps the alert's timing.
 * @returns {Promise<void>} Resolves when this utterance finishes playing.
 */
const speak = (text: string, volume: number): Promise<void> => {
  const clampedVolume = clampVolume(volume)
  speakQueue = speakQueue.then(() =>
    clampedVolume === 0 ? waitAsIfSpoken(text) : speakWithSelectedVoice(text, clampedVolume).catch(reportSpeechFailure)
  )
  return speakQueue
}

/**
 * Download the higher-quality model for every curated Piper voice.
 * @returns {Promise<TtsDownloadResult | undefined>} How the download ended, or undefined when it never started.
 */
const downloadHdVoices = async (): Promise<TtsDownloadResult | undefined> => {
  if (!piperAvailable.value || downloadingHdVoices.value) return undefined
  downloadingHdVoices.value = true
  // The counts come from the main process as it works, so they are not guessed here too.
  hdDownloadProgress.value = { completed: 0, total: 0, voiceProgress: 0 }
  try {
    const result = await nativePiperEngine.downloadHdVoices()
    await refreshVoices()
    return result
  } finally {
    downloadingHdVoices.value = false
  }
}

/** Abort the higher-quality download in progress, keeping the voices already fetched. */
const cancelHdVoicesDownload = (): void => {
  nativePiperEngine.cancelHdVoicesDownload()
}

/**
 * Delete every downloaded higher-quality Piper model.
 * @returns {Promise<boolean>} True when the downloaded voices were removed.
 */
const deleteHdVoices = async (): Promise<boolean> => {
  if (!piperAvailable.value) return false
  const ok = await nativePiperEngine.deleteHdVoices()
  // The stored choice is vehicle-synced, so it must not move for a local cleanup. Suppressing the notice
  // is enough: the operator asked for this voice to be gone, so it needs no explaining to them.
  reportedVoiceOverride = true
  await refreshVoices()
  return ok
}

const voiceOptions = computed(() => voices.value.map((voice) => ({ value: voice.id, name: voice.label })))
const hasOsVoices = computed(() => hostVoices.value.length > 0)
const allHdVoicesDownloaded = computed(
  () => piperVoiceStatuses.value.length > 0 && piperVoiceStatuses.value.every((voice) => voice.hd)
)
const hasDownloadedHdVoices = computed(() => piperVoiceStatuses.value.some((voice) => voice.hd))

/** Reactive voice state and actions shared by the alert store and the settings view. */
export interface TextToSpeechApi {
  /** Dropdown options: `{ value, name }` for every offered voice. */
  voiceOptions: typeof voiceOptions
  /** Id of the voice in use here; writing to it persists a new choice. */
  selectedVoiceId: typeof selectedVoiceId
  /** Whether the bundled Piper synthesizer is usable. */
  piperAvailable: typeof piperAvailable
  /** Whether the offered voice list is final, i.e. the availability check has answered. */
  voiceListSettled: typeof voiceListSettled
  /** Whether the host's own voices are listed alongside the bundled ones. */
  showOsVoices: typeof showOsVoices
  /** Whether the host exposes any voice of its own to list. */
  hasOsVoices: typeof hasOsVoices
  /** Whether every curated voice already has its higher-quality model. */
  allHdVoicesDownloaded: typeof allHdVoicesDownloaded
  /** Whether at least one higher-quality model has been downloaded. */
  hasDownloadedHdVoices: typeof hasDownloadedHdVoices
  /** Whether a higher-quality download is in progress. */
  downloadingHdVoices: typeof downloadingHdVoices
  /** Progress of the current higher-quality download. */
  hdDownloadProgress: typeof hdDownloadProgress
  /** Speak text with the selected voice. */
  speak: typeof speak
  /** Download every higher-quality Piper model. */
  downloadHdVoices: typeof downloadHdVoices
  /** Abort the higher-quality download in progress. */
  cancelHdVoicesDownload: typeof cancelHdVoicesDownload
  /** Delete every downloaded higher-quality Piper model. */
  deleteHdVoices: typeof deleteHdVoices
}

/**
 * Shared text-to-speech orchestration for alert voices, backed by a pluggable
 * set of engines (Web Speech everywhere, bundled Piper on the desktop build).
 * @returns {TextToSpeechApi} The reactive voice state and actions consumed by the store and the settings view.
 */
export const useTextToSpeech = (): TextToSpeechApi => {
  init()
  return {
    voiceOptions,
    selectedVoiceId,
    piperAvailable,
    voiceListSettled,
    showOsVoices,
    hasOsVoices,
    allHdVoicesDownloaded,
    hasDownloadedHdVoices,
    downloadingHdVoices,
    hdDownloadProgress,
    speak,
    downloadHdVoices,
    cancelHdVoicesDownload,
    deleteHdVoices,
  }
}
