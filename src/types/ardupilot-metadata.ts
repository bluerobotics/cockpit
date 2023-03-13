// Parameter metadata as in the JSON files
/**
 *
 */
export interface Metadata {
  /**
   *
   */
  Description?: string
  /**
   *
   */
  DisplayName: string
  /**
   *
   */
  Increment?: string
  /**
   *
   */
  Range?: {
    /**
     *
     */
    high: string
    /**
     *
     */
    low: string
  }
  /**
   *
   */
  RebootRequired?: string
  /**
   *
   */
  ReadOnly?: string
  /**
   *
   */
  Bitmask?: { [key: number]: string }
  /**
   *
   */
  Values?: { [key: number]: string }
  /**
   *
   */
  User?: string
  /**
   *
   */
  Units?: string
}

/**
 *
 */
export interface MetadataCategory {
  [key: string]: Metadata | number // number deals with a sneaky {"json": 0} entry
}
/**
 *
 */
export interface MetadataFile {
  [key: string]: MetadataCategory
}
