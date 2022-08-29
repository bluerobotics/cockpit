/* c8 ignore start */
/**
 * Vehicle communication protocol
 */
export enum Type {
  MAVLink = 'mavlink',
  MAVLink2Rest = 'mavlink2rest',
  None = 'none',
}
/* c8 ignore stop */

/* c8 ignore start */
/**
 * Abstract class for protocol abstraction
 */
export abstract class Abstract {
  abstract type(): Type

  abstract write(data: Uint8Array): boolean
  abstract onRead(callback: (data: Uint8Array) => void)
}
/* c8 ignore stop */
