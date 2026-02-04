// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { en, zhHans } from 'vuetify/locale'

/**
 * Get the initial locale from localStorage or browser settings
 * This should match the logic in i18n.ts
 * @returns {string} The initial locale ('en' or 'zhHans')
 */
function getInitialLocale(): string {
  const stored = localStorage.getItem('cockpit-language')
  if (stored && ['en', 'zh'].includes(stored)) {
    return stored === 'zh' ? 'zhHans' : 'en'
  }

  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zhHans'
  }

  return 'en'
}

export default createVuetify({
  locale: {
    locale: getInitialLocale(),
    fallback: 'en',
    messages: { en, zhHans },
  },
})
