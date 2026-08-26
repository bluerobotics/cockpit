import L, { type Map as LeafletMap } from 'leaflet'
import { onBeforeUnmount } from 'vue'

/** A label placed at the midpoint of a segment on the map. */
export interface MeasurePill {
  /** Where the segment starts. */
  from: L.LatLng
  /** Where the segment ends. */
  to: L.LatLng
  /** What the label reads, or null to leave this pill out. */
  text: string | null
}

/** Return type of {@link useMeasurePillOverlay}. */
export interface UseMeasurePillOverlayReturn {
  /** Binds the overlay to a Leaflet map. */
  initMeasurePillOverlay: (map: LeafletMap) => void
  /** Draws one label per pill, centered on its segment in container pixels. */
  renderMeasurePills: (pills: MeasurePill[]) => void
  /** Removes the overlay and every label in it. */
  destroyMeasurePillOverlay: () => void
}

/**
 * Owns the pill overlay every live measurement writes into: the container pinned over the map, the pool of label
 * elements, and their placement at segment midpoints. Callers only decide which segments to label and what the
 * labels read.
 * @returns {UseMeasurePillOverlayReturn} Methods to bind the overlay, render labels, and tear it down.
 */
export const useMeasurePillOverlay = (): UseMeasurePillOverlayReturn => {
  let mapRef: LeafletMap | undefined
  let overlayEl: HTMLDivElement | null = null
  let pillEls: HTMLDivElement[] = []

  const initMeasurePillOverlay = (map: LeafletMap): void => {
    mapRef = map
  }

  const ensureOverlay = (map: LeafletMap): void => {
    if (overlayEl) return

    overlayEl = document.createElement('div')
    overlayEl.className = 'measure-overlay'
    overlayEl.style.pointerEvents = 'none'
    overlayEl.style.position = 'absolute'
    overlayEl.style.inset = '0'
    overlayEl.style.zIndex = '640'
    map.getContainer().appendChild(overlayEl)
  }

  const renderMeasurePills = (pills: MeasurePill[]): void => {
    if (!mapRef) return
    const map = mapRef
    ensureOverlay(map)

    while (pillEls.length < pills.length) {
      const el = document.createElement('div')
      el.className = 'live-measure-pill'
      el.style.position = 'absolute'
      el.style.transform = 'translate(-50%, -50%)'
      overlayEl!.appendChild(el)
      pillEls.push(el)
    }

    pillEls.forEach((el, index) => {
      const pill = pills[index]
      if (!pill?.text) {
        el.style.display = 'none'
        return
      }

      const from = map.latLngToContainerPoint(pill.from)
      const to = map.latLngToContainerPoint(pill.to)
      el.textContent = pill.text
      el.style.left = `${(from.x + to.x) / 2}px`
      el.style.top = `${(from.y + to.y) / 2}px`
      el.style.display = 'block'
    })
  }

  const destroyMeasurePillOverlay = (): void => {
    overlayEl?.remove()
    overlayEl = null
    pillEls = []
  }

  onBeforeUnmount(destroyMeasurePillOverlay)

  return { initMeasurePillOverlay, renderMeasurePills, destroyMeasurePillOverlay }
}
