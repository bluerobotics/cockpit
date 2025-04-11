<template>
  <BaseConfigurationView>
    <template #title>Cockpit actions configuration</template>
    <template #content>
      <div class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]">
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Actions</template>
          <template #info>
            <li>View, manage, and create different types of actions.</li>
            <li>HTTP Request actions can be used to call external APIs, like servers, vehicles, cameras, etc.</li>
            <li>MAVLink Message actions allow you to send specific MAVLink messages to vehicles.</li>
            <li>JavaScript actions give you full flexibility by allowing you to write custom code.</li>
            <li>
              The link button can be used to link Actions to Data Lake variables, so that changes to the variable value
              will automatically trigger the linked action.
            </li>
            <li>Actions can also be tested/run manually, using the play button.</li>
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
                          {{ customActionTypesNames[item.type] }}
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
                          color="error"
                          icon="mdi-delete"
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
                        New action
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
                      <p class="text-[16px] ml-[170px] w-full">No actions found</p>
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
            <v-card-title class="text-h6 font-weight-bold py-4 text-center">Select Action Type</v-card-title>
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
                <v-btn color="white" variant="text" @click="actionTypeDialog.show = false">Cancel</v-btn>
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
        <ActionConfigDialog
          ref="actionConfigDialog"
          @action-saved="handleActionSaved"
          @action-deleted="handleActionDeleted"
        />
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref } from 'vue'

import ActionConfigDialog from '@/components/configuration/ActionConfigDialog.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { getActionLink } from '@/libs/actions/action-links'
import {
  deleteJavascriptActionConfig,
  getAllJavascriptActionConfigs,
  registerJavascriptActionConfig,
} from '@/libs/actions/free-javascript'
import {
  deleteHttpRequestActionConfig,
  getAllHttpRequestActionConfigs,
  registerHttpRequestActionConfig,
} from '@/libs/actions/http-request'
import {
  deleteMavlinkMessageActionConfig,
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { ActionConfig, customActionTypes, customActionTypesNames } from '@/types/cockpit-actions'

import BaseConfigurationView from './BaseConfigurationView.vue'
const interfaceStore = useAppInterfaceStore()

const actionConfigDialog = ref()

// Add reactive refs for our action lists
const httpRequestActions = ref(getAllHttpRequestActionConfigs())
const mavlinkMessageActions = ref(getAllMavlinkMessageActionConfigs())
const javascriptActions = ref(getAllJavascriptActionConfigs())

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
  { title: 'Name', key: 'name', sortable: true, align: 'start' as const },
  { title: 'Type', key: 'type', sortable: true, align: 'center' as const },
  { title: 'Min Interval', key: 'minInterval', sortable: false, align: 'center' as const },
  { title: 'Linked Variables', key: 'linkedVariables', sortable: false, align: 'center' as const },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
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
  actionConfigDialog.value?.openDialog(item)
}

const runAction = (item: ActionConfig): void => {
  executeActionCallback(item.id)
}

const exportAction = (item: ActionConfig): void => {
  const action =
    item.type === customActionTypes.httpRequest
      ? getAllHttpRequestActionConfigs()[item.id]
      : item.type === customActionTypes.mavlinkMessage
      ? getAllMavlinkMessageActionConfigs()[item.id]
      : getAllJavascriptActionConfigs()[item.id]

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
  a.download = `${item.id}.json`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  a.remove()
}

const deleteAction = (item: ActionConfig): void => {
  switch (item.type) {
    case customActionTypes.httpRequest:
      deleteHttpRequestActionConfig(item.id)
      break
    case customActionTypes.mavlinkMessage:
      deleteMavlinkMessageActionConfig(item.id)
      break
    case customActionTypes.javascript:
      deleteJavascriptActionConfig(item.id)
      break
  }
  loadAllActions()
}

const openNewActionDialog = (type: customActionTypes): void => {
  const newAction: ActionConfig = {
    id: uuidv4(),
    name: '',
    type,
    config: {},
  }
  actionConfigDialog.value?.openDialog(newAction)
}

const actionTypeDialog = ref({ show: false })

const actionTypes = [
  {
    title: 'HTTP Request Action',
    description: 'Create an action to make HTTP requests to external APIs and services',
    value: customActionTypes.httpRequest,
    icon: 'mdi-web',
  },
  {
    title: 'MAVLink Message Action',
    description: 'Create an action to send MAVLink messages to vehicles',
    value: customActionTypes.mavlinkMessage,
    icon: 'mdi-drone',
  },
  {
    title: 'JavaScript Action',
    description: 'Create a custom action using JavaScript code',
    value: customActionTypes.javascript,
    icon: 'mdi-code-braces',
  },
]

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
          const id = uuidv4()

          if ('messageType' in json) {
            registerMavlinkMessageActionConfig({ ...json, id })
          } else if ('method' in json) {
            registerHttpRequestActionConfig({ ...json, id })
          } else if ('code' in json) {
            registerJavascriptActionConfig({ ...json, id })
          } else {
            throw new Error('Unknown action type')
          }
          loadAllActions()
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

onMounted(() => {
  loadAllActions()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
