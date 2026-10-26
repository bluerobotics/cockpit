import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { closeSnackbar, useSnackbar } from '@/composables/snackbar'
import { usePwaInstallation } from '@/composables/usePwaInstallation'

vi.mock('@/libs/utils', () => ({ isElectron: () => Boolean(window.electronAPI) }))

let scope: ReturnType<typeof effectScope>
let browserMode = true
const mediaQueryListeners = new Set<() => void>()
const originalMatchMedia = window.matchMedia

beforeEach(() => {
  browserMode = true
  mediaQueryListeners.clear()
  vi.useFakeTimers()
  vi.stubGlobal('logUserAction', vi.fn())
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: browserMode,
    addEventListener: vi.fn((_event: string, listener: () => void) => mediaQueryListeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => mediaQueryListeners.delete(listener)),
  }))
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  window.matchMedia = originalMatchMedia
  for (const snackbar of [...useSnackbar().snackbars]) closeSnackbar(snackbar.id)
  vi.clearAllTimers()
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'electronAPI')
  vi.clearAllMocks()
})

const offerInstallation = (outcome: 'accepted' | 'dismissed' = 'dismissed'): Event => {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  })
  window.dispatchEvent(event)
  return event
}

test('offers installation only after the browser supplies an install prompt', async () => {
  const installation = scope.run(usePwaInstallation)!
  expect(installation.canInstall.value).toBe(false)
  const event = offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(true)
  expect(event.defaultPrevented).toBe(true)
})

test('retains an offer received outside browser mode and reveals it when browser mode returns', async () => {
  browserMode = false
  const installation = scope.run(usePwaInstallation)!
  const event = offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(false)
  expect(event.defaultPrevented).toBe(true)

  browserMode = true
  for (const listener of [...mediaQueryListeners]) listener()
  await nextTick()
  expect(installation.canInstall.value).toBe(true)
})

test.each(['accepted', 'dismissed'] as const)(
  'consumes each %s prompt once and waits for a new offer',
  async (outcome) => {
    const installation = scope.run(usePwaInstallation)!
    const event = offerInstallation(outcome)
    await nextTick()
    await installation.install()
    await installation.install()
    expect(installation.canInstall.value).toBe(false)
    expect((event as Event & Record<'prompt', () => Promise<void>>).prompt).toHaveBeenCalledTimes(1)
    offerInstallation()
    await nextTick()
    expect(installation.canInstall.value).toBe(true)
  }
)

test('reports a rejected browser prompt and does not reuse it', async () => {
  const installation = scope.run(usePwaInstallation)!
  const event = offerInstallation()
  const prompt = vi.fn().mockRejectedValue(new Error('Installation unavailable'))
  Object.assign(event, { prompt })
  await nextTick()
  await installation.install()
  await installation.install()
  expect(installation.canInstall.value).toBe(false)
  expect(prompt).toHaveBeenCalledTimes(1)
  expect(useSnackbar().snackbars).toMatchObject([
    {
      message: 'Could not open app installation. Try installing from your browser menu.',
      variant: 'error',
    },
  ])
})

test('removes the offer when installed through browser controls', async () => {
  const installation = scope.run(usePwaInstallation)!
  offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(true)
  window.dispatchEvent(new Event('appinstalled'))
  await nextTick()
  expect(installation.canInstall.value).toBe(false)
  const staleOffer = offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(false)
  expect(staleOffer.defaultPrevented).toBe(false)
})

test.each(['electron', 'non-browser display mode'])('does not show the install action in %s', async (environment) => {
  if (environment === 'electron') Object.assign(window, { electronAPI: {} })
  else browserMode = false
  const installation = scope.run(usePwaInstallation)!
  const event = offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(false)
  if (environment === 'electron') expect(event.defaultPrevented).toBe(false)
})

test('removes event listeners when the menu unmounts', async () => {
  const installation = scope.run(usePwaInstallation)!
  scope.stop()
  const event = offerInstallation()
  await nextTick()
  expect(installation.canInstall.value).toBe(false)
  expect(event.defaultPrevented).toBe(false)
})
