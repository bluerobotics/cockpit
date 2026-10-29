import blueboatMarkerImage from '@/assets/blueboat-marker.avif'
import brov2MarkerImage from '@/assets/brov2-marker.avif'
import copterMarkerImage from '@/assets/copter-marker.avif'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.avif'
import planeMarkerImage from '@/assets/plane-marker.avif'
import roverMarkerImage from '@/assets/rover-marker.avif'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

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
