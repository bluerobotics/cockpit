import { expect, test } from 'vitest'

import * as Connection from '@/libs/connection/connection'

test('URI', () => {
  expect(new Connection.URI('http://google.com').isSecure()).toBe(false)
  expect(new Connection.URI('ws://google.com').isSecure()).toBe(false)
  expect(new Connection.URI('https://google.com').isSecure()).toBe(true)
  expect(new Connection.URI('wss://google.com').isSecure()).toBe(true)
  expect(new Connection.URI('https://google.com').type()).toBe(Connection.Type.Http)
  expect(new Connection.URI('wss://google.com').type()).toBe(Connection.Type.WebSocket)
  expect(new Connection.URI('potato://google.com').type()).toBe(Connection.Type.None)
})

test('Type', () => {
  expect(Connection.Type.fromProtocol('http')).toBe(Connection.Type.Http)
  expect(Connection.Type.fromProtocol('https')).toBe(Connection.Type.Http)
  expect(Connection.Type.fromProtocol('ws')).toBe(Connection.Type.WebSocket)
  expect(Connection.Type.fromProtocol('wss')).toBe(Connection.Type.WebSocket)
  expect(Connection.Type.fromProtocol('potato')).toBe(Connection.Type.None)
})
