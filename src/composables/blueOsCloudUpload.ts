import { ref } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { getPresignedUpload, uploadFileToPresignedUrl } from '@/libs/blueos-cloud/api'
import { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'

/**
 *
 */
interface PendingUpload {
  /**
   * Function returning the file contents that should be uploaded.
   *
   * It runs only after the user has selected the destination mission so we don't load expensive blobs (e.g. multi-GB
   * videos) into memory until we know the upload is actually going ahead.
   */
  getBlob: () => Promise<Blob>
  /**
   * Name to use for the uploaded file on BlueOS Cloud.
   */
  fileName: string
  /**
   * Optional name suggested in the mission picker's "Create new mission" field.
   */
  suggestedMissionName?: string
  /**
   * Optional ISO timestamp captured when the file was originally produced.
   */
  capturedAt?: string
}

const pendingUpload = ref<PendingUpload | null>(null)

const showMissionPicker = ref(false)
const showProgressDialog = ref(false)
const currentFileName = ref('')
const currentMissionName = ref('')
const currentMissionId = ref('')
const progress = ref(0)
const isFinished = ref(false)
const errorMessage = ref<string | null>(null)
const isUploading = ref(false)
let abortController: AbortController | null = null

/**
 * Singleton composable that drives the BlueOS Cloud upload flow used by the video library, snapshot library and the
 * system log table.
 *
 * It exposes both the reactive state consumed by the global picker / progress dialogs (mounted once at the app root)
 * and the imperative entry point ({@link requestUpload}) called by feature components.
 * @returns {object} Reactive state and helpers that drive the upload wizard.
 */
export const useBlueOsCloudUpload = (): {
  /**
   * Whether the mission-picker dialog is currently visible.
   */
  showMissionPicker: typeof showMissionPicker
  /**
   * Whether the progress dialog is currently visible.
   */
  showProgressDialog: typeof showProgressDialog
  /**
   * Name of the file being uploaded (or about to be uploaded).
   */
  currentFileName: typeof currentFileName
  /**
   * Title of the mission selected as the upload destination.
   */
  currentMissionName: typeof currentMissionName
  /**
   * Identifier of the mission selected as the upload destination, used to build links to the cloud UI.
   */
  currentMissionId: typeof currentMissionId
  /**
   * Upload progress in the 0-100 range.
   */
  progress: typeof progress
  /**
   * Whether the upload has completed successfully.
   */
  isFinished: typeof isFinished
  /**
   * Error message to display when the upload fails (or `null` while it succeeds).
   */
  errorMessage: typeof errorMessage
  /**
   * Whether an upload is currently in progress.
   */
  isUploading: typeof isUploading
  /**
   * Suggested mission name that the picker should pre-fill in its "Create new" input.
   */
  suggestedMissionName: () => string
  /**
   * Opens the mission picker so the user can choose where to upload `fileName`.
   *
   * Bails out with a snackbar if the integration is disabled or the user is not authenticated.
   * @param {PendingUpload} payload - Upload payload to start.
   */
  requestUpload: (payload: PendingUpload) => void
  /**
   * Internal handler called by the picker once the user confirms a mission.
   * @param {BlueOsCloudMission} mission - Mission selected as the upload destination.
   */
  onMissionSelected: (mission: BlueOsCloudMission) => Promise<void>
  /**
   * Aborts the in-flight upload (if any).
   */
  cancelUpload: () => void
} => {
  const cloudStore = useBlueOsCloudStore()
  const { openSnackbar } = useSnackbar()

  const requestUpload = (payload: PendingUpload): void => {
    if (!cloudStore.isIntegrationEnabled || !cloudStore.isAuthenticated) {
      openSnackbar({
        message: 'Sign in to BlueOS Cloud first to upload files.',
        variant: 'warning',
        duration: 4000,
        closeButton: true,
      })
      return
    }
    pendingUpload.value = payload
    currentFileName.value = payload.fileName
    showMissionPicker.value = true
  }

  const cancelUpload = (): void => {
    abortController?.abort()
  }

  const onMissionSelected = async (mission: BlueOsCloudMission): Promise<void> => {
    const payload = pendingUpload.value
    if (!payload) return

    currentMissionName.value = mission.title
    currentMissionId.value = mission.id
    progress.value = 0
    isFinished.value = false
    errorMessage.value = null
    isUploading.value = true
    showProgressDialog.value = true
    abortController = new AbortController()

    try {
      const blob = await payload.getBlob()
      const accessToken = await cloudStore.ensureValidAccessToken()
      const presigned = await getPresignedUpload(mission.id, payload.fileName, accessToken, payload.capturedAt)
      await uploadFileToPresignedUrl(
        presigned,
        blob,
        payload.fileName,
        (value) => (progress.value = value),
        abortController.signal
      )
      isFinished.value = true
      progress.value = 100
      openSnackbar({
        message: `"${payload.fileName}" uploaded to BlueOS Cloud mission "${mission.title}".`,
        variant: 'success',
        duration: 4000,
        closeButton: true,
      })
    } catch (error) {
      errorMessage.value = (error as Error).message
      openSnackbar({
        message: `Failed to upload to BlueOS Cloud: ${(error as Error).message}`,
        variant: 'error',
        duration: 5000,
        closeButton: true,
      })
    } finally {
      isUploading.value = false
      pendingUpload.value = null
      abortController = null
    }
  }

  const suggestedMissionName = (): string => pendingUpload.value?.suggestedMissionName ?? ''

  return {
    showMissionPicker,
    showProgressDialog,
    currentFileName,
    currentMissionName,
    currentMissionId,
    progress,
    isFinished,
    errorMessage,
    isUploading,
    suggestedMissionName,
    requestUpload,
    onMissionSelected,
    cancelUpload,
  }
}
