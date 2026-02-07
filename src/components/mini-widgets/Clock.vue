<template>
  <div class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[90px]">
    {{ formattedTime }}
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const timeNow = useTimestamp({ interval: 1000 })
const { locale } = useI18n()

const formattedTime = computed(() => {
  const dateLocale = locale.value === 'zh' ? zhCN : undefined
  return format(timeNow.value, 'E LLL do HH:mm', { locale: dateLocale })
})
</script>
