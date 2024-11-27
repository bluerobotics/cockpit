<template>
  <div
    ref="widgetBase"
    class="h-full rounded-lg overflow-hidden"
    :class="[
      isWrapped ? 'w-[40px]' : 'w-full',
      isWrapped && wrapDirection === 'left' ? 'ml-0 mr-auto' : '',
      isWrapped && wrapDirection === 'right' ? 'mr-0 ml-auto' : '',
    ]"
    :width="canvasSize.width"
    :height="canvasSize.height"
    :style="[
      interfaceStore.globalGlassMenuStyles,
      {
        backgroundColor: `${widget.options.backgroundColor + convertedBackgroundOpacity}`,
        backdropFilter: `blur(${widget.options.backgroundBlur}px)`,
      },
    ]"
  >
    <div class="flex flex-col justify-between h-full pa-2 cursor-pointer">
      <div class="flex justify-between w-full">
        <v-icon class="cursor-grab opacity-40" @mousedown="enableMovingOnDrag" @mouseup="disableMovingOnDrag">
          mdi-drag
        </v-icon>
        <div v-if="!isWrapped">
          <div v-if="isEditingWidgetName">
            <input
              ref="nameInput"
              v-model="editedName"
              class="border-b border-gray-400"
              @blur="saveName"
              @keyup.enter="saveName"
            />
          </div>
          <p
            v-else
            class="whitespace-nowrap overflow-hidden text-ellipsis"
            :style="{ maxWidth: `${canvasSize.width * 0.8}px` }"
            @dblclick="enableEditing"
          >
            {{ widget.name }}
          </p>
        </div>
        <div class="flex">
          <v-menu v-if="widgetStore.editingMode" theme="dark">
            <template #activator="{ props: buttonProps }">
              <v-btn size="20" icon="mdi-dots-vertical" variant="text" v-bind="buttonProps"></v-btn>
            </template>

            <v-list>
              <v-list-item @click="handleOptionClick('options')">
                <v-list-item-title>Options</v-list-item-title>
              </v-list-item>
              <v-list-item @click="handleOptionClick('save')">
                <v-list-item-title>Save</v-list-item-title>
              </v-list-item>
              <v-list-item @click="handleOptionClick('load')">
                <v-list-item-title>Load</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
      <div v-if="isWrapped" class="flex rotate-[270deg] justify-center whitespace-nowrap">{{ widget.name }}</div>
      <div v-show="!isWrapped" class="flex justify-center h-full px-3 pt-2 gap-x-2">
        <div
          class="flex flex-col justify-center border-[#FFFFFF33] border-dashed rounded-md"
          :style="{ width: widget.options.columns > 1 ? `${leftColumnWidth}%` : '100%' }"
          :class="[widgetStore.editingMode ? 'border-[1px]' : 'border-0']"
        >
          <div v-for="container in leftContainers" :key="container.name" class="w-full h-full">
            <VueDraggable
              v-model="container.elements"
              :disabled="!widgetStore.editingMode"
              :animation="150"
              group="generalGroup"
              class="flex items-center w-full h-full gap-2 px-2"
              :class="[wrap ? 'flex-wrap' : '', widgetsAlignment]"
              @add="(e) => widgetAdded(e, container.name)"
              @start="showWidgetTrashArea = true"
              @end="showWidgetTrashArea = false"
            >
              <div
                v-for="miniWidget in container.elements"
                :key="miniWidget.hash"
                :data-widget-hash="miniWidget.hash"
                class="rounded-md w-full"
                :class="{
                  'cursor-grab': widgetStore.editingMode,
                  'bg-slate-400': widgetStore.miniWidgetManagerVars(miniWidget.hash).highlighted,
                }"
              >
                <MiniWidgetInstantiator :mini-widget="miniWidget" />
              </div>
            </VueDraggable>
          </div>
        </div>
        <div
          v-if="widget.options.columns > 1 && widgetStore.editingMode"
          class="cursor-col-resize w-1 bg-[#FFFFFF22] relative"
          @mousedown="startResize"
        >
          <div class="absolute inset-y-0 -left-1 -right-1"></div>
        </div>

        <div
          v-if="widget.options.columns > 1"
          class="flex flex-col justify-center border-[#FFFFFF33] border-dashed rounded-md"
          :style="{ width: `${100 - leftColumnWidth}%` }"
          :class="[widgetStore.editingMode ? 'border-[1px]' : 'border-0']"
        >
          <div v-for="container in rightContainers" :key="container.name" class="w-full h-full">
            <VueDraggable
              v-model="container.elements"
              :disabled="!widgetStore.editingMode"
              :animation="150"
              group="generalGroup"
              class="flex items-center w-full h-full gap-2 px-2"
              :class="[wrap ? 'flex-wrap' : '', widgetsAlignment]"
              @add="(e) => widgetAdded(e, container.name)"
              @start="showWidgetTrashArea = true"
              @end="showWidgetTrashArea = false"
            >
              <div
                v-for="element in container.elements"
                :key="element.hash"
                :data-widget-hash="element.hash"
                class="rounded-md w-full"
                :class="{
                  'cursor-grab': widgetStore.editingMode,
                  'bg-slate-400': widgetStore.miniWidgetManagerVars(element.hash).highlighted,
                }"
              >
                <MiniWidgetInstantiator :mini-widget="element" />
              </div>
            </VueDraggable>
          </div>
        </div>
      </div>
      <div />
      <v-btn
        v-if="!widgetStore.editingMode"
        :class="['fixed bottom-[2px]', wrapDirection === 'left' ? 'left-[2px]' : 'right-[2px]']"
        :icon="wrapChevronIcon"
        variant="text"
        size="36"
        @click="isWrapped = !isWrapped"
      />
    </div>
  </div>

  <Teleport to="body">
    <GlassModal :is-visible="widgetStore.widgetManagerVars(widget.hash).configMenuOpen">
      <v-card class="px-8 pb-6 pt-2 rounded-lg w-[400px] bg-transparent">
        <v-card-title class="text-center -mt-1">Custom Widget options</v-card-title>
        <v-btn
          class="absolute top-3 right-0 text-lg rounded-full"
          variant="text"
          size="small"
          @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <div class="flex flex-col justify-start items-start gap-x-4 mt-3 w-full">
          <p class="text-start">Name:</p>
          <v-text-field ref="nameInput" v-model="widget.name" density="compact" class="w-3/4" />
          <p class="text-start">Columns:</p>
          <v-text-field
            ref="nameInput"
            v-model="widget.options.columns"
            min="1"
            max="2"
            type="number"
            density="compact"
            class="w-1/4"
          />
          <p class="mt-1">Background color</p>
          <input v-model="widget.options.backgroundColor" type="color" class="p-0 w-20 mr-4" />
          <p class="mt-3">Background opacity:</p>
          <v-slider v-model="widget.options.backgroundOpacity" min="0" max="1" color="white" thumb-label width="250" />
          <p class="mt-3">Background blur:</p>
          <v-slider v-model="widget.options.backgroundBlur" min="0" max="100" color="white" thumb-label width="250" />
        </div>
      </v-card>
    </GlassModal>
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
  </Teleport>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import saveAs from 'file-saver'
