<template>
  <div
    class="flex items-center h-[30px] px-4"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <v-switch
      v-model="switchValue"
      hide-details
      :color="miniWidget.options.layout?.color || '#FFFFFF'"
      :class="{ 'pointer-events-none': widgetStore.editingMode || !isInput }"
      class="min-w-[35px]"
      @change="handleToggleAction"
    />
    <p v-if="miniWidget.options.layout?.label !== ''" class="ml-3 mb-[3px] whitespace-nowrap">
      {{ miniWidget.options.layout?.label }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Switch]
}>()

const miniWidget = toRefs(props).miniWidget
const switchValue = ref(true)
let listenerId: string | undefined

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

const isInput = computed(() => {
  return miniWidget.value.options?.dataLakeVariable?.persistent === true
})

const startListeningDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, (value) => {
      switchValue.value = Boolean(value)
    })
    switchValue.value = Boolean(getDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id))
  }
}

watch(
  () => miniWidget.value.options.dataLakeVariable?.id,
  (newId, oldId) => {
    if (oldId && listenerId) {
      unlistenDataLakeVariable(oldId, listenerId)
    }
    if (newId) {
      startListeningDataLakeVariable()
    }
  }
)

const handleToggleAction = (): void => {
  if (widgetStore.editingMode) return
  if (miniWidget.value.options.dataLakeVariable) {
    widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, switchValue.value)
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id, switchValue.value)
  }
}

onMounted(() => {
  if (!props.miniWidget.options || Object.keys(props.miniWidget.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(props.miniWidget.hash, {
      layout: {
        align: miniWidget.value.options.layout?.align || 'center',
        color: miniWidget.value.options.layout?.color || '#FFFFFF',
        label: miniWidget.value.options.layout?.label || '',
      },
      variableType: 'boolean',
      dataLakeVariable: undefined,
      toggled: true,
    })

    switchValue.value = true
  }

  if (miniWidget.value.options.dataLakeVariable) {
    if (!miniWidget.value.options.dataLakeVariable.allowUserToChangeValue) {
      updateDataLakeVariableInfo({ ...miniWidget.value.options.dataLakeVariable, allowUserToChangeValue: true })
    }
    startListeningDataLakeVariable()
  } else {
    switchValue.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as boolean
  }
})

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable && listenerId) {
    unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, listenerId)
  }
})
</script>

<style scoped></style>
