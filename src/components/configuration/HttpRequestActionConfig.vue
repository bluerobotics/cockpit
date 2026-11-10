<template>
  <v-dialog v-model="actionDialog.show" max-width="500px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{
        editMode ? t`Edit action` : t`Create new action`
      }}</v-card-title>
      <v-card-text class="px-8">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="createActionConfig">
          <v-text-field
            v-model="newActionConfig.name"
            :label="t`Action Name`"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-select
            v-model="newActionConfig.method"
            :items="availableHttpRequestMethods"
            :label="t`Request Type`"
            required
            variant="outlined"
            density="compact"
            theme="dark"
          />
          <v-text-field
            v-model="newActionConfig.url"
            label="URL"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">{{ t`URL Parameters` }}</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openUrlParamDialog">
              <v-icon size="small">mdi-plus</v-icon>
              {{ t`Add` }}
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
            <h3 class="text-subtitle-2 font-weight-bold">{{ t`Headers` }}</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openHeaderDialog">
              <v-icon size="small">mdi-plus</v-icon>
              {{ t`Add` }}
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
          <div v-if="headerValidationError" class="text-error text-caption mb-2">{{ headerValidationError }}</div>
          <div v-if="headerInputWarning" class="text-warning text-caption mb-2">{{ headerInputWarning }}</div>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">{{ t`JSON Body` }}</h3>
            <v-btn variant="text" class="px-2 py-1" density="compact" @click="openJsonDialog">
              <v-icon size="small">mdi-code-json</v-icon>
              {{ t`Edit` }}
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeActionDialog">{{ t`Cancel` }}</v-btn>
          <div class="flex gap-x-10">
            <v-btn variant="text" @click="resetNewAction">{{ t`Reset` }}</v-btn>
            <v-btn :disabled="!isFormValid" variant="text" @click="saveActionConfig">
              {{ editMode ? t`Save` : t`Create` }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- URL Parameter Dialog -->
  <v-dialog v-model="urlParamDialog.show" max-width="400px">
    <v-card class="rounded-lg px-6 py-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 text-center font-weight-bold pb-6">{{ t`Add URL parameter` }}</v-card-title>
      <v-card-text class="pa-2">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="addUrlParameter">
          <v-text-field
            v-model="urlParamDialog.key"
            :label="t`Parameter Key`"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-select
            v-model="urlParamDialog.valueType"
            :items="paramValueOptions"
            :label="t`Parameter Value`"
            required
            variant="outlined"
            density="compact"
            theme="dark"
          />
          <v-text-field
            v-if="urlParamDialog.valueType === 'fixed'"
            v-model="urlParamDialog.fixedValue"
            :label="t`Fixed Value`"
            required
            variant="outlined"
            density="compact"
            :placeholder="t`Non-dynamic value.`"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-divider class="m-2" />
      <v-card-actions class="pa-2 -mb-1">
        <div class="flex w-full justify-between">
          <v-btn color="white" variant="text" size="small" @click="closeUrlParamDialog">{{ t`Cancel` }}</v-btn>
          <v-btn color="white" size="small" @click="addUrlParameter()"> {{ t`Save` }} </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Header Dialog -->
  <v-dialog v-model="headerDialog.show" max-width="400px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pb-4 text-center">{{ t`Add header` }}</v-card-title>
      <v-card-text class="pa-4">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="addHeader">
          <v-text-field
            v-model="headerDialog.key"
            :label="t`Header Key`"
            required
            variant="outlined"
            :error-messages="headerDialog.keyError"
            density="compact"
          ></v-text-field>
          <v-text-field
            v-model="headerDialog.value"
            :label="t`Header Value`"
            :hint="t`Use {{ inputId }} for dynamic values.`"
            persistent-hint
            :error-messages="headerDialog.valueError"
            variant="outlined"
            density="compact"
          ></v-text-field>
          <div v-if="headerDialogInputWarning" class="text-warning text-caption mb-2">
            {{ headerDialogInputWarning }}
          </div>
          <!-- User-Agent header note -->
          <v-alert
            v-if="headerDialog.key.toLowerCase() === 'user-agent'"
            type="info"
            variant="tonal"
            density="compact"
            color="white"
            class="mt-2"
          >
            <div class="text-body-2">
              <strong>{{ t`Note:` }}</strong>
              {{ t`Specifying the User-Agent header only works in Cockpit standalone, not in Cockpit Lite.` }}
            </div>
          </v-alert>
        </v-form>
      </v-card-text>
      <v-divider class="m-2" />
      <v-card-actions class="pa-2 -mb-1">
        <div class="flex w-full justify-between">
          <v-btn color="white" variant="text" size="small" @click="closeHeaderDialog">{{ t`Cancel` }}</v-btn>
          <v-btn color="white" size="small" @click="addHeader">{{ t`Save` }}</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- JSON Body Dialog -->
  <v-dialog v-model="bodyDialog.show" max-width="520px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2 text-center">{{ t`Edit JSON body template` }}</v-card-title>
      <v-card-text class="px-6">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="saveJsonBody">
          <v-textarea
            v-model="bodyDialog.bodyText"
            :label="t`JSON Body Template`"
            :hint="t`Use {{ inputId }} for dynamic values.`"
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
          <v-btn color="white" variant="text" @click="closeJsonDialog">{{ t`Cancel` }}</v-btn>
          <v-btn color="white" :disabled="!bodyDialog.isValid" @click="saveJsonBody">{{ t`Save` }}</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, ref } from 'vue'

