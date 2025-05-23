import { type ComputedRef, computed } from 'vue'

import { getVideoStreamsEngine } from '@/libs/video-streams'

type Engine = ReturnType<typeof getVideoStreamsEngine>

/* eslint-disable jsdoc/require-jsdoc */
export type UseVideoStreamsReturn = {
  activeStreams: Engine['activeStreams']
  streamsCorrespondency: Engine['streamsCorrespondency']
  availableIceIps: Engine['availableIceIps']
  allowedIceIps: Engine['allowedIceIps']
  enableAutoIceIpFetch: Engine['enableAutoIceIpFetch']
  allowedIceProtocols: Engine['allowedIceProtocols']
  jitterBufferTarget: Engine['jitterBufferTarget']
  lastRenamedStreamName: Engine['lastRenamedStreamName']
  namesAvailableStreams: ComputedRef<string[]>
  namessAvailableAbstractedStreams: ComputedRef<string[]>
  externalStreamId: (internalName: string) => string | undefined
  activateStream: Engine['activateStream']
  getStreamData: Engine['getStreamData']
  getMediaStream: Engine['getMediaStream']
  isRecording: Engine['isRecording']
  startRecording: Engine['startRecording']
  stopRecording: Engine['stopRecording']
  startRecordingAllStreams: Engine['startRecordingAllStreams']
  stopRecordingAllStreams: Engine['stopRecordingAllStreams']
  renameStreamInternalNameById: Engine['renameStreamInternalNameById']
  extractThumbnailFromVideo: Engine['extractThumbnailFromVideo']
}

export const useVideoStreams = (): UseVideoStreamsReturn => {
  const engine = getVideoStreamsEngine()

  const namesAvailableStreams: ComputedRef<string[]> = computed((): string[] =>
    engine.mainWebRTCManager.availableStreams.value.map((s) => s.name)
  )

  const namessAvailableAbstractedStreams: ComputedRef<string[]> = computed((): string[] =>
    engine.streamsCorrespondency.value.map((s) => s.name)
  )

  const externalStreamId = (internal: string): string | undefined => {
    const corr = engine.streamsCorrespondency.value.find((s) => s.name === internal)
    return corr?.externalId
  }

  return {
    ...engine,
    namesAvailableStreams,
    namessAvailableAbstractedStreams,
    externalStreamId,
  }
}
