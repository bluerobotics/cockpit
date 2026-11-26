import { t } from 'ttag'

export const bytesPerMiB = 1024 * 1024

/**
 * Default budget for all meshes together, unless this computer overrides it: 218 MiB, which holds 16 production
 * rolling-history Ping360 meshes as ping-viewer maps them (r8 strips of its 1200 samples, 11264 slots each, 14,283,776
 * bytes each). 16 is policy, not a measured memory guarantee.
 */
export const defaultMapMeshBudgetBytes = 218 * bytesPerMiB

/**
 * Parses the stored budget: only a positive whole number of bytes is accepted
 * @param {string | null} stored - The stored budget, null when none is
 * @returns {number} The bytes, or {@link defaultMapMeshBudgetBytes} for anything else
 */
export const mapMeshBudgetBytes = (stored: string | null): number => {
  const bytes = stored !== null && /^[1-9]\d*$/.test(stored) ? Number(stored) : NaN
  return Number.isSafeInteger(bytes) ? bytes : defaultMapMeshBudgetBytes
}

const maxMapMeshBudgetMiB = Math.floor(Number.MAX_SAFE_INTEGER / bytesPerMiB)
// Plain decimals only, so a string such as '1e3' or '0x10' is not read as some other number of MiB.
const plainDecimal = /^\s*-?\d+(\.\d+)?\s*$/

/**
 * Converts a budget typed in whole MiB into the bytes it is stored as
 * @param {number | string} mib - The budget in MiB, as typed
 * @returns {number | string} The bytes, or why the value cannot be a budget
 */
export const mapMeshBudgetFromMiB = (mib: number | string): number | string => {
  const value = typeof mib === 'number' || plainDecimal.test(String(mib)) ? Number(mib) : NaN
  if (!Number.isInteger(value)) return t`Must be a whole number of MiB.`
  if (value <= 0) return t`Must be more than zero.`
  return value <= maxMapMeshBudgetMiB ? value * bytesPerMiB : t`Must be at most ${maxMapMeshBudgetMiB} MiB.`
}

/**
 * Error for a mesh definition that would push the total reserved by all meshes past the budget
 */
export class MapMeshBudgetError extends Error {
  readonly code = 'budget' as const

  /**
   * @param {string} id - Id of the refused mesh
   * @param {number} usedBytes - Bytes all meshes reserve now, the refused one's current definition included
   * @param {number} previousBytes - Bytes the mesh's current definition reserves, 0 if it is new
   * @param {number} requestedBytes - Bytes the mesh would reserve for its full capacity
   * @param {number} budgetBytes - Most bytes all meshes together can reserve
   */
  constructor(
    id: string,
    readonly usedBytes: number,
    readonly previousBytes: number,
    readonly requestedBytes: number,
    readonly budgetBytes: number
  ) {
    super(
      `Mesh '${id}' needs ${requestedBytes} bytes for its full capacity (it reserves ${previousBytes} now), but all ` +
        `meshes already reserve ${usedBytes} of the ${budgetBytes} bytes this computer allows.`
    )
    this.name = 'MapMeshBudgetError'
  }
}