import { getAllDataLakeVariablesInfo, isSameDataLakeVariableId } from '@/libs/actions/data-lake'
import {
  availableHttpRequestMethods,
  deleteHttpRequestActionConfig,
  getHttpRequestActionConfig,
  registerHttpRequestActionConfig,
  validateHttpRequestHeaders,
} from '@/libs/actions/http-request'
import { findUnknownDataLakeVariablesInString } from '@/libs/utils-data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { HttpRequestActionConfig, HttpRequestMethod } from '@/types/cockpit-actions'
import { ValidationFunctionReturn } from '@/types/general'

const emit = defineEmits<{
  (e: 'action-saved'): void
  (e: 'action-deleted'): void
}>()

const interfaceStore = useAppInterfaceStore()

const defaultActionConfig = {
  name: 'New HTTP Action',
  method: HttpRequestMethod.POST,
  url: 'http://{{ vehicle-address }}',
  headers: {
    'Content-Type': 'application/json',
  },
  urlParams: {},
  body: '',
}

const newActionConfig = ref<HttpRequestActionConfig>(defaultActionConfig)

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
  keyError: '',
  valueError: '',
})

const paramValueOptions = computed(() => {
  const options = [{ title: t`Fixed (specify below)`, value: 'fixed' }]
  const availableInputParameters = getAllDataLakeVariablesInfo()
  Object.values(availableInputParameters).forEach((parameter) => {
    options.push({ title: parameter.id, value: parameter.id })
  })
  return options
})

const availableInputIds = computed(() =>
  paramValueOptions.value.map((option) => option.value).filter((id) => id !== 'fixed')
)

const headerValidationError = computed(() => validateHttpRequestHeaders(newActionConfig.value.headers).error ?? '')

const headerInputWarning = computed(() => {
  const unavailable = Object.values(newActionConfig.value.headers).some(
    (value) =>
      typeof value === 'string' && findUnknownDataLakeVariablesInString(value, availableInputIds.value).length > 0
  )
  return unavailable
    ? t`Some header inputs are not available right now. They will be checked when this action runs.`
    : ''
})

const headerDialogInputWarning = computed(() => {
  const unknown = findUnknownDataLakeVariablesInString(headerDialog.value.value, availableInputIds.value)[0]
  if (unknown === undefined) return ''
  const inputName = unknown || t`(empty)`
  return t`Input ${inputName} is not available right now.`
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
    validateHttpRequestHeaders(config.headers).isValid &&
    isValidJsonTemplate(config.body)
  )
}

const validateJsonTemplate = (template: string): ValidationFunctionReturn => {
  if (!template.trim()) {
    return { isValid: true, error: '' }
  }

  const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g
  const invalidInput = findUnknownDataLakeVariablesInString(template, availableInputIds.value)[0]
  if (invalidInput !== undefined) {
    if (!invalidInput) return { isValid: false, error: t`Invalid placeholder format: {{ }}` }
    return { isValid: false, error: t`Invalid input name in placeholder: ${invalidInput}` }
  }

  // Replace placeholders with a valid JSON value temporarily
  const tempTemplate = template.replace(placeholderRegex, 'PLACEHOLDER')

  try {
    const parsed = JSON.parse(tempTemplate)
    if (typeof parsed !== 'object' || parsed === null) {
      return { isValid: false, error: t`Invalid JSON structure` }
    }

    return { isValid: true, error: '' }
  } catch (error) {
    const message = (error as Error).message
    return { isValid: false, error: t`Invalid JSON: ${message}` }
  }
}

