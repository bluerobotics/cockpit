<template>
  <div
    class="flex items-center"
    :style="{ justifyContent: element.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === element.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
  >
    <div :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
      <v-btn
        :size="element.options.layout?.buttonSize"
        :variant="element.options.layout?.variant"
        :style="{
          color: element.options.layout?.textColor || '#FFFFFF',
          backgroundColor:
            element.options.layout?.variant !== 'text' && element.options.layout?.variant !== 'outlined'
              ? element.options.layout?.backgroundColor || '#FFFFFF33'
              : 'transparent',
        }"
        @click="handleClick"
      >
        {{ element.options.layout?.label || 'Button' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, toRefs } from 'vue'

import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  element: CustomWidgetElementOptions[CustomWidgetElementType.Button]
}>()

const element = toRefs(props).element

const handleClick = (): void => {
  executeActionCallback(`http-request-action (${element.value.options.cockpitAction.name})`)
}

onMounted(() => {
  if (!props.element.options || Object.keys(props.element.options).length === 0) {
    widgetStore.updateElementOptions(props.element.hash, {
      layout: {
        align: element.value.options.layout?.align || 'center',
        backgroundColor: element.value.options.layout?.backgroundColor || '#FFFFFF33',
        label: element.value.options.layout?.label || 'Click Here',
        buttonSize: element.value.options.layout?.buttonSize || 'default',
        textColor: element.value.options.layout?.textColor || '#FFFFFF',
        variant: element.value.options.layout?.variant || 'elevated',
      },
      cockpitAction: element.value.options.cockpitAction || '',
    })
  }
})
</script>

<style scoped></style>
