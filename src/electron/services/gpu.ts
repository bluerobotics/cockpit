import { app } from 'electron'

import { parseChromiumSwitches } from '@/libs/chromium-switches'

import store from './config-store'

/**
 * Apply extra Chromium switches from the config store and the COCKPIT_CHROMIUM_SWITCHES environment variable.
 *
 * These exist as an escape hatch for GPU and video driver bugs that only reproduce on specific hardware, where the
 * workaround is a Chromium switch (e.g. "disable-zero-copy-dxgi-video" for stalling video on some Windows/AMD
 * combinations). Must run before the app is ready, as the GPU process reads the command line on startup.
 */
export const applyChromiumSwitches = (): void => {
  const switches = [
    ...parseChromiumSwitches(store.get('chromiumSwitches')),
    ...parseChromiumSwitches(process.env.COCKPIT_CHROMIUM_SWITCHES),
  ]

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
