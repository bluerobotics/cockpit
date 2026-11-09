<template>
  <div
    class="flex rounded-[10px] overflow-hidden text-white pointer-events-auto"
    :style="interfaceStore.globalGlassMenuStyles"
  >
    <div
      class="overflow-hidden transition-[width] duration-300 ease-out"
      :style="{ width: open ? width : '0px' }"
      :inert="!open || undefined"
    >
      <div class="h-full" :style="{ width }">
        <slot />
      </div>
    </div>
    <div
      class="flex flex-col items-center gap-y-1 px-1 pt-1 pb-[11px]"
      :class="{ 'border-l border-[#FFFFFF11]': open }"
    >
      <v-btn
        icon
        variant="text"
        size="x-small"
        :aria-label="open ? t`Close the ${label}` : t`Open the ${label}`"
        @click="toggle"
      >
        <v-icon :icon="open ? 'mdi-chevron-right' : 'mdi-chevron-left'" size="18" />
        <v-tooltip activator="parent" location="left" :text="open ? t`Close the ${label}` : t`Open the ${label}`" />
      </v-btn>
      <slot name="strip" />
      <p class="flex items-center gap-2 mt-1 whitespace-nowrap [writing-mode:vertical-rl]">
        <v-icon v-if="icon" :icon="icon" size="18" class="opacity-80 rotate-90" />
        <span class="text-sm font-medium">{{ title }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'

import { useAppInterfaceStore } from '@/stores/appInterface'

const props = defineProps<{
  /**
   * Whether the content is slid out.
   */
  open: boolean
  /**
   * What the drawer holds, as read in "Open the <label>".
   */
  label: string
  /**
   * Width of the content when open, as a CSS length.
   */
  width: string
  /**
   * Heading written along the strip.
   */
  title: string
  /**
   * Icon leading the heading, turned with it.
   */
  icon?: string
}>()

const emit = defineEmits<{ (event: 'update:open', open: boolean): void }>()

const interfaceStore = useAppInterfaceStore()

const toggle = (): void => {
  emit('update:open', !props.open)
}
</script>
