/**
 * What kind of craft a traffic contact is, which decides how it is identified, drawn and forgotten
 */
export type TrafficKind = 'aircraft' | 'vessel'

/**
 * One aircraft or vessel as last reported, in the units the map draws
 */
export interface TrafficContact {
  /**
   * Whether the contact is an aircraft or a vessel
   */
  kind: TrafficKind
  /**
   * The contact's own identifier: the ICAO 24-bit address in hex for aircraft, the MMSI for vessels
   */
  key: string
  /**
   * Vessel name or aircraft registration, when broadcast
   */
  name?: string
  /**
   * Radio callsign or flight number, when broadcast
   */
  callsign?: string
  /**
   * Latitude, in degrees
   */
  latitude: number
  /**
   * Longitude, in degrees
   */
  longitude: number
  /**
   * Course over ground, in degrees from true north, when broadcast
   */
  courseDeg?: number
  /**
   * True heading, in degrees, when broadcast
   */
  headingDeg?: number
  /**
   * Speed over ground, in meters per second, when broadcast
   */
  speedMps?: number
  /**
   * Altitude above mean sea level, in meters, for aircraft that broadcast one
   */
  altitudeMeters?: number
  /**
   * Epoch milliseconds the contact was last heard from, which predates the report by its stated age
   */
  lastHeardAtMs: number
}

/**
 * The area to look for aircraft in, as the adsb.lol point query takes it
 */
export interface AdsbAircraftQuery {
  /**
   * Latitude of the center of the search, in degrees
   */
  latitude: number
  /**
   * Longitude of the center of the search, in degrees
   */
  longitude: number
  /**
   * Radius to search within, in nautical miles
   */
  radiusNauticalMiles: number
}

/**
 * One aircraft as adsb.lol reports it, holding only the fields Cockpit reads
 */
export interface AdsbLolAircraft {
  /**
   * ICAO 24-bit address, in lowercase hex
   */
  hex?: string
  /**
   * Flight number or callsign, padded with spaces
   */
  flight?: string
  /**
   * Registration
   */
  r?: string
  /**
   * Latitude, in degrees
   */
  lat?: number
  /**
   * Longitude, in degrees
   */
  lon?: number
  /**
   * Barometric altitude in feet, or the string `ground` for an aircraft on the ground
   */
  alt_baro?: number | string
  /**
   * Geometric altitude, in feet
   */
  alt_geom?: number
  /**
   * Ground speed, in knots
   */
  gs?: number
  /**
   * Track over ground, in degrees from true north
   */
  track?: number
  /**
   * True heading, in degrees
   */
  true_heading?: number
  /**
   * Seconds since the aircraft was last heard from
   */
  seen?: number
}

/**
 * The area to stream vessels from, and the key to stream it with, as aisstream.io takes them
 */
export interface AisStreamRequest {
  /**
   * The user's own aisstream.io API key
   */
  apiKey: string
  /**
   * Southern edge of the area, in degrees
   */
  south: number
  /**
   * Western edge of the area, in degrees
   */
  west: number
  /**
   * Northern edge of the area, in degrees
   */
  north: number
  /**
   * Eastern edge of the area, in degrees
   */
  east: number
}

/**
 * One report as aisstream.io sends it, holding only the fields Cockpit reads
 */
export interface AisStreamReport {
  /**
   * Which report this is, such as `PositionReport` or `ShipStaticData`
   */
  MessageType?: string
  /**
   * The envelope aisstream.io adds to every report, which always names the vessel and where it is
   */
  MetaData?: {
    /**
     * Maritime Mobile Service Identity of the vessel
     */
    MMSI?: number
    /**
     * Vessel name, padded with `@`
     */
    ShipName?: string
    /**
     * Latitude, in degrees
     */
    latitude?: number
    /**
     * Longitude, in degrees
     */
    longitude?: number
  }
  /**
   * The report itself, keyed by its type
   */
  Message?: {
    /**
     * A vessel's position, course, heading and speed
     */
    PositionReport?: {
      /**
       * Course over ground in degrees, 360 when unavailable
       */
      Cog?: number
      /**
       * Speed over ground in knots, 102.3 when unavailable
       */
      Sog?: number
      /**
       * True heading in degrees, 511 when unavailable
       */
      TrueHeading?: number
    }
    /**
     * A vessel's identity, which position reports do not carry
     */
    ShipStaticData?: {
      /**
       * Radio callsign
       */
      CallSign?: string
      /**
       * Vessel name
       */
      Name?: string
    }
  }
}
