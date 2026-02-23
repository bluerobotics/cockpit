<template>
  <BaseConfigurationView>
    <template #title>{{ $t('views.ConfigurationActionsView.cockpitActionsConfiguration') }}</template>
    <template #content>
      <div class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>{{ $t('views.ConfigurationActionsView.title') }}</template>
          <template #info>
            <li>{{ $t('views.ConfigurationActionsView.info1') }}</li>
            <li>{{ $t('views.ConfigurationActionsView.info2') }}</li>
            <li>{{ $t('views.ConfigurationActionsView.info3') }}</li>
            <li>{{ $t('views.ConfigurationActionsView.info4') }}</li>
            <li>{{ $t('views.ConfigurationActionsView.info5') }}</li>
            <li>{{ $t('views.ConfigurationActionsView.info6') }}</li>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 pr-4 mb-8 mt-2 w-full">
              <v-data-table
                :items="allActionConfigs"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg mb-8"
                theme="dark"
                :headers="headers"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div :id="item.id" class="flex items-center justify-left rounded-xl mx-1 w-[160px]">
                        <p class="whitespace-nowrap overflow-hidden truncate">{{ item.name }}</p>
                      </div>
                    </td>
                    <td>
                      <div :id="item.id" class="flex items-center justify-center rounded-xl mx-1 w-[120px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                          {{ translateActionType(item.type) }}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div :id="item.id" class="flex items-center justify-center rounded-xl mx-1 w-[70px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                          {{ item.minInterval ?? 0 }} ms
                        </p>
                      </div>
                    </td>
                    <td>
                      <div :id="item.id" class="flex items-center justify-center rounded-xl mx-1 my-1 w-[150px]">
                        <p class="whitespace-nowrap overflow-hidden truncate">
                          {{ item.linkedVariables?.join(' / ') ?? '--' }}
                        </p>
                      </div>
                    </td>
                    <td class="w-[220px] text-right">
                      <div class="flex items-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editAction(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-link"
                          size="x-small"
                          @click="openLinkDialog(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-play"
                          size="x-small"
                          @click="runAction(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1 pl-[3px] pt-[1px]"
                          icon="mdi-export"
                          size="x-small"
                          @click="exportAction(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-trash-can-outline"
                          size="x-small"
                          @click="deleteAction(item)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr class="w-full">
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                      <v-btn variant="outlined" class="rounded-lg" @click="actionTypeDialog.show = true">
                        <v-icon start>mdi-plus</v-icon>
                        {{ $t('views.ConfigurationActionsView.newAction') }}
                      </v-btn>
                      <v-btn variant="outlined" class="rounded-lg" @click="importAction">
                        <v-icon start>mdi-import</v-icon>
                        {{ $t('views.ConfigurationActionsView.importAction') }}
                      </v-btn>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] ml-[170px] w-full">
                        {{ $t('views.ConfigurationActionsView.noActionsFound') }}
                      </p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>

        <!-- Action Type Selection Dialog -->
        <v-dialog v-model="actionTypeDialog.show" max-width="400px">
          <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
            <v-card-title class="text-h6 font-weight-bold py-4 text-center">{{
              $t('views.ConfigurationActionsView.selectActionType')
            }}</v-card-title>
            <v-card-text class="px-8">
              <v-list bg-color="transparent">
                <v-list-item
                  v-for="type in actionTypes"
                  :key="type.value"
                  :title="type.title"
                  :subtitle="type.description"
                  class="rounded-lg mb-2"
                  @click="selectActionType(type.value)"
                >
                  <template #prepend>
                    <v-icon :icon="type.icon" class="mr-2" />
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-divider class="mt-2 mx-10" />
            <v-card-actions>
              <div class="flex justify-between items-center pa-2 w-full h-full">
                <v-btn color="white" variant="text" @click="actionTypeDialog.show = false">{{
                  $t('common.cancel')
                }}</v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <ActionLinkConfig ref="linkConfig" @save="handleLinkSaved" />

        <!-- Action configuration components with their dialogs -->
        <HttpRequestActionConfig
          ref="httpRequestConfig"
          @action-saved="handleActionSaved"
          @action-deleted="handleActionDeleted"
        />
        <MavlinkMessageActionConfig
          ref="mavlinkConfig"
          @action-saved="handleActionSaved"
          @action-deleted="handleActionDeleted"
        />
        <JavascriptActionConfig
          ref="javascriptConfig"
          @action-saved="handleActionSaved"
          @action-deleted="handleActionDeleted"
        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ActionLinkConfig from '@/components/configuration/ActionLinkConfig.vue'
