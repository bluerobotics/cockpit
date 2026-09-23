import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  type Tool,
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { app, ipcMain, WebContents } from 'electron'
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http'

import type { McpConfig, McpServerStatus, McpState, McpToolCall, McpToolDefinition, McpToolResult } from '@/types/mcp'

import store from './config-store'

const defaultMcpConfig: McpConfig = { enabled: false, allowCode: false, port: 8743, token: '' }
const toolCallTimeoutMs = 10000
const codeSwitch = '"Allow agents to create and run code" (Settings > General > AI agent access)'
const codeToolNote = `Creates or runs code, so it only works while the operator has ${codeSwitch} turned on.`
const codeToolRefusal = `Refused: ask the operator to turn on ${codeSwitch}, then call this tool again.`

let httpServer: HttpServer | undefined
let status: McpServerStatus = { running: false }
let tools: McpToolDefinition[] = []
let toolsOwner: WebContents | undefined
const pendingCalls = new Map<string, (result: McpToolResult) => void>()

const getConfig = (): McpConfig => ({ ...defaultMcpConfig, ...store.get('mcp') })

const getState = (): McpState => ({ config: getConfig(), status })

const errorResult = (message: string): CallToolResult => ({ content: [{ type: 'text', text: message }], isError: true })

const failPendingCalls = (reason: string): void => {
  pendingCalls.forEach((resolve, callId) => resolve({ callId, error: reason }))
}

const callRendererTool = (name: string, args: unknown): Promise<McpToolResult> => {
  return new Promise((resolve) => {
    if (!toolsOwner || toolsOwner.isDestroyed()) {
      resolve({ callId: '', error: 'Cockpit is not ready yet. Try again in a few seconds.' })
      return
    }
    const callId = randomUUID()
    const timer = setTimeout(() => settle({ callId, error: 'Cockpit did not answer in time.' }), toolCallTimeoutMs)
    const settle = (result: McpToolResult): void => {
      clearTimeout(timer)
      pendingCalls.delete(callId)
      resolve(result)
    }
    pendingCalls.set(callId, settle)
    toolsOwner.send('mcp-tool-call', { callId, name, args } satisfies McpToolCall)
  })
}

const createMcpServer = (): Server => {
  const server = new Server({ name: 'cockpit', version: app.getVersion() }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    // Listed whatever the setting, since this server has no stream to tell connected agents the list changed.
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.runsCode ? `${tool.description}\n\n${codeToolNote}` : tool.description,
      inputSchema: tool.inputSchema as Tool['inputSchema'],
      annotations: { readOnlyHint: tool.readOnly },
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = tools.find((t) => t.name === request.params.name)
    if (!tool) return errorResult(`Unknown tool '${request.params.name}'.`)
    // This gates agents, not page code: scripts in the page run with Cockpit's privileges and need no tool.
    if (tool.runsCode && !getConfig().allowCode) {
      return errorResult(codeToolRefusal)
    }

    const { result, error } = await callRendererTool(tool.name, request.params.arguments ?? {})
    if (error !== undefined) return errorResult(error)
    return { content: [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }] }
  })

  return server
}

const hasValidToken = (req: IncomingMessage): boolean => {
  const { token } = getConfig()
  if (token === '') return false
  const expected = Buffer.from(`Bearer ${token}`)
  const received = Buffer.from(req.headers.authorization ?? '')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

const handleHttpRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const { port } = getConfig()
  // Only local agents: a browser page carries an Origin, and a rebound DNS name carries a foreign Host.
  const isLocalHost = [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? '')
  if (!isLocalHost || req.headers.origin !== undefined) {
    res.writeHead(403).end()
    return
  }
  if (!hasValidToken(req)) {
    res.writeHead(401).end()
    return
  }
  if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
    res.writeHead(404).end()
    return
  }
  // Stateless mode serves plain request/response over POST, and has no stream to open or session to close.
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end()
    return
  }

  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } catch (error) {
    console.error('MCP request failed.', error)
    if (!res.headersSent) res.writeHead(500).end()
  }
}

const listenErrorMessages: Record<string, (port: number) => string> = {
  EADDRINUSE: (port) => `port ${port} is already in use. Choose another port.`,
  EACCES: (port) => `port ${port} needs administrator rights. Choose a port above 1024.`,
}

const stopServer = async (): Promise<void> => {
  const server = httpServer
  httpServer = undefined
  status = { running: false }
  if (!server) return
  await new Promise<void>((resolve) => server.close(() => resolve()))
}

const restartServer = async (): Promise<void> => {
  await stopServer()
  const { enabled, port } = getConfig()
  if (!enabled) return

  const server = createServer((req, res) => void handleHttpRequest(req, res))
  status = await new Promise<McpServerStatus>((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      console.error('MCP server could not start.', error)
      resolve({ running: false, error: listenErrorMessages[error.code ?? '']?.(port) ?? error.message })
    })
    server.listen(port, '127.0.0.1', () => resolve({ running: true }))
  })
  if (!status.running) return
  server.on('error', (error) => console.error('MCP server error.', error))
  httpServer = server
  console.log(`MCP server listening on 127.0.0.1:${port}.`)
}

let pendingRestart = Promise.resolve()

// Serialized, so toggling the switch quickly cannot leave two servers fighting over the port.
const applyConfig = (): Promise<void> => (pendingRestart = pendingRestart.then(restartServer))

const setConfig = async (changes: Partial<McpConfig>): Promise<McpState> => {
  const definedChanges = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
  const config: McpConfig = { ...getConfig(), ...definedChanges }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid MCP port '${config.port}'.`)
  }
  if (config.token === '') config.token = randomBytes(32).toString('hex')
  store.set('mcp', config)
  await applyConfig()
  return getState()
}

/**
 * Serve the tools the renderer registers to agents through a local MCP server, when the operator enabled it
 */
export const setupMcpService = (): void => {
  ipcMain.handle('mcp-get-state', () => getState())
  ipcMain.handle('mcp-set-config', (_event, { enabled, allowCode, port }: Partial<McpConfig>) => {
    return setConfig({ enabled, allowCode, port })
  })
  ipcMain.handle('mcp-regenerate-token', () => setConfig({ token: '' }))

  ipcMain.handle('mcp-register-tools', (event, definitions: McpToolDefinition[]) => {
    tools = definitions
    if (toolsOwner === event.sender) return
    toolsOwner = event.sender
    const owner = event.sender
    // A reload or crash drops the renderer's handlers, so its calls could never be answered.
    const forgetOwner = (): void => {
      if (toolsOwner !== owner) return
      failPendingCalls('Cockpit reloaded before answering.')
      tools = []
    }
    owner.on('did-navigate', forgetOwner)
    owner.on('render-process-gone', forgetOwner)
    owner.once('destroyed', () => {
      forgetOwner()
      if (toolsOwner === owner) toolsOwner = undefined
    })
  })

  ipcMain.on('mcp-tool-result', (_event, result: McpToolResult) => {
    pendingCalls.get(result?.callId)?.(result)
  })

  void applyConfig()
}
