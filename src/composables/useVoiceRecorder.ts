import { computed, ComputedRef, shallowRef } from 'vue'

import { AudioRecordingHandle, isAudioRecordingSupported, startAudioRecording } from '@/libs/audio-recording'
import { messageFromError } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'

import { useInteractionDialog } from './interactionDialog'
import { openSnackbar } from './snackbar'

// Module-level so every voice recorder widget shows the same recording.
const activeRecording = shallowRef<AudioRecordingHandle | null>(null)
// Set while the microphone permission prompt is open, so a second click does not start another recording.
let isStarting = false

/**
 * Shared control of the local microphone recording.
 * @returns {object} Whether a recording is ongoing, when it started, and a function that starts or stops it.
 */
export const useVoiceRecorder = (): {
  /**
   * Whether a recording is ongoing
   */
  isRecording: ComputedRef<boolean>
  /**
   * When the ongoing recording started
   */
  recordingStart: ComputedRef<Date | undefined>
  /**
   * Starts a recording, or stops the ongoing one
   */
  toggleRecording: () => Promise<void>
} => {
  const { showDialog } = useInteractionDialog()

  const startRecording = async (): Promise<void> => {
    if (!isAudioRecordingSupported()) {
      const message = 'Microphone access needs the Standalone app, or Cockpit opened over HTTPS or localhost.'
      showDialog({ title: 'Cannot start voice recording', message, variant: 'error' })
      return
    }

    let recording: AudioRecordingHandle
    isStarting = true
    try {
      recording = await startAudioRecording(useMissionStore().missionName)
    } catch (error) {
      const reason = messageFromError(error)
      const message = `Could not access the microphone. Check that one is connected and Cockpit may use it. (${reason})`
      showDialog({ title: 'Cannot start voice recording', message, variant: 'error' })
      return
    } finally {
      isStarting = false
    }
    activeRecording.value = recording

    // Electron cancels the close silently on preventDefault, so the dialog is what tells the user why.
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      const message = 'A voice recording is ongoing. Stop it before closing Cockpit, or it will be lost.'
      showDialog({ message, variant: 'warning' })
    }
    window.addEventListener('beforeunload', warnBeforeUnload)

    try {
      await recording.finished
      openSnackbar({ message: `Saved voice recording "${recording.fileName}".`, variant: 'success', duration: 3000 })
    } catch (error) {
      showDialog({ title: 'Voice recording not saved', message: messageFromError(error), variant: 'error' })
    } finally {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      activeRecording.value = null
    }
  }

  const toggleRecording = async (): Promise<void> => {
    if (activeRecording.value) {
      logUserAction('Stopped voice recording')
      activeRecording.value.stop()
      return
    }
    if (isStarting) return
    logUserAction('Started voice recording')
    await startRecording()
  }

  return {
    isRecording: computed(() => activeRecording.value !== null),
    recordingStart: computed(() => activeRecording.value?.dateStart),
    toggleRecording,
  }
}