import HttpRequestActionConfig from '@/components/configuration/HttpRequestActionConfig.vue'
import JavascriptActionConfig from '@/components/configuration/JavascriptActionConfig.vue'
import MavlinkMessageActionConfig from '@/components/configuration/MavlinkMessageActionConfig.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { getActionLink } from '@/libs/actions/action-links'
import { getAllJavascriptActionConfigs, registerJavascriptActionConfig } from '@/libs/actions/free-javascript'
import { getAllHttpRequestActionConfigs, registerHttpRequestActionConfig } from '@/libs/actions/http-request'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { ActionConfig, customActionTypes } from '@/types/cockpit-actions'

import BaseConfigurationView from './BaseConfigurationView.vue'

const { t } = useI18n()
const interfaceStore = useAppInterfaceStore()

const httpRequestConfig = ref()
const mavlinkConfig = ref()
const javascriptConfig = ref()
const linkConfig = ref()

// Add reactive refs for our action lists
const httpRequestActions = ref(getAllHttpRequestActionConfigs())
const mavlinkMessageActions = ref(getAllMavlinkMessageActionConfigs())
const javascriptActions = ref(getAllJavascriptActionConfigs())

/**
 * Translate action type to localized string
 * @param {customActionTypes} type - The action type to translate
 * @returns {string} The translated action type name
 */
const translateActionType = (type: customActionTypes): string => {
  const typeMap: Record<customActionTypes, string> = {
    [customActionTypes.httpRequest]: t('views.ConfigurationActionsView.actionTypes.httpRequest'),
    [customActionTypes.mavlinkMessage]: t('views.ConfigurationActionsView.actionTypes.mavlinkMessage'),
    [customActionTypes.javascript]: t('views.ConfigurationActionsView.actionTypes.javascript'),
  }
  return typeMap[type] || type
}

/**
 * Extended action config with additional variable-link properties
 */
interface LinkedActionConfig extends ActionConfig {
  /**
   * Minimum interval between auto-triggered executions
   */
  minInterval: number | undefined
  /**
   * Linked data-lake variables
   */
  linkedVariables: string[] | undefined
}

const allActionConfigs = computed<LinkedActionConfig[]>(() => {
  const configs: ActionConfig[] = []

  // Use the reactive refs instead of direct function calls
  Object.entries(httpRequestActions.value).forEach(([id, config]) => {
    configs.push({ id, name: config.name, type: customActionTypes.httpRequest, config })
  })

  Object.entries(mavlinkMessageActions.value).forEach(([id, config]) => {
    configs.push({ id, name: config.name, type: customActionTypes.mavlinkMessage, config })
  })

  Object.entries(javascriptActions.value).forEach(([id, config]) => {
    configs.push({ id, name: config.name, type: customActionTypes.javascript, config })
  })

  const extendedConfigs: LinkedActionConfig[] = []

  configs.forEach((config) => {
    const link = getActionLink(config.id)
    extendedConfigs.push({ ...config, minInterval: link?.minInterval, linkedVariables: link?.variables })
  })

  return extendedConfigs
})

const headers = [
  { title: t('common.name'), key: 'name', sortable: true, align: 'start' },
  { title: t('views.ConfigurationActionsView.type'), key: 'type', sortable: true, align: 'center' },
  { title: t('views.ConfigurationActionsView.minInterval'), key: 'minInterval', sortable: false, align: 'center' },
  {
    title: t('views.ConfigurationActionsView.linkedVariables'),
    key: 'linkedVariables',
    sortable: false,
    align: 'center',
  },
  { title: t('views.ConfigurationActionsView.actionsColumn'), key: 'actions', sortable: false, align: 'end' },
]

const loadAllActions = (): void => {
  // Update our reactive refs
  httpRequestActions.value = { ...getAllHttpRequestActionConfigs() }
  mavlinkMessageActions.value = { ...getAllMavlinkMessageActionConfigs() }
  javascriptActions.value = { ...getAllJavascriptActionConfigs() }
}

