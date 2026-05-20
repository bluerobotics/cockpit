<template>
  <BlueOsCloudMissionPicker
    v-model="upload.showMissionPicker.value"
    title="Upload to BlueOS Cloud"
    description="Select the mission that should receive this file, or create a new one."
    confirm-label="Upload"
    :suggested-mission-name="upload.suggestedMissionName()"
    @selected="upload.onMissionSelected"
  />
  <BlueOsCloudUploadProgress
    v-model="upload.showProgressDialog.value"
    :file-name="upload.currentFileName.value"
    :mission-name="upload.currentMissionName.value"
    :mission-id="upload.currentMissionId.value"
    :progress="upload.progress.value"
    :is-upload-finished="upload.isFinished.value"
    :error-message="upload.errorMessage.value"
    @cancel="upload.cancelUpload"
  />
</template>

<script setup lang="ts">
import BlueOsCloudMissionPicker from '@/components/blueos-cloud/BlueOsCloudMissionPicker.vue'
import BlueOsCloudUploadProgress from '@/components/blueos-cloud/BlueOsCloudUploadProgress.vue'
import { useBlueOsCloudUpload } from '@/composables/blueOsCloudUpload'

const upload = useBlueOsCloudUpload()
</script>
