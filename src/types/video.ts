import { WebRTCManager } from '@/composables/webRTC'
import type { Stream } from '@/libs/webrtc/signalling_protocol'

/**
 * Everything needed for every stream
 */
export interface StreamData {
  /**
   * The actual WebRTC stream
   */
  stream: Stream | undefined
  /**
   * The responsible for its management
   */
  webRtcManager: WebRTCManager
  /**
   * MediaStream object, if WebRTC stream is chosen
   */
  mediaStream: MediaStream | undefined
  /**
   * Connection state of the stream
   * Used to identify when to use the stream or not
   */
  connected: boolean
  /**
   * MediaRecorder object for that stream
   */
  mediaRecorder: MediaRecorder | undefined
  /**
   * Date object with info on when a recording was started, if so
   */
  timeRecordingStart: Date | undefined
}

export type UnprocessedVideoInfo = {
  /**
   * The date the recording started
   */
  dateStart: Date
  /**
   * The last date in which the recording was updated.
   * This is updated as the recording goes on. If there's no update for a long time, it's an indication that the recording finished or failed.
   */
  dateLastRecordingUpdate: Date
  /**
   * This date is explicitly set when the recording finishes.
   * This is undefined while the recording is ongoing.
   * If there's no update on the 'dateLastRecordingUpdate' for a long time, and this is undefined, it's an indication that the recording failed.
   */
  dateFinish: Date | undefined
  /**
   * The last date in which the processing was updated.
   * This is updated as the processing goes on. If there's no update for a long time and the processing didn't finish, it's an indication that the processing failed.
   * This is undefined when the processing didn't start yet.
   */
  dateLastProcessignUpdate: Date | undefined
  /**
   * The name of the file
   */
  fileName: string
  /**
   *  The width of the video
   */
  vWidth: number
  /**
   *  The height of the video
   */
  vHeight: number
}
