import { addLocale, useLocale } from 'ttag'

import pt_BR from '@/i18n/pt_BR.po'
import { createDataLakeVariable } from '@/libs/actions/data-lake'
import { settingsManager } from '@/libs/settings-management'

export const languageKey = 'cockpit-language'

// Each language is titled in itself, so it can be found from any interface language.
const catalogs = {
  pt_BR: { strings: pt_BR, vuetifyLocale: 'pt', title: 'Português (Brasil)' },
}

export const availableLanguages = [
  { value: 'en', title: 'English' },
  ...Object.entries(catalogs).map(([value, { title }]) => ({ value, title })),
]

const storedLanguage = settingsManager.getKeyValue<string>(languageKey)
// Stored with the oldest epoch, so it lists the setting without overriding a language synced from the vehicle.
if (storedLanguage === undefined) settingsManager.setKeyValue(languageKey, 'en', 0)

const language = storedLanguage ?? 'en'
const catalog = Object.keys(catalogs).includes(language) ? catalogs[language as keyof typeof catalogs] : undefined

// Applied when this module is evaluated, so strings translated at other modules' top level already see the language.
Object.entries(catalogs).forEach(([code, { strings }]) => addLocale(code, strings))
if (catalog) useLocale(language)

export const interfaceLanguage = catalog ? language : 'en'
export const vuetifyLocale = catalog?.vuetifyLocale ?? 'en'

/**
 * Translates in a language other than the interface one, such as one just picked but not applied yet
 * @param {string} target Code of the language to translate into
 * @param {() => T} translate Synchronous function that evaluates the translated strings
 * @returns {T} What `translate` returned
 */
export const translatedIn = <T>(target: string, translate: () => T): T => {
  useLocale(target)
  try {
    return translate()
  } finally {
    useLocale(interfaceLanguage)
  }
}

// Lets extensions (iframes, custom widgets) follow the interface language.
createDataLakeVariable(
  {
    id: 'cockpit-interface-language',
    name: 'Cockpit interface language',
    type: 'string',
    description: 'The language the interface is shown in, such as en or pt_BR.',
  },
  interfaceLanguage
)
