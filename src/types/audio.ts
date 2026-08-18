/**
 * Common information shared by every audio recording entry, both ongoing and finalized.
 */
export interface CommonAudioInfo {
  /**
   * The name of the audio file (including extension)
   */
  fileName: string
  /**
   * Recording hash that uniquely identifies the recording
   */
  hash: string
  /**
   * The date the recording started
   */
  dateStart?: Date
  /**
   * The date the recording finished. Undefined while the recording is ongoing.
   */
  dateFinish?: Date
}

/**
 * Audio recording metadata persisted alongside the audio blob (sidecar JSON).
 * @example
 * {
 *   fileName: 'Cockpit (Apr 24, 2026 - 14꞉30꞉15 GMT-3) #abc12345.webm',
 *   hash: 'abc12345',
 *   dateStart: '2026-04-24T17:30:15.000Z',
 *   dateFinish: '2026-04-24T17:34:42.000Z',
 *   durationMs: 267000,
 *   mimeType: 'audio/webm;codecs=opus',
 *   missionName: 'Cockpit',
 *   cockpitVersion: '1.2.3',
 * }
 */
export interface AudioRecordingMetadata extends CommonAudioInfo {
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
 * Library entry for an audio recording, including any metadata loaded from the sidecar JSON.
 */
export interface AudioLibraryFile extends CommonAudioInfo {
  /**
   * Duration of the recording in milliseconds, when known.
   */
  durationMs?: number
  /**
   * Container/codec of the recording, when known.
   */
  mimeType?: string
}

/**
 * Audio extension container types supported by the recorder.
 */
export enum AudioExtensionContainer {
  WEBM = 'webm',
  OGG = 'ogg',
  MP4 = 'mp4',
}
