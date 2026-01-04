<template>
  <div class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[90px]">
    {{ format(timeNow, 'E LLL do HH:mm', { locale: currentLocale }) }}
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const timeNow = useTimestamp({ interval: 1000 })

const currentLocale = computed(() => {
  return locale.value === 'zh' ? zhCN : enUS
})
</script>
