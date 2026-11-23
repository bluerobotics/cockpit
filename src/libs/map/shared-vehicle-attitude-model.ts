import type { VehicleAttitudeRenderer } from '@/libs/map/vehicle-attitude-model'

// The canvas overhangs the 64 px marker by 10% so the model reads a little larger than the vehicle pictures.
const vehicleAttitudeModelSizePx = 64 * 1.1

/**
 * A model loaded for every canvas showing it, so several maps share one download and one WebGL context.
 */
interface PooledModel {
  /** Canvases showing the model, each with what to call if the model cannot be drawn. */
  canvases: Map<HTMLCanvasElement, () => void>
  /** The renderer, once the model has loaded. */
  renderer?: VehicleAttitudeRenderer
}

const pool = new Map<string, PooledModel>()
// Kept for the session, so a device without WebGL does not download and retry a model every time a map mounts.
const failedModelUrls = new Set<string>()
const visibleCanvases = new Set<Element>()
let visibilityObserver: IntersectionObserver | undefined
const renderSizePx = vehicleAttitudeModelSizePx * Math.min(window.devicePixelRatio, 2)
// Below this change the tilt is not visible at marker size, so telemetry jitter does not cost a render.
const redrawThresholdRad = (0.5 * Math.PI) / 180

const propellerWindDownMs = 2000
// Half the joystick preview's rate: at marker size the spin reads the same, for half the renders over an armed flight.
const spinFrameIntervalMs = 1000 / 15

let attitude = { roll: 0, pitch: 0 }
let armed = false
let disarmedAt: number | undefined
let frame: number | undefined
let lastSpin: number | undefined

// Full speed while armed, then easing out to a stop after disarming, the way a freewheeling propeller winds down.
const propellerSpeedFactor = (now: number): number => {
  if (armed) return 1
  if (disarmedAt === undefined) return 0
  return Math.max(0, 1 - (now - disarmedAt) / propellerWindDownMs) ** 2
}

const hasPropellers = (): boolean => [...pool.values()].some(({ renderer }) => renderer?.hasPropellers)

// While the propellers turn the models keep being drawn, but only into markers on screen: an armed flight with every
// marker panned away or behind another view costs no renders.
const drawAll = (now: number): void => {
  frame = undefined
  const speedFactor = propellerSpeedFactor(now)
  const spinning = speedFactor > 0 && hasPropellers() && visibleCanvases.size > 0
  if (spinning && lastSpin !== undefined && now - lastSpin < spinFrameIntervalMs) {
    frame = requestAnimationFrame(drawAll)
    return
  }
  const spinSeconds = spinning && lastSpin !== undefined ? ((now - lastSpin) / 1000) * speedFactor : 0
  lastSpin = spinning ? now : undefined
  if (speedFactor === 0) disarmedAt = undefined
  pool.forEach(({ renderer, canvases }) => {
    const targets = [...canvases.keys()].filter((canvas) => visibleCanvases.has(canvas))
    if (targets.length === 0 || renderer === undefined) return
    renderer.draw(attitude.roll, attitude.pitch, targets, spinSeconds)
    targets.forEach((canvas) => (canvas.dataset.drawn = ''))
  })
  if (spinning) frame = requestAnimationFrame(drawAll)
}

const scheduleDraw = (): void => {
  if (pool.size > 0) frame ??= requestAnimationFrame(drawAll)
}

const observeVisibility = (canvas: HTMLCanvasElement): void => {
  visibilityObserver ??= new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visibleCanvases.add(target)
      else visibleCanvases.delete(target)
    })
    scheduleDraw()
  })
  visibilityObserver.observe(canvas)
}

const failCanvases = (entry: PooledModel): void => [...entry.canvases.values()].forEach((onFailure) => onFailure())

const load = async (modelUrl: string, entry: PooledModel): Promise<void> => {
  try {
    const { createVehicleAttitudeRenderer } = await import('@/libs/map/vehicle-attitude-model')
    // A lost context is usually transient (a GPU reset, too many contexts), so unlike a failed load it is not
    // remembered, and the next map mount tries a fresh renderer.
    const renderer = await createVehicleAttitudeRenderer(modelUrl, renderSizePx, () => failCanvases(entry))
    if (pool.get(modelUrl) !== entry) return renderer.dispose()
    entry.renderer = renderer
    scheduleDraw()
  } catch (error) {
    console.error('Could not draw the vehicle model on the map.', error)
    failedModelUrls.add(modelUrl)
    failCanvases(entry)
  }
}

/**
 * Sets the attitude every vehicle model is drawn at, redrawing them on the next frame if it changed visibly.
 * @param {number} roll - Roll in radians, positive with the right side down.
 * @param {number} pitch - Pitch in radians, positive with the nose up.
 */
export const setVehicleModelAttitude = (roll: number, pitch: number): void => {
  const changed =
    Math.abs(roll - attitude.roll) >= redrawThresholdRad || Math.abs(pitch - attitude.pitch) >= redrawThresholdRad
  if (!changed) return
  attitude = { roll, pitch }
  scheduleDraw()
}

/**
 * Sets whether the vehicle is armed, which keeps the propellers of every model that has them turning, and winds them
 * down once it disarms.
 * @param {boolean} isArmed - Whether the vehicle is armed.
 */
export const setVehicleModelArmed = (isArmed: boolean): void => {
  if (isArmed === armed) return
  armed = isArmed
  disarmedAt = isArmed ? undefined : performance.now()
  scheduleDraw()
}

/**
 * Starts drawing a vehicle model into a canvas, loading the model if no other canvas shows it yet.
 * @param {HTMLCanvasElement} canvas - Canvas to draw into; its pixel size is set here.
 * @param {string} modelUrl - URL of the vehicle's glTF model.
 * @param {() => void} onFailure - Called if the model cannot be drawn, so the caller can show something else.
 * @returns {() => void} Stops drawing into the canvas, releasing the model once no canvas shows it.
 */
export const attachVehicleModel = (
  canvas: HTMLCanvasElement,
  modelUrl: string,
  onFailure: () => void
): (() => void) => {
  if (failedModelUrls.has(modelUrl)) {
    onFailure()
    return () => undefined
  }
  canvas.width = renderSizePx
  canvas.height = renderSizePx

  let entry = pool.get(modelUrl)
  if (entry === undefined) {
    entry = { canvases: new Map() }
    pool.set(modelUrl, entry)
    load(modelUrl, entry)
  }
  entry.canvases.set(canvas, onFailure)
  observeVisibility(canvas)
  scheduleDraw()

  const attached = entry
  return () => {
    attached.canvases.delete(canvas)
    visibilityObserver?.unobserve(canvas)
    visibleCanvases.delete(canvas)
    delete canvas.dataset.drawn
    if (attached.canvases.size > 0) return
    attached.renderer?.dispose()
    if (pool.get(modelUrl) === attached) pool.delete(modelUrl)
    if (pool.size > 0) return
    // Nothing tracks the vehicle while no map shows it, so the next map starts from a parked vehicle, not a stale one.
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    lastSpin = undefined
    armed = false
    disarmedAt = undefined
  }
}
