/**
 * The type of a variable in the data lake
 */
export type DataLakeVariableType = 'string' | 'number' | 'boolean'

/**
 * A configuration for a Data Lake variable
 */
export interface DataLakeVariable {
  /**
   * The id of the variable
   */
  id: string
  /**
   * The name of the variable
   */
  name: string
  /**
   * The type of the variable
   */
  type: DataLakeVariableType
  /**
   * What the variable does or means
   */
  description?: string
  /**
   * The unit the value is stored in, as MAVLink states it, so it can be converted for display
   */
  unit?: string
  /**
   * Whether the variable existance should be persisted between boots
   */
  persistent?: boolean
  /**
   * Whether the variable's value should be persisted between boots
   */
  persistValue?: boolean
  /**
   * Whether the user may set the variable's value: by hand from the Data Lake page, and, when the variable is not a
   * compound one, through a joystick mapping or a widget element
   */
  allowUserToChangeValue?: boolean
  /**
   * Whether Cockpit created the variable, rather than the user. Cockpit creates almost every variable there is, so
   * this is assumed when absent, and the few places that create one on the user's behalf set it to false
   */
  systemOwned?: boolean
}

/**
 * Internal structure for storing listener information
 */
export interface DataLakeVariableListener {
  /**
   * The callback to be called when the variable changes
   */
  callback: (value: string | number | boolean) => void
  /**
   * Whether to notify the listener when the timestamp changes
   */
  notifyOnTimestampChange: boolean
}

/**
 * Options for listening to data lake variable changes
 */
export interface ListenDataLakeVariableOptions {
  /**
   * If true, notify when timestamp changes even if value stays the same.
   * By default, listeners are only notified when the value changes.
   */
  notifyOnTimestampChange?: boolean
}
