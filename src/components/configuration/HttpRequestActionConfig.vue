<template>
  <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>HTTP Request Actions</template>
    <template #info>
      <p>View, manage, and create HTTP request actions.</p>
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
              <th class="text-center">
                <p class="text-[16px] font-bold">URL</p>
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
              <td>
                <div :id="item.id" class="flex items-center justify-center rounded-xl mx-1 w-[200px]">
                  <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.url }}</p>
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
              <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                <v-btn variant="outlined" class="rounded-lg" @click="openNewActionDialog()">
                  <v-icon start>mdi-plus</v-icon>
                  New HTTP action
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
              <td colspan="3" class="text-center flex items-center justify-center h-[50px] w-full">
                <p class="text-[16px] ml-[170px] w-full">No HTTP request actions found</p>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </template>
  </ExpansiblePanel>

  <v-dialog v-model="actionDialog.show" max-width="500px">
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
          <v-select
            v-model="newActionConfig.method"
            :items="availableHttpRequestMethods"
            label="Request Type"
            required
            variant="outlined"
            density="compact"
          ></v-select>
          <v-text-field
            v-model="newActionConfig.url"
            label="URL"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">URL Parameters</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openUrlParamDialog">
              <v-icon size="small">mdi-plus</v-icon>
              Add
            </v-btn>
          </div>
          <div v-if="Object.keys(newActionConfig.urlParams).length > 0" class="mb-2">
            <v-chip-group>
              <v-chip
                v-for="(param, index) in Object.entries(newActionConfig.urlParams)"
                :key="`param-${index}`"
                closable
                size="x-small"
                class="m-1"
                @click:close="removeUrlParam(param[0])"
              >
                {{ param[0] }}: {{ param[1] }}
              </v-chip>
            </v-chip-group>
          </div>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">Headers</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openHeaderDialog">
              <v-icon size="small">mdi-plus</v-icon>
              Add
            </v-btn>
          </div>
          <div v-if="Object.keys(newActionConfig.headers).length > 0" class="mb-2">
            <v-chip-group>
              <v-chip
                v-for="(header, index) in Object.entries(newActionConfig.headers)"
                :key="`header-${index}`"
                closable
                size="x-small"
                class="m-1"
                @click:close="removeHeader(header[0])"
              >
                {{ header[0] }}: {{ header[1] }}
              </v-chip>
            </v-chip-group>
          </div>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">JSON Body</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openJsonDialog">
              <v-icon size="small">mdi-code-json</v-icon>
              Edit
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeActionDialog">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn variant="text" @click="resetNewAction">Reset</v-btn>
            <v-btn color="primary" :disabled="!isFormValid" variant="text" @click="saveActionConfig">
              {{ editMode ? 'Save' : 'Create' }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- URL Parameter Dialog -->
  <v-dialog v-model="urlParamDialog.show" max-width="400px">
    <v-card class="rounded-lg px-6 py-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 text-center font-weight-bold pb-6">Add URL parameter</v-card-title>
      <v-card-text class="pa-2">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="addUrlParameter">
          <v-text-field
            v-model="urlParamDialog.key"
            label="Parameter Key"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-select
            v-model="urlParamDialog.valueType"
            :items="paramValueOptions"
            label="Parameter Value"
            required
            variant="outlined"
            density="compact"
          ></v-select>
          <v-text-field
            v-if="urlParamDialog.valueType === 'fixed'"
            v-model="urlParamDialog.fixedValue"
            label="Fixed Value"
            required
            variant="outlined"
            density="compact"
            placeholder="Non-dynamic value."
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-divider class="m-2" />
      <v-card-actions class="pa-2 -mb-1">
        <div class="flex w-full justify-between">
          <v-btn color="white" variant="text" size="small" @click="closeUrlParamDialog">Cancel</v-btn>
          <v-btn color="white" size="small" @click="saveUrlParameter()"> Save </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Header Dialog -->
  <v-dialog v-model="headerDialog.show" max-width="400px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pb-4 text-center">Add header</v-card-title>
      <v-card-text class="pa-4">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="addHeader">
          <v-text-field
            v-model="headerDialog.key"
            label="Header Key"
            required
            variant="outlined"
            :error-messages="headerDialog.error"
            density="compact"
          ></v-text-field>
          <v-text-field
            v-model="headerDialog.value"
            label="Header Value"
            variant="outlined"
            density="compact"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-divider class="m-2" />
      <v-card-actions class="pa-2 -mb-1">
        <div class="flex w-full justify-between">
          <v-btn color="white" variant="text" size="small" @click="closeHeaderDialog">Cancel</v-btn>
          <v-btn color="white" size="small" @click="addHeader">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- JSON Body Dialog -->
  <v-dialog v-model="bodyDialog.show" max-width="520px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2 text-center">Edit JSON body template</v-card-title>
      <v-card-text class="px-6">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="saveJsonBody">
          <v-textarea
            v-model="bodyDialog.bodyText"
            label="JSON Body Template"
            hint="Use {{ inputId }} for dynamic values."
            persistent-hint
            :error-messages="bodyDialog.error"
            rows="12"
            variant="outlined"
            density="compact"
            @update:model-value="validateJsonTemplateForDialog"
          ></v-textarea>
        </v-form>
      </v-card-text>
      <v-divider class="m-2" />
      <v-card-actions class="pa-2 -mb-1">
        <div class="flex w-full justify-between">
          <v-btn color="white" variant="text" @click="closeJsonDialog">Cancel</v-btn>
          <v-btn color="white" :disabled="!bodyDialog.isValid" @click="saveJsonBody">Save</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { openSnackbar } from '@/composables/snackbar'
import { getAllDataLakeVariablesInfo } from '@/libs/actions/data-lake'
import {
  availableHttpRequestMethods,
  deleteHttpRequestActionConfig,
  getAllHttpRequestActionConfigs,
  getHttpRequestActionConfig,
  HttpRequestActionConfig,
  HttpRequestMethod,
  registerHttpRequestActionConfig,
} from '@/libs/actions/http-request'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'
const interfaceStore = useAppInterfaceStore()

const actionsConfigs = reactive<Record<string, HttpRequestActionConfig>>({})
const newActionConfig = ref<HttpRequestActionConfig>({
  name: '',
  method: HttpRequestMethod.GET,
  url: '',
  headers: {},
  urlParams: {},
  body: '',
})

const bodyInputError = ref('')

const urlParamDialog = ref({
  show: false,
  key: '',
  valueType: 'fixed',
  fixedValue: '',
})

const bodyDialog = ref({
  show: false,
  bodyText: '',
  error: '',
  isValid: false,
})

const headerDialog = ref({
  show: false,
  key: '',
  value: '',
  error: '',
})

const paramValueOptions = computed(() => {
  const options = [{ title: 'Fixed (specify below)', value: 'fixed' }]
  const availableInputParameters = getAllDataLakeVariablesInfo()
  Object.values(availableInputParameters).forEach((parameter) => {
    options.push({ title: parameter.id, value: parameter.id })
  })
  return options
})

const isFormValid = computed(() => {
  return isValidRequestConfig(newActionConfig.value)
})

const isValidRequestConfig = (config: HttpRequestActionConfig): boolean => {
  return (
    !!config.name &&
    !!config.method &&
    !!config.url &&
    isValidUrlParams(config.urlParams) &&
    isValidHeaders(config.headers).isValid &&
    isValidJsonTemplate(config.body)
  )
}

// eslint-disable-next-line jsdoc/require-jsdoc
const validateJsonTemplate = (template: string): { isValid: boolean; error: string } => {
  if (!template.trim()) {
    return { isValid: true, error: '' }
  }

  // Check if all placeholders are properly formatted
  const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g
  const placeholders = template.match(placeholderRegex)
  if (placeholders) {
    const availableInputs = paramValueOptions.value.map((option) => option.value).filter((option) => option !== 'fixed')
    for (const placeholder of placeholders) {
      const inputName = placeholder.match(/\{\{\s*([^}]+)\s*\}\}/)?.[1]?.trim()
      if (!inputName) {
        return { isValid: false, error: `Invalid placeholder format: ${placeholder}` }
      }
      if (!availableInputs.includes(inputName)) {
        return {
          isValid: false,
          error: `Invalid input name in placeholder: ${inputName}. Available inputs are: ${availableInputs.join(', ')}`,
        }
      }
    }
  }

  // Replace placeholders with a valid JSON value temporarily
  const tempTemplate = template.replace(placeholderRegex, 'PLACEHOLDER')

  try {
    const parsed = JSON.parse(tempTemplate)
    if (typeof parsed !== 'object' || parsed === null) {
      return { isValid: false, error: 'Invalid JSON structure' }
    }

    return { isValid: true, error: '' }
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON: ' + (error as Error).message }
  }
}

