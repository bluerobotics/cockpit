import type { ActionConfig } from '@/types/cockpit-actions'

/**
 * The id a custom action is stored under when none is given: its type prefix and its name. An action keeps its id
 * when renamed, so that id can belong to an action now called something else, and then the next free numbered one
 * is used instead of replacing it. An action with the same name is still replaced, as before.
 * @param {string} prefix - The action type's id prefix, e.g. 'http-request-action'
 * @param {string} name - The action's name
 * @param {Record<string, ActionConfig['config']>} registered - The actions of that type, by id
 * @returns {string} The id to store the action under
 */
export const customActionIdFor = (
  prefix: string,
  name: string,
  registered: Record<string, ActionConfig['config']>
): string => {
  const base = `${prefix} (${name})`
  let id = base
  for (let n = 2; registered[id] !== undefined && registered[id].name !== name; n++) id = `${base} ${n}`
  return id
}
