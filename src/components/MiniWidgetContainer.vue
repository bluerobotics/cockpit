<template>
  <div ref="miniWidgetContainer" class="relative flex h-full w-full items-center justify-center">
    <VueDraggable
      v-model="container.widgets"
      :disabled="!allowEditing"
      :animation="150"
      group="generalGroup"
      class="flex h-full w-full items-center gap-2 px-2"
      :class="[wrap ? 'flex-wrap' : '', widgetsAlignment]"
      @start="showWidgetTrashArea = true"
      @end="showWidgetTrashArea = false"
      @add="refreshWidgetsHashs"
      @choose="(event) => emit('chooseMiniWidget', event)"
      @unchoose="(event) => emit('unchooseMiniWidget', event)"
    >
      <div
        v-for="miniWidget in container.widgets"
        :key="miniWidget.hash"
        :data-widget-hash="miniWidget.hash"
        class="rounded-md"
        :class="{ 'cursor-grab': allowEditing, 'bg-slate-400': miniWidget.managerVars.highlighted }"
        @mouseover="miniWidget.managerVars.highlighted = allowEditing"
        @mouseleave="miniWidget.managerVars.highlighted = false"
      >
        <div :class="{ 'pointer-events-none select-none': allowEditing }">
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
        class="absolute left-1/2 top-1/2 z-[65] flex h-64 w-64 -translate-x-32 -translate-y-32 items-center justify-center rounded-3xl bg-slate-500/50 transition-all hover:bg-slate-200/50"
      >
        <div class="relative h-full w-full">
          <FontAwesomeIcon
            icon="fa-solid fa-trash"
            class="absolute left-1/2 top-1/2 h-24 -translate-x-12 -translate-y-12 text-slate-50/30 transition-all"
          />
          <VueDraggable
            v-model="trashList"
            :animation="150"
            group="generalGroup"
            class="flex h-full w-full flex-wrap items-center justify-center gap-2"
            @add="handleDeleteWidget"
          >
            <div v-for="miniWidget in trashList" :key="miniWidget.hash">
              <div class="pointer-events-none select-none">
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
import { v4 as uuid } from 'uuid'
import { ref, toRefs } from 'vue'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { CurrentlyLoggedVariables } from '@/libs/sensors-logging'
import type { DraggableEvent, MiniWidget, MiniWidgetContainer } from '@/types/widgets'

import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'

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

const miniWidgetContainer = ref<HTMLElement>()

const widgetsAlignment = computed(() => `justify-${align.value}`)

const refreshWidgetsHashs = (): void => {
  container.value.widgets = container.value.widgets.map((w) => ({ ...w, ...{ hash: uuid() } }))
}

const showWidgetTrashArea = ref(false)

const trashList = ref<MiniWidget[]>([])

const handleDeleteWidget = (event: DraggableEvent): void => {
  const widgetData = container.value.widgets.find((w) => w.hash === event.item.dataset.widgetHash)
  if (widgetData) {
    // Remove miniWidget variableName from Logged variables list
    CurrentlyLoggedVariables.removeVariable(widgetData.options.displayName)
  }
  trashList.value = []
}
</script>
