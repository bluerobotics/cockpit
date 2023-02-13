<template>
  <div v-if="editMode" class="w-full h-full pointer-events-none position-absolute editing-mode-overlay" />
  <div
    ref="editMenu"
    class="flex flex-col items-center justify-between h-full px-2 py-6 m-0 overflow-y-scroll text-white nav-drawer"
  >
    <p class="my-1 text-xl font-semibold">Edit menu</p>
    <div class="w-11/12 h-px my-1 bg-white" />
    <v-expansion-panels v-model="openPanels">
      <v-expansion-panel>
        <v-expansion-panel-title>Current profile: {{ store.currentProfile.name }} </v-expansion-panel-title>
        <v-expansion-panel-text class="pa-2">
          <div v-if="selectedLayer !== undefined">
            <p class="mt-4">Layer</p>
            <div class="flex items-center m-2">
              <v-select
                v-model="selectedLayer"
                :items="availableLayers"
                density="compact"
                variant="outlined"
                no-data-text="No layers available."
                hide-details
              />
              <v-btn
                class="ml-2"
                icon="mdi-delete"
                size="small"
                variant="outlined"
                rounded="lg"
                @click="layerDeleteDialog.reveal"
              />
            </div>
            <p class="mt-4">Widgets</p>
            <template v-if="selectedLayer.widgets.length > 0">
              <li v-for="widget in selectedLayer.widgets" :key="widget.hash" class="pl-6">
                {{ widget.component }}
              </li>
            </template>
            <p v-else class="pl-6">No widgets in layer.</p>
            <div class="flex items-center m-3">
              <v-select
                v-model="selectedWidgetType"
                :items="availableWidgetTypes"
                density="compact"
                variant="outlined"
                label="Widget type"
                hide-details
              />
              <v-btn
                class="ml-2"
                icon="mdi-plus"
                size="small"
                rounded="lg"
                :disabled="selectedWidgetType === undefined"
                variant="outlined"
                @click="addWidget"
              />
            </div>
          </div>
          <v-btn class="ma-1" variant="plain" @click="addLayer">Add new layer</v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
    <div class="flex items-center w-10/12 my-2 justify-evenly">
      <v-select
        v-model="selectedProfile"
        :items="availableProfiles"
        class="w-10/12 m-1 max-h-16"
        density="compact"
        variant="outlined"
        label="Layer profiles"
        no-data-text="No layer profiles"
        hide-details
      />
      <v-btn class="m-1" icon="mdi-download" size="small" variant="outlined" rounded="lg" @click="loadProfile" />
    </div>
    <v-btn class="m-1 text-white" @click="profileCreationDialog.reveal"> Create new profile </v-btn>
    <v-btn class="m-1 text-white" @click="profileResetDialog.reveal"> Reset profiles </v-btn>
    <v-switch
      class="flex items-center justify-center m-1 max-h-8"
      label="Grid"
      :model-value="showGrid"
      hide-details
      @change="emit('update:showGrid', !showGrid)"
    />
    <v-btn class="w-10/12" variant="outlined" @click="emit('update:editMode', false)">Exit edit mode</v-btn>
  </div>
  <teleport to="body">
    <v-dialog v-model="layerDeleteDialogRevealed" width="auto">
      <v-card class="pa-2">
        <v-card-title>Delete layer?</v-card-title>
        <v-card-actions>
          <v-btn @click="layerDeleteDialog.confirm">Yes</v-btn>
          <v-btn @click="layerDeleteDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="profileResetDialogRevealed" width="auto">
      <v-card class="pa-2">
        <v-card-title>Reset profiles?</v-card-title>
        <v-card-actions>
          <v-btn @click="profileResetDialog.confirm">Yes</v-btn>
          <v-btn @click="profileResetDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="profileCreationDialogRevealed" width="50%">
      <v-card class="pa-2">
        <v-card-title>New profile</v-card-title>
        <v-card-text>
          <v-form v-model="newProfileForm">
            <v-text-field
              v-model="newProfileName"
              autofocus
              hide-details="auto"
              label="Profile name"
              :rules="[(name) => !!name || 'Name is required']"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn :disabled="!newProfileForm" @click="createNewProfile()"> Create </v-btn>
          <v-btn @click="profileCreationDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { useConfirmDialog, useMouse, useMouseInElement } from '@vueuse/core'
import gsap from 'gsap'
import Swal from 'sweetalert2'
import { computed, ref, toRefs, watch } from 'vue'

import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

const store = useWidgetManagerStore()