const isValidJsonTemplate = (template: string): boolean => {
  const { isValid } = validateJsonTemplate(template)
  return isValid
}

const validateJsonTemplateForDialog = (template: string): void => {
  const { isValid, error } = validateJsonTemplate(template)
  bodyDialog.value.error = error
  bodyDialog.value.isValid = isValid
}

const isValidUrlParams = (params: Record<string, string>): boolean => {
  return Object.entries(params).every(([key, value]) => {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const parsedValue = value.replace('{{', '').replace('}}', '').trim()
      return key !== '' && value !== '' && paramValueOptions.value.map((option) => option.value).includes(parsedValue)
    }
    return key !== '' && value !== ''
  })
}

// eslint-disable-next-line jsdoc/require-jsdoc
const isValidHeaders = (headers: Record<string, string>): { isValid: boolean; error: string } => {
  for (const [key, value] of Object.entries(headers)) {
    // Header keys should be non-empty and contain valid characters
    const validKeyRegex = /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/
    if (!key || !validKeyRegex.test(key)) {
      const error = 'Invalid header key. Use only letters, numbers, and common punctuation. No spaces allowed.'
      return { isValid: false, error }
    }

    // Header values can be empty, but if not, they should not contain newlines
    if (value && /[\r\n]/.test(value)) {
      return { isValid: false, error: 'Header value cannot contain newlines.' }
    }
  }
  return { isValid: true, error: '' }
}

