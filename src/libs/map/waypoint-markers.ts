import * as L from 'leaflet'

import type { IconDimensions, MarkerSizes } from '@/types/mission'

/**
 * Size bucket to render waypoint markers at for a given zoom level.
 * @param {number} zoomLevel - The current map zoom level.
 * @returns {MarkerSizes} The bucket the markers should be drawn with.
 */
export const getMarkerSizeFromZoom = (zoomLevel: number): MarkerSizes => {
  if (zoomLevel <= 17) return 'xs'
  if (zoomLevel <= 19) return 'sm'
  return 'md'
}

/**
 * Leaflet icon dimensions matching a marker size bucket.
 * @param {MarkerSizes} size - The marker size bucket.
 * @returns {IconDimensions} The icon size and anchor, in pixels.
 */
export const getIconDimensionsFromMarkerSize = (size: MarkerSizes): IconDimensions => {
  if (size === 'xs') {
    return { iconSize: [6, 6], iconAnchor: [3, 3] }
  }
  if (size === 'sm') {
    return { iconSize: [12, 12], iconAnchor: [6, 6] }
  }
  return { iconSize: [26, 26], iconAnchor: [13, 13] } // md size
}

/**
 * How a waypoint's number tooltip should be rendered.
 */
export interface WaypointNumberTooltipOptions {
  /**
   * The already-formatted number to display.
   */
  label: string
  /**
   * Marker size bucket the tooltip has to match.
   */
  size: MarkerSizes
  /**
   * Class for the centered tooltip used when the number fits inside the marker.
   */
  permanentClassName: string
  /**
   * Class for the compact tooltip shown above markers too small to hold the number.
   */
  compactClassName: string
  /**
   * Keeps the compact tooltip open without hovering.
   */
  pinned?: boolean
  /**
   * Binds no tooltip, for markers that already render their number inside the icon.
   */
  suppressed?: boolean
}

const openTooltipOnHover = (event: L.LeafletEvent): void => {
  const marker = event.target as L.Marker
  marker.openTooltip()
}

const closeTooltipOnHover = (event: L.LeafletEvent): void => {
  const marker = event.target as L.Marker
  marker.closeTooltip()
}

const unbindWaypointTooltip = (marker: L.Marker): void => {
  marker.off('mouseover', openTooltipOnHover)
  marker.off('mouseout', closeTooltipOnHover)
  marker.unbindTooltip()
}

/**
 * Binds the tooltip carrying a waypoint's number, picking the centered always-open form when the
 * number fits inside the marker and the compact hover form when it does not. Reuses the tooltip
 * already bound whenever only its text changed, since rebinding replaces the tooltip DOM element.
 * @param {L.Marker} marker - The waypoint marker to bind onto.
 * @param {WaypointNumberTooltipOptions} options - How the tooltip should be rendered.
 * @returns {void}
 */
export const bindWaypointNumberTooltip = (marker: L.Marker, options: WaypointNumberTooltipOptions): void => {
  if (options.suppressed) {
    unbindWaypointTooltip(marker)
    return
  }

  const isCompact = options.size !== 'md'
  const permanent = !isCompact || Boolean(options.pinned)
  const className = isCompact ? options.compactClassName : options.permanentClassName

  const bound = marker.getTooltip()
  if (bound?.options.className === className && bound.options.permanent === permanent) {
    if (bound.getContent() !== options.label) bound.setContent(options.label)
    return
  }

  unbindWaypointTooltip(marker)
  marker.bindTooltip(
    L.tooltip({
      content: options.label,
      permanent,
      direction: isCompact ? 'top' : 'center',
      className,
      opacity: 1,
      interactive: false,
    })
  )

  if (permanent) {
    marker.openTooltip()
    return
  }

  marker.on('mouseover', openTooltipOnHover)
  marker.on('mouseout', closeTooltipOnHover)
}
