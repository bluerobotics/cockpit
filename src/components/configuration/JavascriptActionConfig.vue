<template>
  <v-dialog v-model="actionDialog.show" max-width="800px" persistent>
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{
        editMode ? 'Edit action' : 'Create new action'
      }}</v-card-title>
      <v-card-text class="px-8">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="createActionConfig">
          <v-text-field
            v-model="newActionConfig.name"
            label="Action Name"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>

          <div class="d-flex align-center justify-space-between mb-2">
            <h3 class="text-subtitle-2 font-weight-bold">JavaScript Code</h3>
            <!-- eslint-disable-next-line prettier/prettier -->
            <div v-pre class="text-caption">Use {{ variable-id }} to access data lake variables</div>
          </div>
          <v-textarea
            v-model="newActionConfig.code"
            label="JavaScript Code"
            :error-messages="codeError"
            rows="10"
            variant="outlined"
            density="compact"
            @update:model-value="validateCode"
          ></v-textarea>
        </v-form>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full" style="color: rgba(255, 255, 255, 0.5)">
          <v-btn @click="closeActionDialog">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn @click="testAction">Test Action</v-btn>
            <v-btn @click="resetNewAction">Reset</v-btn>
            <v-btn class="text-white" :disabled="!isFormValid" @click="saveActionConfig">
              {{ editMode ? 'Save' : 'Create' }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  deleteJavascriptActionConfig,
  executeActionCode,
  getJavascriptActionConfig,
  JavascriptActionConfig,
  registerJavascriptActionConfig,
} from '@/libs/actions/free-javascript'
import { useAppInterfaceStore } from '@/stores/appInterface'

const emit = defineEmits<{
  (e: 'action-saved'): void
  (e: 'action-deleted'): void
}>()

const interfaceStore = useAppInterfaceStore()

const newActionConfig = ref<JavascriptActionConfig>({
  name: '',
  code: '',
})

const codeError = ref('')
const editMode = ref(false)
const actionDialog = ref({ show: false })

const isFormValid = computed(() => {
  return newActionConfig.value.name && newActionConfig.value.code && !codeError.value
})

const validateCode = (code: string): void => {
  try {
    new Function(code)
    codeError.value = ''
  } catch (error) {
    codeError.value = `Invalid JavaScript: ${error}`
  }
}

const createActionConfig = (): void => {
  editMode.value = false
  registerJavascriptActionConfig(newActionConfig.value)
  emit('action-saved')
  resetNewAction()
}

const saveActionConfig = (): void => {
  createActionConfig()
  closeActionDialog()
}

const resetNewAction = (): void => {
  newActionConfig.value = {
    name: '',
    code: '',
  }
  codeError.value = ''
  editMode.value = false
}

const testAction = (): void => {
  executeActionCode(newActionConfig.value.code)
}

const exportAction = (id: string): void => {
  const action = getJavascriptActionConfig(id)
  if (!action) {
    console.error('Action not found')
    return
  }
  const json = JSON.stringify(action, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = `${id}.json`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  a.remove()
}

const deleteAction = (id: string): void => {
  deleteJavascriptActionConfig(id)
  emit('action-deleted')
}

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

const openEditDialog = (id: string): void => {
  const action = getJavascriptActionConfig(id)
  if (action) {
    editMode.value = true
    newActionConfig.value = JSON.parse(JSON.stringify(action)) // Deep copy
    actionDialog.value.show = true
  }
}

const openNewDialog = (): void => {
  resetNewAction()
  actionDialog.value.show = true
}

defineExpose({
  openEditDialog,
  openNewDialog,
  exportAction,
  deleteAction,
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
