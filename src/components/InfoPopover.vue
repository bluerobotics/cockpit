<template>
  <span class="inline-flex">
    <v-menu location="top" offset="8" max-width="320" @update:model-value="logToggle">
      <template #activator="{ props: activatorProps }">
        <v-btn
          v-bind="activatorProps"
          icon
          variant="text"
          :size="iconSizes[size] + 8"
          color="white"
          :aria-label="t`More information`"
        >
          <v-icon :size="iconSizes[size]">mdi-information-outline</v-icon>
        </v-btn>
      </template>
      <div class="p-3 rounded-lg text-sm" :style="interfaceStore.globalGlassMenuStyles">
        <slot>{{ text }}</slot>
      </div>
    </v-menu>
  </span>
</template>

<script setup lang="ts">
import { t } from 'ttag'

import { useAppInterfaceStore } from '@/stores/appInterface'

const props = withDefaults(
  defineProps<{
    /**
     * Explanation shown in the popover, unless the default slot provides richer content
     */
    text?: string
    /**
     * Size of the information icon
     */
    size?: 'small' | 'medium' | 'large'
  }>(),
  { text: undefined, size: 'medium' }
)

const iconSizes = { small: 16, medium: 19, large: 22 }

const interfaceStore = useAppInterfaceStore()

const logToggle = (isOpen: boolean): void => {
  if (isOpen) logUserAction(`Opened the information popover "${props.text ?? 'with custom content'}"`)
}
</script>
