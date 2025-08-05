import { DataLakeVariableType } from '@/libs/actions/data-lake'

/**
 * Keys that identify different instances of devices in MAVLink messages
 */
const mavlinkIdentificationKeys = [
  'cam_idx',
  'camera_id',
  'compass_id',
  'gcs_system_id',
  'gimbal_device_id',
  'gps_id',
  'hw_unique_id',
  'id',
  'idx',
  'rtk_receiver_id',
  'sensor_id',
  'storage_id',
  'stream_id',
  'uas_id',
]

/**
 * Creates the appropriate path prefix based on identification keys
 * @param {string} messageName The MAVLink message type name
 * @param {Record<string, unknown>} data The message data
 * @returns {string} The path prefix with instance ID if found, otherwise just the message name
 */
function getMessagePathWithId(messageName: string, data: Record<string, unknown>): string {
  const instanceId = Object.entries(data).find(([key, value]) => {
    return mavlinkIdentificationKeys.includes(key) && (typeof value === 'string' || typeof value === 'number')
  })

  return instanceId ? `${messageName}/${instanceId[0]}=${instanceId[1]}` : messageName
}

/**
 * Result of flattening a data structure
 */
export type FlattenedPair = {
  /**
   * Full path to the data, including message type and field name
   * e.g. "ATTITUDE/roll" or "NAMED_VALUE_FLOAT/GpsHDOP"
   */
  path: string
  /**
   * The actual value of the field after flattening
   * - Primitive values are kept as-is
   * - String arrays are joined
   * - Number arrays create multiple entries
   */
  value: string | number | boolean
  /**
   * The type of the flattened value
   * Used to create the appropriate DataLakeVariable
   */
  type: DataLakeVariableType
}

/**
 * Type guard to check if a value is an array of numbers
 * @param {unknown[]} data The data to check
 * @returns {data is number[]} True if the array contains numbers
 */
function isNumberArray(data: unknown[]): data is number[] {
  return typeof data[0] === 'number'
}

/**
 * Type guard to check if a value is an array of strings
 * @param {unknown[]} data The data to check
 * @returns {data is string[]} True if the array contains strings
 */
function isStringArray(data: unknown[]): data is string[] {
  return typeof data[0] === 'string'
}

/**
 * Flattens complex data structures into simple types that can be stored in the data lake
 * @param {Record<string, unknown>} data The data to flatten
 * @returns {FlattenedPair[]} Array of flattened path/value pairs
 */
export function flattenData(data: Record<string, unknown>): FlattenedPair[] {
  if (!('type' in data)) return []
  const messageName = data.type as string
  const messagePathWithId = getMessagePathWithId(messageName, data)

  // Special handling for NAMED_VALUE_FLOAT messages
  if (messageName === 'NAMED_VALUE_FLOAT') {
    const name = (data.name as string[]).join('').replace(/\0/g, '')
    return [
      {
        path: `${messagePathWithId}/${name}`,
        type: 'number',
        value: data.value as number,
      },
      ...Object.entries(data)
        .filter(([key]) => !['name', 'value', 'type'].includes(key))
        .map(([key, value]) => ({
          path: `${messagePathWithId}/${key}`,
          type: typeof value as 'string' | 'number' | 'boolean',
          value: value as string | number | boolean,
        })),
    ]
  }

  // For all other messages
  return Object.entries(data)
    .filter(([key]) => key !== 'type')
    .flatMap(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return [
          {
            path: `${messagePathWithId}/${key}`,
            type: typeof value as 'string' | 'number' | 'boolean',
            value,
          },
        ]
      }
      if (typeof value === 'object' && value !== null && 'bits' in value) {
        return [
          {
            path: `${messagePathWithId}/${key}`,
            type: typeof (value as any).bits as 'number',
            value: (value as any).bits,
          },
        ]
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return []
        if (isNumberArray(value)) {
          return value.map((item, index) => ({
            path: `${messagePathWithId}/${key}/${index}`,
            type: 'number',
            value: item,
          }))
        }
        if (isStringArray(value)) {
          return [
            {
              path: `${messagePathWithId}/${key}`,
              type: 'string',
              value: value.join(''),
            },
          ]
        }
      }
      return []
    })
}
