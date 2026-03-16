#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Verify that the @kmamal/sdl native binary was properly installed.
 * Yarn v1 treats dependency install script failures as warnings,
 * so @kmamal/sdl's own install hook can fail silently, leaving no sdl.node.
 * This script re-runs the SDL install if the binary is missing, and fails
 * loudly if recovery also fails - preventing broken Electron builds that
 * silently fall back to the browser Gamepad API.
 */
function verifySDL() {
  const sdlDir = path.join(__dirname, '..', 'node_modules', '@kmamal', 'sdl')
  const sdlNodePath = path.join(sdlDir, 'dist', 'sdl.node')

  if (fs.existsSync(sdlNodePath)) {
    console.log('SDL native module verified: sdl.node exists.')
    return
  }

  console.warn('SDL native module not found. Attempting to run the SDL install script...')

  try {
    execSync('node scripts/install.mjs', { cwd: sdlDir, stdio: 'inherit' })
  } catch (error) {
    console.error('SDL install script failed:', error.message)
  }

  if (fs.existsSync(sdlNodePath)) {
    console.log('SDL native module recovered successfully: sdl.node exists.')
    return
  }

  console.error('')
  console.error('========================================')
  console.error('  SDL native module verification failed')
  console.error('========================================')
  console.error('')
  console.error(`  Expected binary not found: ${sdlNodePath}`)
  console.error('')
  console.error('  The @kmamal/sdl install script failed to download the')
  console.error('  pre-built binary. This will cause Cockpit to fall back')
  console.error('  to the browser Gamepad API with incorrect joystick mappings.')
  console.error('')
  console.error('  Check your network connection and ensure you can reach')
  console.error('  GitHub releases, then run yarn install again.')
  console.error('')
  process.exit(1)
}

verifySDL()
