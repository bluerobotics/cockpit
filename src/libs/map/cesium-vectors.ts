import * as turf from '@turf/turf'
import {
  type Scene,
  ArcType,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Material,
  MaterialAppearance,
  PerInstanceColorAppearance,
  PointPrimitiveCollection,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineCollection,
  Primitive,
} from 'cesium'

import type { MapFeature } from '@/libs/map/cesium-map'
import { type MapLayerSlot, slotHeight } from '@/libs/map/map-slots'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * How a line is drawn, in the terms Leaflet paths used: pixel widths and pixel dash patterns.
 */
export interface LineStyle {
  /** Stroke color. */
  color: string
  /** Stroke width, in pixels. Leaflet's default was 3. */
  width?: number
  /** Stroke opacity. */
  opacity?: number
  /** Dash pattern, in pixels, as Leaflet's `dashArray` took it. */
  dashPattern?: number[]
}

/**
 * Diagonal stripes, for areas that have to read as forbidden (exclusion fences).
 */
export interface StripeFill {
  /** Stripe color. */
  color: string
  /** Stripe opacity. */
  opacity: number
  /** Distance between stripes, in pixels; each stripe is half of it. */
  spacing: number
}

/**
 * How an area is filled.
 */
export interface FillStyle {
  /** Fill color, for a plain fill. */
  color?: string
  /** Fill opacity. */
  opacity?: number
  /** Stripes, instead of a plain fill. */
  stripes?: StripeFill
}

/**
 * How a dot is drawn, in the terms of Leaflet's circle markers.
 */
export interface PointStyle {
  /** Radius, in pixels. */
  radius: number
  /** Fill color. */
  fillColor: string
  /** Fill opacity. */
  fillOpacity?: number
  /** Stroke color. */
  color?: string
  /** Stroke width, in pixels. */
  weight?: number
  /** Stroke opacity. */
  opacity?: number
}

/**
 * A line some composable drew, described well enough for another one to redraw over it in its place.
 */
export interface DrawnLine {
  /** Id of the vector layer drawing the line. */
  layerId: string
  /** The line's current vertices. */
  coordinates: () => WaypointCoordinates[]
  /** How the line is drawn. */
  style: LineStyle
}

/** A line of a vector layer. */
export interface LineFeature {
  /** Feature kind. */
  type: 'line'
  /** The `[latitude, longitude]` vertices. */
  coordinates: WaypointCoordinates[]
  /** How it is drawn. */
  style: LineStyle
  /** Properties reported to layer-scoped event handlers. */
  properties?: Record<string, unknown>
}

/** An area of a vector layer. */
export interface PolygonFeature {
  /** Feature kind. */
  type: 'polygon'
  /** The `[latitude, longitude]` vertices of the outer ring, open or closed. */
  ring: WaypointCoordinates[]
  /** How it is filled. */
  fill: FillStyle
  /** Properties reported to layer-scoped event handlers. */
  properties?: Record<string, unknown>
}

/** A dot of a vector layer. */
export interface PointFeature {
  /** Feature kind. */
  type: 'point'
  /** The `[latitude, longitude]` of the dot. */
  coordinates: WaypointCoordinates
  /** How it is drawn. */
  style: PointStyle
  /** Properties reported to layer-scoped event handlers. */
  properties?: Record<string, unknown>
}

/** One thing a vector layer draws. */
export type VectorFeature = LineFeature | PolygonFeature | PointFeature

/**
 * A line feature.
 * @param {WaypointCoordinates[]} coordinates - The `[latitude, longitude]` vertices.
 * @param {LineStyle} style - How it is drawn.
 * @param {Record<string, unknown>} [properties] - Properties reported to layer-scoped event handlers.
 * @returns {LineFeature} The feature.
 */
export const lineFeature = (
  coordinates: WaypointCoordinates[],
  style: LineStyle,
  properties?: Record<string, unknown>
): LineFeature => ({ type: 'line', coordinates, style, properties })

/**
 * An area feature.
 * @param {WaypointCoordinates[]} ring - The `[latitude, longitude]` vertices of the outer ring.
 * @param {FillStyle} fill - How it is filled.
 * @param {Record<string, unknown>} [properties] - Properties reported to layer-scoped event handlers.
 * @returns {PolygonFeature} The feature.
 */
export const polygonFeature = (
  ring: WaypointCoordinates[],
  fill: FillStyle,
  properties?: Record<string, unknown>
): PolygonFeature => ({ type: 'polygon', ring, fill, properties })

/**
 * A dot feature.
 * @param {WaypointCoordinates} coordinates - The `[latitude, longitude]` of the dot.
 * @param {PointStyle} style - How it is drawn.
 * @param {Record<string, unknown>} [properties] - Properties reported to layer-scoped event handlers.
 * @returns {PointFeature} The feature.
 */
export const pointFeature = (
  coordinates: WaypointCoordinates,
  style: PointStyle,
  properties?: Record<string, unknown>
): PointFeature => ({ type: 'point', coordinates, style, properties })

