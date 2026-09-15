import { MavMissionType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

export const MISSION = MavMissionType.MAV_MISSION_TYPE_MISSION

/**
 * Wait until `pulse` is called or `ms` elapses.
 * @param {number} ms Idle timeout
 * @param {(cb: (() => void) | null) => void} setPulse Register or clear the current waiter
 * @returns {Promise<void>} Resolves on pulse, rejects with `idle` on timeout
 */
export const waitPulse = (ms: number, setPulse: (cb: (() => void) | null) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      setPulse(null)
      reject(new Error('idle'))
    }, ms)
    setPulse(() => {
      clearTimeout(timer)
      setPulse(null)
      resolve()
    })
  })

export const fail = (log: string, user: string): never => {
  console.error(log)
  throw new Error(user)
}
