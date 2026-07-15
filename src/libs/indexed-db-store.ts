/**
 * Configuration for an {@link IndexedDbStore}.
 */
interface IndexedDbStoreConfig {
  /**
   * IndexedDB database name
   */
  name: string
  /**
   * Object store name inside the database
   */
  storeName: string
  /**
   * Database schema version (positive integer); drives IndexedDB's upgrade flow. Defaults to 1.
   */
  version?: number
  /**
   * Human-readable description. IndexedDB has no native description, so this is metadata only and
   * does not affect storage; kept for parity/documentation.
   */
  description?: string
}

/**
 * Minimal promise-based key-value store backed directly by IndexedDB.
 *
 * Exposes a subset of the localforage instance API (`getItem`, `setItem`, `removeItem`, `keys`,
 * `iterate`) so it can be used as a near drop-in replacement, without the localforage dependency.
 */
export class IndexedDbStore {
  private readonly dbName: string
  private readonly storeName: string
  private readonly version?: number
  /**
   * Metadata only — IndexedDB has no native database description; kept for parity/documentation.
   */
  readonly description?: string
  private dbPromise: Promise<IDBDatabase> | null = null

  /**
   * @param {IndexedDbStoreConfig} config - Database, object store, and optional version/description
   */
  constructor(config: IndexedDbStoreConfig) {
    this.dbName = config.name
    this.storeName = config.storeName
    this.version = config.version
    this.description = config.description
  }

  /**
   * Open (and cache) the database connection, creating the object store on first use.
   *
   * Probes the current version first and only ever upgrades — never requests a lower version (which
   * would throw on a database that already exists at a higher version, e.g. one created by another
   * library). The object store is created via a version bump when missing.
   * @returns {Promise<IDBDatabase>} The open database
   */
  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    const ensureStore = (db: IDBDatabase): void => {
      if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName)
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const probe = indexedDB.open(this.dbName)
      probe.onupgradeneeded = () => ensureStore(probe.result)
      probe.onerror = () => reject(probe.error)
      probe.onsuccess = () => {
        const db = probe.result
        const storeMissing = !db.objectStoreNames.contains(this.storeName)
        const targetVersion = Math.max(this.version ?? 0, db.version + (storeMissing ? 1 : 0))

        if (!storeMissing && targetVersion <= db.version) {
          resolve(db)
          return
        }

        db.close()
        const upgrade = indexedDB.open(this.dbName, targetVersion)
        upgrade.onupgradeneeded = () => ensureStore(upgrade.result)
        upgrade.onerror = () => reject(upgrade.error)
        upgrade.onblocked = () => reject(new Error(`Opening IndexedDB database "${this.dbName}" was blocked.`))
        upgrade.onsuccess = () => resolve(upgrade.result)
      }
    })
    return this.dbPromise
  }

  /**
   * Run a transaction against the object store.
   * @param {IDBTransactionMode} mode - Transaction mode
   * @param {(store: IDBObjectStore) => IDBRequest} operation - Builds the request to run
   * @returns {Promise<T>} Resolves with the request result once the transaction completes
   */
  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.openDb()
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, mode)
      const request = operation(transaction.objectStore(this.storeName))
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(request.result as T)
    })
  }

  /**
   * @param {string} key - Item key
   * @returns {Promise<T | null>} The stored value, or null when the key is absent
   */
  async getItem<T>(key: string): Promise<T | null> {
    const value = await this.run<T | undefined>('readonly', (store) => store.get(key))
    return value === undefined ? null : value
  }

  /**
   * @param {string} key - Item key
   * @param {T} value - Value to store
   * @returns {Promise<T>} The stored value
   */
  async setItem<T>(key: string, value: T): Promise<T> {
    await this.run('readwrite', (store) => store.put(value, key))
    return value
  }

  /**
   * @param {string} key - Item key to remove
   */
  async removeItem(key: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(key))
  }

  /**
   * @returns {Promise<string[]>} All keys in the store
   */
  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
    return keys as string[]
  }

  /**
   * Read all values, optionally restricted to a key range (efficient native range query).
   * @param {IDBKeyRange} [query] - Key range to restrict results to
   * @returns {Promise<T[]>} The matching values, in ascending key order
   */
  async getAll<T>(query?: IDBKeyRange): Promise<T[]> {
    return this.run<T[]>('readonly', (store) => store.getAll(query))
  }

  /**
   * Count entries, optionally restricted to a key range (native count, no values are read).
   * @param {IDBKeyRange} [query] - Key range to restrict the count to
   * @returns {Promise<number>} The number of matching entries
   */
  async count(query?: IDBKeyRange): Promise<number> {
    return this.run<number>('readonly', (store) => store.count(query))
  }

  /**
   * Delete every entry whose key falls within the given range, in a single native operation.
   * @param {IDBKeyRange} query - Key range to delete
   */
  async removeRange(query: IDBKeyRange): Promise<void> {
    await this.run('readwrite', (store) => store.delete(query))
  }

  /**
   * Iterate over every entry in insertion order. Returning a non-undefined value from the iteratee
   * stops the iteration early and resolves with that value (matching localforage's behavior).
   * @param {(value: T, key: string, iterationNumber: number) => U | void} iteratee - Per-entry callback
   * @returns {Promise<U | void>} The early-return value, if any
   */
  async iterate<T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U | void): Promise<U | void> {
    const db = await this.openDb()
    return new Promise<U | void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly')
      const request = transaction.objectStore(this.storeName).openCursor()
      let iterationNumber = 1

      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }

        const result = iteratee(cursor.value as T, cursor.key as string, iterationNumber++)
        if (result !== undefined) {
          resolve(result)
          return
        }
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  }
}
