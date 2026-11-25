import { useStorage } from '@vueuse/core'
import { t } from 'ttag'

import { closeSnackbar, openSnackbar } from '@/composables/snackbar'

/**
 * Warns once per launch when Windows Firewall blocks Cockpit, and offers to lift the block. Windows only asks about a
 * program once, so after a cancelled question nothing else would tell why video or a vehicle does not arrive.
 */
export const useFirewallWarning = (): void => {
  // Kept on this computer alone, as the firewall it is about
  const suppressed = useStorage('cockpit-suppress-firewall-warning', false)
  if (suppressed.value || !window.electronAPI?.isBlockedByFirewall) return

  const allow = async (): Promise<void> => {
    // Windows takes from seconds to a minute to change its rules after the confirmation, with nothing to show for it
    const waiting = openSnackbar({
      message: t`Letting Cockpit through Windows Firewall. Confirm it when Windows asks, and wait for the result.`,
      variant: 'info',
      persistent: true,
    })
    const allowed = await window.electronAPI!.allowThroughFirewall()
    closeSnackbar(waiting)
    if (allowed) {
      openSnackbar({ message: t`Windows Firewall no longer blocks Cockpit.`, variant: 'success', duration: 5000 })
      return
    }
    openSnackbar({
      message: t`Windows Firewall still blocks Cockpit. Allow it in the Windows Firewall settings of this computer.`,
      variant: 'error',
      persistent: true,
    })
  }

  void window.electronAPI.isBlockedByFirewall().then((blocked) => {
    if (!blocked) return
    openSnackbar({
      message: t`Windows Firewall is blocking Cockpit, so video and vehicle connections sent to this computer may not arrive.`,
      variant: 'warning',
      persistent: true,
      action: { label: t`Allow Cockpit`, handler: () => void allow() },
      suppress: {
        tooltip: t`Do not warn about the firewall again on this computer`,
        handler: () => (suppressed.value = true),
      },
    })
  })
}
