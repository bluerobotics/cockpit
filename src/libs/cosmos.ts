export {}

declare global {
  /**
   * Running time assert for development
   *
   * @param {boolean}
   * @param {string?}
   * @returns {void}
   */
  function assert(result: boolean, message?: string): void

  /**
   * Warn developer when something is not implemented
   *
   * @param {string}
   * @returns {void}
   */
  function unimplemented(message?: string): void

  /**
   * Helper to avoid unused warnings
   *
   * @param T variable
   * @returns {void}
   */
  function unused<T>(variable: T): void

  /**
   * Expand Array interface for internal usage
   */
  interface Array<T> {
    /**
     * Return the first element of array
     *
     * @returns T | undefined
     */
    first(): T | undefined

    /**
     * Check if array is empty
     *
     * @returns boolean
     */
    isEmpty(): boolean

    /**
     * Return the last element of array
     *
     * @returns T | undefined
     */
    last(): T | undefined

    /**
     * Return a random element if available
     *
     * @returns T | undefined
     */
    random(): T | undefined

    /**
     * Return the sum of all ements
     *
     * @returns number
     */
    sum(): number
  }
}

// Global functions
global.assert = function (result: boolean, message?: string) {
  if (!result) throw new Error(message ?? 'Assert failed')
}

global.unimplemented = function (message?: string) {
  console.warn(new Error(message ?? 'Not implemented'))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
global.unused = function <T>(variable: T) {}

// Extend types
Array.prototype.first = function <T>(this: T[]): T | undefined {
  return this.isEmpty() ? undefined : this[0]
}

Array.prototype.last = function <T>(this: T[]): T | undefined {
  return this.isEmpty() ? undefined : this[this.length - 1]
}

Array.prototype.isEmpty = function <T>(this: T[]): boolean {
  return this.length === 0
}

Array.prototype.random = function <T>(this: T[]): T | undefined {
  return this[Math.floor(Math.random() * this.length)]
}

Array.prototype.sum = function (this: number[]): number {
  return this.reduce((a, b) => a + b, 0)
}
