/**
 * Audio recording metadata persisted alongside the audio blob (sidecar JSON). The recording it describes is
 * the file with the same name and its own extension, so the sidecar does not repeat it.
 */
export interface AudioRecordingMetadata {
  /**
   * Date the recording started (ISO string when serialized to JSON)
   */
  dateStart: Date
  /**
   * Date the recording finished (ISO string when serialized to JSON)
   */
  dateFinish: Date
  /**
   * Duration of the recording in milliseconds
   */
  durationMs: number
  /**
   * Container/codec of the recording, as reported by the MediaRecorder
   */
  mimeType: string
  /**
   * Name of the active mission at the time of the recording
   */
  missionName: string
  /**
   * Cockpit version that produced the recording
   */
  cockpitVersion: string
}

/**
 * Library entry for an audio recording, with what its metadata sidecar tells when available.
 */
export interface AudioLibraryFile {
  /**
   * The name of the audio file (including extension)
   */
  fileName: string
  /**
   * The date the recording started, when known.
   */
  dateStart?: Date
  /**
   * Duration of the recording in milliseconds, when known.
   */
  durationMs?: number
}

/**
 * Audio extension container types supported by the recorder.
 */
export enum AudioExtensionContainer {
  WEBM = 'webm',
  OGG = 'ogg',
  MP4 = 'mp4',
}
