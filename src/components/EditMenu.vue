<template>
  <div class="z-[60] h-full w-full bg-slate-600"></div>
  <div
    class="edit-panel left-panel relative flex flex-col justify-between px-1 text-white"
    :class="{ active: editMode }"
  >
    <div
      class="mdi mdi-close absolute left-2 top-2 aspect-square cursor-pointer text-2xl text-slate-500 transition-all hover:text-slate-300"
      @click="emit('update:editMode', false)"
    />
    <div class="mt-10 flex select-none items-center justify-center text-xl font-semibold">
      <p>Edit interface</p>
      <div
        class="icon-btn mdi mdi-dots-vertical absolute right-2 !bg-slate-600"
        @click.stop="editMenuDialogRevealed = true"
      />
    </div>
    <div class="sm my-2 h-px w-full bg-slate-800/40" />
    <div class="flex h-[35%] w-full shrink flex-col items-center justify-center overflow-y-clip px-2">
      <p class="mb-3 select-none text-lg font-semibold">Profiles</p>
      <div class="w-full overflow-y-auto overflow-x-hidden px-2">
        <TransitionGroup name="fade-and-suffle">
          <div
            v-for="profile in store.savedProfiles"
            :key="profile.hash"
            class="my-1 flex w-full items-center justify-between"
          >
            <Button
              class="flex h-8 w-full items-center justify-center overflow-auto"
              :class="{ 'selected-view': profile.hash === store.currentProfile.hash }"
              @click="store.loadProfile(profile)"
            >
              <p class="ml-7 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{{ profile.name }}</p>
              <div class="grow" />
              <div class="icon-btn mdi mdi-download" @click.stop="store.exportProfile(profile)" />
              <div class="icon-btn mdi mdi-content-copy" @click.stop="store.duplicateProfile(profile)" />
              <div class="icon-btn mdi mdi-cog" @click.stop="renameProfile(profile)" />
              <div class="icon-btn mdi mdi-trash-can" @click.stop="store.deleteProfile(profile)" />
            </Button>
          </div>
        </TransitionGroup>
      </div>
      <div class="mt-2 flex">
        <div class="icon-btn mdi mdi-plus" @click="addNewProfile" />
        <div class="icon-btn">
          <label class="flex h-full w-full cursor-pointer items-center justify-center">
            <input type="file" accept="application/json" hidden @change="(e: Event) => store.importProfile(e)" />
            <span class="mdi mdi-upload" />
          </label>
        </div>
        <div
          v-tooltip="'Export profiles to vehicle.'"
          class="icon-btn mdi mdi-briefcase-upload"
          @click="store.exportProfilesToVehicle"
        />
        <div
          v-tooltip="'Import profiles from vehicle.'"
          class="icon-btn mdi mdi-briefcase-download"
          @click="store.importProfilesFromVehicle"
        />
        <div
          v-tooltip="'Reset profiles to default configuration.'"
          class="icon-btn mdi mdi-restore"
          @click="resetSavedProfiles"
        />
      </div>
    </div>
    <div class="sm my-2 h-px w-full bg-slate-800/40" />
    <div ref="viewsContainer" class="flex h-[30%] w-full shrink flex-col items-center justify-between overflow-y-clip">
      <p class="mb-3 select-none text-lg font-semibold">Views</p>
      <div class="w-full overflow-y-auto overflow-x-hidden px-2">
        <TransitionGroup name="fade-and-suffle">
          <div
            v-for="view in store.currentProfile.views"
            :key="view.hash"
            class="my-1 flex w-full items-center justify-between"
          >
            <Button
              class="flex h-8 w-full items-center justify-center overflow-auto"
              :class="{ 'selected-view': view === store.currentView }"
              @click="store.selectView(view)"
            >
              <p class="ml-7 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{{ view.name }}</p>
              <div class="grow" />
              <div
                class="icon-btn mdi mdi-eye"
                :class="{ 'mdi-eye-closed': !view.visible }"
                @click.stop="toggleViewVisibility(view)"
              />
              <div class="icon-btn mdi mdi-download" @click.stop="store.exportView(view)" />
              <div class="icon-btn mdi mdi-content-copy" @click.stop="store.duplicateView(view)" />
              <div class="icon-btn mdi mdi-cog" @click.stop="renameView(view)" />
              <div class="icon-btn mdi mdi-trash-can" @click.stop="store.deleteView(view)" />
            </Button>
          </div>
        </TransitionGroup>
      </div>
      <div class="grow" />
    </div>
    <div ref="managementContainer" class="mt-2 flex w-full items-center justify-center px-2">
      <div class="icon-btn mdi mdi-plus" @click="addNewView" />
      <div class="icon-btn">
        <label class="flex h-full w-full cursor-pointer items-center justify-center">
          <input type="file" accept="application/json" hidden @change="(e: Event) => store.importView(e)" />
          <span class="mdi mdi-upload" />
        </label>
      </div>
      <div />
    </div>
    <div class="sm my-2 h-px w-full bg-slate-800/40" />
    <div
      v-show="widgetMode === WidgetMode.RegularWidgets"
      class="flex h-[35%] w-full flex-col items-center justify-between overflow-y-clip"
    >
      <p class="select-none text-lg font-semibold">
        <span class="mdi mdi-swap-vertical mr-1 text-slate-400" />
        Current widgets
      </p>
      <div class="grow" />
      <VueDraggable
        v-model="store.currentView.widgets"
        class="flex w-full grow flex-col items-center overflow-y-auto overflow-x-hidden px-2"
        :animation="150"
        group="regularWidgetsGroup"
      >
        <TransitionGroup name="fade">
          <div
            v-for="widget in store.currentView.widgets"
            :key="widget.hash"
            class="my-1 flex w-full items-center justify-between"
          >
            <Button
              class="flex h-8 w-full cursor-grab items-center justify-center overflow-auto pl-3 active:cursor-grabbing"
              :class="{ '!bg-slate-400': widget.managerVars.highlighted }"
              @mouseover="widget.managerVars.highlighted = true"
              @mouseleave="widget.managerVars.highlighted = false"
            >
              <span class="mr-3 text-base text-slate-700">⠿</span>
              <p class="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{{ widget.name }}</p>
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
      class="flex h-[35%] w-full flex-col items-center justify-between overflow-y-auto"
    >
      <p class="select-none text-lg font-semibold">Current mini-widgets</p>
      <div class="grow" />
      <div
        v-for="miniWidgetContainer in store.miniWidgetContainersInCurrentView"
        :key="miniWidgetContainer.name"
        class="w-full"
      >
        <span class="w-full select-none px-1 text-left text-sm text-slate-400">{{ miniWidgetContainer.name }}</span>
        <div class="flex w-full grow flex-col items-center overflow-x-hidden px-3">
          <TransitionGroup name="fade">
            <div v-if="miniWidgetContainer.widgets.isEmpty()" class="my-1 flex w-full items-center justify-between">
              ---
            </div>
            <div
              v-for="widget in miniWidgetContainer.widgets"
              :key="widget.hash"
              class="my-1 flex h-10 w-full items-center justify-between rounded-md px-2 py-1"
              :class="{ 'bg-slate-400': widget.managerVars.highlighted }"
              @mouseover="widget.managerVars.highlighted = true"
              @mouseleave="widget.managerVars.highlighted = false"
            >
              <div class="flex w-full items-center justify-start overflow-auto">
                <p class="select-none overflow-hidden text-ellipsis whitespace-nowrap">
                  {{ widget.name || widget.component }}
                </p>
              </div>
              <div class="icon-btn mdi mdi-cog" @click="widget.managerVars.configMenuOpen = true" />
              <div class="icon-btn mdi mdi-trash-can" @click="store.deleteMiniWidget(widget)" />
            </div>
          </TransitionGroup>
        </div>
      </div>
      <div class="grow" />
    </div>
    <div class="mt-4 h-px w-full bg-slate-800/40" />
  </div>
  <div
    class="edit-panel middle-panel flex flex-col items-center justify-center px-3 text-white"
    :class="{ active: editMode }"
  >
    <Button
      class="my-1 flex h-8 w-full items-center justify-center hover:bg-slate-500"
      :class="{ 'bg-slate-700': widgetMode !== WidgetMode.RegularWidgets }"
      @click="widgetMode = WidgetMode.RegularWidgets"
    >
      <p class="overflow-hidden text-ellipsis whitespace-nowrap">Regular widgets</p>
    </Button>
    <Button
      class="my-1 flex h-8 w-full items-center justify-center hover:bg-slate-500"
      :class="{ 'bg-slate-700': widgetMode !== WidgetMode.MiniWidgets }"
      @click="widgetMode = WidgetMode.MiniWidgets"
    >
      <p class="overflow-hidden text-ellipsis whitespace-nowrap">Mini widgets</p>
    </Button>
  </div>
  <div class="edit-panel bottom-panel flex items-center justify-between py-2" :class="{ active: editMode }">
    <div class="mr-2 h-full w-px bg-slate-800/40" />
    <div
      v-show="widgetMode === WidgetMode.RegularWidgets"
      ref="availableWidgetsContainer"
      class="flex aspect-square h-full w-full items-center justify-between overflow-x-auto text-white"
    >
      <div
        v-for="widgetType in availableWidgetTypes"
        :key="widgetType"
        class="mx-3 flex aspect-square h-5/6 flex-col items-center justify-center rounded-md bg-slate-500 p-2"
      >
        <div
          class="mdi mdi-plus m-2 flex aspect-square w-8 cursor-pointer items-center justify-center rounded-md bg-slate-700 transition-all hover:bg-slate-400"
          @click="store.addWidget(widgetType, store.currentView)"
        />
        {{ widgetType }}
      </div>
    </div>
    <div
      v-show="widgetMode === WidgetMode.MiniWidgets"
      ref="availableMiniWidgetsContainer"
      class="flex h-full w-full items-center gap-2 overflow-auto"
    >
      <div
        v-for="miniWidget in availableMiniWidgetTypes"
        :key="miniWidget.hash"
        class="mx-3 flex h-5/6 w-fit cursor-grab flex-col items-center justify-center rounded-md p-2 text-slate-100 transition-all"
        :class="{ 'hover:bg-slate-400': !mousePressed }"
      >
        <div class="pointer-events-none m-2 select-none">
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
          <v-switch
            v-model="store.currentView.showBottomBarOnBoot"
            label="Show bottom bar on boot"
            class="m-2 text-slate-800"
          />
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn @click="viewRenameDialog.confirm">Save</v-btn>
          <v-btn @click="viewRenameDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
  <teleport to="body">
    <v-dialog v-model="profileConfigDialogRevealed" width="36rem">
      <v-card class="pa-2">
        <v-card-text>
          <v-text-field v-model="newProfileName" counter="25" label="New profile name" />
          <div class="my-2 flex w-full flex-col items-center">
            <v-combobox
              v-model="vehicleTypesAssignedToCurrentProfile"
              :items="availableVehicleTypes"
              label="Vehicle types that use this profile by default:"
              chips
              multiple
              variant="outlined"
              class="m-4 w-10/12"
            />
          </div>
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn @click="profileConfigDialog.confirm">Save</v-btn>
          <v-btn @click="profileConfigDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
  <teleport to="body">
    <v-dialog v-model="editMenuDialogRevealed" width="20rem">
      <v-card class="pa-2">
        <v-card-text>
          <v-switch v-model="store.snapToGrid" label="Snap to grid" class="m-2 text-slate-800" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { useConfirmDialog, useMousePressed } from '@vueuse/core'
