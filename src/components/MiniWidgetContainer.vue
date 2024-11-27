<template>
  <div ref="miniWidgetContainer" class="relative flex items-center justify-center w-full h-full">
    <VueDraggable
      v-model="container.widgets"
      :disabled="!allowEditing"
      :animation="150"
      group="generalGroup"
      class="flex items-center w-full h-full gap-2 px-2"
      :class="[wrap ? 'flex-wrap' : '', widgetsAlignment]"
      @start="showWidgetTrashArea = true"
      @end="showWidgetTrashArea = false"
      @add="(e) => widgetAdded(e)"
      @choose="(event) => emit('chooseMiniWidget', event)"
      @unchoose="(event) => emit('unchooseMiniWidget', event)"
    >
      <div
        v-for="miniWidget in container.widgets"
        :key="miniWidget.hash"
        :data-widget-hash="miniWidget.hash"
        class="rounded-md"
        :class="{
          'cursor-grab': allowEditing,
          'bg-slate-400': widgetStore.miniWidgetManagerVars(miniWidget.hash).highlighted,
        }"
        @mouseover="widgetStore.miniWidgetManagerVars(miniWidget.hash).highlighted = allowEditing"
        @mouseleave="widgetStore.miniWidgetManagerVars(miniWidget.hash).highlighted = false"
      >
        <div :class="{ 'select-none ': allowEditing }">
          <MiniWidgetInstantiator :mini-widget="miniWidget" />
        </div>
      </div>
    </VueDraggable>
  </div>
  <teleport to="body">
    <Transition>
      <div
        v-if="showWidgetTrashArea"
        ref="widgetTrashArea"
        class="absolute w-32 h-32 -translate-x-32 -translate-y-32 bottom-[20%] left-1/3 bg-[#FF000055] z-[65] rounded-xl flex items-center justify-center hover:bg-slate-200/50 transition-all"
      >
        <div class="relative flex justify-center items-center w-full h-full">
          <FontAwesomeIcon
            icon="fa-solid fa-trash"
            class="absolute h-16 transition-all -translate-x-7 -translate-y-8 top-1/2 left-1/2 text-white"
          />
          <VueDraggable
            v-model="trashList"
            :animation="150"
            group="generalGroup"
            class="flex flex-wrap items-center justify-center w-full h-full gap-2"
            @add="handleDeleteWidget"
          >
            <div v-for="miniWidget in trashList" :key="miniWidget.hash">
              <div class="select-none">
                <MiniWidgetInstantiator :mini-widget="miniWidget" />
              </div>
            </div>
          </VueDraggable>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import type SortableEvent from 'sortablejs'
import { v4 as uuid } from 'uuid'
import { onBeforeMount, ref, toRefs } from 'vue'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { CurrentlyLoggedVariables } from '@/libs/sensors-logging'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { DraggableEvent, MiniWidget, MiniWidgetContainer } from '@/types/widgets'

import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'

const widgetStore = useWidgetManagerStore()

const emit = defineEmits<{
  (e: 'chooseMiniWidget', value: unknown): void
  (e: 'unchooseMiniWidget', value: unknown): void
}>()

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
  wrap?: boolean
  /**
   * Where to align the widgets to
   */
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  allowEditing: false,
  wrap: false,
  align: 'center',
})

const container = toRefs(props).container
const allowEditing = toRefs(props).allowEditing
const wrap = toRefs(props).wrap
const align = toRefs(props).align
const lastKnownHashes = ref<string[]>([])

onBeforeMount(() => {
  lastKnownHashes.value = container.value.widgets.map((w) => w.hash)
})

const miniWidgetContainer = ref<HTMLElement>()

const widgetsAlignment = computed(() => `justify-${align.value}`)

const widgetAdded = (e: SortableEvent.SortableEvent): void => {
  // Open the configuration menu of widgets that were just added from the edit-mode list
  const newHashes = container.value.widgets.map((w) => w.hash)
  const hashNewWidget = newHashes.find((h) => !lastKnownHashes.value.includes(h))
  const newWidget = container.value.widgets.find((w) => w.hash === hashNewWidget)

  if (newWidget && e.pullMode === 'clone') {
    newWidget.hash = uuid()
    widgetStore.miniWidgetManagerVars(newWidget.hash).configMenuOpen = true
  }

  lastKnownHashes.value = container.value.widgets.map((w) => w.hash)
}

const showWidgetTrashArea = ref(false)

const trashList = ref<MiniWidget[]>([])

const handleDeleteWidget = (event: DraggableEvent): void => {
  const widgetData = container.value.widgets.find((w) => w.hash === event.item.dataset.widgetHash)
  if (widgetData) {
    // Remove miniWidget variableName from Logged variables list
    CurrentlyLoggedVariables.removeVariable(widgetData.options.displayName)
  }
  widgetStore.elementToShowOnDrawer = undefined
  trashList.value = []
}
</script>
