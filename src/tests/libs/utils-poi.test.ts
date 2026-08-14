import { describe, expect, it } from 'vitest'

import { getPoiTooltipHtml, normalizePoiHeading, poiPinRotation } from '@/libs/utils-poi'
import type { PoiCoordinateSource, ResolvedPointOfInterest } from '@/types/mission'

const buildPoi = (heading: PoiCoordinateSource | null, resolvedHeading: number | null): ResolvedPointOfInterest => ({
  id: 'buoy',
  name: 'Buoy',
  description: '',
  latitude: 1,
  longitude: 2,
  fallbackCoordinates: [1, 2],
  heading,
  coordinates: [1, 2],
  isLiveTracked: false,
  hasValidPosition: true,
  resolvedHeading,
  latitudeVariableId: 'cockpit/pois/buoy/latitude',
  longitudeVariableId: 'cockpit/pois/buoy/longitude',
  icon: 'mdi-anchor',
  color: '#FF0000',
  timestamp: 0,
})

describe('normalizePoiHeading', () => {
  it('keeps headings already inside the 0-360 range', () => {
    expect(normalizePoiHeading(0)).toBe(0)
    expect(normalizePoiHeading(137.5)).toBe(137.5)
  })

  it('wraps headings outside the 0-360 range', () => {
    expect(normalizePoiHeading(-90)).toBe(270)
    expect(normalizePoiHeading(360)).toBe(0)
    expect(normalizePoiHeading(730)).toBe(10)
  })

  it('has no heading for values a data-lake source cannot orient a marker with', () => {
    expect(normalizePoiHeading(undefined)).toBeNull()
    expect(normalizePoiHeading(null)).toBeNull()
    expect(normalizePoiHeading(NaN)).toBeNull()
    expect(normalizePoiHeading(Infinity)).toBeNull()
    expect(normalizePoiHeading('90')).toBeNull()
  })
})

describe('poiPinRotation', () => {
  it('leaves the pin untouched when it already rests pointing at the bearing', () => {
    expect(poiPinRotation(225)).toBe(0)
  })

  it('turns the pin from its resting corner to the requested bearing', () => {
    expect(poiPinRotation(0)).toBe(-225)
    expect(poiPinRotation(270)).toBe(45)
  })
})

describe('getPoiTooltipHtml', () => {
  it('tells a heading that has no value yet apart from no heading at all', () => {
    const poi = buildPoi('{{ mavlink/boat/heading }}', null)
    expect(getPoiTooltipHtml(poi, poi.coordinates)).toContain('Heading: unknown')
  })

  it('shows no heading line for a POI without a heading source', () => {
    const poi = buildPoi(null, null)
    expect(getPoiTooltipHtml(poi, poi.coordinates)).not.toContain('Heading')
  })

  it('shows the resolved heading when there is one', () => {
    const poi = buildPoi('{{ mavlink/boat/heading }}', 90)
    expect(getPoiTooltipHtml(poi, poi.coordinates)).toContain('Heading: 90.0°')
  })

  it('keeps the heading line when the position is unknown as well', () => {
    const poi = { ...buildPoi('{{ mavlink/boat/heading }}', null), isLiveTracked: true, hasValidPosition: false }
    expect(getPoiTooltipHtml(poi, poi.coordinates)).toContain('Heading: unknown')
  })
})
