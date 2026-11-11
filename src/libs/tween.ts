/**
 * Maps the elapsed fraction of a tween (0 to 1) to the fraction of the distance covered.
 */
export type Easing = (progress: number) => number

/**
 * Decelerates into the target. The default, so the widgets move as they did before this helper replaced GSAP,
 * whose default ease this is.
 * @param {number} progress Elapsed fraction of the tween, from 0 to 1
 * @returns {number} Fraction of the distance covered
 */
const easeOutQuad: Easing = (progress) => 1 - (1 - progress) ** 2

/**
 * Overshoots the target and settles on it with a decaying oscillation.
 * @param {number} amplitude Peak overshoot as a multiple of the distance, at least 1
 * @param {number} period Length of one oscillation, as a fraction of the tween's duration
 * @returns {Easing} The easing function
 */
export const elasticOut = (amplitude: number, period: number): Easing => {
  const phase = (period / (2 * Math.PI)) * Math.asin(1 / amplitude)
  return (progress) => {
    if (progress === 1) return 1
    return amplitude * 2 ** (-10 * progress) * Math.sin(((progress - phase) * 2 * Math.PI) / period) + 1
  }
}

type Tween = {
  /**
   * Value of the property when the tween started
   */
  from: number
  /**
   * Value the property ends on
   */
  to: number
  /**
   * Start time, in the clock of `requestAnimationFrame`
   */
  startMs: number
  /**
   * Length of the tween, in milliseconds
   */
  durationMs: number
  /**
   * Easing applied to the elapsed fraction
   */
  ease: Easing
}

// One tween per property: a new tween on a property replaces the running one, so a burst of telemetry updates
// never stacks animations that fight over the same value.
const runningTweens = new Map<Record<PropertyKey, unknown>, Map<PropertyKey, Tween>>()
let ticking = false

// The next frame is scheduled in `finally`, so a write that throws costs one frame instead of stopping every tween
// for the rest of the session, and a finished tween is dropped before its last write, so a throwing one cannot
// outlive its duration.
const tick = (nowMs: number): void => {
  try {
    runningTweens.forEach((tweens, target) => {
      tweens.forEach((tween, key) => {
        const progress = Math.min(Math.max((nowMs - tween.startMs) / tween.durationMs, 0), 1)
        if (progress === 1) tweens.delete(key)
        target[key] = tween.from + (tween.to - tween.from) * tween.ease(progress)
      })
      if (tweens.size === 0) runningTweens.delete(target)
    })
  } finally {
    ticking = runningTweens.size > 0
    if (ticking) requestAnimationFrame(tick)
  }
}

/**
 * Animates numeric properties of an object towards new values, one animation frame at a time.
 * A property that is not a number yet jumps straight to its value, since there is nothing to animate from.
 * @param {object} target Object whose properties are animated, usually a reactive one
 * @param {number} durationSeconds Length of the animation, in seconds
 * @param {Record<PropertyKey, number>} values Final value of each animated property
 * @param {Easing} ease Easing of the animation, `easeOutQuad` by default
 */
export const tweenTo = (
  target: object,
  durationSeconds: number,
  values: Record<PropertyKey, number>,
  ease: Easing = easeOutQuad
): void => {
  const record = target as Record<PropertyKey, unknown>
  const tweens = runningTweens.get(record) ?? new Map<PropertyKey, Tween>()
  const startMs = performance.now()

  Object.entries(values).forEach(([key, to]) => {
    const from = record[key]
    if (typeof from !== 'number' || durationSeconds <= 0) {
      tweens.delete(key)
      record[key] = to
      return
    }
    tweens.set(key, { from, to, startMs, durationMs: durationSeconds * 1000, ease })
  })

  if (tweens.size === 0) return
  runningTweens.set(record, tweens)
  if (ticking) return
  ticking = true
  requestAnimationFrame(tick)
}