const isValidJsonTemplate = (template: string): boolean => {
  const { isValid } = validateJsonTemplate(template)
  return isValid
}

const validateJsonTemplateForDialog = (template: string): void => {
  const { isValid, error } = validateJsonTemplate(template)
  bodyDialog.value.error = error ?? ''
  bodyDialog.value.isValid = isValid
}

const isValidUrlParams = (params: Record<string, string>): boolean => {
  return Object.entries(params).every(([key, value]) => {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const parsedValue = value.replace('{{', '').replace('}}', '').trim()
      return (
        key !== '' && value !== '' && availableInputIds.value.some((id) => isSameDataLakeVariableId(id, parsedValue))
      )
    }
    return key !== '' && value !== ''
  })
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
  logUserAction('Added URL parameter to HTTP request action')
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
    logUserAction('Saved JSON body for HTTP request action')
    newActionConfig.value.body = bodyDialog.value.bodyText
    closeJsonDialog()
  }
}

const removeUrlParam = (key: string): void => {
  logUserAction('Removed URL parameter from HTTP request action')
  delete newActionConfig.value.urlParams[key]
}

const openHeaderDialog = (): void => {
  headerDialog.value = {
    show: true,
    key: '',
    value: '',
    keyError: '',
    valueError: '',
  }
}

const closeHeaderDialog = (): void => {
  headerDialog.value.show = false
  headerDialog.value.keyError = ''
  headerDialog.value.valueError = ''
}

const addHeader = (): void => {
  const { isValid, error, field } = validateHttpRequestHeaders({ [headerDialog.value.key]: headerDialog.value.value })
  headerDialog.value.keyError = field === 'key' ? error ?? '' : ''
  headerDialog.value.valueError = field === 'value' ? error ?? '' : ''
  if (isValid) {
    logUserAction('Added header to HTTP request action')
    newActionConfig.value.headers[headerDialog.value.key] = headerDialog.value.value
    closeHeaderDialog()
  }
}

const removeHeader = (key: string): void => {
  logUserAction('Removed header from HTTP request action')
  delete newActionConfig.value.headers[key]
}

const idBeingEdited = ref<string>()
const editMode = computed(() => idBeingEdited.value !== undefined)

const createActionConfig = (): void => {
  registerHttpRequestActionConfig(newActionConfig.value, idBeingEdited.value)
  emit('action-saved')
  resetNewAction()
}

const saveActionConfig = (): void => {
  logUserAction(`${editMode.value ? 'Updated' : 'Created'} HTTP request action '${newActionConfig.value.name}'`)
  createActionConfig()
  closeActionDialog()
}

const resetNewAction = (): void => {
  newActionConfig.value = JSON.parse(JSON.stringify(defaultActionConfig))
  bodyInputError.value = ''
  idBeingEdited.value = undefined
}

const exportAction = (id: string): void => {
  const action = getHttpRequestActionConfig(id)
  if (!action) {
    console.error('Action not found')
    return
  }
  logUserAction(`Exported HTTP request action '${action.name}'`)
  const json = JSON.stringify(action, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = `${action.name}.json`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  a.remove()
}

const deleteAction = (id: string): void => {
  const action = getHttpRequestActionConfig(id)
  logUserAction(`Deleted HTTP request action '${action?.name ?? id}'`)
  deleteHttpRequestActionConfig(id)
  emit('action-deleted')
}

const actionDialog = ref({
  show: false,
})

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

const openEditDialog = (id: string): void => {
  const action = getHttpRequestActionConfig(id)
  if (action) {
    idBeingEdited.value = id
    logUserAction(`Opened edit dialog for HTTP request action '${action.name}'`)
    newActionConfig.value = JSON.parse(JSON.stringify(action)) // Deep copy
    actionDialog.value.show = true
  }
}

const openNewDialog = (): void => {
  logUserAction('Opened new HTTP request action dialog')
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
