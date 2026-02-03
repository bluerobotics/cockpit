import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

/**
 * Custom action types
 */
export enum customActionTypes {
  httpRequest = 'http-request',
  mavlinkMessage = 'mavlink-message',
  javascript = 'javascript',
}

/**
 * Custom action types names
 */
export const customActionTypesNames: Record<customActionTypes, string> = {
  [customActionTypes.httpRequest]: 'HTTP Request',
  [customActionTypes.mavlinkMessage]: 'MAVLink Message',
  [customActionTypes.javascript]: 'JavaScript',
}

/**
 * The types of HTTP methods that can be used.
 */
export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

/**
 * Configuration for an HTTP request action
 */
export type HttpRequestActionConfig = {
  /**
   * The name of the action.
   */
  name: string
  /**
   * The URL to send the request to.
   */
  url: string
  /**
   * The HTTP method to use.
   */
  method: HttpRequestMethod
  /**
   * The headers to send with the request.
   */
  headers: Record<string, string>
  /**
   * The URL parameters to send with the request.
   */
  urlParams: Record<string, string>
  /**
   * The body of the request.
   */
  body: string
}

/**
 * Enum with the possible message field types
 */
export enum MessageFieldType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  TYPE_STRUCT_ENUM = 'type_struct_enum',
}

/**
 * Configuration for a single MAVLink message field
 */
export type MavlinkMessageConfigField = {
  /**
   * The type of the field
   * Determines how the value is processed
   */
  type: MessageFieldType
  /**
   * The value of the field
   */
  value: any
}

/**
 * Configuration for a MAVLink message
 */
export type MavlinkMessageConfig = Record<string, MavlinkMessageConfigField> | string

/**
 * Configuration for a MAVLink message action
 */
export type MavlinkMessageActionConfig = {
  /**
   * The name of the action
   */
  name: string
  /**
   * The type of MAVLink message to send
   */
  messageType: MAVLinkType
  /**
   * The key-value pairs of the message fields
   */
  messageConfig: MavlinkMessageConfig
}

/**
 * Configuration for a JavaScript action
 */
export type JavascriptActionConfig = {
  /**
   * The name of the action
   */
  name: string
  /**
   * The JavaScript code to execute
   */
  code: string
}

/**
 * Represents the configuration of a custom action
 */
export interface ActionConfig {
  /**
   * Action ID
   */
  id: string
  /**
   * Action name
   */
  name: string
  /**
   * Action type
   */
  type: customActionTypes
  /**
   * Action configuration
   * Specific to the action type
   */
  config: HttpRequestActionConfig | MavlinkMessageActionConfig | JavascriptActionConfig
  /**
   * Version of the Action
   */
  version?: string
}
