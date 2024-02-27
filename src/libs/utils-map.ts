import type { WaypointCoordinates } from '@/types/mission'

/**
 * Default target follower update interval in milliseconds.
 * @constant {number}
 */
const defaultUpdateIntervalMs = 500

/**
 * Enum for the different types of targets that can be followed.
 * @enum {string}
 */
export enum WhoToFollow {
  HOME = 'Home',
  VEHICLE = 'Vehicle',
}

/**
 * Class responsible for following a target in a given map.
 * @class
 */
export class TargetFollower {
  /**
   * Sets current center for the map coupled to this follower.
   * @type {(center: WaypointCoordinates) => void}
   */
  private onCenterChange: (newCenter: WaypointCoordinates) => void

  /**
   * Sets current target to the component observing this follower.
   */
  private onTargetChange: (newTarget: WhoToFollow | undefined) => void

  /**
   * Current target ref to follow.
   * @type {WhoToFollow | undefined}
   */
  private target: WhoToFollow | undefined

  /**
   * Targets available to be followed
   * @type {Record<string, () => WaypointCoordinates | undefined>}
   */
  private trackables: Record<string, () => WaypointCoordinates | undefined> = {}

  /**
   * Update interval task
   * @type {ReturnType<typeof setInterval> | undefined}
   */
  private updateInterval: ReturnType<typeof setInterval> | undefined

  /**
   * Constructor for the TargetFollower class.
   * @param {(newTarget: WhoToFollow | undefined) => void} onTargetChange - Sets current target to the component observing this follower.
   * @param {(newCenter: WaypointCoordinates) => void} onCenterChange - Sets current center for the map coupled to this follower.
   */
  constructor(
    onTargetChange: (newTarget: WhoToFollow | undefined) => void,
    onCenterChange: (newCenter: WaypointCoordinates) => void
  ) {
    this.onTargetChange = onTargetChange
    this.onCenterChange = onCenterChange
  }

  /**
   * Sets coupled map center to a given target.
   * @param {WhoToFollow} target - The target to follow.
   * @returns {void}
   */
  private setCenter(target: WhoToFollow | undefined): void {
    if (!target) return

    const updateOnValid = (newCenter: WaypointCoordinates | undefined): void => {
      if (newCenter) {
        this.onCenterChange(newCenter)
      }
    }

    updateOnValid(this.trackables[target]?.())
  }

  /**
   * Stops to follow current target and goes to a given target.
   * @param {WhoToFollow} target - The target to follow.
   * @param {boolean} toggleSameTarget - If should stop following current selected
   * target if the same target is selected again.
   * @returns {void}
   */
  public goToTarget(target: WhoToFollow, toggleSameTarget = false): void {
    // Saves a copy of target because unFollow will set it to undefined
    const oldTarget = this.target
    this.unFollow()

    if (toggleSameTarget && target === oldTarget) {
      return
    }

    this.setCenter(target)
  }

  /**
   * Sets a source of data for a given target to follow.
   * @param {WhoToFollow} target - The target that will receive this data
   * @param {() => WaypointCoordinates | undefined} compute - The function to compute the target data
   * coordinates.
   * @returns {void}
   */
  public setTrackableTarget(target: WhoToFollow, compute: () => WaypointCoordinates | undefined): void {
    this.trackables[target] = compute
  }

  /**
   * Update current map center ref based on the target to follow.
   * @returns {void}
   */
  public update(): void {
    this.setCenter(this.target)
  }

  /**
   * Enable auto update for the current target ref, don't forget to disable auto update
   * prior to object destruction or it can lead to intervals running forever.
   * @returns {void}
   */
  public enableAutoUpdate(): void {
    this.updateInterval = setInterval(() => this.update(), defaultUpdateIntervalMs)
  }

  /**
   * Disable auto update for the current target ref.
   * @returns {void}
   */
  public disableAutoUpdate(): void {
    clearInterval(this.updateInterval)
  }

  /**
   * Set the current target ref to follow.
   * @param {WhoToFollow} target - The target to follow.
   * @param {boolean} navigateNow - If should navigate to the target now.
   * @returns {void}
   */
  public follow(target: WhoToFollow, navigateNow = true): void {
    this.target = target
    this.onTargetChange(this.target)

    if (navigateNow) {
      this.setCenter(target)
    }
  }

  /**
   * Unset the current target ref to follow.
   * @returns {void}
   */
  public unFollow(): void {
    this.target = undefined
    this.onTargetChange(this.target)
  }
}
