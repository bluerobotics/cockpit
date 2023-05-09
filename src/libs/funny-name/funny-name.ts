import * as Words from './words'

/**
 * Reference of names to be used
 * The idea is to use for aerial vehicle as Air, boats and submarines as water and etc,
 * like pokemon.
 */
export enum Type {
  Air,
  Water,
  None,
}

/**
 * Return the generated name from a specific type
 * @param {Type} type
 * @returns {string}
 */
export function generate(type: Type): string {
  const left = Words.adjetives.random()
  let right = undefined
  switch (type) {
    case Type.Water:
      right = Words.animalsOcean.random()
      break
    default:
      unimplemented()
  }

  return right ? `${left}-${right}` : 'sad-patrick-report-this'
}
