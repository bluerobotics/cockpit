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
   * Whether the variable existance should be persisted between boots
   */
  persistent?: boolean
  /**
   * Whether the variable's value should be persisted between boots
   */
  persistValue?: boolean
  /**
   * Whether the variable's value should be allowed to be changed by the user
   */
  allowUserToChangeValue?: boolean
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
