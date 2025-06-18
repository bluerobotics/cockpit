import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { findDataLakeInputsInString, replaceDataLakeInputsInString } from '@/libs/utils-data-lake'
import type { PointOfInterest, PointOfInterestCoordinates } from '@/types/mission'

/**
 * Checks if a coordinate expression contains data-lake syntax (e.g., "{{ mavlink/buoy/latitude }}")
 * @param expression The expression to check
 * @returns True if the expression contains data-lake syntax
 */
export const isDataLakeExpression = (expression: string | number): boolean => {
  if (typeof expression !== 'string') return false
  return findDataLakeInputsInString(expression).length > 0
}

/**
 * Evaluates a coordinate expression, either returning the static value or evaluating data-lake syntax
 * @param expression The expression to evaluate (number or data-lake string)
 * @returns The evaluated coordinate value or undefined if evaluation fails
 */
export const evaluateCoordinateExpression = (expression: string | number): number | undefined => {
  if (typeof expression === 'number') return expression
  if (typeof expression !== 'string') return undefined

  // Check if it's a data-lake expression
  if (isDataLakeExpression(expression)) {
    try {
      const evaluated = replaceDataLakeInputsInString(expression)
      const numValue = parseFloat(evaluated)
      return isNaN(numValue) ? undefined : numValue
    } catch (error) {
      console.warn(`Failed to evaluate coordinate expression: ${expression}`, error)
      return undefined
    }
  }

  // Try to parse as a static number
  const numValue = parseFloat(expression)
  return isNaN(numValue) ? undefined : numValue
}

/**
 * Updates a POI's coordinates based on its expressions
 * @param poi The POI to update
 * @returns Updated POI with current coordinates and status
 */
export const updateDynamicPoiCoordinates = (poi: PointOfInterest): PointOfInterest => {
  const updatedPoi = { ...poi }

  // Check if this POI uses dynamic coordinates
  const hasLatExpression = poi.latitudeExpression !== undefined
  const hasLngExpression = poi.longitudeExpression !== undefined
  const isDynamic = hasLatExpression || hasLngExpression

  updatedPoi.isDynamic = isDynamic

  if (!isDynamic) {
    // Static POI - ensure hasValidPosition is true
    updatedPoi.hasValidPosition = true
    return updatedPoi
  }

  // Dynamic POI - evaluate expressions
  let newLat: number | undefined
  let newLng: number | undefined

  if (hasLatExpression) {
    newLat = evaluateCoordinateExpression(poi.latitudeExpression!)
  } else {
    // Use current static latitude
    newLat = poi.coordinates[0]
  }

  if (hasLngExpression) {
    newLng = evaluateCoordinateExpression(poi.longitudeExpression!)
  } else {
    // Use current static longitude
    newLng = poi.coordinates[1]
  }

  // Check if we got valid coordinates
  const hasValidCoords = newLat !== undefined && newLng !== undefined

  if (hasValidCoords) {
    // Update current coordinates and last known position
    updatedPoi.coordinates = [newLat!, newLng!]
    updatedPoi.lastKnownCoordinates = [newLat!, newLng!]
    updatedPoi.hasValidPosition = true
  } else {
    // Use last known coordinates if available
    if (updatedPoi.lastKnownCoordinates) {
      updatedPoi.coordinates = updatedPoi.lastKnownCoordinates
    }
    updatedPoi.hasValidPosition = false
  }

  return updatedPoi
}

/**
 * Checks if a POI needs dynamic coordinate updates
 * @param poi The POI to check
 * @returns True if the POI has dynamic expressions
 */
export const isDynamicPoi = (poi: PointOfInterest): boolean => {
  return Boolean(poi.latitudeExpression || poi.longitudeExpression)
}

/**
 * Gets the display status text for a POI
 * @param poi The POI to get status for
 * @returns Status text to display in tooltip
 */
export const getPoiStatusText = (poi: PointOfInterest): string => {
  if (!poi.isDynamic) return ''

  if (poi.hasValidPosition) {
    return 'Live tracking'
  } else {
    return 'No position data - showing last known location'
  }
}

/**
 * Gets the appropriate color for a POI marker based on its status
 * @param poi The POI to get color for
 * @param originalColor The original POI color
 * @returns Color to use for the marker
 */
export const getPoiMarkerColor = (poi: PointOfInterest, originalColor: string): string => {
  if (!poi.isDynamic) return originalColor

  if (poi.hasValidPosition) {
    return originalColor
  } else {
    // Return a grayed-out version for POIs without valid position
    return '#808080'
  }
}