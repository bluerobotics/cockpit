<template>
  <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>Vanilla JavaScript Actions</template>
    <template #info>
      <p>View, manage, and create vanilla JavaScript actions.</p>
      <p>Take a look at <code>window.cockpit</code> to see available functions and variables.</p>
    </template>
    <template #content>
      <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[640px]">
        <v-data-table
          :items="allSavedActionConfigs"
          items-per-page="10"
          class="elevation-1 bg-transparent rounded-lg"
          theme="dark"
          :style="interfaceStore.globalGlassMenuStyles"
        >
          <template #headers>
            <tr>
              <th class="text-left">
                <p class="text-[16px] font-bold">Name</p>
              </th>
              <th class="text-right">
                <p class="text-[16px] font-bold">Actions</p>
              </th>
            </tr>
          </template>
          <template #item="{ item }">
            <tr>
              <td>
                <div :id="item.id" class="flex items-center justify-left rounded-xl mx-1 w-[140px]">
                  <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.name }}</p>
                </div>
              </td>
              <td class="w-[200px] text-right">
                <div class="flex items-center justify-center">
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    icon="mdi-pencil"
                    size="x-small"
                    @click="openActionEditDialog(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    icon="mdi-play"
                    size="x-small"
                    @click="runAction(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1 pl-[3px] pt-[1px]"
                    icon="mdi-export"
                    size="x-small"
                    @click="exportAction(item.id)"
                  />
                  <v-btn
                    variant="outlined"
                    class="rounded-full mx-1"
                    color="error"
                    icon="mdi-delete"
                    size="x-small"
                    @click="deleteActionConfig(item.id)"
                  />
                </div>
              </td>
            </tr>
          </template>
          <template #bottom>
            <tr class="w-full">
              <td colspan="2" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                <v-btn variant="outlined" class="rounded-lg" @click="openNewActionDialog()">
                  <v-icon start>mdi-plus</v-icon>
                  New JavaScript action
                </v-btn>
                <v-btn variant="outlined" class="rounded-lg" @click="importAction">
                  <v-icon start>mdi-import</v-icon>
                  Import action
                </v-btn>
              </td>
            </tr>
          </template>
          <template #no-data>
            <tr>
              <td colspan="2" class="text-center flex items-center justify-center h-[50px] w-full">
                <p class="text-[16px] ml-[170px] w-full">No JavaScript actions found</p>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </template>
  </ExpansiblePanel>

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
            <div class="text-caption">Use getVariable('variableId') to access data lake variables</div>
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
import { computed, onMounted, reactive, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { openSnackbar } from '@/composables/snackbar'
import {
  deleteJavascriptActionConfig,
  executeActionCode,
  getAllJavascriptActionConfigs,
  getJavascriptActionConfig,
  JavascriptActionConfig,
  registerJavascriptActionConfig,
} from '@/libs/actions/free-javascript'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'

const interfaceStore = useAppInterfaceStore()

const actionsConfigs = reactive<Record<string, JavascriptActionConfig>>({})
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

const editActionConfig = (id: string): void => {
  editMode.value = true
  newActionConfig.value = JSON.parse(JSON.stringify(actionsConfigs[id])) // Deep copy
}

const createActionConfig = (): void => {
  editMode.value = false
  registerJavascriptActionConfig(newActionConfig.value)
  loadSavedActions()
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

const allSavedActionConfigs = computed(() => {
  return Object.entries(actionsConfigs).map(([id, action]) => ({ id, ...action }))
})

const deleteActionConfig = (id: string): void => {
  delete actionsConfigs[id]
  deleteJavascriptActionConfig(id)
  loadSavedActions()
}

const loadSavedActions = (): void => {
  Object.assign(actionsConfigs, getAllJavascriptActionConfigs())
}

const runAction = (id: string): void => {
  executeActionCallback(id)
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

const importAction = (): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          validateCode(json.code)

          if (!json.name || !json.code || codeError.value) {
            throw new Error('Invalid JavaScript action configuration file.')
          }

          registerJavascriptActionConfig(json as JavascriptActionConfig)
          loadSavedActions()
        } catch (error) {
          openSnackbar({ message: `Cannot import action. ${error}`, variant: 'error', duration: 5000 })
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
  input.remove()
}

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

const openActionEditDialog = (id: string): void => {
  editActionConfig(id)
  actionDialog.value.show = true
}

const openNewActionDialog = (): void => {
  resetNewAction()
  actionDialog.value.show = true
}

onMounted(() => {
  loadSavedActions()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
