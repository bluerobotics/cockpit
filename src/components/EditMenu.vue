<template>
  <div class="w-full h-full bg-slate-600 z-[60]"></div>
  <div
    class="relative flex flex-col justify-between px-1 text-white edit-panel left-panel"
    :class="{ active: editMode }"
  >
    <div
      class="absolute text-2xl transition-all cursor-pointer text-slate-500 aspect-square mdi mdi-close hover:text-slate-300 left-2 top-2"
      @click="emit('update:editMode', false)"
    />
    <p class="flex items-center justify-center mt-10 text-xl font-semibold select-none">Edit interface</p>
    <div class="w-full h-px my-2 sm bg-slate-800/40" />
    <div ref="profilesContainer" class="flex flex-col items-center justify-center w-full px-2 shrink">
      <p class="mb-3 text-lg font-semibold select-none">Profiles</p>
      <TransitionGroup name="fade-and-suffle">
        <div
          v-for="profile in store.allProfiles"
          :key="profile.hash"
          class="flex items-center justify-between w-full my-1"
        >
          <Button
            class="flex items-center justify-center w-full h-8 overflow-auto"
            :class="{ 'selected-view': profile.hash === store.currentProfile.hash }"
            @click="store.loadProfile(profile)"
          >
            <p class="overflow-hidden text-sm text-ellipsis ml-7 whitespace-nowrap">{{ profile.name }}</p>
            <div class="grow" />
            <div class="icon-btn mdi mdi-download" @click="store.exportProfile(profile)" />
            <template v-if="!store.isDefaultProfile(profile)">
              <div class="icon-btn mdi mdi-cog" @click="renameProfile(profile)" />
              <div class="icon-btn mdi mdi-trash-can" @click.stop="store.deleteProfile(profile)" />
            </template>
          </Button>
        </div>
        <div class="flex mt-2">
          <div class="icon-btn mdi mdi-plus" @click="addNewProfile" />
          <div class="icon-btn">
            <label class="flex items-center justify-center w-full h-full cursor-pointer">
              <input type="file" accept="application/json" hidden @change="(e: Event) => store.importProfile(e)" />
              <span class="mdi mdi-upload" />
            </label>
          </div>
        </div>
      </TransitionGroup>
    </div>
    <div class="w-full h-px my-2 sm bg-slate-800/40" />
    <div ref="viewsContainer" class="flex flex-col items-center justify-between w-full shrink overflow-y-clip h-[30%]">
      <p class="mb-3 text-lg font-semibold select-none">Views</p>
      <div class="w-full px-2 overflow-x-hidden overflow-y-auto">
        <TransitionGroup name="fade-and-suffle">
          <div
            v-for="view in store.currentProfile.views"
            :key="view.hash"
            class="flex items-center justify-between w-full my-1"
          >
            <Button
              class="flex items-center justify-center w-full h-8 overflow-auto"
              :class="{ 'selected-view': view === store.currentView }"
              @click="store.selectView(view)"
            >
              <p class="overflow-hidden text-sm text-ellipsis ml-7 whitespace-nowrap">{{ view.name }}</p>
              <div class="grow" />
              <div class="icon-btn mdi mdi-cog" @click="renameView(view)" />
              <div class="icon-btn mdi mdi-trash-can" @click.stop="store.deleteView(view)" />
            </Button>
          </div>
        </TransitionGroup>
      </div>
      <div class="grow" />
    </div>
    <div ref="managementContainer" class="flex items-center justify-center w-full px-2">
      <div class="icon-btn mdi mdi-plus" @click="addNewView" />
      <div class="icon-btn">
        <label class="flex items-center justify-center w-full h-full cursor-pointer">
          <input type="file" accept="application/json" hidden @change="(e: Event) => store.importView(e)" />
          <span class="mdi mdi-upload" />
        </label>
      </div>
      <div class="icon-btn mdi mdi-download" @click="store.exportCurrentView" />
      <div />
    </div>
    <div class="w-full h-px my-2 sm bg-slate-800/40" />
    <div
      v-show="widgetMode === WidgetMode.RegularWidgets"
      class="flex flex-col items-center justify-between w-full overflow-y-clip h-[35%]"
    >
      <p class="text-lg font-semibold select-none">Current widgets</p>
      <div class="grow" />
      <VueDraggable
        v-model="store.currentView.widgets"
        class="flex flex-col items-center w-full px-2 overflow-x-hidden overflow-y-auto grow"
        animation="150"
        group="regularWidgetsGroup"
      >
        <TransitionGroup name="fade">
          <div
            v-for="widget in store.currentView.widgets"
            :key="widget.hash"
            class="flex items-center justify-between w-full my-1"
          >
            <Button
              class="flex items-center justify-center w-full h-8 pl-3 overflow-auto cursor-grab active:cursor-grabbing"
            >
              <span class="mr-3 text-base text-slate-700 mdi mdi-dots-grid"></span>
              <p class="overflow-hidden text-sm text-ellipsis whitespace-nowrap">{{ widget.name }}</p>
              <div class="grow" />
              <div
                class="icon-btn mdi mdi-fullscreen"
                :class="{ 'mdi-fullscreen-exit': store.isFullScreen(widget) }"
                @click="store.toggleFullScreen(widget)"
              />
              <div class="icon-btn mdi mdi-cog" @click="store.openWidgetConfigMenu(widget)" />
              <div class="icon-btn mdi mdi-trash-can" @click="store.deleteWidget(widget)" />
            </Button>
          </div>
        </TransitionGroup>
      </VueDraggable>
      <div class="grow" />
    </div>
    <div
      v-show="widgetMode === WidgetMode.MiniWidgets"
      class="flex flex-col items-center justify-between w-full overflow-y-auto h-[35%]"
    >
      <p class="text-lg font-semibold select-none">Current mini-widgets</p>
      <div class="grow" />
      <div
        v-for="miniWidgetContainer in store.currentView.miniWidgetContainers"
        :key="miniWidgetContainer.name"
        class="w-full"
      >
        <span class="w-full px-1 text-sm text-left select-none text-slate-400">{{ miniWidgetContainer.name }}</span>
        <div class="flex flex-col items-center w-full px-3 overflow-x-hidden grow">
          <TransitionGroup name="fade">
            <div v-if="miniWidgetContainer.widgets.isEmpty()" class="flex items-center justify-between w-full my-1">
              ---
            </div>
            <div
              v-for="widget in miniWidgetContainer.widgets"
              :key="widget.hash"
              class="flex items-center justify-between w-full h-10 my-1"
            >
              <div class="flex items-center justify-start w-full overflow-auto">
                <p class="overflow-hidden select-none text-ellipsis whitespace-nowrap">{{ widget.component }}</p>
              </div>
              <div class="icon-btn mdi mdi-cog" @click="widget.managerVars.configMenuOpen = true" />
              <div class="icon-btn mdi mdi-trash-can" @click="store.deleteMiniWidget(widget)" />
            </div>
          </TransitionGroup>
        </div>
      </div>
      <div class="grow" />
    </div>
    <div class="w-full h-px mt-4 bg-slate-800/40" />
  </div>
  <div
    class="flex flex-col items-center justify-center px-3 text-white edit-panel middle-panel"
    :class="{ active: editMode }"
  >
    <Button
      class="flex items-center justify-center w-full h-8 my-1 hover:bg-slate-500"
      :class="{ 'bg-slate-700': widgetMode !== WidgetMode.RegularWidgets }"
      @click="widgetMode = WidgetMode.RegularWidgets"
    >
      <p class="overflow-hidden text-ellipsis whitespace-nowrap">Regular widgets</p>
    </Button>
    <Button
      class="flex items-center justify-center w-full h-8 my-1 hover:bg-slate-500"
      :class="{ 'bg-slate-700': widgetMode !== WidgetMode.MiniWidgets }"
      @click="widgetMode = WidgetMode.MiniWidgets"
    >
      <p class="overflow-hidden text-ellipsis whitespace-nowrap">Mini widgets</p>
    </Button>
  </div>
  <div class="flex items-center justify-between py-2 edit-panel bottom-panel" :class="{ active: editMode }">
    <div class="w-px h-full mr-2 bg-slate-800/40" />
    <div
      v-show="widgetMode === WidgetMode.RegularWidgets"
      ref="availableWidgetsContainer"
      class="flex items-center justify-between w-full h-full overflow-x-auto text-white aspect-square"
    >
      <div
        v-for="widgetType in availableWidgetTypes"
        :key="widgetType"
        class="flex flex-col items-center justify-center p-2 mx-3 rounded-md bg-slate-500 h-5/6 aspect-square"
      >
        <div
          class="flex items-center justify-center w-8 m-2 transition-all rounded-md cursor-pointer bg-slate-700 aspect-square mdi mdi-plus hover:bg-slate-400"
          @click="store.addWidget(widgetType, store.currentView)"
        />
        {{ widgetType }}
      </div>
    </div>
    <div
      v-show="widgetMode === WidgetMode.MiniWidgets"
      ref="availableMiniWidgetsContainer"
      class="flex items-center w-full h-full gap-2 overflow-auto"
    >
      <div
        v-for="miniWidget in availableMiniWidgetTypes"
        :key="miniWidget.hash"
        class="flex flex-col items-center justify-center p-2 mx-3 transition-all rounded-md h-5/6 w-fit text-slate-100 cursor-grab"
        :class="{ 'hover:bg-slate-400': !mousePressed }"
      >
        <div class="m-2 pointer-events-none select-none">
          <MiniWidgetInstantiator :mini-widget="miniWidget" />
        </div>
      </div>
    </div>
  </div>
  <teleport to="body">
    <v-dialog v-model="viewRenameDialogRevealed" width="20rem">
      <v-card class="pa-2">
        <v-card-text>
          <v-text-field v-model="newViewName" counter="25" label="New view name" />
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn @click="viewRenameDialog.confirm">Save</v-btn>
          <v-btn @click="viewRenameDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
  <teleport to="body">
    <v-dialog v-model="profileRenameDialogRevealed" width="20rem">
      <v-card class="pa-2">
        <v-card-text>
          <v-text-field v-model="newProfileName" counter="25" label="New profile name" />
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn @click="profileRenameDialog.confirm">Save</v-btn>
          <v-btn @click="profileRenameDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { useConfirmDialog, useMousePressed } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { computed, onMounted, ref, toRefs, watch } from 'vue'
