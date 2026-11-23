/**
 * Propeller speed in radians per second while the vehicle idles, 390 rpm.
 */
export const idlePropellerSpeed = (390 * 2 * Math.PI) / 60

/**
 * Interval between frames while only the propellers move, drawing them at 30 fps.
 */
export const idleFrameIntervalMs = 1000 / 30
