import { useEventListener, useMediaQuery } from '@vueuse/core'
import { type ComputedRef, computed, ref, shallowRef } from 'vue'

import { isElectron } from '@/libs/utils'

import { openSnackbar } from './snackbar'

type BeforeInstallPromptEvent = Event & {
  /** Opens the browser's one-shot installation dialog. */
  prompt: () => Promise<unknown>
  /** The user's response to the browser installation dialog. */
  userChoice: Promise<{
    /** Whether the user accepted the installation. */
    outcome: 'accepted' | 'dismissed'
    /** The installation platform offered by the browser. */
    platform: string
  }>
}

/**
 * Offers browser installation while an unused native prompt is available.
 * @returns {{canInstall: ComputedRef<boolean>, install: () => Promise<void>}} Installation availability and action.
 */
export const usePwaInstallation = (): {
  /** Whether the browser currently offers installation. */
  canInstall: ComputedRef<boolean>
  /** Opens the available installation prompt. */
  install: () => Promise<void>
} => {
  const deferredPrompt = shallowRef<BeforeInstallPromptEvent>()
  const installed = ref(false)
  const browserMode = useMediaQuery('(display-mode: browser)')
  const canInstall = computed(() => !isElectron() && !installed.value && browserMode.value && !!deferredPrompt.value)

  useEventListener(window, 'beforeinstallprompt', (event: BeforeInstallPromptEvent) => {
    if (isElectron() || installed.value) return
    event.preventDefault()
    deferredPrompt.value = event
  })

  useEventListener(window, 'appinstalled', () => {
    installed.value = true
    deferredPrompt.value = undefined
  })

  const install = async (): Promise<void> => {
    if (!canInstall.value || !deferredPrompt.value) return
    const prompt = deferredPrompt.value
    deferredPrompt.value = undefined
    logUserAction('Opened the browser app installation prompt')
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      logUserAction(outcome === 'accepted' ? 'Accepted app installation' : 'Dismissed app installation')
    } catch {
      openSnackbar({
        message: 'Could not open app installation. Try installing from your browser menu.',
        variant: 'error',
        duration: 5000,
      })
    }
  }

  return { canInstall, install }
}