import { nextTick } from 'vue'
import { type UseDraggableOptions, useDraggable, VueDraggable } from 'vue-draggable-plus'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { MiniWidgetType } from '@/types/miniWidgets'
import { type Profile, type View, type Widget, WidgetType } from '@/types/widgets'

import Button from './Button.vue'
import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'

const store = useWidgetManagerStore()
const trashList = ref<Widget[]>([])
watch(trashList, () => {
  nextTick(() => (trashList.value = []))
})

const props = defineProps<{
  /**
   * Whether or not the interface is in edit mode
   */
  editMode: boolean
}>()

const emit = defineEmits<{
  (e: 'update:editMode', editMode: boolean): void
}>()

const availableWidgetTypes = computed(() => Object.values(WidgetType))
const availableMiniWidgetTypes = computed(() =>
  Object.values(MiniWidgetType).map((widgetType) => ({
    component: widgetType,
    options: {},
    hash: uuid(),
    managerVars: {
      timesMounted: 0,
      configMenuOpen: false,
    },
  }))
)

const widgetAddMenuGroupOptions = {
  name: 'generalGroup',
  pull: 'clone',
  put: false,
  revertClone: false,
}

const editMode = toRefs(props).editMode

const viewBeingRenamed = ref(store.currentView)
const newViewName = ref('')
const viewRenameDialogRevealed = ref(false)
const viewRenameDialog = useConfirmDialog(viewRenameDialogRevealed)
viewRenameDialog.onConfirm(() => {
  store.renameView(viewBeingRenamed.value, newViewName.value)
  newViewName.value = ''
})

