<template>
  <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>AI agent access</template>
    <template #info>
      <p class="w-full">
        Lets AI agents running on this computer, like Claude Code or Cursor, create data-lake variables, transforming
        functions, actions and DIY widgets for you, through the Model Context Protocol (MCP). Every change an agent
        makes is announced on screen. These settings stay on this computer and are not synced with the vehicle.
      </p>
    </template>
    <template #content>
      <p v-if="!isElectron()" class="w-full text-sm opacity-70 py-2">
        Only available in the Cockpit desktop app, since a browser tab cannot accept connections from agents.
      </p>
      <div v-else-if="mcpState" class="flex flex-col w-full py-2">
        <v-switch
          :model-value="mcpState.config.enabled"
          label="Allow agents to connect"
          color="white"
          hide-details
          @update:model-value="onEnabledChange"
        />
        <v-switch
          :model-value="mcpState.config.allowCode"
          :disabled="!mcpState.config.enabled"
          label="Allow agents to create and run code"
          color="white"
          hint="Transforming functions, DIY widgets, and saving or running actions, which may command the vehicle"
          persistent-hint
          @update:model-value="onAllowCodeChange"
        />
        <div
          v-if="mcpState.config.enabled"
          class="grid items-start gap-x-4 mt-4"
          :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-[120px_1fr]'"
        >
          <v-text-field
            v-model.number="portInput"
            label="Port"
            type="number"
            variant="outlined"
            density="compact"
            hide-details
            @keyup.enter="applyPort"
            @blur="applyPort"
          />
          <v-text-field
            :model-value="connectionCommand"
            label="Command to add Cockpit to Claude Code"
            variant="outlined"
            density="compact"
            readonly
            :error-messages="mcpState.status.error ? `Could not start: ${mcpState.status.error}` : undefined"
            :hint="mcpState.status.running ? `Listening on 127.0.0.1:${mcpState.config.port}` : undefined"
            persistent-hint
          >
            <template #append-inner>
              <v-btn
                v-tooltip.bottom="'Copy command'"
                icon="mdi-content-copy"
                aria-label="Copy command"
                size="x-small"
                variant="text"
                @click="copyConnectionCommand"
              />
              <v-btn
                v-tooltip.bottom="'Generate a new token, disconnecting every agent'"
                icon="mdi-key-change"
                aria-label="Generate a new token"
                size="x-small"
                variant="text"
                @click="regenerateToken"
              />
            </template>
          </v-text-field>
        </div>
      </div>
    </template>
  </ExpansiblePanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { openSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { McpConfig, McpState } from '@/types/mcp'

const interfaceStore = useAppInterfaceStore()

const mcpState = ref<McpState>()
const portInput = ref<number>()

const connectionCommand = computed(() => {
  if (!mcpState.value) return ''
  const { port, token } = mcpState.value.config
  const url = `http://127.0.0.1:${port}/mcp`
  return `claude mcp add --transport http cockpit ${url} --header "Authorization: Bearer ${token}"`
})

const setState = (state: McpState): void => {
  mcpState.value = state
  portInput.value = state.config.port
}

const updateConfig = async (changes: Partial<Pick<McpConfig, 'enabled' | 'allowCode' | 'port'>>): Promise<void> => {
  try {
    setState(await window.electronAPI!.setMcpConfig(changes))
    const startError = mcpState.value?.status.error
    if (startError) openSnackbar({ message: `Could not start: ${startError}`, variant: 'error' })
  } catch (error) {
    portInput.value = mcpState.value?.config.port
    openSnackbar({ message: `Could not change the agent access settings. ${error}`, variant: 'error' })
  }
}

const onEnabledChange = async (enabled: boolean | null): Promise<void> => {
  logUserAction(`${enabled ? 'Enabled' : 'Disabled'} AI agent access`)
  await updateConfig({ enabled: enabled === true })
  if (enabled && mcpState.value?.status.running) {
    openSnackbar({ message: 'Agents on this computer can now connect to Cockpit.', variant: 'success' })
  }
}

const onAllowCodeChange = async (allowCode: boolean | null): Promise<void> => {
  logUserAction(`${allowCode ? 'Allowed' : 'Disallowed'} AI agents to create and run code`)
  await updateConfig({ allowCode: allowCode === true })
}

const applyPort = async (): Promise<void> => {
  if (portInput.value === undefined || portInput.value === mcpState.value?.config.port) return
  logUserAction(`Changed the AI agent access port to ${portInput.value}`)
  await updateConfig({ port: portInput.value })
}

const copyConnectionCommand = async (): Promise<void> => {
  logUserAction('Copied the command to add Cockpit to Claude Code')
  try {
    await navigator.clipboard.writeText(connectionCommand.value)
    openSnackbar({ message: 'Command copied. Run it in a terminal to connect Claude Code.', variant: 'success' })
  } catch {
    openSnackbar({ message: 'Could not copy the command. Select it and copy it by hand.', variant: 'error' })
  }
}

const regenerateToken = async (): Promise<void> => {
  logUserAction('Regenerated the AI agent access token')
  setState(await window.electronAPI!.regenerateMcpToken())
  openSnackbar({ message: 'New token generated. Agents need the new command to reconnect.', variant: 'success' })
}

onMounted(async () => {
  if (!isElectron() || !window.electronAPI) return
  setState(await window.electronAPI.getMcpState())
})
</script>
