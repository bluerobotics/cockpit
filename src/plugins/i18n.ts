import { addLocale, t, useLocale } from 'ttag'
import type { App } from 'vue'

import pt_BR from '@/i18n/pt_BR.po'
import { settingsManager } from '@/libs/settings-management'

export const languageKey = 'cockpit-language'

const catalogs = {
  pt_BR: { strings: pt_BR, vuetifyLocale: 'pt' },
}

const language = settingsManager.getKeyValue<string>(languageKey) ?? 'en'
const catalog = catalogs[language as keyof typeof catalogs]

// Applied when this module is evaluated, so strings translated at other modules' top level already see the language.
if (catalog) {
  addLocale(language, catalog.strings)
  useLocale(language)
}

export const vuetifyLocale = catalog?.vuetifyLocale ?? 'en'

export default {
  install(app: App): void {
    app.config.globalProperties.t = t
  },
}