import Swal from 'sweetalert2'
import { v4 as uuid } from 'uuid'
import { computed, onMounted, ref, toRefs, watch } from 'vue'
import { nextTick } from 'vue'
import { type UseDraggableOptions, useDraggable, VueDraggable } from 'vue-draggable-plus'

import { defaultMiniWidgetManagerVars } from '@/assets/defaults'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { isHorizontalScroll } from '@/libs/utils'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type Profile, type View, type Widget, MiniWidgetType, WidgetType } from '@/types/widgets'

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
    name: widgetType,
    options: {},
    hash: uuid(),
    managerVars: defaultMiniWidgetManagerVars,
  }))
)

const widgetAddMenuGroupOptions = {
  name: 'generalGroup',
  pull: 'clone',
  put: false,
  revertClone: false,
}

const editMode = toRefs(props).editMode

const editMenuDialogRevealed = ref(false)
useConfirmDialog(editMenuDialogRevealed)

const viewBeingRenamed = ref(store.currentView)
const newViewName = ref('')
const viewRenameDialogRevealed = ref(false)
const viewRenameDialog = useConfirmDialog(viewRenameDialogRevealed)
viewRenameDialog.onConfirm(() => {
  store.renameView(viewBeingRenamed.value, newViewName.value)
  newViewName.value = ''
})

