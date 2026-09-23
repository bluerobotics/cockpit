import { onBeforeUnmount } from 'vue'
import { z } from 'zod'

import { type McpTool, libMcpTools, mcpToolDefinition } from '@/libs/mcp/tools'
import { isElectron } from '@/libs/utils'
import type { McpToolCall } from '@/types/mcp'

import { openSnackbar } from './snackbar'

const errorMessage = (error: unknown): string => {
  if (error instanceof z.ZodError) return z.prettifyError(error)
  return error instanceof Error ? error.message : String(error)
}

/**
 * Offer Cockpit's tools to agents through the MCP server that the Electron main process runs
 */
export const useMcpBridge = (): void => {
  const api = window.electronAPI
  if (!isElectron() || api === undefined) return

  const tools: McpTool[] = [...libMcpTools]

  const handleCall = async ({ callId, name, args }: McpToolCall): Promise<void> => {
    const tool = tools.find((t) => t.name === name)
    try {
      if (tool === undefined) throw new Error(`Unknown tool '${name}'.`)
      // Round-tripped through JSON so reactive proxies, which IPC cannot clone, reach the agent as plain data.
      const result = JSON.parse(JSON.stringify((await tool.run(args)) ?? null))
      api.sendMcpToolResult({ callId, result })
      if (!tool.readOnly) openSnackbar({ message: `An agent changed Cockpit: ${tool.title}.`, variant: 'info' })
    } catch (error) {
      api.sendMcpToolResult({ callId, error: errorMessage(error) })
    }
  }

  const stopListening = api.onMcpToolCall((call) => void handleCall(call))
  api.registerMcpTools(tools.map(mcpToolDefinition)).catch((error) => {
    console.error('Could not offer the Cockpit tools to agents.', error)
  })

  onBeforeUnmount(stopListening)
}
