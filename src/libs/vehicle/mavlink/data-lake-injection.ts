import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'

import { flattenData } from '../common/data-flattener'

const setVariable = (id: string, name: string, value: string | number): void => {
  if (getDataLakeVariableInfo(id) === undefined) {
    createDataLakeVariable({ id, name, type: typeof value === 'string' ? 'string' : 'number' })
  }
  setDataLakeVariableData(id, value)
}

/**
 * Inject variable(s) from a MAVLink package into the DataLake, under
 * `/mavlink/<system id>/<component id>/<message>/<field>`.
 * @param {Package} mavlinkPackage The package to take the variables from
 * @param {number} [legacyVariablesSystemId] System that also gets the legacy, unprefixed variable names (e.g.
 * 'ATTITUDE/roll'), for its component 1 only. Omit to create the prefixed variables alone.
 * @returns {void}
 */
export const injectMavlinkPackageIntoDataLake = (mavlinkPackage: Package, legacyVariablesSystemId?: number): void => {
  const messageType = mavlinkPackage.message.type
  const { system_id: messageSystemId, component_id: messageComponentId } = mavlinkPackage.header
  const prefix = `/mavlink/${messageSystemId}/${messageComponentId}`
  const suffix = `(MAVLink / System: ${messageSystemId} / Component: ${messageComponentId})`
  const shouldCreateLegacyVariables =
    legacyVariablesSystemId !== undefined && legacyVariablesSystemId === messageSystemId && messageComponentId === 1

  // Inject variables from the MAVLink messages into the DataLake
  if (['NAMED_VALUE_FLOAT', 'NAMED_VALUE_INT'].includes(messageType)) {
    // Special handling for NAMED_VALUE_FLOAT/NAMED_VALUE_INT messages
    const name = `${(mavlinkPackage.message.name as string[]).join('').replace(/\0/g, '')}`
    setVariable(`${prefix}/${messageType}/${name}`, `${name} ${suffix}`, mavlinkPackage.message.value)

    if (shouldCreateLegacyVariables) {
      // Create duplicated variables for legacy purposes (that was how they were stored in the old generic-variables system)
      setVariable(name, `(Legacy) ${name}`, mavlinkPackage.message.value)
    }
  } else {
    // For all other messages, use the flattener
    flattenData(mavlinkPackage.message).forEach(({ path, value }) => {
      if (typeof value !== 'string' && typeof value !== 'number') return

      if (shouldCreateLegacyVariables) {
        // Create the variable in the old style path for legacy purposes (that was how they were stored in the old generic-variables system)
        setVariable(path, `(Legacy) ${path}`, value)
      }

      // Create the variable in the new style path
      setVariable(`${prefix}/${path}`, `${path} ${suffix}`, value)
    })
  }
}
