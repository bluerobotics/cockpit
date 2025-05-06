<template>
  <div
    class="flex items-center"
    :style="{ justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <div :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
      <v-btn
        :size="miniWidget.options.layout?.buttonSize"
        :variant="miniWidget.options.layout?.variant"
        :style="{
          color: miniWidget.options.layout?.textColor || '#FFFFFF',
          backgroundColor:
            miniWidget.options.layout?.variant !== 'text' && miniWidget.options.layout?.variant !== 'outlined'
              ? miniWidget.options.layout?.backgroundColor || '#FFFFFF33'
              : 'transparent',
        }"
        @click="handleClick"
      >
        {{ miniWidget.options.layout?.label || 'Button' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, toRefs, watch } from 'vue'

import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Button]
}>()

const miniWidget = toRefs(props).miniWidget

const handleClick = (): void => {
  if (widgetStore.editingMode) return
  executeActionCallback(miniWidget.value.options.cockpitAction.id)
}

watch(
  () => widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen,
  (newValue) => {
    if (newValue === true) {
      widgetStore.showElementPropsDrawer(miniWidget.value.hash)
      setTimeout(() => {
        widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = false
      }, 200)
    }
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  if (!props.miniWidget.options || Object.keys(props.miniWidget.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(props.miniWidget.hash, {
      layout: {
        align: miniWidget.value.options.layout?.align || 'center',
        backgroundColor: miniWidget.value.options.layout?.backgroundColor || '#FFFFFF33',
        label: miniWidget.value.options.layout?.label || 'Click Here',
        buttonSize: miniWidget.value.options.layout?.buttonSize || 'default',
        textColor: miniWidget.value.options.layout?.textColor || '#FFFFFF',
        variant: miniWidget.value.options.layout?.variant || 'elevated',
      },
      cockpitAction: miniWidget.value.options.cockpitAction || '',
    })
  }
})
</script>

<style scoped></style>
