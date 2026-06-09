<template>
  <div
    class="flex relative w-full"
    :style="{ width: '100%', justifyContent: miniWidget.options.layout?.align }"
    :class="
      widgetStore.elementToShowOnDrawer?.hash === miniWidget.hash && widgetStore.editingMode
        ? 'bg-[#00000010] '
        : 'border-0'
    "
    @click="widgetStore.editingMode && widgetStore.showElementPropsDrawer(miniWidget.hash)"
  >
    <v-tooltip
      text="This element is in display mode. To make it interactive, create or select a user-controlled data-lake variable"
      location="top"
      open-delay="500"
      :disabled="isInput || !isConnected"
    >
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps">
          <v-select
            v-model="selectedValue"
            :items="options"
            item-title="name"
            item-value="value"
            theme="dark"
            density="compact"
            variant="filled"
            :min-width="miniWidget.options.layout?.width || 168"
            hide-details
            class="text-white"
            :class="[
              isInteractive ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none cursor-default',
              !isConnected ? 'opacity-50' : '',
            ]"
            @update:model-value="handleSelection"
          >
          </v-select>
        </div>
      </template>
    </v-tooltip>
    <AlertIcon
      v-if="showAlertIcon"
      icon="mdi-connection"
      color="#b9af1d"
      animation="pulse"
      class="absolute center ml-[70px] mt-[12px]"
      tooltip="This element isn't connected to a data-lake variable yet. Click here to configure it."
      @click="widgetStore.showElementPropsDrawer(miniWidget.hash)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRefs, watch } from 'vue'

import AlertIcon from '@/components/AlertIcon.vue'
import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { setDataLakeVariableData } from '@/libs/actions/data-lake'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidgetElementOptions, CustomWidgetElementType, SelectorOption } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Element instance
   */
  miniWidget: CustomWidgetElementOptions[CustomWidgetElementType.Dropdown]
}>()

const options = computed(() => {
  return miniWidget.value.options.layout?.selectorOptions || []
})

const miniWidget = toRefs(props).miniWidget
const selectedOption = ref<SelectorOption | undefined>(
  options.value.find((option) => option.value === props.miniWidget.options.lastSelected?.value) || options.value[0]
)

const selectedValue = ref<string | number | boolean>(
  props.miniWidget.options.lastSelected?.value || options.value[0]?.value
)

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

watch(selectedOption, (newValue) => {
  widgetStore.updateElementOptions(miniWidget.value.hash, {
    ...miniWidget.value.options,
    lastSelected: newValue,
  })
})

const handleSelection = (value: string | number | boolean): void => {
  if (widgetStore.editingMode) return

  const selected = options.value.find((option) => option.value === value)
  if (!selected) return

  selectedValue.value = value

  if (miniWidget.value.options.dataLakeVariable) {
    setDataLakeVariableData(miniWidget.value.options.dataLakeVariable.id, value)
  }
  widgetStore.setMiniWidgetLastValue(miniWidget.value.hash, selected.value)
}

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

// Reactively reads the linked data lake variable, auto-resubscribing when the linked id changes.
const { value: dataLakeValue } = useDataLakeVariable(() => miniWidget.value.options.dataLakeVariable?.id)
watch(
  dataLakeValue,
  (value) => {
    if (value === undefined) return
    selectedValue.value = String(value)
  },
  { immediate: true }
)

onMounted(() => {
  if (!miniWidget.value.options || Object.keys(miniWidget.value.options).length === 0) {
    miniWidget.value.isCustomElement = true
    widgetStore.updateElementOptions(miniWidget.value.hash, {
      layout: {
        selectorOptions: [],
        align: 'start',
        width: 168,
      },
      variableType: 'string',
      dataLakeVariable: undefined,
    })
  }
  // When linked to a data lake variable, the value comes from the composable/watch above.
  if (!miniWidget.value.options.dataLakeVariable) {
    const last = widgetStore.getMiniWidgetLastValue(miniWidget.value.hash)
    selectedOption.value = options.value.find((opt) => opt.value === last) || options.value[0]
  }
})
</script>

<style scoped>
.select-container {
  width: 100%;
  align-items: center;
  flex-direction: row;
}
</style>
