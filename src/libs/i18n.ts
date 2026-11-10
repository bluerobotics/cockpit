import { addLocale, useLocale } from 'ttag'

import pt_BR from '@/i18n/pt_BR.po'
import { createDataLakeVariable } from '@/libs/actions/data-lake'
import { settingsManager } from '@/libs/settings-management'

export const languageKey = 'cockpit-language'

const catalogs = {
  pt_BR: { strings: pt_BR, vuetifyLocale: 'pt' },
}

const language = settingsManager.getKeyValue<string>(languageKey) ?? 'en'
const catalog = Object.keys(catalogs).includes(language) ? catalogs[language as keyof typeof catalogs] : undefined

// Applied when this module is evaluated, so strings translated at other modules' top level already see the language.
if (catalog) {
  addLocale(language, catalog.strings)
  useLocale(language)
}

export const interfaceLanguage = catalog ? language : 'en'
export const vuetifyLocale = catalog?.vuetifyLocale ?? 'en'

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
