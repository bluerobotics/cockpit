#!/usr/bin/env node
/* eslint-env node */
/**
 * Test WebSocket server for generic WebSocket connections feature.
 *
 * This server sends test data to connected Cockpit instances in the format:
 *   variableName=value
 *
 * Usage:
 *   1. Install ws package (if not already): npm install ws
 *   2. Run: node scripts/test-websocket-server.mjs
 *   3. In Cockpit, go to General Settings > Generic WebSocket connections
 *   4. Enter: ws://localhost:8765
 *   5. Click Connect
 *   6. Check the Data Lake to see the variables being updated
 */

import { WebSocketServer } from 'ws'

const PORT = 8765

const wss = new WebSocketServer({ port: PORT })

console.log(`\n🚀 Test WebSocket server running on ws://localhost:${PORT}`)
console.log('\n📋 Instructions:')
console.log('   1. Open Cockpit in your browser')
console.log('   2. Go to Settings > General')
console.log('   3. Expand "Generic WebSocket connections"')
console.log(`   4. Enter: ws://localhost:${PORT}`)
console.log('   5. Click Connect')
console.log('   6. Check the Data Lake tool to see variables being updated')
console.log('\n📊 Sending test data every second...\n')

// Track connected clients
let clientCount = 0

wss.on('connection', (ws) => {
  clientCount++
  const clientId = clientCount
  console.log(`✅ Client ${clientId} connected (total: ${wss.clients.size})`)

  // Send a welcome message
  ws.send('test-connection-status=connected')

  // Quoted string values that cycle through number-like, boolean-like, and string values
  // These should always be treated as strings due to the quotes
  const quotedValues = ['123', 'true', 'false', '456.789', 'hello world', '0', '']

  // Send all test variables at 10 Hz
  let counter = 0
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      counter++

      // Send all variables every tick
      ws.send(`test-counter=${counter}`)
      ws.send(`test-random=${Math.floor(Math.random() * 100)}`)
      ws.send(`test-sine=${Math.sin(counter * 0.1).toFixed(3)}`)
      ws.send(`test-boolean=${counter % 2 === 0}`)
      ws.send(`test-timestamp=${Date.now()}`)

      // Send a quoted string that cycles through different value types
      // This tests that quoted values are always treated as strings
      const quotedValue = quotedValues[counter % quotedValues.length]
      ws.send(`test-quoted-string="${quotedValue}"`)

      // Only log every second (every 10th tick) to avoid console spam
      if (counter % 10 === 0) {
        console.log(`📤 [Client ${clientId}] Sent all 6 variables (tick #${counter})`)
      }
    }
  }, 100)

  ws.on('close', () => {
    clearInterval(interval)
    console.log(`❌ Client ${clientId} disconnected (total: ${wss.clients.size})`)
  })

  ws.on('error', (error) => {
    console.error(`⚠️ Client ${clientId} error:`, error.message)
  })
})

wss.on('error', (error) => {
  console.error('Server error:', error)
})

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...')
  wss.close(() => {
    console.log('Server closed.')
    process.exit(0)
  })
})