/**
 * The ring of a circle of a ground radius, which is how circles are drawn.
 * @param {WaypointCoordinates} center - The `[latitude, longitude]` center.
 * @param {number} radiusMeters - The ground radius, in meters.
 * @returns {WaypointCoordinates[]} The closed ring.
 */
export const meterCircleRing = (center: WaypointCoordinates, radiusMeters: number): WaypointCoordinates[] =>
  turf
    .circle([center[1], center[0]], Math.max(radiusMeters, 0.01), { steps: 96, units: 'meters' })
    .geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as WaypointCoordinates)

const defaultLineWidth = 3

/**
 * Cesium's 16-bit dash mask for a Leaflet pixel dash pattern, and the pixel length the mask spans.
 * @param {number[]} pattern - Alternating dash and gap lengths, in pixels.
 * @returns {{ dashLength: number, dashPattern: number }} The mask and its length.
 */
export const dashMask = (
  pattern: number[]
): {
  /** Pixel length of the whole pattern. */ dashLength: number
  /** The 16-bit on/off mask. */ dashPattern: number
} => {
  const lengths = pattern.length % 2 ? [...pattern, ...pattern] : pattern
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let mask = 0
  for (let bit = 0; bit < 16; bit++) {
    let position = ((bit + 0.5) / 16) * total
    let on = true
    for (const length of lengths) {
      if (position < length) break
      position -= length
      on = !on
    }
    // Cesium reads the mask from its most significant bit along the line.
    if (on) mask |= 1 << (15 - bit)
  }
  return { dashLength: total, dashPattern: mask }
}

const cssColor = (color: string, opacity: number): Color => Color.fromCssColorString(color).withAlpha(opacity)

const toCartesian = (coordinates: WaypointCoordinates, height: number): Cartesian3 =>
  Cartesian3.fromDegrees(coordinates[1], coordinates[0], height)

// Lines are drawn just above the areas of their slot, so a polygon's outline stays on its own fill.
const lineLift = 0.5
const pointLift = 1

/**
 * The primitives drawing one vector layer of a map. The map owns these; composables use the map's vector methods.
 */
export class VectorLayer {
  private readonly polylines = new PolylineCollection()
  private readonly points = new PointPrimitiveCollection()
  private polygons: Primitive[] = []
  private features: VectorFeature[] = []
  private opacityFactor = 1
  private stripeZoom: number | undefined

  /**
   * Creates the layer's primitives in a scene.
   * @param {Scene} scene - The map's scene.
   * @param {string} id - The layer id.
   * @param {MapLayerSlot} slot - The stacking slot.
   * @param {number} lift - Extra height within the slot, which stacks the layers of one slot in the order they were
   *   created.
   * @param {(key: object, feature: MapFeature) => void} register - Records what each picked primitive belongs to.
   * @param {() => number} zoom - The map's current zoom, which sizes stripes in pixels.
   * @param {() => number} metersPerPixel - Ground meters per pixel at the map center, for the same purpose.
   */
  constructor(
    private readonly scene: Scene,
    readonly id: string,
    readonly slot: MapLayerSlot,
    readonly lift: number,
    private readonly register: (key: object, feature: MapFeature) => void,
    private readonly zoom: () => number,
    private readonly metersPerPixel: () => number
  ) {
    scene.primitives.add(this.polylines)
    scene.primitives.add(this.points)
  }

  /**
   * Replaces everything the layer draws.
   * @param {VectorFeature[]} features - The features to draw.
   */
  set(features: VectorFeature[]): void {
    this.features = features
    this.redraw()
  }

  /**
   * Fades the whole layer, for dimming it behind something being edited.
   * @param {number} factor - Opacity multiplier, from 0 to 1.
   */
  setOpacityFactor(factor: number): void {
    if (factor === this.opacityFactor) return
    this.opacityFactor = factor
    this.redraw()
  }

  /**
   * Shows or hides the layer.
   * @param {boolean} visible - Whether to show it.
   */
  setVisible(visible: boolean): void {
    this.polylines.show = visible
    this.points.show = visible
    this.polygons.forEach((primitive) => (primitive.show = visible))
  }

  /**
   * Whether the layer is shown.
   * @returns {boolean} True when visible.
   */
  isVisible(): boolean {
    return this.polylines.show
  }

  /**
   * Redraws striped areas when the zoom changed enough for their stripes to drift from their pixel spacing.
   */
  refreshForZoom(): void {
    if (this.stripeZoom === undefined || Math.abs(this.zoom() - this.stripeZoom) < 0.05) return
    this.redraw()
  }

  /**
   * Removes the layer's primitives from the scene.
   */
  destroy(): void {
    this.clearPolygons()
    this.scene.primitives.remove(this.polylines)
    this.scene.primitives.remove(this.points)
  }

  /**
   * Destroys the area primitives.
   */
  private clearPolygons(): void {
    this.polygons.forEach((primitive) => this.scene.primitives.remove(primitive))
    this.polygons = []
  }

