/**
 * Brightest value (0 to 1, per sRGB channel) that scenery may show through adaptive glass, and the knee where the
 * curve starts bending toward it.
 * @param {number} level From 0 (mild ceiling) to 1 (very dark ceiling)
 * @param {number} sensitivity From 0 (only scenery near the ceiling reacts) to 1 (dimmer scenery reacts too)
 * @returns {[number, number]} The ceiling and the knee
 */
export const glassToneCeilingAndKnee = (level: number, sensitivity: number): [number, number] => {
  const ceiling = 0.75 - 0.45 * level
  return [ceiling, ceiling * (0.9 - 0.6 * sensitivity)]
}

/**
 * Element id of the SVG tone filter, unique per curve so a backdrop filter referencing it repaints when it changes.
 * @param {number} level From 0 to 1, see {@link glassToneCeilingAndKnee}
 * @param {number} sensitivity From 0 to 1, see {@link glassToneCeilingAndKnee}
 * @returns {string} The filter element id
 */
export const glassToneFilterId = (level: number, sensitivity: number): string =>
  `cockpit-glass-tone-${Math.round(level * 100)}-${Math.round(sensitivity * 100)}`

/**
 * `tableValues` for an `feFuncR/G/B` transfer that passes scenery below the knee through untouched and eases it
 * toward the ceiling above it, with slope 1 at the knee so the bend leaves no visible edge.
 * @param {number} level From 0 to 1, see {@link glassToneCeilingAndKnee}
 * @param {number} sensitivity From 0 to 1, see {@link glassToneCeilingAndKnee}
 * @returns {string} Space-separated transfer table
 */
export const glassToneTable = (level: number, sensitivity: number): string => {
  const [ceiling, knee] = glassToneCeilingAndKnee(level, sensitivity)
  const shoulder = ceiling - knee
  const samples = 33
  return Array.from({ length: samples }, (_, index) => {
    const input = index / (samples - 1)
    if (input <= knee) return input.toFixed(3)
    return (knee + shoulder * (1 - Math.exp(-(input - knee) / shoulder))).toFixed(3)
  }).join(' ')
}