import type SortableEvent from 'sortablejs'
import { v4 as uuid } from 'uuid'
import { computed, nextTick, onBeforeMount, onMounted, ref, toRefs, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { useSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { CustomWidget, CustomWidgetElement, CustomWidgetElementContainer, MiniWidget, Widget } from '@/types/widgets'

import GlassModal from '../GlassModal.vue'
import MiniWidgetInstantiator from '../MiniWidgetInstantiator.vue'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const { showSnackbar } = useSnackbar()

const props = defineProps<{
  /**
   * Widget instance
   */
  widget: CustomWidget
}>()
const widget = toRefs(props).widget

const currentWidget = ref<Widget>(props.widget)
const lastKnownHashes = ref(new Map<string, string[]>())
const wrap = ref(false)
const widgetsAlignment = ref('justify-center')
const isMenuOpen = ref(false)
const isEditingWidgetName = ref(false)
const editedName = ref(props.widget.name)
const nameInput = ref<HTMLInputElement | null>(null)
const leftColumnWidth = ref(props.widget.options.leftColumnWidth || 50)
const isDragging = ref(false)
const widgetBase = ref<HTMLElement | null>(null)
const isWrapped = ref(false)
const wrapDirection = ref<'left' | 'right'>('right')
const trashList = ref<MiniWidget[] | CustomWidgetElement[]>([])

const updateWrapDirection = (): void => {
  if (widgetBase.value) {
    const widgetRect = widgetBase.value.getBoundingClientRect()
    const screenWidth = window.innerWidth
    const widgetCenterX = widgetRect.left + widgetRect.width / 2

    if (widgetCenterX < screenWidth / 2) {
      wrapDirection.value = 'left'
    } else {
      wrapDirection.value = 'right'
    }
  }
}

const wrapChevronIcon = computed(() => {
  if (wrapDirection.value === 'left') {
    return isWrapped.value ? 'mdi-chevron-right' : 'mdi-chevron-left'
  } else {
    return isWrapped.value ? 'mdi-chevron-left' : 'mdi-chevron-right'
  }
})

const enableEditing = (): void => {
  editedName.value = props.widget.name
  isEditingWidgetName.value = true

  nextTick(() => {
    if (nameInput.value) {
      nameInput.value.focus()
      nameInput.value.select()
    }
  })
}

const saveName = (): void => {
  isEditingWidgetName.value = false
  if (currentWidget.value && editedName.value !== currentWidget.value.name) {
    currentWidget.value.name = editedName.value
  }
}

const loadWidget = (event: Event): void => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    showSnackbar({ variant: 'error', message: 'No file selected.', duration: 3000 })
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const loadedWidget = JSON.parse(e.target?.result as string) as Widget
      const hash = currentWidget.value.hash
      widgetStore.loadWidgetFromFile(hash, loadedWidget)
    } catch (error) {
      showSnackbar({ variant: 'error', message: 'Invalid widget file format.', duration: 3000 })
    }
  }

  reader.readAsText(file)
}

