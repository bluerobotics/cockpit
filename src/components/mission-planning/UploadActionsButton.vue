<template>
  <div class="flex flex-col">
    <div class="flex flex-row items-stretch gap-2 m-2 mt-2">
      <button
        :disabled="disabled"
        :class="{ 'bg-[#FFFFFF11] hover:bg-[#FFFFFF11] text-[#FFFFFF22] elevation-0': disabled }"
        class="flex-1 min-w-0 h-[40px] py-2 px-2 text-sm rounded-md elevation-1 bg-[#3B78A8] hover:bg-[#3B78A8] transition-colors duration-200"
        @click="emit('upload')"
      >
        {{ label }}
      </button>
      <v-tooltip location="top" :text="toggleText">
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="tooltipProps"
            :aria-label="toggleText"
            class="relative flex items-center justify-center h-[40px] py-2 px-1 rounded-md elevation-1 bg-[#FFFFFF11] hover:bg-[#FFFFFF22] transition-colors duration-200"
            @click="toggleActions"
          >
            <span v-if="indicator && !expanded" class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#3B78A8]" />
            <v-icon size="28" class="text-white transition-transform duration-200" :class="{ 'rotate-180': expanded }">
              mdi-menu-down
            </v-icon>
          </button>
        </template>
      </v-tooltip>
    </div>
    <v-expand-transition>
      <div v-if="expanded" class="flex flex-col">
        <v-divider class="mx-2 my-1 opacity-5" />
        <slot />
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { computed, defineModel } from 'vue'

const props = defineProps<{
  /**
   * Text of the upload button.
   */
  label: string
  /**
   * Whether the upload button is disabled.
   */
  disabled?: boolean
  /**
   * What the collapsed actions are about, as in "mission actions", used in the toggle's tooltip and logs.
   */
  actionsName: string
  /**
   * Shows a dot on the collapsed toggle, hinting that it hides something worth opening.
   */
  indicator?: boolean
}>()

const emit = defineEmits<{
  (e: 'upload'): void
}>()

const expanded = defineModel<boolean>('expanded', { default: false })

const toggleText = computed(() => `${expanded.value ? 'Hide' : 'Show'} ${props.actionsName}`)

const toggleActions = (): void => {
  logUserAction(`${expanded.value ? 'Closed' : 'Opened'} the ${props.actionsName} menu`)
  expanded.value = !expanded.value
}
</script>
