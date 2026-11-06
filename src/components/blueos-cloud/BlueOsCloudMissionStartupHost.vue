<template>
  <BlueOsCloudMissionStartupDialog
    :model-value="showDecisionDialog"
    :previous-mission="previousMission"
    @continue-previous="continuePreviousMission"
    @select-existing="openMissionPicker"
    @create-new="openCreateMissionForm"
    @skip="skipMission"
    @close="dismissDecisionDialog"
  />
  <BlueOsCloudMissionPicker
    v-model="showMissionPicker"
    title="Select a BlueOS Cloud mission"
    description="Pick a mission to continue logging to."
    @selected="onMissionSelected"
  />
  <BlueOsCloudMissionForm v-model="showMissionForm" mode="create" @submit="onMissionFormSubmit" />
</template>

<script setup lang="ts">
import BlueOsCloudMissionForm from '@/components/blueos-cloud/BlueOsCloudMissionForm.vue'
import BlueOsCloudMissionPicker from '@/components/blueos-cloud/BlueOsCloudMissionPicker.vue'
import BlueOsCloudMissionStartupDialog from '@/components/blueos-cloud/BlueOsCloudMissionStartupDialog.vue'
import { useBlueOsCloudMissionStartupDialog } from '@/composables/blueos-cloud/useBlueOsCloudMissionStartupDialog'

const {
  showDecisionDialog,
  showMissionPicker,
  showMissionForm,
  previousMission,
  continuePreviousMission,
  openMissionPicker,
  openCreateMissionForm,
  skipMission,
  dismissDecisionDialog,
  onMissionSelected,
  onMissionFormSubmit,
} = useBlueOsCloudMissionStartupDialog()
</script>
