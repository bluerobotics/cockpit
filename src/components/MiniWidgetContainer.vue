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
    <VueDraggable
      v-model="container.widgets"
      :disabled="!allowEditing"
      animation="150"
      group="generalGroup"
      class="flex items-center justify-center w-full h-full gap-2 px-2"
      :class="{ 'flex-wrap': wrap }"
      @start="showWidgetTrashArea = true"
      @end="showWidgetTrashArea = false"
      @add="refreshWidgetsHashs"
    >
      <div v-for="item in container.widgets" :key="item.hash">
        <div :class="{ 'select-none pointer-events-none': allowEditing }">
          <template v-if="item.component === MiniWidgetType.ArmerButton">
            <ArmerButton :options="item.options" />
          </template>
          <template v-if="item.component === MiniWidgetType.BaseCommIndicator">
            <BaseCommIndicator :options="item.options" />
          </template>
          <template v-if="item.component === MiniWidgetType.DepthIndicator">
            <DepthIndicator :options="item.options" />
          </template>
          <template v-if="item.component === MiniWidgetType.JoystickCommIndicator">
            <JoystickCommIndicator :options="item.options" />
          </template>
          <template v-if="item.component === MiniWidgetType.MiniVideoRecorder">
            <MiniVideoRecorder :options="item.options" />
          </template>
          <template v-if="item.component === MiniWidgetType.ModeSelector">
            <ModeSelector :options="item.options" />
          </template>
        </div>
      </div>
    </VueDraggable>
  </div>
  <teleport to="body">
    <div
      v-if="showWidgetAddMenu"
      ref="widgetAddMenu"
      class="absolute w-64 h-1/3 -translate-x-32 -translate-y-1/2 top-1/2 left-1/2 bg-slate-500/40 z-[65] rounded-2xl transition-all backdrop-blur-sm p-5"
    >
      <VueDraggable
        v-model="allAvailableWidgets"
        animation="150"
        :group="widgetAddMenuGroupOptions"
        :sort="false"
        class="flex flex-col items-center w-full h-full gap-2 overflow-auto scrollbar-hide bottom-trans-grad"
      >
        <div v-for="item in allAvailableWidgets" :key="item.hash">
          <div class="pointer-events-none select-none">
            <template v-if="item.component === MiniWidgetType.ArmerButton">
              <ArmerButton :options="item.options" />
            </template>
            <template v-if="item.component === MiniWidgetType.BaseCommIndicator">
              <BaseCommIndicator :options="item.options" />
            </template>
            <template v-if="item.component === MiniWidgetType.DepthIndicator">
              <DepthIndicator :options="item.options" />
            </template>
            <template v-if="item.component === MiniWidgetType.JoystickCommIndicator">
              <JoystickCommIndicator :options="item.options" />
            </template>
            <template v-if="item.component === MiniWidgetType.MiniVideoRecorder">
              <MiniVideoRecorder :options="item.options" />
            </template>
            <template v-if="item.component === MiniWidgetType.ModeSelector">
              <ModeSelector :options="item.options" />
            </template>
          </div>
        </div>
      </VueDraggable>
      <button
        class="absolute top-0 right-0 m-2 transition-all text-slate-400 hover:text-slate-200"
        @click="showWidgetAddMenu = !showWidgetAddMenu"
      >
        <FontAwesomeIcon icon="fa-solid fa-close" />
      </button>
    </div>
  </teleport>
  <teleport to="body">
    <div
      v-if="showWidgetTrashArea"
      ref="widgetTrashArea"
      class="absolute w-64 h-64 -translate-x-32 -translate-y-32 top-1/2 left-1/2 bg-slate-500/50 z-[65] rounded-3xl flex items-center justify-center hover:bg-slate-200/50 transition-all"
    >
      <div class="relative w-full h-full">
        <FontAwesomeIcon
          icon="fa-solid fa-trash"
          class="absolute h-24 transition-all -translate-x-12 -translate-y-12 top-1/2 left-1/2 text-slate-50/30"
        />
        <VueDraggable
          v-model="trashList"
          animation="150"
          group="generalGroup"
          class="flex flex-wrap items-center justify-center w-full h-full gap-2"
        >
          <div v-for="item in trashList" :key="item.hash">
            <div class="pointer-events-none select-none">
              <template v-if="item.component === MiniWidgetType.ArmerButton">
                <ArmerButton :options="item.options" />
              </template>
              <template v-if="item.component === MiniWidgetType.BaseCommIndicator">
                <BaseCommIndicator :options="item.options" />
              </template>
              <template v-if="item.component === MiniWidgetType.DepthIndicator">
                <DepthIndicator :options="item.options" />
              </template>
              <template v-if="item.component === MiniWidgetType.JoystickCommIndicator">
                <JoystickCommIndicator :options="item.options" />
              </template>
              <template v-if="item.component === MiniWidgetType.MiniVideoRecorder">
                <MiniVideoRecorder :options="item.options" />
              </template>
              <template v-if="item.component === MiniWidgetType.ModeSelector">
                <ModeSelector :options="item.options" />
              </template>
            </div>
          </div>
        </VueDraggable>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onClickOutside, useElementHover } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { ref, toRefs, watch } from 'vue'
