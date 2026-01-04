import { createI18n } from 'vue-i18n'

// Import translation files
import en from '@/locales/en.json'
import zh from '@/locales/zh.json'

// Get the user's preferred language from localStorage or browser
const savedLocale = localStorage.getItem('cockpit-language')
const browserLocale = navigator.language.split('-')[0]

// List of supported locales
const supportedLocales = ['en', 'zh']

// Determine default locale
const defaultLocale = savedLocale || (supportedLocales.includes(browserLocale) ? browserLocale : 'zh')

// Create i18n instance
const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
  globalInjection: true,
})

// Export the translate function for use in stores and utilities
export const { t } = i18n.global

export default i18n
