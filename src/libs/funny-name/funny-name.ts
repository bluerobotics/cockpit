import { interfaceLanguage } from '@/libs/i18n'

import * as EnglishWords from './words'
import * as BrazilianPortugueseWords from './words-pt_BR'
import * as ChineseWords from './words-zh_CN'

type WordList = {
  /**
   * Whether names read adjective first, as in English, rather than noun first, as in Portuguese
   */
  adjectiveFirst: boolean
  /**
   * Positive adjectives
   */
  adjetives: string[]
  /**
   * Ocean animal names
   */
  animalsOcean: string[]
  /**
   * Ready-made mission names
   */
  coolMissionNames: string[]
}

const wordsByLanguage: Record<string, WordList> = { pt_BR: BrazilianPortugueseWords, zh_CN: ChineseWords }

export const Words: WordList = wordsByLanguage[interfaceLanguage] ?? EnglishWords

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

  if (!right) return 'sad-patrick-report-this'
  return Words.adjectiveFirst ? `${left}-${right}` : `${right}-${left}`
}
