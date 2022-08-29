import type { MAVLinkType } from './mavlink2rest-enum'

// Generic interface to encapsulate multiple MAVLink messages
export type MAVLinkMessageDictionary = Map<MAVLinkType, Message>

/**
 * MAVLink header component from source
 */
export interface Header {
  /**
   * MAVLink source component identification
   */
  component_id: number

  /**
   * MAVLink sequence number of the message [0, 255]
   */
  sequence: number

  /**
   * MAVLink source system identification
   */
  system_id: number
}

/**
 * MAVLink2Rest message definition
 */
export interface Message {
  /**
   * Defines the type of the MAVLink message
   */
  type: MAVLinkType

  /**
   * Allow access of variable members of the MAVLink message
   */
  [key: string]: any // eslint-disable-line
}

/**
 * MAVLink2Rest package abstraction for MAVLink protocol
 */
export interface Package {
  /**
   * Header containing source information
   */
  header: Header

  /**
   * MAVLink message
   */
  message: Message
}

/**
 * Abstract MAVLink2Rest type identification
 */
export interface Type<T> {
  /**
   * Abstract type
   */
  type: T
}

/**
 * Abstract MAVLink2Rest bitflag identification
 */
export interface BitFlag {
  /**
   * Abstract bitflag
   */
  bits: number[]
}
