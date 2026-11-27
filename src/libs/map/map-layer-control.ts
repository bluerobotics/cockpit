import L, { type Layer, type Map as LeafletMap } from 'leaflet'

/**
 * One entry of the map layer selector, as the selector UI shows it.
 */
export interface MapLayerOption {
  /**
   * Leaflet's stamp of the layer, stable for the layer's lifetime.
   */
  id: number
  /**
   * Label shown in the selector.
   */
  name: string
  /**
   * Whether the layer is a toggleable overlay rather than one of the mutually exclusive base maps.
   */
  overlay: boolean
  /**
   * Whether the layer is currently drawn on the map.
   */
  active: boolean
}

/**
 * Registry of a map's selectable base maps and overlays, standing in for Leaflet's layers control so the selector can
 * be drawn by a Vue component.
 */
export interface MapLayerControl {
  /**
   * Lists the layer as a base map.
   */
  addBaseLayer: (layer: Layer, name: string) => void
  /**
   * Lists the layer as an overlay.
   */
  addOverlay: (layer: Layer, name: string) => void
  /**
   * Stops listing the layer, without removing it from the map.
   */
  removeLayer: (layer: Layer) => void
  /**
   * Snapshot of the listed layers, base maps first, each in the order it was listed.
   */
  options: () => MapLayerOption[]
  /**
   * Applies an operator's pick: switches to a base map, or toggles an overlay.
   */
  select: (id: number) => void
  /**
   * Calls the listener whenever a layer is listed or unlisted, until the returned function is called.
   */
  onChange: (listener: () => void) => () => void
}

/**
 * A layer as the registry keeps it.
 */
interface ListedLayer {
  /**
   * The Leaflet layer itself.
   */
  layer: Layer
  /**
   * Label shown in the selector.
   */
  name: string
  /**
   * Whether the layer is an overlay rather than a base map.
   */
  overlay: boolean
}

/**
 * Creates the layer registry for one map.
 * @param {() => LeafletMap | undefined} getMap - Resolves the map the layers are drawn on, once it exists.
 * @param {Record<string, Layer>} baseMaps - Base maps listed from the start.
 * @param {Record<string, Layer>} overlays - Overlays listed from the start.
 * @returns {MapLayerControl} The registry.
 */
export const createMapLayerControl = (
  getMap: () => LeafletMap | undefined,
  baseMaps: Record<string, Layer>,
  overlays: Record<string, Layer>
): MapLayerControl => {
  let listed: ListedLayer[] = []
  let lastZIndex = 0
  const listeners = new Set<() => void>()
  const notify = (): void => listeners.forEach((listener) => listener())

  const add = (layer: Layer, name: string, overlay: boolean): void => {
    listed.push({ layer, name, overlay })
    notify()
    // Leaflet's control stacked layers in listing order, which keeps overlays above a base map picked after them.
    if ('setZIndex' in layer && typeof layer.setZIndex === 'function') layer.setZIndex(++lastZIndex)
  }

  Object.entries(baseMaps).forEach(([name, layer]) => add(layer, name, false))
  Object.entries(overlays).forEach(([name, layer]) => add(layer, name, true))

  const options = (): MapLayerOption[] => {
    const map = getMap()
    return [...listed]
      .sort((a, b) => Number(a.overlay) - Number(b.overlay))
      .map(({ layer, name, overlay }) => ({ id: L.stamp(layer), name, overlay, active: !!map?.hasLayer(layer) }))
  }

  // Fires the same map events Leaflet's control did, and only for picks made through the selector.
  const select = (id: number): void => {
    const map = getMap()
    const entry = listed.find(({ layer }) => L.stamp(layer) === id)
    if (!map || !entry) return
    const event = { layer: entry.layer, name: entry.name }

    if (entry.overlay) {
      const adding = !map.hasLayer(entry.layer)
      if (adding) map.addLayer(entry.layer)
      else map.removeLayer(entry.layer)
      map.fire(adding ? 'overlayadd' : 'overlayremove', event)
      return
    }

    if (map.hasLayer(entry.layer)) return
    listed.forEach(({ layer, overlay }) => !overlay && map.hasLayer(layer) && map.removeLayer(layer))
    map.addLayer(entry.layer)
    map.fire('baselayerchange', event)
  }

  return {
    addBaseLayer: (layer, name) => add(layer, name, false),
    addOverlay: (layer, name) => add(layer, name, true),
    removeLayer: (layer) => {
      listed = listed.filter((entry) => entry.layer !== layer)
      notify()
    },
    options,
    select,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
