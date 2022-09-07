/**
 * Code based over:
 * https://raw.githubusercontent.com/rgr-myrg/signal-ts/7e10237c565e14b680029834c970ea49b0ed60dd/src/ts/Signal.ts
 * From: https://github.com/rgr-myrg/signal-ts
 */

/**
 * Type specialized signal, where a signal can only emit a single type
 */
export class Signal<T> {
  public slots: ((arg1: T) => void)[] = []
  public onces: ((arg1: T) => void)[] = []
  public caller: (() => T) | undefined = undefined

  /**
   * Add slot, called when emit is raised
   *
   * @param  {Function} slot
   * @returns {Signal<'T'>}
   */
  public add(slot: (arg1: T) => void): Signal<T> {
    typeof slot === 'function' && this.slots.push(slot)

    return this
  }

  /**
   * Called only once when an emit is raised
   *
   * @param  {Function} slot
   * @returns {Signal<'T'>}
   */
  public once(slot: (arg1: T) => void): Signal<T> {
    typeof slot === 'function' && this.onces.push(slot)

    return this
  }

  /**
   * Remove a specific slot from the notification list
   *
   * @param  {Function} slot
   * @returns {Signal<'T'>}
   */
  public remove(
    slot: ((arg1: T) => void) | ((arg1: undefined) => void)
  ): Signal<T> {
    this.slots = this.slots.filter((item) => item !== slot)
    this.onces = this.onces.filter((item) => item !== slot)

    return this
  }

  /**
   * Remove all callbacks
   *
   * @returns {Signal<'T'>}
   */
  public clear(): Signal<T> {
    this.slots = []
    this.onces = []

    return this
  }

  /**
   * Register function to be called when emit is used
   *
   * @param {Function} caller
   */
  public register_caller(caller: () => T): void {
    this.caller = caller
  }

  /**
   * Emit signal with desired value
   *
   * @param {'T'} payload
   */
  public emit_value(payload: T): void {
    this.notify(this.slots, payload)
    this.notify(this.onces, payload)

    this.onces = []
  }

  /**
   * Emit signal
   */
  public emit(): void {
    if (typeof this.caller === 'function') {
      this.emit_value(this.caller())
    }
  }

  /**
   *  Notify all slots
   *
   * @param {Function[]} slots
   * @param {'T'} payload
   */
  notify(slots: ((arg1: T) => void)[], payload: T): void {
    for (const slot of slots) {
      slot.call(slot, payload)
    }
  }
}

/**
 * Generic signal that can emit multiple types based on typeof
 */
export class SignalTyped {
  public slots: Map<string, ((arg1: unknown) => void)[]> = new Map()
  public onces: Map<string, ((arg1: unknown) => void)[]> = new Map()
  public caller: (() => unknown) | undefined = undefined

  /**
   * Add slots for generic types
   *
   * @param {string} typeof_value
   * @param {Function} slot
   * @returns {SignalTyped}
   */
  public add(typeof_value: string, slot: (arg1: unknown) => void): SignalTyped {
    if (typeof slot === 'function') {
      if (!this.slots.has(typeof_value)) {
        this.slots.set(typeof_value, [])
      }
      this.slots.get(typeof_value)?.push(slot)
    }

    return this
  }

  /**
   * Called only once when an emit is raised
   *
   * @param {string} typeof_value
   * @param {Function} slot
   * @returns {SignalTyped}
   */
  public once<T>(typeof_value: string, slot: (arg1: T) => void): SignalTyped {
    if (typeof slot === 'function') {
      if (!this.onces.has(typeof_value)) {
        this.onces.set(typeof_value, [])
      }
      this.onces.get(typeof_value)?.push(slot)
    }

    return this
  }

  /**
   * Remove a specific slot from the notification list
   *
   * @param {string} typeof_value
   * @param {Function} slot
   * @returns {SignalTyped}
   */
  public remove<T>(
    typeof_value: string,
    slot: (arg1: T) => void | (() => void)
  ): SignalTyped {
    this.slots.has(typeof_value) &&
      this.slots.set(
        typeof_value,
        this.slots.get(typeof_value)?.filter((item) => item !== slot)
      )

    this.onces.has(typeof_value) &&
      this.onces.set(
        typeof_value,
        this.onces.get(typeof_value)?.filter((item) => item !== slot)
      )

    return this
  }

  /**
   * Remove all callbacks
   *
   * @returns {SignalTyped}
   */
  public clear(): SignalTyped {
    this.slots = new Map()
    this.onces = new Map()

    return this
  }

  /**
   * Emit signal with desired value
   *
   * @param {string} typeof_value
   * @param {'T'} payload
   */
  public emit_value<T>(typeof_value: string, payload: T): void {
    this.slots.has(typeof_value) &&
      this.notify(this.slots.get(typeof_value), payload)
    this.onces.has(typeof_value) &&
      this.notify(this.onces.get(typeof_value), payload)

    this.onces.set(typeof_value, [])
  }

  /**
   *  Notify all slots
   *
   * @param {Function} slots
   * @param {'T'} payload
   */
  notify<T>(slots: ((arg1: T) => void)[], payload: T): void {
    for (const slot of slots) {
      slot.call(slot, payload)
    }
  }
}
