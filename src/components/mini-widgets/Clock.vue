<template>
  <div class="flex items-center justify-center m-2 text-sm font-bold text-center text-white select-none min-w-[90px]">
    {{ format(timeNow, 'E LLL do HH:mm') }}
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'

const timeNow = useTimestamp({ interval: 1000 })
</script>