const profileBeingRenamed = ref(store.currentProfile)
const newProfileName = ref('')
const profileRenameDialogRevealed = ref(false)
const profileRenameDialog = useConfirmDialog(profileRenameDialogRevealed)
profileRenameDialog.onConfirm(() => {
  profileBeingRenamed.value.name = newProfileName.value
  newProfileName.value = ''
})

const addNewView = (): void => {
  store.addView()
  renameView(store.currentView)
}

const addNewProfile = (): void => {
  store.addProfile()
  renameProfile(store.currentProfile)
}

const renameView = (view: View): void => {
  viewBeingRenamed.value = view
  newViewName.value = view.name
  viewRenameDialogRevealed.value = true
}

const renameProfile = (profile: Profile): void => {
  profileBeingRenamed.value = profile
  newProfileName.value = profile.name
  profileRenameDialogRevealed.value = true
}

const availableWidgetsContainer = ref()
const availableMiniWidgetsContainer = ref()

// @ts-ignore: Documentation is not clear on what generic should be passed to 'UseDraggableOptions'
const miniWidgetsContainerOptions = ref<UseDraggableOptions>({
  animation: '150',
  group: widgetAddMenuGroupOptions,
  sort: false,
})
useDraggable(availableMiniWidgetsContainer, availableMiniWidgetTypes, miniWidgetsContainerOptions)

