<template>
  <div
    class="flex items-center h-[30px] min-w-[50px] px-1"
    :style="{ justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <p
      v-if="miniWidget.options.layout?.label !== ''"
      class="mr-3 mb-[3px] text-white"
      :class="{ 'opacity-50': !isConnected }"
    >
      {{ miniWidget.options.layout?.label }}
    </p>
    <v-tooltip
      text="This element is in display mode. To make it interactive, create or select a user-controlled data-lake variable"
      location="top"
      open-delay="500"
      :disabled="isInput || !isConnected"
    >
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps">
          <v-checkbox
            v-model="isChecked"
            hide-details
            :color="miniWidget.options.layout?.color"
            class="text-white"
            :class="{
              'opacity-30': !isConnected,
              'cursor-default pointer pointer-events-none': !isInteractive,
            }"
            theme="dark"
            @update:model-value="handleToggleAction"
          ></v-checkbox>
        </div>
      </template>
    </v-tooltip>
    <AlertIcon
      v-if="showAlertIcon"
      icon="mdi-connection"
      color="#b9af1d"
      animation="pulse"
      class="absolute center ml-10 mt-[10px]"
      tooltip="This element isn't connected to a data-lake variable yet. Click here to configure it."
      @click="widgetStore.showElementPropsDrawer(miniWidget.hash)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import AlertIcon from '@/components/AlertIcon.vue'
import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Checkbox]
}>()

const miniWidget = toRefs(props).miniWidget
const isChecked = ref(false)
let listenerId: string | undefined

const handleToggleAction = (): void => {
  if (widgetStore.editingMode) return
  widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, isChecked.value)
  if (miniWidget.value.options.dataLakeVariable) {
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id, isChecked.value)
  }
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

const showAlertIcon = computed(() => {
  return !isConnected.value && !widgetStore.editingMode && widgetStore.isRealMiniWidget(miniWidget.value.hash)
})

const isConnected = computed(() => {
  return !!miniWidget.value.options.dataLakeVariable?.id
})

const isInput = computed(() => {
  return miniWidget.value.options.dataLakeVariable?.allowUserToChangeValue === true
})

const isInteractive = computed(() => {
  return isConnected.value && isInput.value && !widgetStore.editingMode
})

const startListeningDataLakeVariable = (): void => {
  if (miniWidget.value.options.dataLakeVariable) {
    listenerId = listenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, (value) => {
      isChecked.value = Boolean(value)
    })
    isChecked.value = Boolean(getDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id))
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

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        label: '',
        align: 'center',
        color: '#FFFFFF',
      },
      variableType: 'boolean',
      dataLakeVariable: undefined,
    })
  }

  if (miniWidget.value.options.dataLakeVariable) {
    startListeningDataLakeVariable()
  } else {
    isChecked.value = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash) as boolean
  }
})

onUnmounted(() => {
  if (miniWidget.value.options.dataLakeVariable && listenerId) {
    unlistenDataLakeVariable(miniWidget.value.options.dataLakeVariable.id, listenerId)
  }
})
</script>

<style scoped></style>
