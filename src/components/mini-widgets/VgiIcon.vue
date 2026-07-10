<template>
  <span v-if="!isCustom" class="mdi" :class="[iconName]" />
  <span v-else-if="iconUrl" class="inline-flex items-center justify-center">
    <img :src="iconUrl" class="w-[1em] h-[1em] object-contain" alt="" />
  </span>
  <span v-else class="mdi mdi-image-off-outline" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCustomIcons } from '@/composables/useCustomIcons'
import { isCustomIconRef } from '@/libs/custom-icons'

const props = defineProps<{
  /**
   * Icon reference: an MDI class name (e.g. `mdi-thermometer`) or a custom icon reference
   * (as produced by `customIconRefFromId`), resolved via the custom icon library.
   */
  iconName: string
}>()

const { resolveIconUrl } = useCustomIcons()

const isCustom = computed(() => isCustomIconRef(props.iconName))
const iconUrl = computed(() => resolveIconUrl(props.iconName))
</script>