const props = defineProps<{
  /**
   * To show or not the snapping grid on the background (model prop)
   */
  showGrid: boolean
  /**
   * Whether or not the interface is in edit mode
   */
  editMode: boolean
}>()

const emit = defineEmits<{
  (e: 'update:showGrid', showGrid: boolean): void
  (e: 'update:editMode', editMode: boolean): void
}>()

const openPanels = ref([0])
const availableWidgetTypes = computed(() => Object.values(WidgetType))
const selectedWidgetType = ref()
const selectedProfile = ref()
const selectedLayer = ref(store.currentProfile.layers[0])
const newProfileName = ref('')
const newProfileForm = ref(false)

const editMode = toRefs(props).editMode

const showDrawer = ref(props.editMode)
const { x: mouseX } = useMouse()

const editMenu = ref()
const { isOutside: notHoveringEditMenu } = useMouseInElement(editMenu)
const mouseNearLeftBorder = computed(() => mouseX.value < 50)

watch(showDrawer, (isShowing, wasShowing) => {
  if (!wasShowing && isShowing) {
    gsap.to('.nav-drawer', { x: 400, duration: 0.25 })
  } else if (wasShowing && !isShowing) {
    gsap.to('.nav-drawer', { x: -400, duration: 0.25 })
  }
})

watch(mouseNearLeftBorder, (isNear, wasNear) => {
  if (editMode.value && !wasNear && isNear) {
    showDrawer.value = true
  }
})

watch(notHoveringEditMenu, (isNotHovering, wasNotHovering) => {
  if (!wasNotHovering && isNotHovering) {
    showDrawer.value = false
  }
})

watch(editMode, (isEditMode, wasEditMode) => {
  showDrawer.value = !wasEditMode && isEditMode
})

const availableLayers = computed(() =>
  store.currentProfile.layers.slice().map((layer) => ({
    title: layer.name,
    value: layer,
  }))
)

const availableProfiles = computed(() =>
  Object.values(store.savedProfiles).map((profile) => ({
    title: profile.name,
    value: profile,
  }))
)

const loadProfile = (): void => {
  if (selectedProfile.value === undefined) {
    console.warn('Cannot load profile. No profile selected.')
    return
  }
  store.loadProfile(selectedProfile.value)
  selectedLayer.value = store.currentProfile.layers[0]
}
const createNewProfile = async (): Promise<void> => {
  profileCreationDialogRevealed.value = false
  try {
    const newProfile = store.saveProfile(newProfileName.value, store.currentProfile.layers)
    store.loadProfile(newProfile)
    selectedProfile.value = store.currentProfile
    newProfileName.value = ''
    profileCreationDialog.confirm()
  } catch (error) {
    await Swal.fire({ title: 'Could not create new profile!', text: error as string, icon: 'error' })
    profileCreationDialogRevealed.value = true
  }
}
const deleteLayer = (): void => {
  store.deleteLayer(selectedLayer.value)
  selectedLayer.value = store.currentProfile.layers[0]
}
const resetProfiles = (): void => {
  store.resetSavedProfiles()
  store.resetCurrentProfile()
  selectedLayer.value = store.currentProfile.layers[0]
}
const addLayer = (): void => {
  store.addLayer()
  selectedLayer.value = store.currentProfile.layers[0]
}

const addWidget = (): void => {
  if (selectedWidgetType.value === undefined) return
  if (selectedLayer.value === undefined) return
  store.addWidget(selectedWidgetType.value, selectedLayer.value)
}

const layerDeleteDialogRevealed = ref(false)
const layerDeleteDialog = useConfirmDialog(layerDeleteDialogRevealed)
layerDeleteDialog.onConfirm(deleteLayer)

const profileCreationDialogRevealed = ref(false)
const profileCreationDialog = useConfirmDialog(profileCreationDialogRevealed)

const profileResetDialogRevealed = ref(false)
const profileResetDialog = useConfirmDialog(profileResetDialogRevealed)
profileResetDialog.onConfirm(resetProfiles)
</script>

<style scoped>
.nav-drawer {
  position: absolute;
  left: -400px;
  width: 380px;
  z-index: 60;
  background-color: rgba(47, 57, 66, 0.8);
  backdrop-filter: blur(1px);
}
.editing-mode-overlay {
  border: 8px solid;
  border-image: linear-gradient(45deg, rgba(64, 152, 224, 0.7), rgba(234, 255, 47, 0.7)) 1;
  z-index: 55;
}
.v-expansion-panel {
  background-color: rgba(0, 0, 0, 0);
  color: white;
}
</style>
