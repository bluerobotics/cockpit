import gsap from 'gsap'

/** Options for {@link createQuickTween}. */
export interface QuickTweenOptions {
  /** Tween duration in seconds. */
  duration?: number
  /** GSAP ease (e.g. 'power1.out', 'elastic.out(1.2, 0.5)'). Defaults to GSAP's default ease. */
  ease?: string
  /** Called on each tween tick - typically schedules a (coalesced) canvas redraw. */
  onUpdate?: () => void
}

/** A cache of reused GSAP quickTo setters bound to a single target object. */
export interface QuickTween {
  /**
   * Animate `target[key]` toward `value`, reusing a single tween per key (no per-update allocation).
   * @param {string | number} key - Property of the target object to animate.
   * @param {number} value - Value to animate towards.
   */
  set: (key: string | number, value: number) => void
  /**
   * Set `target[key]` immediately without tweening (e.g. to jump across an angle-wrap boundary).
   * @param {string | number} key - Property of the target object to set.
   * @param {number} value - Value to assign.
   */
  snap: (key: string | number, value: number) => void
  /** Kill all tweens of the target and release the cached setters. Call on unmount. */
  kill: () => void
}

/**
 * Creates a cache of reused GSAP `quickTo` setters for a target object.
 *
 * `gsap.to()` allocates a new tween on every call, so animating values that change at telemetry rate
 * (HUD pitch/roll/yaw/depth) spawns and accumulates large numbers of overlapping tweens - which
 * profiling showed dominating frame time on constrained hardware. `quickTo` reuses one tween per
 * property and just retargets it, which is GSAP's recommended pattern for frequently-updated values.
 * Each setter reads the property's current value as the tween start, so a direct {@link QuickTween.snap}
 * followed by {@link QuickTween.set} cleanly replaces the chained `fromTo` animations used for
 * angle wrap-around.
 * @param {Record<string, number>} target - Plain object whose numeric properties are animated.
 * @param {QuickTweenOptions} [options] - Tween configuration.
 * @returns {QuickTween} The reusable setter cache.
 */
export const createQuickTween = (target: Record<string, number>, options: QuickTweenOptions = {}): QuickTween => {
  const { duration = 0.1, ease, onUpdate } = options
  const setters = new Map<string, ReturnType<typeof gsap.quickTo>>()

  const setterFor = (key: string): ReturnType<typeof gsap.quickTo> => {
    let setter = setters.get(key)
    if (setter === undefined) {
      const vars: gsap.TweenVars = { duration }
      if (ease !== undefined) vars.ease = ease
      if (onUpdate !== undefined) vars.onUpdate = onUpdate
      setter = gsap.quickTo(target, key, vars)
      setters.set(key, setter)
    }
    return setter
  }

  return {
    set: (key, value) => setterFor(String(key))(value),
    // Passing the value as both end and start lands instantly and cancels any in-flight tween, so a
    // wrap-around jump can't be overridden by a still-running animation on the same property.
    snap: (key, value) => setterFor(String(key))(value, value),
    kill: () => {
      gsap.killTweensOf(target)
      setters.clear()
    },
  }
}
