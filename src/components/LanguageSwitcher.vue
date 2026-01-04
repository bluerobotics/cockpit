<template>
  <div class="language-switcher">
    <v-select
      v-model="currentLocale"
      :items="languages"
      item-title="label"
      item-value="value"
      density="compact"
      variant="outlined"
      hide-details
      @update:model-value="changeLanguage"
    >
      <template #prepend-inner>
        <v-icon size="small">mdi-translate</v-icon>
      </template>
    </v-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const currentLocale = ref(locale.value)

const languages = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

const changeLanguage = (newLocale: string) => {
  locale.value = newLocale
  currentLocale.value = newLocale
  localStorage.setItem('cockpit-language', newLocale)
  
  // Update Electron menu language if running in Electron
  if (window.electronAPI?.updateMenuLanguage) {
    window.electronAPI.updateMenuLanguage(newLocale)
  }
}

onMounted(() => {
  currentLocale.value = locale.value
})
</script>

<style scoped>
.language-switcher {
  min-width: 120px;
}
</style>
