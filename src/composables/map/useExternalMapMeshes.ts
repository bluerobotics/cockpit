import { listenToGenericWebSocketJsonMessages } from '@/libs/generic-websocket'
import {
  type ExternalMapMeshCommand,
  externalMapMeshCommandSchema,
  isExternalMapMeshCommand,
} from '@/libs/map/external-map-mesh-api'
import { MapMeshStore } from '@/libs/map/external-map-meshes'
import { messageFromError } from '@/libs/utils'

/**
 * Shared state of the map meshes received from external software
 */
export interface ExternalMapMeshesState {
  /**
   * Every received map mesh, kept in memory only
   */
  meshes: MapMeshStore
  /**
   * Applies a map mesh command from external software, ignoring any other message
   */
  handleExternalMapMeshMessage: (message: unknown) => void
}

// The mesh a command names, read before validation, so even a malformed command can be reported against it.
const sentMeshId = (message: Record<string, unknown>): string => {
  const id = message.id ?? (message.mesh as Record<string, unknown> | null | undefined)?.id
  return typeof id === 'string' ? id : ''
}

let state: ExternalMapMeshesState | undefined

const createState = (): ExternalMapMeshesState => {
  const meshes = new MapMeshStore()

  const applyCommand = (command: ExternalMapMeshCommand): void => {
    switch (command.type) {
      case 'cockpit:setMapMesh':
        meshes.set(command.mesh)
        return
      case 'cockpit:setMapMeshQuads':
        meshes.writeQuads(command.id, command)
        return
      case 'cockpit:removeMapMeshQuads':
        meshes.removeQuads(command.id, command.first, command.count)
        return
      case 'cockpit:clearMapMesh':
        meshes.clear(command.id)
        return
      case 'cockpit:removeMapMesh':
        meshes.remove(command.id)
    }
  }

  // A sender repeats its commands many times a second, so each kind of rejection, its message with the numbers masked,
  // is only worth one warning per mesh.
  const warnedRejections = new Set<string>()
  const warnRejection = (id: string, error: string): void => {
    const kind = `${id}:${error.replace(/\d+/g, '#')}`
    if (warnedRejections.has(kind)) return
    warnedRejections.add(kind)
    console.warn(`[ExternalMapMeshes] Ignoring command for mesh '${id}'. ${error}`)
  }

  const handleExternalMapMeshMessage = (message: unknown): void => {
    if (!isExternalMapMeshCommand(message)) return
    const id = sentMeshId(message as Record<string, unknown>)
    const parsed = externalMapMeshCommandSchema.safeParse(message)
    if (!parsed.success) {
      // A malformed mesh can fail on every position, so only the first problem is worth reading.
      const [issue] = parsed.error.issues
      const others = parsed.error.issues.length - 1
      const more = others > 0 ? ` (and ${others} more)` : ''
      warnRejection(id, `Invalid command. ${issue.path.join('.')}: ${issue.message}${more}`)
      return
    }
    try {
      applyCommand(parsed.data)
    } catch (error) {
      warnRejection(id, messageFromError(error))
    }
  }

  // The singleton outlives every consumer, so this listener is never removed.
  listenToGenericWebSocketJsonMessages(handleExternalMapMeshMessage)

  return { meshes, handleExternalMapMeshMessage }
}

/**
 * Map meshes sent by external software (BlueOS extensions through a WebSocket connection, or pages embedded in an
 * iframe widget), kept in memory only. State is created once and shared across all callers.
 * @returns {ExternalMapMeshesState} The shared meshes and the command handler
 */
export const useExternalMapMeshes = (): ExternalMapMeshesState => {
  if (!state) state = createState()
  return state
}
