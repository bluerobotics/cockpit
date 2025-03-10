<template>
  <div v-contextmenu="handleContextMenu" :style="{ opacity: miniWidget.options.opacity ?? 1 }">
    <component :is="componentFromType(miniWidget.component)" :mini-widget="miniWidget" />
  </div>
  <ContextMenu
    ref="contextMenuRef"
    :visible="contextMenuVisible"
    :menu-items="contextMenuItems"
    width="200px"
    @close="contextMenuVisible = false"
  >
    <template #default>
      <div class="flex justify-between items-center pr-4 h-10 hover:bg-[#FFFFFF11] text-[14px]">
        <div class="w-full -ml-1">
          <v-slider
            v-model="OpacitySlider"
            color="white"
            min="0.2"
            max="1"
            step="0.01"
            class="scale-75 h-[32px] opacity-75"
          />
        </div>
        <v-icon icon="mdi-circle-opacity" size="16" class="text-[#FFFFFF88] rotate-180" />
      </div>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, toRefs } from 'vue'

import ContextMenu from '@/components/ContextMenu.vue'
import { createDataLakeVariable, getDataLakeVariableInfo } from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type MiniWidget, CustomWidgetElement, isMiniWidgetConfigurable, MiniWidgetType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Mini-widget instance
   */
  miniWidget: MiniWidget | CustomWidgetElement
}>()

const miniWidget = toRefs(props).miniWidget
const componentCache: Record<string, ReturnType<typeof defineAsyncComponent>> = {}
const contextMenuRef = ref()
const contextMenuVisible = ref(false)

const handleContextMenu = {
  open: (event: MouseEvent | TouchEvent) => {
    contextMenuRef.value.openAt(event)
    contextMenuVisible.value = true
  },
  close: () => {
    contextMenuVisible.value = false
  },
}

const OpacitySlider = computed({
  get() {
    return miniWidget.value.options?.opacity ?? 1
  },
  set(newValue) {
    if (miniWidget.value.options) {
      miniWidget.value.options.opacity = newValue
    }
  },
})

const isConfigMenuDisabled = computed(() => {
  if ('isCustomElement' in miniWidget.value && miniWidget.value.isCustomElement) return false
  if (isMiniWidgetConfigurable[miniWidget.value.component as MiniWidgetType]) {
    return false
  }
  return true
})

const openWidgetConfig = (): void => {
  contextMenuVisible.value = false
  widgetStore.miniWidgetManagerVars(miniWidget.value.hash).configMenuOpen = true
}

const contextMenuItems = computed(() =>
  isConfigMenuDisabled.value ? [] : [{ item: 'Options', action: openWidgetConfig, icon: 'mdi-cog' }]
)

const componentFromType = (componentType: string): ReturnType<typeof defineAsyncComponent> => {
  if (!componentCache[componentType]) {
    componentCache[componentType] = defineAsyncComponent(async () => {
      try {
        return await import(`../components/mini-widgets/${componentType}.vue`)
      } catch (error) {
        return await import(`../components/custom-widget-elements/${componentType}.vue`)
      }
    })
  }
  return componentCache[componentType]
}

const registerCockpitActions = (): void => {
  if (
    miniWidget.value.options.dataLakeVariable &&
    getDataLakeVariableInfo(miniWidget.value.options.dataLakeVariable.id) !== undefined
  )
    return
  if (miniWidget.value.options.dataLakeVariable) {
    createDataLakeVariable(
      miniWidget.value.options.dataLakeVariable,
      widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    )
  }
}

onMounted(() => registerCockpitActions())
</script>
