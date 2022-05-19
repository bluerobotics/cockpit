import { expect, test } from 'vitest'

import * as Connection from '@/libs/connection/connection'

test('Scheme', () => {
  expect(new Connection.Scheme('http://google.com').isSecure()).toBe(false)
  expect(new Connection.Scheme('ws://google.com').isSecure()).toBe(false)
  expect(new Connection.Scheme('https://google.com').isSecure()).toBe(true)
  expect(new Connection.Scheme('wss://google.com').isSecure()).toBe(true)
  expect(new Connection.Scheme('https://google.com').type()).toBe(
    Connection.Type.Http
  )
  expect(new Connection.Scheme('wss://google.com').type()).toBe(
    Connection.Type.WebSocket
  )
  expect(new Connection.Scheme('potato://google.com').type()).toBe(
    Connection.Type.None
  )
})

test('Type', () => {
  expect(Connection.Type.fromProtocol('http')).toBe(Connection.Type.Http)
  expect(Connection.Type.fromProtocol('https')).toBe(Connection.Type.Http)
  expect(Connection.Type.fromProtocol('ws')).toBe(Connection.Type.WebSocket)
  expect(Connection.Type.fromProtocol('wss')).toBe(Connection.Type.WebSocket)
  expect(Connection.Type.fromProtocol('potato')).toBe(Connection.Type.None)
})
