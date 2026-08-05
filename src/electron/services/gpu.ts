import { app } from 'electron'

import { parseChromiumSwitches } from '@/libs/chromium-switches'

import store from './config-store'

/**
 * Apply extra Chromium switches from the config store and the COCKPIT_CHROMIUM_SWITCHES environment variable.
 *
 * These exist as an escape hatch for GPU and video driver bugs that only reproduce on specific hardware, where the
 * workaround is a Chromium switch (e.g. "disable-zero-copy-dxgi-video" for stalling video on some Windows/AMD
 * combinations). Must run before the app is ready, as the GPU process reads the command line on startup.
 *
 * A switch can always turn out to break rendering on a given machine, so the persisted ones are guarded: a flag is
 * raised before they are applied and only lowered once a window finishes loading. Finding it still raised on the next
 * launch means the previous attempt never got that far, so the switches are set aside instead of applied again.
 */
export const applyChromiumSwitches = (): void => {
  const persisted = store.get('chromiumSwitches') ?? []

  if (store.get('chromiumSwitchesBootPending') && persisted.length > 0) {
    store.set('chromiumSwitchesDisabled', persisted)
    store.set('chromiumSwitches', [])
    store.set('chromiumSwitchesBootPending', false)
    console.warn(`Cockpit failed to start with these Chromium switches, so they were disabled: ${persisted.join(' ')}`)
  }

  const entries = store.get('chromiumSwitches') ?? []
  if (entries.length > 0) {
    store.set('chromiumSwitchesBootPending', true)
  }

  // Switches from the environment are a support and development override, so they stay outside of the failsafe.
  const switches = [...parseChromiumSwitches(entries), ...parseChromiumSwitches(process.env.COCKPIT_CHROMIUM_SWITCHES)]

  switches.forEach(({ name, value }) => {
    if (value === undefined) {
      app.commandLine.appendSwitch(name)
    } else {
      app.commandLine.appendSwitch(name, value)
    }
    console.log(`Applied custom Chromium switch: --${name}${value === undefined ? '' : `=${value}`}`)
  })
}

/**
 * Clear the pending-boot flag, marking the applied switches as safe. Called once a window has finished loading.
 */
export const markStartupAsHealthy = (): void => {
  if (store.get('chromiumSwitchesBootPending')) {
    store.set('chromiumSwitchesBootPending', false)
  }
}

/**
 * Log the GPU feature status and driver identification, so video problems can be told apart from rendering ones
 * without asking the user to reproduce anything. Only meaningful after the app is ready.
 */
export const logGpuStatus = async (): Promise<void> => {
  try {
    console.log(`GPU feature status: ${JSON.stringify(app.getGPUFeatureStatus())}`)
    const gpuInfo = await app.getGPUInfo('basic')
    console.log(`GPU info: ${JSON.stringify(gpuInfo)}`)
  } catch (error) {
    console.error('Failed to read the GPU status.', error)
  }
}
