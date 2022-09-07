/* Code based over:
 * https://raw.githubusercontent.com/rgr-myrg/signal-ts/7e10237c565e14b680029834c970ea49b0ed60dd/src/test/Signal.spec.ts
 * From: https://github.com/rgr-myrg/signal-ts
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { Signal, SignalTyped } from '@/libs/signal'

describe('Signal Tests', () => {
  // eslint-disable-next-line jsdoc/require-jsdoc,@typescript-eslint/no-empty-function
  class Receiver {
    // eslint-disable-next-line
    onReceive(x: number): void {}
    // eslint-disable-next-line
    onOnce(x: number): void {}
  }

  let signal: Signal<number>
  let receiver: Receiver

  beforeAll(() => {
    signal = new Signal()
    receiver = new Receiver()

    vi.spyOn(signal, 'notify')
    vi.spyOn(receiver, 'onReceive')
    vi.spyOn(receiver, 'onOnce')
  })

  it('add() should register the callback', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    signal.add(() => {})
    expect(signal.slots.length).toBe(1)
  })

  it('once() should register the callback', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    signal.once(() => {})
    expect(signal.onces.length).toBe(1)
  })

  it('remove() should deregister the callback', () => {
    // eslint-disable-next-line
    const fn = () => {}
    signal.add(fn)

    const length: number = signal.slots.length
    signal.remove(fn)

    expect(signal.slots.length).toEqual(length - 1)
  })

  it('emit() should execute the callback', () => {
    signal.add(receiver.onReceive)
    signal.emit_value(5)
    expect(receiver.onReceive).toHaveBeenCalledWith(5)
  })

  it('emit() should execute the callback only once', () => {
    signal.once(receiver.onOnce)
    signal.emit_value(5)
    signal.emit_value(0)
    expect(receiver.onOnce).toHaveBeenCalledWith(5)
    expect(receiver.onOnce).toHaveBeenCalledTimes(1)
    expect(signal.onces.length).toBe(0)
  })

  it("emit() should invoke the Signal's notify method", () => {
    signal.emit_value(5)
    expect(signal.notify).toHaveBeenCalled()
  })

  it('notify() should execute the callback with the payload', () => {
    signal.add(receiver.onReceive)
    signal.notify(signal.slots, 5)
    expect(receiver.onReceive).toHaveBeenCalledWith(5)
  })

  it('register_caller() should register and be used when calling emit', () => {
    signal.slots = []
    signal.onces = []
    signal.add(receiver.onReceive)
    signal.register_caller(() => {
      return 42
    })
    signal.emit()
    expect(receiver.onReceive).toHaveBeenCalledWith(42)
  })
})

describe('SignalTyped Tests', () => {
  // eslint-disable-next-line jsdoc/require-jsdoc,@typescript-eslint/no-empty-function
  class Receiver {
    // eslint-disable-next-line
    onReceive(x: number): void {}
    // eslint-disable-next-line
    onOnce(x: number): void {}
  }

  let signal: SignalTyped
  let receiver: Receiver

  beforeAll(() => {
    signal = new SignalTyped()
    receiver = new Receiver()

    vi.spyOn(signal, 'notify')
    vi.spyOn(receiver, 'onReceive')
    vi.spyOn(receiver, 'onOnce')
  })

  it('add() should register the callback', () => {
    const name = 'add'
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    signal.add(name, () => {})
    expect(signal.slots.has(name)).toBe(true)
    expect(signal.slots.get(name)?.length).toBe(1)
  })

  it('once() should register the callback', () => {
    const name = 'add'
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    signal.once(name, () => {})
    expect(signal.onces.has(name)).toBe(true)
    expect(signal.onces.get(name)?.length).toBe(1)
  })

  it('remove() should deregister the callback', () => {
    signal.slots = new Map()
    signal.onces = new Map()

    const name = 'add'
    // eslint-disable-next-line
    const fn = () => {}
    signal.add(name, fn)

    expect(signal.slots.get(name)?.length).toBe(1)
    signal.remove(name, fn)
    expect(signal.slots.get(name)?.length).toBe(0)
  })

  it('remove() should deregister the once callback', () => {
    signal.slots = new Map()
    signal.onces = new Map()

    const name = 'add'
    // eslint-disable-next-line
    const fn = () => {}
    signal.once(name, fn)

    expect(signal.onces.get(name)?.length).toBe(1)
    signal.remove(name, fn)
    expect(signal.onces.get(name)?.length).toBe(0)
  })

  it('emit() should execute the callback', () => {
    const name = 'add'
    signal.add(name, receiver.onReceive)
    signal.emit_value(name, 5)
    expect(receiver.onReceive).toHaveBeenCalledWith(5)
  })

  it('emit() should execute the callback only once', () => {
    const name = 'add'
    signal.once(name, receiver.onOnce)
    signal.emit_value(name, 5)
    signal.emit_value(name, 0)
    expect(receiver.onOnce).toHaveBeenCalledWith(5)
    expect(receiver.onOnce).toHaveBeenCalledTimes(1)
    expect(signal.onces.get(name)?.length).toBe(0)
  })

  it("emit() should invoke the Signal's notify method", () => {
    const name = 'add'
    signal.emit_value(name, 5)
    expect(signal.notify).toHaveBeenCalled()
  })

  it('notify() should execute the callback with the payload', () => {
    const name = 'add'
    signal.add(name, receiver.onReceive)
    const slot = signal.slots.get(name)
    expect(slot).not.toBe(undefined)
    // Ensure to be not undefined by previous line
    slot && signal.notify(slot, 5)
    expect(receiver.onReceive).toHaveBeenCalledWith(5)
  })
})