const profileBeingConfigured = ref(store.currentProfile)
const newProfileName = ref('')
const profileConfigDialogRevealed = ref(false)
const profileConfigDialog = useConfirmDialog(profileConfigDialogRevealed)
profileConfigDialog.onConfirm(() => {
  profileBeingConfigured.value.name = newProfileName.value
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

const toggleViewVisibility = (view: View): void => {
  if (view.visible && view === store.currentView) {
    Swal.fire({ text: 'You cannot hide the current view.', icon: 'error' })
    return
  }
  view.visible = !view.visible
}

const renameProfile = (profile: Profile): void => {
  profileBeingConfigured.value = profile
  newProfileName.value = profile.name
  profileConfigDialogRevealed.value = true
}

const resetSavedProfiles = async (): Promise<void> => {
  const result = await Swal.fire({
    text: 'Are you sure you want to reset your profiles to the default ones?',
    showCancelButton: true,
    confirmButtonText: 'Reset',
    icon: 'warning',
  })
  if (result.isConfirmed) store.resetSavedProfiles()
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
    container.addEventListener(
      'wheel',
      function (e: WheelEvent) {
        // In case of horizontal scroll skip the previous wheel event and let the horizontal scroll work
        if (isHorizontalScroll(e)) return

        const scrollBy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX

        container.scrollLeft += Math.sign(scrollBy) * Math.min(Math.abs(scrollBy), 100)

        // Prevents this wheel to avoid a following scroll to happens and act simultaneously
        e.preventDefault()
      },
      { passive: false }
    )
  })
})

