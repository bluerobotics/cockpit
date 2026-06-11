import { createI18n } from 'vue-i18n'

import zh from '@/locales/zh.json'

/**
 * Get the user's preferred language from localStorage or browser settings
 * @returns {string} The language code (e.g., 'en', 'zh')
 */
function getDefaultLanguage(): string {
  // First, check localStorage
  const stored = localStorage.getItem('cockpit-language')
  if (stored && ['en', 'zh'].includes(stored)) {
    return stored
  }

  // Then, check browser language
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }

  // Default to English
  return 'en'
}

/**
 * Create and configure the vue-i18n instance.
 * English strings are used directly as translation keys.
 * When locale is 'en', vue-i18n returns the key itself (the English text).
 * When locale is 'zh', the Chinese translation is looked up from zh.json.
 */
const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: getDefaultLanguage(), // Set default locale
  fallbackLocale: 'en', // Fallback to key (English) if translation is missing
  messages: {
    zh,
  },
  globalInjection: true, // Enable global $t() function
  missingWarn: false, // Disable missing translation warnings
  fallbackWarn: false, // Disable fallback warnings
})

/**
 * Export the global t function for direct use in non-component code
 */
export const t = i18n.global.t

export default i18n
