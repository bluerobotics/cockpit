import init, { ParserEmitter } from 'mavlink2rest-wasm'
// @ts-ignore
import wasmUrl from 'mavlink2rest-wasm/mavlink2rest_wasm_bg.wasm?url'

/**
 * Converts between raw MAVLink bytes and the mavlink2rest JSON used by the rest of Cockpit
 */
export class RawMavlinkCodec {
  private _textEncoder = new TextEncoder()
  private _textDecoder = new TextDecoder()
  private _mavlink2rest: ParserEmitter | undefined

  /**
   * Load the parser, must finish before decode or encode do anything
   */
  async initialize(): Promise<void> {
    await init(wasmUrl)
    this._mavlink2rest = new ParserEmitter()
  }

  /**
   * Parse raw MAVLink bytes, calling onMessage with each complete message as JSON
   * @param {Uint8Array} data - Raw bytes, may hold partial messages
   * @param {(message: Uint8Array) => void} onMessage - Receives the encoded JSON of each message
   */
  decode(data: Uint8Array, onMessage: (message: Uint8Array) => void): void {
    this._mavlink2rest?.parser(data)
    this._mavlink2rest?.emit((mavlink_json: string) => onMessage(this._textEncoder.encode(mavlink_json)))
  }

  /**
   * Serialize a mavlink2rest JSON message into raw MAVLink bytes
   * @param {Uint8Array} data - Encoded JSON message
   * @returns {Uint8Array | undefined} Raw bytes, undefined before initialize finishes
   * @throws {Error} When the message does not match the dialect
   */
  encode(data: Uint8Array): Uint8Array | undefined {
    if (this._mavlink2rest === undefined) return undefined
    const json = this._textDecoder.decode(data)
    const message: unknown = this._mavlink2rest.rest2mavlink(json)
    // rest2mavlink returns a string instead of throwing when the JSON does not match the dialect
    if (!(message instanceof Uint8Array)) {
      throw new Error(`could not encode ${json}`)
    }
    return message
  }
}
