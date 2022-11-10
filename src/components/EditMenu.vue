<template>
  <div v-if="editMode" class="editing-mode-overlay" />
  <v-navigation-drawer v-model="showDrawer" width="400" temporary>
    <v-card ref="editDrawer" flat class="pa-2 edit-menu">
      <v-card-title>Edit menu</v-card-title>
      <div class="mx-2 my-4">
        <v-expansion-panels>
          <v-expansion-panel>
            <v-expansion-panel-title>
              Current profile: {{ store.currentProfile.name }}
            </v-expansion-panel-title>
            <v-expansion-panel-text class="pa-2">
              <div v-if="selectedLayer !== undefined">
                <v-card-subtitle class="mt-4">Layer</v-card-subtitle>
                <div class="d-flex align-center ma-2">
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
                    rounded="lg"
                    @click="layerDeleteDialog.reveal"
                  />
                </div>
                <v-card-subtitle class="mt-4">Widgets</v-card-subtitle>
                <template v-if="selectedLayer.widgets.length > 0">
                  <li
                    v-for="widget in selectedLayer.widgets"
                    :key="widget.hash"
                    class="pl-6"
                  >
                    {{ widget.component }}
                  </li>
                </template>
                <p v-else class="pl-6">No widgets in layer.</p>
                <div class="d-flex align-center ma-3">
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
                    @click="addWidget"
                  />
                </div>
              </div>
              <v-btn class="ma-1" flat @click="addLayer">Add new layer</v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
      <div class="d-flex align-center ma-2">
        <v-select
          v-model="selectedProfile"
          :items="availableProfiles"
          density="compact"
          variant="outlined"
          label="Layer profiles available"
          no-data-text="No profiles available."
          hide-details
        />
        <v-btn
          class="ml-2"
          icon="mdi-download"
          size="small"
          rounded="lg"
          @click="loadProfile"
        />
      </div>
      <v-card-actions>
        <v-btn class="ma-1" @click="profileCreationDialog.reveal">
          Create new profile
        </v-btn>
        <v-switch
          class="ma-1"
          label="Grid"
          :model-value="showGrid"
          hide-details
          @change="emit('update:showGrid', !showGrid)"
        />
      </v-card-actions>
      <v-btn flat block @click="emit('update:editMode', false)">
        Exit edit mode
      </v-btn>
    </v-card>
  </v-navigation-drawer>
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
    <v-dialog v-model="profileCreationDialogRevealed" width="50%">
      <v-card class="pa-2">
        <v-card-title>New profile</v-card-title>
        <v-card-text>
          <v-form v-model="newProfileForm">
            <v-text-field
              v-model="newProfileName"
              hide-details="auto"
              label="Profile name"
              :rules="[(name) => !!name || 'Name is required']"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn
            :disabled="!newProfileForm"
            @click="profileCreationDialog.confirm"
          >
            Create
          </v-btn>
          <v-btn @click="profileCreationDialog.cancel">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { useConfirmDialog, useElementBounding, useMouse } from '@vueuse/core'
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

const availableWidgetTypes = computed(() => Object.values(WidgetType))
const selectedWidgetType = ref()
const selectedProfile = ref()
const selectedLayer = ref(store.currentProfile.layers[0])
const newProfileName = ref('')
const newProfileForm = ref(false)

const showDrawer = ref(props.editMode)
const editDrawer = ref()
const { width: menuWidth } = useElementBounding(editDrawer)
const { x: mouseX } = useMouse()
watch(mouseX, () => {
  const hoveringMenu = mouseX.value < 1.2 * menuWidth.value && showDrawer.value
  showDrawer.value = props.editMode && (mouseX.value < 10 || hoveringMenu)
})

const editMode = toRefs(props).editMode
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
const createNewProfile = (): void => {
  const newProfile = store.saveProfile(
    newProfileName.value,
    store.currentProfile.layers
  )
  store.loadProfile(newProfile)
  selectedProfile.value = store.currentProfile
  newProfileName.value = ''
}
const deleteLayer = (): void => {
  store.deleteLayer(selectedLayer.value)
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
profileCreationDialog.onConfirm(createNewProfile)
</script>

<style scoped>
.edit-menu {
  height: 100%;
  width: 100%;
}
.editing-mode-overlay {
  position: absolute;
  height: 100%;
  width: 100%;
  border: 8px solid;
  border-image: linear-gradient(
      45deg,
      rgba(64, 152, 224, 0.7),
      rgba(234, 255, 47, 0.7)
    )
    1;
  pointer-events: none;
  z-index: 70;
}
</style>
