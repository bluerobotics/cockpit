import { listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'

/**
 * The `cockpit` API a user script receives: the global one, with the registrations it makes tracked so they can be
 * undone when the script is replaced or removed
 */
type TrackedCockpitApi = Window['cockpit'] & {
  /**
   * Run a function when the script is replaced or removed, to undo what the tracked helpers do not cover
   * @param {() => void} cleanup - The function to run
   */
  onCleanup: (cleanup: () => void) => void
  /**
   * Same as window.setInterval, cleared when the script is replaced or removed
   */
  setInterval: typeof window.setInterval
  /**
   * Same as window.setTimeout, cleared when the script is replaced or removed
   */
  setTimeout: typeof window.setTimeout
}

const runCleanup = (cleanup: () => void, label: string): void => {
  try {
    cleanup()
  } catch (error) {
    console.error(`Error cleaning up after the ${label}.`, error)
  }
}

/**
 * What the runs of one piece of user code registered through the tracked API, so it can all be undone at once
 */
export interface CleanupScope {
  /**
   * Starts a run: returns how that run records a cleanup. A cleanup recorded after the scope was cleaned up runs at
   * once, so a registration that arrives late, after a network reply say, does not outlive the code that made it.
   * @returns {(cleanup: () => void) => () => void} Records a cleanup for the run, returning what drops it again
   */
  startRun: () => (cleanup: () => void) => () => void
  /**
   * Undoes everything the runs started so far registered
   */
  cleanUp: () => void
}

/**
 * Create a cleanup scope, one per owner of user code: a DIY widget run, a JavaScript action, an editor's test runs
 * @param {string} label - What the code is, for the error log
 * @returns {CleanupScope} The scope
 */
export const createCleanupScope = (label: string): CleanupScope => {
  let generation = 0
  let cleanups = new Set<() => void>()
  return {
    startRun: () => {
      const runGeneration = generation
      return (cleanup) => {
        if (runGeneration !== generation) {
          runCleanup(cleanup, label)
          return () => undefined
        }
        const entry = (): void => cleanup()
        cleanups.add(entry)
        return () => cleanups.delete(entry)
      }
    },
    cleanUp: () => {
      generation++
      const pending = cleanups
      cleanups = new Set()
      pending.forEach((cleanup) => runCleanup(cleanup, label))
    },
  }
}

/**
 * Run user code in its own function scope, handing it a `cockpit` API whose data-lake listeners and timers are
 * recorded in `scope`, plus any named values in `context`. Top-level declarations stay local to the run, so running
 * the code again does not collide with the previous run.
 * @param {string} code - The code
 * @param {string} label - What the code is, for the error log
 * @param {CleanupScope} scope - Where the run records what to undo
 * @param {Record<string, unknown>} context - Extra values the code receives as variables, keyed by name
 */
export const runUserScript = (
  code: string,
  label: string,
  scope: CleanupScope,
  context: Record<string, unknown> = {}
): void => {
  const track = scope.startRun()

  // A listener the code removes itself must leave the scope too, or cleanup would unlisten it a second time.
  const untrackListener = new Map<string, () => void>()

  const cockpit: TrackedCockpitApi = {
    ...window.cockpit,
    listenDataLakeVariable: (...args: Parameters<typeof listenDataLakeVariable>) => {
      const listenerId = listenDataLakeVariable(...args)
      untrackListener.set(
        listenerId,
        track(() => unlistenDataLakeVariable(args[0], listenerId))
      )
      return listenerId
    },
    unlistenDataLakeVariable: (...args: Parameters<typeof unlistenDataLakeVariable>) => {
      untrackListener.get(args[1])?.()
      untrackListener.delete(args[1])
      unlistenDataLakeVariable(...args)
    },
    setInterval: ((...args: Parameters<typeof window.setInterval>) => {
      const intervalId = window.setInterval(...args)
      track(() => window.clearInterval(intervalId))
      return intervalId
    }) as typeof window.setInterval,
    setTimeout: ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      // A timeout that has fired has nothing left to clear, so it drops its own entry rather than pile up.
      const run = typeof handler === 'function' ? handler : () => new Function(handler)()
      const timeoutId = window.setTimeout(
        (...runArgs: unknown[]) => {
          untrack()
          run(...runArgs)
        },
        timeout,
        ...args
      )
      const untrack = track(() => window.clearTimeout(timeoutId))
      return timeoutId
    }) as typeof window.setTimeout,
    onCleanup: track,
  }

  try {
    new Function('cockpit', ...Object.keys(context), code)(cockpit, ...Object.values(context))
  } catch (error) {
    console.error(`Error running the ${label}.`, error)
  }
}
