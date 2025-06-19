import { DataLakeVariableType } from '@/libs/actions/data-lake'

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

  // Special handling for NAMED_VALUE_FLOAT messages
  if (messageName === 'NAMED_VALUE_FLOAT') {
    const name = (data.name as string[]).join('').replace(/\0/g, '')
    return [
      {
        path: `${messageName}/${name}`,
        type: 'number',
        value: data.value as number,
      },
      ...Object.entries(data)
        .filter(([key]) => !['name', 'value', 'type'].includes(key))
        .map(([key, value]) => ({
          path: `${messageName}/${key}`,
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
            path: `${messageName}/${key}`,
            type: typeof value as 'string' | 'number' | 'boolean',
            value,
          },
        ]
      }
      if (typeof value === 'object' && value !== null && 'bits' in value) {
        return [
          {
            path: `${messageName}/${key}`,
            type: typeof (value as any).bits as 'number',
            value: (value as any).bits,
          },
        ]
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return []
        if (isNumberArray(value)) {
          return value.map((item, index) => ({
            path: `${messageName}/${key}/${index}`,
            type: 'number',
            value: item,
          }))
        }
        if (isStringArray(value)) {
          return [
            {
              path: `${messageName}/${key}`,
              type: 'string',
              value: value.join(''),
            },
          ]
        }
      }
      return []
    })
}