// eslint-disable-next-line jsdoc/require-jsdoc, no-redeclare
enum WidgetMode {
  RegularWidgets,
  MiniWidgets,
}

const widgetMode = ref(WidgetMode.RegularWidgets)

const { pressed: mousePressed } = useMousePressed()

const availableVehicleTypes = computed(() => Object.keys(MavType))

const vehicleTypesAssignedToCurrentProfile = computed({
  get() {
    return Object.keys(store.vehicleTypeProfileCorrespondency).filter((vType) => {
      // @ts-ignore: Enums in TS such
      return store.vehicleTypeProfileCorrespondency[vType] === profileBeingConfigured.value.hash
    })
  },
  set(selectedVehicleTypes: string[]) {
    availableVehicleTypes.value.forEach((vType) => {
      // @ts-ignore: Enums in TS such
      if (store.vehicleTypeProfileCorrespondency[vType] === profileBeingConfigured.value.hash) {
        // @ts-ignore: Enums in TS such
        store.vehicleTypeProfileCorrespondency[vType] = undefined
      }
      if (selectedVehicleTypes.includes(vType)) {
        // @ts-ignore: Enums in TS such
        store.vehicleTypeProfileCorrespondency[vType] = profileBeingConfigured.value.hash
      }
    })
  },
})
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
