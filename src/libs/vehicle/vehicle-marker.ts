import copterMarkerImage from '@/assets/arducopter-top-view.avif'
import blueboatMarkerImage from '@/assets/blueboat-marker.avif'
import brov2MarkerImage from '@/assets/brov2-marker.avif'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.avif'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

const copterTypes: MavType[] = [
  MavType.MAV_TYPE_QUADROTOR,
  MavType.MAV_TYPE_HEXAROTOR,
  MavType.MAV_TYPE_OCTOROTOR,
  MavType.MAV_TYPE_TRICOPTER,
  MavType.MAV_TYPE_DODECAROTOR,
]

/**
 * Resolves the top-view marker image that best represents a vehicle type, falling back to a generic marker.
 * @param {MavType | undefined} vehicleType - The vehicle's MAVLink type, or undefined when still unknown.
 * @returns {string} The URL of the marker image to display.
 */
export const vehicleMarkerImageUrl = (vehicleType: MavType | undefined): string => {
  if (vehicleType === undefined) return genericVehicleMarkerImage
  if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) return blueboatMarkerImage
  if (vehicleType === MavType.MAV_TYPE_SUBMARINE) return brov2MarkerImage
  if (copterTypes.includes(vehicleType)) return copterMarkerImage
  return genericVehicleMarkerImage
}