onMounted(() => {
  const widgetContainers = [availableWidgetsContainer.value, availableMiniWidgetsContainer.value]
  widgetContainers.forEach((container) => {
    container.addEventListener('wheel', function (e: WheelEvent) {
      if (e.deltaY > 0) container.scrollLeft += 100
      else container.scrollLeft -= 100
    })
  })
})

// eslint-disable-next-line jsdoc/require-jsdoc, no-redeclare
enum WidgetMode {
  RegularWidgets,
  MiniWidgets,
}

const widgetMode = ref(WidgetMode.RegularWidgets)

const { pressed: mousePressed } = useMousePressed()
</script>

<style scoped>
.edit-panel {
  transition: all 0.2s;
  position: absolute;
  z-index: 60;
  background-color: rgb(71 85 105);
}
.left-panel {
  top: 0%;
  height: 80%;
  width: 20%;
  left: -20%;
}
.left-panel.active {
  left: 0%;
}
.middle-panel {
  bottom: -20%;
  left: -20%;
  height: 20%;
  width: 20%;
}
.middle-panel.active {
  bottom: 0%;
  left: 0%;
}
.bottom-panel {
  right: 0%;
  bottom: -20%;
  height: 20%;
  width: 80%;
}
.bottom-panel.active {
  bottom: 0%;
}
.v-expansion-panel {
  background-color: rgba(0, 0, 0, 0);
  color: white;
}

.fade-and-suffle-move,
.fade-and-suffle-enter-active,
.fade-and-suffle-leave-active,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}
.fade-and-suffle-enter-from,
.fade-enter-from,
.fade-and-suffle-leave-to,
.fade-leave-to {
  opacity: 0;
  transform: scaleY(0.01) translate(30px, 0);
}

.sortable-ghost {
  cursor: grabbing;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  aspect-ratio: 1;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-left: 0.25rem;
  transition: all;
  border-radius: 0.125rem;
  cursor: pointer;
  @apply bg-slate-700;
}
.icon-btn:hover {
  @apply bg-slate-500;
}

.selected-view {
  @apply bg-slate-400;
}
</style>
