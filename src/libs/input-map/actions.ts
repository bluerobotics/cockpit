/**
 * List of actions that cockpit can perform
 */
export enum App {
  Screenshot,
}

export const Action = { App }
export type Action = typeof Action

/**
 * Return all available actions
 *
 * @returns {string[]} A array of string name for each action
 */
export function allActions(): string[] {
  return Object.values(Action)
    .flat(1)
    .map((value) => value[0])
}
