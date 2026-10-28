/**
 * Fetches a URL, giving up once it has gone unanswered for too long.
 * @param {string} url The URL to fetch
 * @param {number} timeoutMs How long to wait for an answer, in milliseconds
 * @returns {Promise<Response>} The answer, or a rejection whose `name` is `AbortError` once the wait is over
 */
export const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

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

/**
 * Simple scale function
 * @param {number} input Input value
 * @param {number} inputMin Input lowest point
 * @param {number} inputMax Input maximum point
 * @param {number} outputMin Output lowest point
 * @param {number} outputMax Output maximum point
 * @returns {number}
 */
export const scale = (
  input: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number
): number => {
  return ((input - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin
}
