<template>
  <GlassButton
    :label="simplified ? '' : languageLabel"
    :label-class="[labelSize, '-mb-0.5 mt-6']"
    :icon="simplified ? 'mdi-translate' : undefined"
    :icon-size="simplified ? 25 : undefined"
    variant="uncontained"
    :tooltip="simplified ? languageLabel : undefined"
    :width="buttonSize"
    @click="toggleLanguage"
  >
    <v-icon v-if="!simplified" size="20" class="mr-2">mdi-translate</v-icon>
  </GlassButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from 'vuetify'

import GlassButton from './GlassButton.vue'

/**
 * Props for the LanguageSwitcher component
 */
interface Props {
  /** Whether to show a simplified version of the language switcher */
  simplified?: boolean
  /** The size of the button */
  buttonSize?: number
  /** The size of the label text */
  labelSize?: string
}

defineProps<Props>()

const { locale } = useI18n()
const { current: vuetifyLocale } = useLocale()

const languageLabel = computed(() => {
  return locale.value === 'zh' ? '中文' : 'English'
})

/**
 * Toggle between Chinese and English languages
 */
const toggleLanguage = (): void => {
  const newLocale = locale.value === 'zh' ? 'en' : 'zh'
  locale.value = newLocale

  // Update Vuetify locale
  vuetifyLocale.value = newLocale === 'zh' ? 'zhHans' : 'en'

  // Save to localStorage
  localStorage.setItem('cockpit-language', newLocale)

  // Update Electron menu language if running in Electron
  try {
    if (window.electronAPI?.updateMenuLanguage) {
      window.electronAPI.updateMenuLanguage(newLocale)
    }
  } catch (error) {
    console.warn('Failed to update Electron menu language:', error)
  }
}
</script>
