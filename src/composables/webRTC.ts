import { type Ref, ref, watch } from 'vue'

import { webRtcSignallingServerUrl } from '@/assets/defaults'
import * as Words from '@/libs/funny-name/words'
import type { RtcPeer, SignallingMessage } from '@/types/webrtc'

/**
 *
 * @returns { void }
 * @param { Ref<RtcPeer | undefined> } selectedPeer - Peer to receive stream from
 */
export default function useWebRtcStream(
  selectedPeer: Ref<RtcPeer | undefined>
): {
  /**
   * Available WebRTC peers to be chosen from
   */
  availablePeers: Ref<RtcPeer[]>
  /**
   * MediaStream object, if WebRTC peer is chosen
   */
  stream: Ref<MediaStream | undefined>
} {
  const sessionId = ref()
  const availablePeers = ref([] as RtcPeer[])
  const stream = ref<MediaStream | undefined>()
  const rtc_configuration = { iceServers: [] }
  const sessionWebSocket = ref<WebSocket | undefined>()

  const addAvailablePeer = (peerId: string, displayName: string): void => {
    removeAvailablePeer(peerId)
    availablePeers.value.push({ id: peerId, displayName })
  }

  const removeAvailablePeer = (peerId: string): void => {
    const peerToRemove = availablePeers.value.find((peer) => peer.id === peerId)
    if (peerToRemove) {
      const index = availablePeers.value.indexOf(peerToRemove)
      availablePeers.value.splice(index, 1)
    }
  }

  const startSocket = (): void => {
    console.debug('Trying to connect to signalling server.')
    sessionWebSocket.value = new WebSocket(webRtcSignallingServerUrl)
    sessionWebSocket.value.addEventListener('open', onSocketOpen)
    sessionWebSocket.value.addEventListener('error', onSocketError)
    sessionWebSocket.value.addEventListener('message', onSocketMessage)
    sessionWebSocket.value.addEventListener('close', onSocketClose)
  }

  const clearAvailablePeers = (): void => {
    console.debug(`Cleaning available peers for session '${sessionId.value}'.`)
    availablePeers.value = []
  }

  const stopSocket = (): void => {
    console.debug(`Stopping socket '${sessionId.value}'.`)
    if (sessionWebSocket.value === undefined) {
      console.warn(`Socket for session '${sessionId.value}' already undefined.`)
      return
    }
    sessionWebSocket.value.removeEventListener('open', onSocketOpen)
    sessionWebSocket.value.removeEventListener('error', onSocketError)
    sessionWebSocket.value.removeEventListener('message', onSocketMessage)
    sessionWebSocket.value.removeEventListener('close', onSocketClose)
    sessionWebSocket.value = undefined
  }

  const resetSocket = (): void => {
    console.debug(`Reseting socket '${sessionId.value}'.`)
    stopSocket()
    clearAvailablePeers()
    window.setTimeout(startSocket, 1000)
  }

  const onSocketClose = (event: Event): void => {
    console.debug('WebRTC socket closed.', event)
    resetSocket()
  }

  const onSocketError = (event: Event): void => {
    console.debug('WebRTC socket error.', event)
    resetSocket()
  }

  const onSocketOpen = (event: Event): void => {
    console.debug('WebRTC socket open.', event)
    if (sessionWebSocket.value === undefined) {
      resetSocket()
      return
    }
    sendSocketSignal({
      type: 'register',
      peerType: 'listener',
    })
  }

  const sendSocketSignal = (signal: SignallingMessage): void => {
    console.debug(`Sending signal on session '${sessionId.value}'.`, signal)
    if (sessionWebSocket.value === undefined) {
      resetSocket()
      return
    }
    sessionWebSocket.value.send(JSON.stringify(signal))
  }

  const onSocketMessage = async (event: MessageEvent): Promise<void> => {
    console.debug(
      'Message received from WebRTC signalling server.',
      JSON.parse(event.data)
    )
    if (sessionWebSocket.value === undefined) {
      resetSocket()
      return
    }
    try {
      const msg: SignallingMessage = JSON.parse(event.data)
      if (msg.type == 'registered') {
        sessionId.value = msg.peerId
        console.debug(
          `Cockpit registered as '${msg.peerType}' with id '${msg.peerId}'.`
        )
        sendSocketSignal({
          type: 'list',
        })
      } else if (msg.type == 'list' && msg.producers) {
        availablePeers.value = msg.producers
        console.debug('Updated available peers list: ', availablePeers.value)
      } else if (msg.type == 'producerAdded') {
        addAvailablePeer(
          // @ts-ignore: peerId is always available on `producerAdded` messages
          msg.peerId,
          msg.displayName || `Device ${Words.animalsOcean.random()}`
        )
      } else if (msg.type == 'producerRemoved') {
        // @ts-ignore: peerId is always available on `producerRemoved` messages
        removeAvailablePeer(msg.peerId)
      } else if (msg.type == 'peer') {
        console.debug('Peer message received.')
        const peer = availablePeers.value.find((p) => p.id === msg.peerId)
        if (peer === undefined) {
          console.error(`No peer found with id ${msg.peerId}.`)
          return
        }
        if (peer.connection === undefined) {
          createConnection(peer)
        }
        if (msg.sdp != null) {
          await setDescriptions(peer, msg.sdp)
        }
        if (msg.ice != null) {
          addIceCandidate(peer, msg.ice)
        }
      } else {
        console.error('Unsupported message: ', msg)
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.error('Error parsing incoming JSON: ', event.data)
      } else {
        console.error('Unknown error parsing response: ', event.data)
      }
    }
  }

  const createConnection = (peer: RtcPeer): void => {
    console.debug('Creating peer connection.')
    peer.connection = new RTCPeerConnection(rtc_configuration)
    peer.connection.addEventListener('track', (event: RTCTrackEvent) => {
      console.debug(`New stream on peer ${peer.id}.`)
      stream.value = event.streams[0]
    })
    peer.connection.addEventListener(
      'icecandidate',
      (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) {
          console.error('Cannot listen to ICE candidate event. Candidate null.')
          return
        }
        console.debug('Sending ICE candidate to signalling server.')
        sendSocketSignal({
          type: 'peer',
          peerId: peer.id,
          ice: event.candidate.toJSON(),
        })
      }
    )
  }

  const setDescriptions = async (
    peer: RtcPeer,
    // eslint-disable-next-line no-undef
    sdp: RTCSessionDescriptionInit
  ): Promise<void> => {
    console.debug('Setting RTC descriptions.')
    if (peer.connection === undefined) {
      console.error('Cannot set RTC descriptions. No RTC connection defined.')
      return
    }
    console.debug('Setting remote description.')
    await peer.connection.setRemoteDescription(sdp)
    console.debug('Creating answer to RTC connection.')
    const description = await peer.connection.createAnswer()
    console.debug('Setting local description.')
    await peer.connection.setLocalDescription(description)
    console.debug('Sending SDP to signalling server.')
    sendSocketSignal({
      type: 'peer',
      peerId: peer.id,
      // @ts-ignore: as `setLocalDescription` didn't raise, we know it exists
      sdp: peer.connection.localDescription.toJSON(),
    })
  }

  // eslint-disable-next-line no-undef
  const addIceCandidate = (peer: RtcPeer, ice: RTCIceCandidateInit): void => {
    console.debug('Adding ICE candidate.')
    if (peer.connection === undefined) {
      console.error('Cannot add ICE candidate. No RTC connection defined.')
      return
    }
    peer.connection.addIceCandidate(new RTCIceCandidate(ice))
  }

  watch(selectedPeer, (newPeer, oldPeer) => {
    console.debug(`Selected peer changed from ${oldPeer} to ${newPeer}.`)
    if (oldPeer !== undefined) {
      stopPeerConsuming(oldPeer.id)
    }
    if (newPeer !== undefined) {
      startPeerConsuming(newPeer.id)
    }
  })

  const startPeerConsuming = (peerId: string): void => {
    console.debug('Registering as consumer on signalling server.')
    sendSocketSignal({
      type: 'register',
      peerType: 'consumer',
    })
    console.debug(`Starting session with new peer "${peerId}".`)
    sendSocketSignal({
      type: 'startSession',
      peerId: peerId,
    })
  }

  const stopPeerConsuming = (peerId: string): void => {
    console.debug(`Ending session with old peer "${peerId}".`)
    sendSocketSignal({
      type: 'endSession',
      peerId: peerId,
    })
  }

  startSocket()

  return { availablePeers, stream }
}
