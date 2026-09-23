/**
 * Machine-local configuration of the MCP server, kept in the Electron config store
 */
export interface McpConfig {
  /**
   * Whether the server listens for agents at all
   */
  enabled: boolean
  /**
   * Whether tools that create or run code are offered to agents
   */
  allowCode: boolean
  /**
   * Local port the server listens on
   */
  port: number
  /**
   * Bearer token agents must send, generated the first time the server is enabled
   */
  token: string
}

/**
 * Current state of the MCP server
 */
export interface McpServerStatus {
  /**
   * Whether the server is listening
   */
  running: boolean
  /**
   * Why the server could not start, when it did not
   */
  error?: string
}

/**
 * MCP configuration together with the server state it produced
 */
export interface McpState {
  /**
   * Stored configuration
   */
  config: McpConfig
  /**
   * Server state
   */
  status: McpServerStatus
}

/**
 * Tool the renderer offers to agents, as registered with the Electron main process
 */
export interface McpToolDefinition {
  /**
   * Unique tool name
   */
  name: string
  /**
   * Human-readable title
   */
  title: string
  /**
   * What the tool does, written for the agent
   */
  description: string
  /**
   * JSON Schema of the tool arguments
   */
  inputSchema: Record<string, unknown>
  /**
   * Whether the tool only reads state
   */
  readOnly: boolean
  /**
   * Whether the tool creates or runs code, which the operator has to allow separately
   */
  runsCode: boolean
}

/**
 * Tool call relayed from the Electron main process to the renderer
 */
export interface McpToolCall {
  /**
   * Id matching the call to its result
   */
  callId: string
  /**
   * Name of the tool to call
   */
  name: string
  /**
   * Arguments sent by the agent, not yet validated
   */
  args: unknown
}

/**
 * Outcome of a tool call, sent back from the renderer to the Electron main process
 */
export interface McpToolResult {
  /**
   * Id of the call this answers
   */
  callId: string
  /**
   * JSON-serializable result, when the call succeeded
   */
  result?: unknown
  /**
   * Why the call failed, when it did
   */
  error?: string
}
