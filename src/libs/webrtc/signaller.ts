/* eslint-disable jsdoc/no-undefined-types */
import type { Answer, Message, Negotiation, Stream } from '@/libs/webrtc/signalling_protocol'

type OnOpenCallback = (event: Event) => void
type OnStatusChangeCallback = (status: string) => void
type OnAvailableStreamsCallback = (streams: Array<Stream>) => void
type OnConsumerIdReceivedCallback = (consumer_id: string) => void
type OnSessionIdReceivedCallback = (session_id: string) => void
type OnSessionEndCallback = (session_id: string, reason: string) => void
type OnIceNegotiationCallback = (candidate: RTCIceCandidateInit) => void
type OnMediaNegotiationCallback = (description: RTCSessionDescription) => void

/**
 * An abstraction for the Mavlink Camera Manager WebRTC Signaller.
 * A single signaller instance can be shared by any number of Consumers and/or their Sessions.
 */
export class Signaller {
  private ws: WebSocket
  public onOpen?: OnOpenCallback
  public onStatusChange?: OnStatusChangeCallback
  private url: URL
  public listeners: Map<
    keyof WebSocketEventMap,
    Map<(type: WebSocketEventMap[keyof WebSocketEventMap]) => void, boolean | AddEventListenerOptions | undefined>
  >
  private shouldReconnect: boolean
  /**
   * Creates a new Signaller instance
   * @param {URL} url - URL of the signalling server
   * @param {boolean} shouldReconnect - If it should try to reconnect if the WebSocket connection is lost
   * @param {OnOpenCallback} onOpen - An optional callback for when signalling opens its WebSocket connection
   * @param {OnStatusChangeCallback} onStatusChange - An optional callback for internal status change
   */
  constructor(url: URL, shouldReconnect: boolean, onOpen?: OnOpenCallback, onStatusChange?: OnStatusChangeCallback) {
    this.onOpen = onOpen
    this.onStatusChange = onStatusChange
    this.listeners = new Map()
    this.shouldReconnect = shouldReconnect
    this.url = url

    const status = `Connecting to signalling server on ${url}`
    console.debug('[WebRTC] [Signaller] ' + status)
    this.onStatusChange?.(status)

    try {
      this.ws = this.connect()
    } catch (error) {
      console.error(`Could not establish initial connection. ${error}`)
    }
  }

  /**
   *
   * @param {keyof WebSocketEventMap} type
   * @param {WebSocketEventMap} listener
   * @param {boolean | AddEventListenerOptions} options
   */
  public addEventListener<T extends keyof WebSocketEventMap>(
    type: T,
    listener: (event: WebSocketEventMap[T]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Map())
    }