const openUrlParamDialog = (): void => {
  urlParamDialog.value = {
    show: true,
    key: '',
    valueType: 'fixed',
    fixedValue: '',
  }
}

const closeUrlParamDialog = (): void => {
  urlParamDialog.value.show = false
}

const addUrlParameter = (): void => {
  const parsedValue = `{{ ${urlParamDialog.value.valueType} }}`
  const value = urlParamDialog.value.valueType === 'fixed' ? urlParamDialog.value.fixedValue : parsedValue
  newActionConfig.value.urlParams[urlParamDialog.value.key] = value
  closeUrlParamDialog()
}

const openJsonDialog = (): void => {
  bodyDialog.value = {
    show: true,
    bodyText: newActionConfig.value.body,
    error: '',
    isValid: isValidJsonTemplate(newActionConfig.value.body),
  }
}

const closeJsonDialog = (): void => {
  bodyDialog.value.show = false
}

const saveJsonBody = (): void => {
  if (bodyDialog.value.isValid) {
    newActionConfig.value.body = bodyDialog.value.bodyText
    closeJsonDialog()
  }
}

const removeUrlParam = (key: string): void => {
  delete newActionConfig.value.urlParams[key]
}

const openHeaderDialog = (): void => {
  headerDialog.value = {
    show: true,
    key: '',
    value: '',
    error: '',
  }
}

const closeHeaderDialog = (): void => {
  headerDialog.value.show = false
  headerDialog.value.error = ''
}

const addHeader = (): void => {
  const { isValid, error } = isValidHeaders({ [headerDialog.value.key]: headerDialog.value.value })
  if (isValid) {
    newActionConfig.value.headers[headerDialog.value.key] = headerDialog.value.value
    closeHeaderDialog()
  } else {
    headerDialog.value.error = error
  }
}

const removeHeader = (key: string): void => {
  delete newActionConfig.value.headers[key]
}

const editMode = ref(false)

const editActionConfig = (id: string): void => {
  editMode.value = true
  newActionConfig.value = JSON.parse(JSON.stringify(actionsConfigs[id])) // Deep copy
}

const createActionConfig = (): void => {
  editMode.value = false
  registerHttpRequestActionConfig(newActionConfig.value)
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
    method: HttpRequestMethod.GET,
    url: '',
    headers: {},
    urlParams: {},
    body: '',
  }
  bodyInputError.value = ''
  editMode.value = false
}

const allSavedActionConfigs = computed(() => {
  return Object.entries(actionsConfigs).map(([id, action]) => ({ id, ...action }))
})

const deleteActionConfig = (id: string): void => {
  delete actionsConfigs[id]
  deleteHttpRequestActionConfig(id)
  loadSavedActions()
}

const loadSavedActions = (): void => {
  Object.assign(actionsConfigs, getAllHttpRequestActionConfigs())
}

const runAction = (id: string): void => {
  executeActionCallback(id)
}

const exportAction = (id: string): void => {
  const action = getHttpRequestActionConfig(id)
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

          if (!isValidRequestConfig(json)) {
            throw new Error('Invalid request configuration file.')
          }

          registerHttpRequestActionConfig(json as HttpRequestActionConfig)
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

const actionDialog = ref({
  show: false,
})

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

const saveUrlParameter = (): void => {
  addUrlParameter()
  closeUrlParamDialog()
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
