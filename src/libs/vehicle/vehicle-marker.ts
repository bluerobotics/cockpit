import blueboatMarkerImage from '@/assets/blueboat-marker.avif'
import brov2MarkerImage from '@/assets/brov2-marker.avif'
import copterMarkerImage from '@/assets/copter-marker.avif'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.avif'
import planeMarkerImage from '@/assets/plane-marker.avif'
import roverMarkerImage from '@/assets/rover-marker.avif'
import blueBoatModelUrl from '@/assets/vehicles/models/blueboat.glb?url'
import quadcopterModelUrl from '@/assets/vehicles/models/quadcopter.glb?url'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'
import type { VehicleIconAppearance } from '@/types/mission'

const markerImageByVehicleType: Partial<Record<VehicleType, string>> = {
  [VehicleType.Sub]: brov2MarkerImage,
  [VehicleType.Rover]: roverMarkerImage,
  [VehicleType.Copter]: copterMarkerImage,
  [VehicleType.Plane]: planeMarkerImage,
}

/**
 * Resolves the top-view marker image that best represents a vehicle type, falling back to a generic marker.
 * @param {MavType | undefined} vehicleType - The vehicle's MAVLink type, or undefined when still unknown.
 * @returns {string} The URL of the marker image to display.
 */
export const vehicleMarkerImageUrl = (vehicleType: MavType | undefined): string => {
  if (vehicleType === undefined) return genericVehicleMarkerImage
  // Boats share the Rover class with ground rovers, so they are told apart before classifying.
  if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) return blueboatMarkerImage
  const vehicleClass = getVehicleTypeFromMavType(vehicleType)
  return (vehicleClass && markerImageByVehicleType[vehicleClass]) ?? genericVehicleMarkerImage
}

// Only copters and boats are drawn as a 3D model on the map for now; every other vehicle keeps its picture.
const modelUrlByVehicleType: Partial<Record<VehicleType, string>> = {
  [VehicleType.Copter]: quadcopterModelUrl,
}

/**
 * Resolves the 3D model that represents a vehicle type on the map.
 * @param {MavType | undefined} vehicleType - The vehicle's MAVLink type, or undefined when still unknown.
 * @returns {string | undefined} The URL of the glTF model, or undefined when no model fits the vehicle.
 */
export const vehicleModelUrl = (vehicleType: MavType | undefined): string | undefined => {
  // Boats share the Rover class with ground rovers, which have no model, so they are told apart first.
  if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) return blueBoatModelUrl
  const vehicleClass = vehicleType === undefined ? undefined : getVehicleTypeFromMavType(vehicleType)
  return vehicleClass && modelUrlByVehicleType[vehicleClass]
}

/**
 * Whether a vehicle type flies.
 * @param {MavType | undefined} vehicleType - The vehicle's MAVLink type, or undefined when still unknown.
 * @returns {boolean} True for copters and planes.
 */
export const isAerialVehicle = (vehicleType: MavType | undefined): boolean => {
  const vehicleClass = vehicleType === undefined ? undefined : getVehicleTypeFromMavType(vehicleType)
  return vehicleClass === VehicleType.Copter || vehicleClass === VehicleType.Plane
}

/**
 * Attributes that make the shared `.vehicle-heading-arrow` styles draw a vehicle icon in the chosen appearance.
 * They go on the element holding both the arrow and the vehicle's picture.
 * @param {VehicleIconAppearance} appearance - The icon style and arrow colors chosen by the user.
 * @returns {{ iconStyle: string, cssVariables: Record<string, string> }} The `data-icon-style` value and the CSS
 * custom properties carrying the arrow colors.
 */
export const vehicleIconAttributes = (
  appearance: VehicleIconAppearance
): {
  /** Value for the element's `data-icon-style` attribute. */
  iconStyle: string
  /** CSS custom properties carrying the arrow colors. */
  cssVariables: Record<string, string>
} => ({
  // The 3D model is drawn only where a map attaches one, so anywhere else the style falls back to the picture.
  iconStyle: appearance.style === '3d-model' ? 'picture' : appearance.style,
  cssVariables: {
    '--vehicle-arrow-color': appearance.arrowColor,
    '--vehicle-arrow-outline-color': appearance.arrowOutlineColor,
  },
})