const handleActionSaved = (): void => {
  loadAllActions()
}

const handleLinkSaved = (): void => {
  loadAllActions()
}

const handleActionDeleted = (): void => {
  loadAllActions()
}

const editAction = (item: ActionConfig): void => {
  switch (item.type) {
    case customActionTypes.httpRequest:
      httpRequestConfig.value?.openEditDialog(item.id)
      break
    case customActionTypes.mavlinkMessage:
      mavlinkConfig.value?.openEditDialog(item.id)
      break
    case customActionTypes.javascript:
      javascriptConfig.value?.openEditDialog(item.id)
      break
  }
}

const runAction = (item: ActionConfig): void => {
  executeActionCallback(item.id)
}

const exportAction = (item: ActionConfig): void => {
  switch (item.type) {
    case customActionTypes.httpRequest:
      httpRequestConfig.value?.exportAction(item.id)
      break
    case customActionTypes.mavlinkMessage:
      mavlinkConfig.value?.exportAction(item.id)
      break
    case customActionTypes.javascript:
      javascriptConfig.value?.exportAction(item.id)
      break
  }
}

const deleteAction = (item: ActionConfig): void => {
  switch (item.type) {
    case customActionTypes.httpRequest:
      httpRequestConfig.value?.deleteAction(item.id)
      break
    case customActionTypes.mavlinkMessage:
      mavlinkConfig.value?.deleteAction(item.id)
      break
    case customActionTypes.javascript:
      javascriptConfig.value?.deleteAction(item.id)
      break
  }
}

const openNewActionDialog = (type: customActionTypes): void => {
  switch (type) {
    case customActionTypes.httpRequest:
      httpRequestConfig.value?.openNewDialog()
      break
    case customActionTypes.mavlinkMessage:
      mavlinkConfig.value?.openNewDialog()
      break
    case customActionTypes.javascript:
      javascriptConfig.value?.openNewDialog()
      break
  }
}

const actionTypeDialog = ref({ show: false })

const actionTypes = computed(() => [
  {
    title: t('views.ConfigurationActionsView.httpRequestAction'),
    description: t('views.ConfigurationActionsView.httpRequestDescription'),
    value: customActionTypes.httpRequest,
    icon: 'mdi-web',
  },
  {
    title: t('views.ConfigurationActionsView.mavlinkMessageAction'),
    description: t('views.ConfigurationActionsView.mavlinkMessageDescription'),
    value: customActionTypes.mavlinkMessage,
    icon: 'mdi-drone',
  },
  {
    title: t('views.ConfigurationActionsView.javascriptAction'),
    description: t('views.ConfigurationActionsView.javascriptDescription'),
    value: customActionTypes.javascript,
    icon: 'mdi-code-braces',
  },
])

const selectActionType = (type: customActionTypes): void => {
  actionTypeDialog.value.show = false
  openNewActionDialog(type)
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

          // Determine the action type based on the content and register it
          if ('messageType' in json) {
            registerMavlinkMessageActionConfig(json)
            loadAllActions()
            const configs = getAllMavlinkMessageActionConfigs()
            const id = Object.keys(configs).find((key) => configs[key].name === json.name)
            if (id) mavlinkConfig.value?.openEditDialog(id)
          } else if ('method' in json) {
            registerHttpRequestActionConfig(json)
            loadAllActions()
            const configs = getAllHttpRequestActionConfigs()
            const id = Object.keys(configs).find((key) => configs[key].name === json.name)
            if (id) httpRequestConfig.value?.openEditDialog(id)
          } else if ('code' in json) {
            registerJavascriptActionConfig(json)
            loadAllActions()
            const configs = getAllJavascriptActionConfigs()
            const id = Object.keys(configs).find((key) => configs[key].name === json.name)
            if (id) javascriptConfig.value?.openEditDialog(id)
          } else {
            throw new Error('Unknown action type')
          }
        } catch (error) {
          console.error('Cannot import action:', error)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
  input.remove()
}

const openLinkDialog = (item: ActionConfig): void => {
  linkConfig.value?.openDialog(item)
}

onMounted(() => {
  loadAllActions()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
