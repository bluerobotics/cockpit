/**
 * Convert a decimal number to a hexadecimal string
 * @param {number} decimal The decimal number to convert
 * @returns {string} The hexadecimal string
 */
export const decimalToHex = (decimal: number): string => {
  return decimal.toString(16).padStart(4, '0')
}

/**
 * Convert a hexadecimal string to a decimal number
 * @param {string} hex The hexadecimal string to convert
 * @returns {number} The decimal number
 */
export const hexToDecimal = (hex: string): number => {
  return parseInt(hex, 16)
}
