import { expect, test, vi } from 'vitest'

import type { GenericWebSocketReply } from '@/libs/generic-websocket'

/* eslint-disable jsdoc/require-jsdoc -- a test double of the browser's WebSocket. */
class FakeWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static readonly opened: FakeWebSocket[] = []
  readyState = FakeWebSocket.OPEN
  readonly sent: string[] = []
  onmessage?: (event: { data: string }) => void
  constructor(readonly url: string) {
    FakeWebSocket.opened.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
}
/* eslint-enable jsdoc/require-jsdoc */

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: () => ['ws://sender'], setKeyValue: vi.fn() },
}))
vi.mock('@/libs/actions/data-lake', () => ({
  createDataLakeVariable: vi.fn(),
  getDataLakeVariableInfo: vi.fn(),
  setDataLakeVariableData: vi.fn(),
}))
vi.mock('@/libs/utils-data-lake', () => ({
  guessedTypeFromString: () => 'string',
  replaceDataLakeInputsInString: (text: string) => text,
}))
globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket

const { listenToGenericWebSocketJsonMessages } = await import('@/libs/generic-websocket')

test('command listeners can answer on the socket the command came from, until it closes', () => {
  const [socket] = FakeWebSocket.opened
  const received: [unknown, GenericWebSocketReply][] = []
  const stop = listenToGenericWebSocketJsonMessages((message, reply) => received.push([message, reply]))

  socket.onmessage?.({ data: JSON.stringify({ type: 'cockpit:getMapCapabilities', requestId: 'r-1' }) })
  expect(received).toHaveLength(1)
  const [[message, reply]] = received
  expect(message).toEqual({ type: 'cockpit:getMapCapabilities', requestId: 'r-1' })

  reply({ type: 'cockpit:mapCapabilities', requestId: 'r-1' })
  expect(socket.sent).toEqual(['{"type":"cockpit:mapCapabilities","requestId":"r-1"}'])
  socket.readyState = FakeWebSocket.CLOSED
  reply({ type: 'cockpit:mapCapabilities', requestId: 'r-2' })
  expect(socket.sent).toHaveLength(1)
  stop()
})