  /**
   * Rebuilds the primitives from the current features.
   */
  private redraw(): void {
    const height = slotHeight(this.slot) + this.lift
    const visible = this.isVisible()
    const factor = this.opacityFactor
    this.polylines.removeAll()
    this.points.removeAll()
    this.clearPolygons()
    this.stripeZoom = undefined

    const plainAreas: GeometryInstance[] = []
    this.features.forEach((feature) => {
      const key = { layerId: this.id }
      this.register(key, { layerId: this.id, properties: feature.properties ?? {} })
      if (feature.type === 'line') {
        if (feature.coordinates.length < 2) return
        const { style } = feature
        const color = cssColor(style.color, (style.opacity ?? 1) * factor)
        this.polylines.add({
          id: key,
          positions: feature.coordinates.map((coordinates) => toCartesian(coordinates, height + lineLift)),
          width: style.width ?? defaultLineWidth,
          material: style.dashPattern
            ? Material.fromType('PolylineDash', { color, gapColor: Color.TRANSPARENT, ...dashMask(style.dashPattern) })
            : Material.fromType('Color', { color }),
        })
      } else if (feature.type === 'point') {
        const { style } = feature
        this.points.add({
          id: key,
          position: toCartesian(feature.coordinates, height + pointLift),
          pixelSize: style.radius * 2,
          color: cssColor(style.fillColor, (style.fillOpacity ?? 1) * factor),
          outlineColor: cssColor(style.color ?? style.fillColor, (style.opacity ?? 1) * factor),
          outlineWidth: style.weight ?? 0,
        })
      } else if (feature.ring.length >= 3) {
        const hierarchy = new PolygonHierarchy(feature.ring.map((coordinates) => toCartesian(coordinates, height)))
        if (feature.fill.stripes) {
          this.polygons.push(this.stripedArea(hierarchy, feature.ring, feature.fill, key, height))
          return
        }
        plainAreas.push(
          new GeometryInstance({
            id: key,
            geometry: new PolygonGeometry({
              polygonHierarchy: hierarchy,
              height,
              arcType: ArcType.RHUMB,
              vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: {
              color: ColorGeometryInstanceAttribute.fromColor(
                cssColor(feature.fill.color ?? '#000000', (feature.fill.opacity ?? 1) * factor)
              ),
            },
          })
        )
      }
    })
    if (plainAreas.length) {
      this.polygons.push(
        new Primitive({
          geometryInstances: plainAreas,
          appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
          // Built at once, so an area being dragged never blinks out while it is rebuilt.
          asynchronous: false,
        })
      )
    }
    this.polygons.forEach((primitive) => this.scene.primitives.add(primitive))
    this.setVisible(visible)
    this.scene.requestRender()
  }

  /**
   * An area filled with 45° stripes spaced in screen pixels, as Leaflet's SVG pattern was.
   * @param {PolygonHierarchy} hierarchy - The area's outline.
   * @param {WaypointCoordinates[]} ring - The same outline, as coordinates.
   * @param {FillStyle} fill - The fill, with its stripes.
   * @param {object} key - The pick key of the feature.
   * @param {number} height - The slot height.
   * @returns {Primitive} The striped area.
   */
  private stripedArea(
    hierarchy: PolygonHierarchy,
    ring: WaypointCoordinates[],
    fill: FillStyle,
    key: object,
    height: number
  ): Primitive {
    const stripes = fill.stripes as StripeFill
    // Cesium stretches a material over the area's extent, so the stripe count is what keeps them at a pixel spacing,
    // which is why striped areas are redrawn as the zoom changes.
    this.stripeZoom = this.zoom()
    const lats = ring.map((c) => c[0])
    const lngs = ring.map((c) => c[1])
    const [south, north, west, east] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
    const spanX = turf.distance([west, south], [east, south], { units: 'meters' })
    const spanY = turf.distance([west, south], [west, north], { units: 'meters' })
    // The texture spans the area's extent turned 45°, and Cesium's repeat counts half periods (measured: 12px apart).
    const repeat = Math.max(1, (2 * ((spanX + spanY) / Math.SQRT2)) / (stripes.spacing * this.metersPerPixel()))
    const color = cssColor(stripes.color, stripes.opacity * (fill.opacity ?? 1) * this.opacityFactor)
    return new Primitive({
      geometryInstances: new GeometryInstance({
        id: key,
        geometry: new PolygonGeometry({
          polygonHierarchy: hierarchy,
          height,
          arcType: ArcType.RHUMB,
          stRotation: Math.PI / 4,
          vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        }),
      }),
      appearance: new MaterialAppearance({
        material: Material.fromType('Stripe', {
          evenColor: color,
          oddColor: Color.TRANSPARENT,
          repeat,
          horizontal: false,
        }),
        flat: true,
        translucent: true,
      }),
      asynchronous: false,
    })
  }
}
