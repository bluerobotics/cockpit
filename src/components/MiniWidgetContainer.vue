<template>
  <div ref="miniWidgetContainer" class="relative flex items-center justify-center w-full h-full">
    <VueDraggable
      v-model="container.widgets"
      :disabled="!allowEditing"
      animation="150"
      group="generalGroup"
      class="flex items-center w-full h-full gap-2 px-2"
      :class="[wrap ? 'flex-wrap' : '', widgetsAlignment]"
      @start="showWidgetTrashArea = true"
      @end="showWidgetTrashArea = false"
      @add="refreshWidgetsHashs"
    >
      <div v-for="item in container.widgets" :key="item.hash">
        <div :class="{ 'select-none pointer-events-none': allowEditing }">
          <MiniWidgetInstantiator :widget-type="item.component" :options="item.options" />
        </div>
      </div>
    </VueDraggable>
  </div>
  <teleport to="body">
    <Transition>
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
                <MiniWidgetInstantiator :widget-type="item.component" :options="item.options" />
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
import { ref, toRefs, watch } from 'vue'
import { computed } from 'vue'
import { nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { MiniWidget, MiniWidgetContainer } from '@/types/miniWidgets'

import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'

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
watch(trashList, () => {
  nextTick(() => (trashList.value = []))
})
</script>