    this.listeners.get(type)!.set(listener as (type: WebSocketEventMap[keyof WebSocketEventMap]) => void, options)
    this.ws.addEventListener(type, listener, options)
  }

  /**
   *
   * @param {keyof WebSocketEventMap} type
   * @param {WebSocketEventMap} listener
   * @param {boolean | AddEventListenerOptions} options
   */
  public removeEventListener<T extends keyof WebSocketEventMap>(
    type: T,
    listener: (event: WebSocketEventMap[T]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.ws.removeEventListener(type, listener, options)

    if (!this.listeners.has(type)) {
      return
    }

    const selectedListeners = this.listeners.get(type)!
    if (!selectedListeners.has(listener as (type: WebSocketEventMap[keyof WebSocketEventMap]) => void)) {
      console.warn(
        `[WebRTC] [Signaller] Failed removing listener named ${listener.name} of type "${type}". Reason: not found`
      )
      return
    }

    const storedOptions = selectedListeners.get(listener as (type: WebSocketEventMap[keyof WebSocketEventMap]) => void)
    if (options && storedOptions && options !== storedOptions) {
      return
    }
    selectedListeners.delete(listener as (type: WebSocketEventMap[keyof WebSocketEventMap]) => void)
  }

  /**
   *
   * @param {string | undefined} type
   * @param {boolean} removeFromListeners
   */
  public removeAllListeners<T extends keyof WebSocketEventMap>(type: T, removeFromListeners: boolean): void {
    if (!this.listeners.size || !this.listeners.has(type)) {
      // no listener of the given type was registered yet
      return
    }

    for (const [listener, options] of this.listeners.get(type)!) {
      this.ws.removeEventListener(type, listener, options)
    }

    if (removeFromListeners) {
      this.listeners.delete(type)
    }
  }

  /**
   * Requests the signalling server for a new consumer ID
   * @param {OnConsumerIdReceivedCallback} onConsumerIdReceived - A callback for when the requested consumer id is received
   */
  public requestConsumerId(onConsumerIdReceived: OnConsumerIdReceivedCallback): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const signaller = this
    this.addEventListener('message', function consumerIdListener(ev: MessageEvent): void {
      try {
        const message: Message = JSON.parse(ev.data)
        if (message.type !== 'answer') {
          return
        }

        const answer: Answer = message.content
        if (answer.type !== 'peerId') {
          return
        }

        signaller.removeEventListener('message', consumerIdListener)

        const consumerId: string = answer.content.id
        signaller.onStatusChange?.(`Consumer Id arrived: ${consumerId}`)
        onConsumerIdReceived(consumerId)
      } catch (error) {
        const errorMsg = `Failed receiving PeerId Answer Message. Error: ${error}. Data: ${ev.data}`
        console.error('[WebRTC] [Signaller] ' + errorMsg)
        signaller.onStatusChange?.(errorMsg)
      }
    })

    const message: Message = {
      type: 'question',
      content: {
        type: 'peerId',
      },
    }

    try {
      this.ws.send(JSON.stringify(message))
      signaller.onStatusChange?.('Consumer Id requested, waiting answer...')
    } catch (reason) {
      const error = `Failed requesting peer id. Reason: ${reason}`
      console.error('[WebRTC] [Signaller] ' + error)
      signaller.onStatusChange?.(error)
    }
  }

  /**
   * Whether or not its WebSocket is OPEN (aka 'connected')
   * @returns {boolean} true when OPEN (aka 'connected')
   */
  public isConnected(): boolean {
    return this.ws.readyState === this.ws.OPEN
  }

  /**
   * Requests the signalling server for the list of the streams available
   */
  public requestStreams(): void {
    const message: Message = {
      type: 'question',
      content: {
        type: 'availableStreams',
      },
    }

    try {
      if (this.ws.readyState !== this.ws.OPEN) {
        return
      }
      this.ws.send(JSON.stringify(message))
      this.onStatusChange?.('StreamsAvailable requested')
    } catch (error) {
      const errorMsg = `Failed requesting available streams. Reason: ${error}`
      console.error('[WebRTC] [Signaller] ' + errorMsg)
      this.onStatusChange?.(errorMsg)
    }
  }

  /**
   * Requests the signalling server for a new session ID
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {string} producerId - Unique ID of the producer, given by the signalling server
   * @param {OnSessionIdReceivedCallback} onSessionIdReceived - A callback for when the requested session id is received
   */
  public requestSessionId(
    consumerId: string,
    producerId: string,
    onSessionIdReceived: OnSessionIdReceivedCallback
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const signaller = this
    signaller.addEventListener('message', function sessionStartListener(ev: MessageEvent): void {
      try {
        const message: Message = JSON.parse(ev.data)
        if (message.type !== 'answer') {
          return
        }

        const answer: Answer = message.content
        if (answer.type !== 'startSession') {
          return
        }

        const sessionId = answer.content.session_id
        if (sessionId === undefined) {
          return
        }

        // Only remove after getting the right message
        signaller.removeEventListener('message', sessionStartListener)

        signaller.onStatusChange?.(`Session Id arrived: ${sessionId}`)
        onSessionIdReceived(sessionId)
      } catch (error) {
        const errorMsg = `Failed receiving StartSession Answer Message. Error: ${error}. Data: ${ev.data}`
        console.error('[WebRTC] [Signaller] ' + errorMsg)
        signaller.onStatusChange?.(errorMsg)
        return
      }
    })

    const message: Message = {
      type: 'question',
      content: {
        type: 'startSession',
        content: {
          consumer_id: consumerId,
          producer_id: producerId,
        },
      },
    }

    try {
      this.ws.send(JSON.stringify(message))
      signaller.onStatusChange?.('Session Id requested, waiting answer...')
    } catch (reason) {
      const error = `Failed requesting Session Id. Reason: ${reason}`
      console.error('[WebRTC] [Signaller] ' + error)
      signaller.onStatusChange?.(error)
    }
  }

  /**
   * Sends an ICE candidate to the signalling server
   * @param {string} sessionId - Unique ID of the session, given by the signalling server
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {string} producerId - Unique ID of the producer, given by the signalling server
   * @param {RTCIceCandidate} ice - The ICE candidate to be sent to the signalling server, given by the consumer/client side
   */
  public sendIceNegotiation(sessionId: string, consumerId: string, producerId: string, ice: RTCIceCandidate): void {
    const message: Message = {
      type: 'negotiation',
      content: {
        type: 'iceNegotiation',
        content: {
          session_id: sessionId,
          consumer_id: consumerId,
          producer_id: producerId,
          ice: ice.toJSON(),
        },
      },
    }

    console.debug(`[WebRTC] [Signaller] Sending ICE answer: ${JSON.stringify(message, null, 4)}`)

    try {
      this.ws.send(JSON.stringify(message))
      this.onStatusChange?.('ICE Candidate sent')
    } catch (error) {
      const errorMsg = `Failed sending ICE Candidate. Reason: ${error}`
      console.error('[WebRTC] [Signaller] ' + errorMsg)
      this.onStatusChange?.(errorMsg)
    }
  }

  /**
   * Sends an SDP to the signalling server
   * @param {string} sessionId - Unique ID of the session, given by the signalling server
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {string} producerId - Unique ID of the producer, given by the signalling server
   * @param {RTCSessionDescription} sdp - The SDP to be sent to the signalling server, given by the consumer/client side
   */
  public sendMediaNegotiation(
    sessionId: string,
    consumerId: string,
    producerId: string,
    sdp: RTCSessionDescription
  ): void {
    const message: Message = {
      type: 'negotiation',
      content: {
        type: 'mediaNegotiation',
        content: {
          session_id: sessionId,
          consumer_id: consumerId,
          producer_id: producerId,
          sdp: sdp.toJSON(),
        },
      },
    }

    try {
      this.ws.send(JSON.stringify(message))
      this.onStatusChange?.('ICE Candidate sent')
    } catch (error) {
      const errorMsg = `Failed sending SDP. Reason: ${error}`
      console.error('[WebRTC] [Signaller] ' + errorMsg)
      this.onStatusChange?.(errorMsg)
    }
  }

  /**
   * Parses a "endSession" Question received by the signalling server
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {string} producerId - Unique ID of the producer, given by the signalling server
   * @param {string} sessionId - Unique ID of the session, given by the signalling server
   * @param {OnSessionEndCallback} onSessionEnd - A callback for when an "endSession" message is received
   */
  public parseEndSessionQuestion(
    consumerId: string,
    producerId: string,
    sessionId: string,
    onSessionEnd: OnSessionEndCallback
  ): void {
    console.debug(
      '[WebRTC] [Signaller] Registering parseEndSessionQuestion callbacks for ' +
        `Consumer "${consumerId}", ` +
        `Producer "${producerId}", ` +
        `Session "${sessionId}", `
    )
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const signaller = this
    this.addEventListener('message', function endSessionListener(ev: MessageEvent): void {
      try {
        const message: Message = JSON.parse(ev.data)
        if (message.type !== 'question') {
          return
        }

        const question = message.content
        if (question.type !== 'endSession') {
          return
        }

        const endSessionQuestion = question.content
        if (
          endSessionQuestion.consumer_id !== consumerId ||
          endSessionQuestion.producer_id !== producerId ||
          endSessionQuestion.session_id !== sessionId
        ) {
          return
        }

        signaller.removeEventListener('message', endSessionListener)

        const reason = endSessionQuestion.reason
        signaller.onStatusChange?.('EndSession arrived')
        onSessionEnd?.(sessionId, reason)
      } catch (error) {
        const errorMsg = `Failed parsing received Message. Error: ${error}. Data: ${ev.data}`
        console.error('[WebRTC] [Signaller] ' + errorMsg)
        signaller.onStatusChange?.(errorMsg)
        return
      }
    })
  }

  /**
   * Parses Negotiation messages received from the signalling server
   * @param {string} consumerId - Unique ID of the consumer, given by the signalling server
   * @param {string} producerId - Unique ID of the producer, given by the signalling server
   * @param {string} sessionId - Unique ID of the session, given by the signalling server
   * @param {OnIceNegotiationCallback} onIceNegotiation - An optional callback for when a "iceNegotiation" Negotiation is received
   * @param {OnMediaNegotiationCallback} onMediaNegotiation - An optional callback for when a "mediaNegotiation" Negotiation is received
   */
  public parseNegotiation(
    consumerId: string,
    producerId: string,
    sessionId: string,
    onIceNegotiation?: OnIceNegotiationCallback,
    onMediaNegotiation?: OnMediaNegotiationCallback
  ): void {
    console.debug(
      '[WebRTC] [Signaller] Registering parseNegotiation callbacks for ' +
        `Consumer "${consumerId}", ` +
        `Producer "${producerId}", ` +
        `Session "${sessionId}", `
    )
    this.addEventListener('message', (ev: MessageEvent): void => {
      try {
        const message: Message = JSON.parse(ev.data)

        if (message.type !== 'negotiation') {
          return
        }

        const negotiation: Negotiation = message.content

        if (
          negotiation.content.consumer_id !== consumerId ||
          negotiation.content.producer_id !== producerId ||
          negotiation.content.session_id !== sessionId
        ) {
          return
        }

        switch (negotiation.type) {
          case 'iceNegotiation':
            this.onStatusChange?.('iceNegotiation arrived')
            onIceNegotiation?.(negotiation.content.ice)
            break

          case 'mediaNegotiation':
            this.onStatusChange?.('mediaNegotiation arrived')
            onMediaNegotiation?.(negotiation.content.sdp)
            break
        }
      } catch (error) {
        const errorMsg = `Failed parsing received Message. Error: ${error}. Data: ${ev.data}`
        console.error('[WebRTC] [Signaller] ' + errorMsg)
        this.onStatusChange?.(errorMsg)
        return
      }
    })
  }

  /**
   * Parses "availableStreams" Answer received from the signalling server
   * @param {OnAvailableStreamsCallback} onAvailableStreams - A callback for when an "availableStreams" Answer is received
   */
  public parseAvailableStreamsAnswer(onAvailableStreams: OnAvailableStreamsCallback): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const signaller = this
    this.addEventListener('message', function availableStreamListener(ev: MessageEvent): void {
      try {
        const message: Message = JSON.parse(ev.data)
        if (message.type !== 'answer') {
          return
        }

        const answer: Answer = message.content
        if (answer.type !== 'availableStreams') {
          return
        }

        signaller.removeEventListener('message', availableStreamListener)

        const streams: Array<Stream> = answer.content
        signaller.onStatusChange?.('Available Streams arrived')
        onAvailableStreams?.(streams)
      } catch (error) {
        const errorMsg = `Failed parsing received Message. Error: ${error}. Data: ${ev.data}`
        console.error('[WebRTC] [Signaller] ' + errorMsg)
        signaller.onStatusChange?.(errorMsg)
        return
      }
    })
  }

  /**
   * Ends the Websocket and cleans up the registered callbacks, without reconnecting it
   * @param {string} reason - The id of the caller, just for debugging purposes
   */
  public end(reason: string): void {
    // Unregister basic listeners
    this.ws.removeEventListener('open', this.onOpenCallback.bind(this))
    this.ws.removeEventListener('error', this.onErrorCallback.bind(this))
    this.ws.removeEventListener('close', this.onCloseCallback.bind(this))

    // Unregister all additional listeners
    this.removeAllListeners('open', false)
    this.removeAllListeners('error', false)
    this.removeAllListeners('close', false)
    this.removeAllListeners('message', false)

    if (this.ws.readyState !== this.ws.OPEN) {
      return
    }
    console.debug(`[WebRTC] [Signaller] Closing WebSocket. Reason: ${reason}`)
    this.ws.close()
  }

  /**
   * Connects to the signalling server
   * @returns {WebSocket} - The WebSocket object for signalling connection
   */
  private connect(): WebSocket {
    const ws = new WebSocket(this.url.toString())

    // Register basic listeners
    ws.addEventListener('open', this.onOpenCallback.bind(this))
    ws.addEventListener('error', this.onErrorCallback.bind(this))
    ws.addEventListener('close', this.onCloseCallback.bind(this))

    // re-register all additional listeners
    for (const [type, listenerMap] of this.listeners) {
      for (const [listener, options] of listenerMap) {
        ws.addEventListener(type, listener, options)
      }
    }

    return ws
  }

  /**
   * Reconnects to the signalling server
   */
  private reconnect(): void {
    const status = `Reconnecting to signalling`
    console.debug('[WebRTC] [Signaller] ' + status)
    this.onStatusChange?.(status)

    this.end('reconnect')

    const oldWs = this.ws

    oldWs.onclose = null
    oldWs.onopen = null
    oldWs.onmessage = null
    oldWs.onerror = null

    try {
      this.ws = this.connect()
    } catch (error) {
      console.error(`[WebRTC] [Signaller] Could not reconnect. ${error}`)
    }
  }

  /**
   * The onOpen callback for its WebSocket
   * @param {Event} event - The WebSocket's onOpen event
   */
  private onOpenCallback(event: Event): void {
    const status = `Signaller Connected`
    console.debug('[WebRTC] [Signaller] ' + status, event)
    this.onStatusChange?.(status)

    this.onOpen?.(event)
  }

  /**
   * The onClose callback for its WebSocket
   * @param {CloseEvent} event - The WebSocket's onClose event
   */
  private onCloseCallback(event: CloseEvent): void {
    const status = `Signaller connection closed`
    console.debug('[WebRTC] [Signaller] ' + status, event)
    this.onStatusChange?.(status)

    if (this.shouldReconnect) {
      setTimeout(() => {
        // Avoid multiple reconnections
        if (this.ws.readyState === this.ws.CLOSED || this.ws.readyState === this.ws.CLOSING) {
          this.reconnect()
        }
      }, 1000)
    }
  }

  /**
   * The onError callback for its WebSocket
   * @param {Event} event - The WebSocket's onError event
   */
  private onErrorCallback(event: Event): void {
    const status = `Signaller connection Error`
    console.debug('[WebRTC] [Signaller] ' + status, event)
    this.onStatusChange?.(status)
  }
}
