<template>
  <div ref="miniWidgetContainer" class="relative flex items-center justify-center w-full h-full">
    <div
      ref="addButton"
      class="transition-all z-[63] absolute flex items-center justify-center text-slate-50 hover:text-green-500 cursor-pointer top-1/2 left-1/2 -translate-y-2 -translate-x-2 h-4"
      :class="{ 'pointer-events-none opacity-0': !showWidgetAddButton }"
      @click="showWidgetAddMenu = true"
    >
      <FontAwesomeIcon icon="fa-solid fa-circle-plus" size="xl" class="transition-all" />
    </div>
    <Sortable
      :list="container.widgets"
      :options="sortableOptions"
      item-key="component"
      class="flex items-center justify-center gap-y-2 mini-widget-container"
      :class="{ 'flex-wrap': wrap }"
    >
      <template #item="{ element }">
        <MiniWidgetHugger :container="container" :widget="element">
          <template v-if="element.component === MiniWidgetType.ArmerButton">
            <ArmerButton />
          </template>
          <template v-if="element.component === MiniWidgetType.BaseCommIndicator">
            <BaseCommIndicator />
          </template>
          <template v-if="element.component === MiniWidgetType.DepthIndicator">
            <DepthIndicator />
          </template>
          <template v-if="element.component === MiniWidgetType.JoystickCommIndicator">
            <JoystickCommIndicator />
          </template>
          <template v-if="element.component === MiniWidgetType.ModeSelector">
            <ModeSelector />
          </template>
        </MiniWidgetHugger>
      </template>
    </Sortable>
  </div>
  <Dialog v-model:show="showWidgetAddMenu" class="p-2">
    <Button
      v-for="widget in MiniWidgetType"
      :key="widget"
      class="m-1"
      @click="store.addWidgetToContainer(widget, container)"
    >
      {{ widget }}
    </Button>
  </Dialog>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { Sortable } from 'sortablejs-vue3'
import { ref, toRefs } from 'vue'
import { watch } from 'vue'

import { useMiniWidgetsManagerStore } from '@/stores/miniWidgetsManager'
import { type MiniWidgetContainer, MiniWidgetType } from '@/types/miniWidgets'

import Button from './Button.vue'
import Dialog from './Dialog.vue'
import ArmerButton from './mini-widgets/ArmerButton.vue'
import BaseCommIndicator from './mini-widgets/BaseCommIndicator.vue'
import DepthIndicator from './mini-widgets/DepthIndicator.vue'
import JoystickCommIndicator from './mini-widgets/JoystickCommIndicator.vue'
import ModeSelector from './mini-widgets/ModeSelector.vue'
import MiniWidgetHugger from './MiniWidgetHugger.vue'

// eslint-disable-next-line jsdoc/require-jsdoc
interface Props {
  /**
   * The container with the widgets that will be displayed
   */
  container: MiniWidgetContainer
  /**
   * To wrap widgets to other lines or not
   */
  wrap: boolean
}

const props = withDefaults(defineProps<Props>(), {
  wrap: false,
})

const container = toRefs(props).container
const wrap = toRefs(props).wrap

const store = useMiniWidgetsManagerStore()

const sortableOptions = {
  animation: 150,
  group: 'generalGroup',
}

const showWidgetAddButton = ref(false)
const addButton = ref<HTMLElement>()
const miniWidgetContainer = ref<HTMLElement>()
const hoveringContainer = useElementHover(miniWidgetContainer)

watch(hoveringContainer, (isHovered, wasHovered) => {
  if (addButton.value === undefined) return
  if (!wasHovered && isHovered) {
    const buttonInScreenTop = addButton.value.getBoundingClientRect().y < window.innerHeight / 2
    addButton.value.style.top = buttonInScreenTop ? '150%' : '-50%'
    showWidgetAddButton.value = true
  }
  if (wasHovered && !isHovered) {
    setTimeout(() => {
      if (addButton.value === undefined) return
      addButton.value.style.top = '50%'
      showWidgetAddButton.value = false
    }, 1500)
  }
})

const showWidgetAddMenu = ref(false)
</script>