import { computed } from 'vue'
import { nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { type MiniWidget, type MiniWidgetContainer, MiniWidgetType } from '@/types/miniWidgets'

import ArmerButton from './mini-widgets/ArmerButton.vue'
import BaseCommIndicator from './mini-widgets/BaseCommIndicator.vue'
import DepthIndicator from './mini-widgets/DepthIndicator.vue'
import JoystickCommIndicator from './mini-widgets/JoystickCommIndicator.vue'
import ModeSelector from './mini-widgets/ModeSelector.vue'

// eslint-disable-next-line jsdoc/require-jsdoc
interface Props {
  /**
   * The container with the widgets that will be displayed
   */
  container: MiniWidgetContainer
  /**
   * To allow or not the widgets to be moved, added or removed
   */
  allowEditing: boolean
  /**
   * To wrap widgets to other lines or not
   */
  wrap: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowEditing: false,
  wrap: false,
})

const container = toRefs(props).container
const allowEditing = toRefs(props).allowEditing
const wrap = toRefs(props).wrap

const showWidgetAddButton = ref(false)
const addButton = ref<HTMLElement>()
const miniWidgetContainer = ref<HTMLElement>()
const hoveringContainer = useElementHover(miniWidgetContainer)

// eslint-disable-next-line no-undef
let closeAddButtonTimeout: NodeJS.Timeout | undefined = undefined
watch(hoveringContainer, (isHovered, wasHovered) => {
  if (!allowEditing.value) return
  if (addButton.value === undefined || miniWidgetContainer.value === undefined) return
  if (closeAddButtonTimeout !== undefined) {
    clearTimeout(closeAddButtonTimeout)
  }
  const containerBounds = miniWidgetContainer.value.getBoundingClientRect()
  const buttonBounds = addButton.value.getBoundingClientRect()
  const containerInScreenTop = containerBounds.y < window.innerHeight / 2
  if (!wasHovered && isHovered) {
    addButton.value.style.top = containerInScreenTop
      ? `${containerBounds.height + 1.5 * buttonBounds.height}px`
      : `${0 - 1.5 * buttonBounds.height}px`
    showWidgetAddButton.value = true
  }
  if (wasHovered && !isHovered) {
    closeAddButtonTimeout = setTimeout(() => {
      if (addButton.value === undefined) return
      addButton.value.style.top = '50%'
      showWidgetAddButton.value = false
    }, 1500)
  }
})

const showWidgetAddMenu = ref(false)
const widgetAddMenu = ref()
onClickOutside(widgetAddMenu, () => (showWidgetAddMenu.value = false))

const refreshWidgetsHashs = (): void => {
  container.value.widgets = container.value.widgets.map((w) => ({ ...w, ...{ hash: uuid() } }))
}

const showWidgetTrashArea = ref(false)

const trashList = ref<MiniWidget[]>([])
watch(trashList, () => {
  nextTick(() => (trashList.value = []))
})
const allAvailableWidgets = computed(() =>
  Object.values(MiniWidgetType).map((widgetType) => ({ component: widgetType, options: {}, hash: uuid() }))
)

const widgetAddMenuGroupOptions = {
  name: 'generalGroup',
  pull: 'clone',
  put: false,
  revertClone: false,
}
</script>

<style>
.bottom-trans-grad {
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 0) 100%);
}
</style>