const showWidgetTrashArea = ref(false)

const handleDeleteWidget = (): void => {
  widgetStore.elementToShowOnDrawer = undefined
  trashList.value = []
}

const handleOptionClick = (option: string): void => {
  isMenuOpen.value = false
  if (option === 'options') {
    widgetStore.widgetManagerVars(currentWidget.value.hash).configMenuOpen = true
  } else if (option === 'save') {
    downloadWidget()
  } else if (option === 'load') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.widget'

    input.addEventListener('change', (event: Event) => {
      loadWidget(event)
    })

    input.click()
  }
}

const downloadWidget = (): void => {
  const blob = new Blob([JSON.stringify(widget.value)], { type: 'application/json;charset=utf-8' })
  const fileName = `${widget.value.name}.widget`
  saveAs(blob, fileName)
}

const startResize = (event: MouseEvent): void => {
  if (!widgetStore.editingMode) return

  const startX = event.clientX
  const startWidth = leftColumnWidth.value
  isDragging.value = true

  const doDrag = (e: MouseEvent): void => {
    if (!widgetBase.value) return
    const containerWidth = widgetBase.value.offsetWidth
    const newWidth = startWidth + ((e.clientX - startX) / containerWidth) * 100
    leftColumnWidth.value = Math.max(10, Math.min(90, newWidth))
  }

  const stopDrag = (): void => {
    isDragging.value = false
    document.removeEventListener('mousemove', doDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  document.addEventListener('mousemove', doDrag)
  document.addEventListener('mouseup', stopDrag)
}

const leftContainers = computed(() =>
  currentWidget.value.options.elementContainers.filter((container: CustomWidgetElementContainer) =>
    container.name.includes('left')
  )
)
const rightContainers = computed(() =>
  currentWidget.value.options.elementContainers.filter((container: CustomWidgetElementContainer) =>
    container.name.includes('right')
  )
)

const convertedBackgroundOpacity = computed(() => Math.round(widget.value.options.backgroundOpacity * 255).toString(16))

const enableMovingOnDrag = (): void => {
  widgetStore.allowMovingAndResizing(currentWidget.value.hash, true)
  window.addEventListener('mouseup', disableMovingOnDrag)
  window.addEventListener('dragend', disableMovingOnDrag)
}

const disableMovingOnDrag = (): void => {
  updateWrapDirection()
  widgetStore.allowMovingAndResizing(currentWidget.value.hash, false)
  window.removeEventListener('mouseup', disableMovingOnDrag)
  window.removeEventListener('dragend', disableMovingOnDrag)
}

const widgetAdded = (e: SortableEvent.SortableEvent, containerName: string): void => {
  const container = currentWidget.value.options.elementContainers.find(
    (innerContainer: CustomWidgetElementContainer) => innerContainer.name === containerName
  )
  if (!container) return

  const currentHashes = container.elements.map((element: CustomWidgetElement) => element.hash)
  const previousHashes = lastKnownHashes.value.get(containerName) || []
  const newHash = currentHashes.find((hash: string) => !previousHashes.includes(hash))

  if (newHash) {
    const newWidget = container.elements.find((element: CustomWidgetElement) => element.hash === newHash)
    if (newWidget && e.pullMode === 'clone') {
      newWidget.hash = uuid()
      widgetStore.miniWidgetManagerVars(newWidget.hash).configMenuOpen = true
    }
    widgetStore.showElementPropsDrawer(newWidget.hash)
    lastKnownHashes.value.set(containerName, currentHashes)
  }
}

const { width: windowWidth } = useWindowSize()
const canvasSize = computed(() => ({
  width: currentWidget.value.size.width * windowWidth.value,
  height: currentWidget.value.size.height * windowWidth.value,
}))

const containerRef = ref<HTMLElement | null>(null)

watch(
  () => widgetStore.editingMode,
  (newValue) => {
    if (newValue === true) {
      disableMovingOnDrag()
      isWrapped.value = false
    }
  }
)

const loadWidgetFromStore = (): void => {
  try {
    const loadedWidget = widgetStore.editWidgetByHash(props.widget.hash)
    if (loadedWidget) {
      currentWidget.value = loadedWidget
    }
  } catch (error) {
    showSnackbar({ variant: 'warning', message: 'Error reading widget file.', duration: 1000 })
  }
}

onBeforeMount(() => {
  props.widget.options.elementContainers.forEach((container: CustomWidgetElementContainer) => {
    lastKnownHashes.value.set(
      container.name,
      container.elements.map((w) => w.hash)
    )
  })
})

onMounted(() => {
  updateWrapDirection()
  window.addEventListener('resize', updateWrapDirection)
  containerRef.value = document.querySelector('.main')
  loadWidgetFromStore()
  disableMovingOnDrag()
})
</script>

<style scoped>
.cursor-col-resize {
  cursor: col-resize;
}

.cursor-col-resize:hover,
.cursor-col-resize:active {
  background-color: #ffffff55;
}
</style>
