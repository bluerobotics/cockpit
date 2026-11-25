import { execFile, execFileSync } from 'child_process'
import { app, ipcMain } from 'electron'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// The script travels encoded, so that no path can break out of the command line it is passed on
const powerShellArguments = (script: string): string[] => [
  '-NoProfile',
  '-NonInteractive',
  '-EncodedCommand',
  Buffer.from(script, 'utf16le').toString('base64'),
]

// Reading the rules takes a couple of seconds on an idle computer, and over half a minute on a slow one that is busy
const powerShellTimeout = 180000

// Starting an elevated run waits for the user's confirmation, so it gets no limit
const runPowerShell = async (script: string, timeout = powerShellTimeout): Promise<string> => {
  const { stdout } = await execFileAsync('powershell.exe', powerShellArguments(script), { windowsHide: true, timeout })
  return stdout.trim()
}

const program = process.execPath.replaceAll("'", "''")

// Enabled inbound rules of Windows Firewall that name this program. Windows leaves blocking ones behind when its own
// question about the program is cancelled, and never asks again.
const rulesWith = (action: 'Allow' | 'Block'): string =>
  [
    `Get-NetFirewallApplicationFilter -Program '${program}' -ErrorAction SilentlyContinue | Get-NetFirewallRule`,
    `Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq '${action}' }`,
  ].join(' | ')

/**
 * Tell whether Windows Firewall holds a rule that blocks what is sent to Cockpit
 * @returns {Promise<boolean>} True if blocked. False on other systems, and when the firewall could not be asked.
 */
const isBlockedByFirewall = async (): Promise<boolean> => {
  if (process.platform !== 'win32') return false
  try {
    return (await runPowerShell(`@(${rulesWith('Block')}).Count`)) !== '0'
  } catch (error) {
    console.warn('[firewall] Could not read the rules of Windows Firewall:', error)
    return false
  }
}

// The answer Windows itself stores only allows the kinds of network that were ticked in its question, and the
// network of a vehicle is one it files as public, so only a rule for every kind counts
const allowingRules = `${rulesWith('Allow')} | Where-Object { $_.Profile -eq 'Any' }`

// No blocking rule is not enough: without one that allows it, Windows drops what is sent to the program all the same
const isAllowedByFirewall = async (): Promise<boolean> => {
  try {
    const counts = await runPowerShell(`"$(@(${rulesWith('Block')}).Count) $(@(${allowingRules}).Count)"`)
    const [blocking, allowing] = counts.split(' ').map(Number)
    return blocking === 0 && allowing > 0
  } catch (error) {
    console.warn('[firewall] Could not read the rules of Windows Firewall:', error)
    return false
  }
}

const allowSwitch = '--allow-through-firewall'

/**
 * Replace the rules blocking Cockpit with one that allows it, if this run was started for that by
 * allowThroughFirewall, and end the run there. Runs from firewall-elevated-run.ts, before the rest of the application
 * is even loaded.
 */
export const allowThroughFirewallIfStartedForIt = (): void => {
  if (process.platform !== 'win32' || !process.argv.includes(allowSwitch)) return

  const allow = `New-NetFirewallRule -DisplayName 'Cockpit' -Direction Inbound -Action Allow -Program '${program}'`
  const script = [
    `${rulesWith('Block')} | Remove-NetFirewallRule`,
    `if (@(${allowingRules}).Count -eq 0) { ${allow} -Profile Any | Out-Null }`,
  ].join('; ')
  try {
    execFileSync('powershell.exe', powerShellArguments(script), { windowsHide: true, timeout: powerShellTimeout })
  } catch (error) {
    console.warn('[firewall] Could not change the rules of Windows Firewall:', error)
  }
  process.exit()
}

/**
 * Replace the rules blocking Cockpit with one that allows it, which Windows asks the user to confirm as an
 * administrator
 * @returns {Promise<boolean>} True if Cockpit is let through
 */
const allowThroughFirewall = async (): Promise<boolean> => {
  if (process.platform !== 'win32') return true

  // Cockpit starts itself elevated, rather than PowerShell, so that the confirmation of Windows names Cockpit.
  // Outside a packaged build the program is Electron, which has to be told where the application is.
  const elevated = [...(app.isPackaged ? [] : [`"${app.getAppPath()}"`]), allowSwitch]
    .map((argument) => `'${argument.replaceAll("'", "''")}'`)
    .join(',')
  const elevate = `Start-Process '${program}' -Verb RunAs -Wait -ArgumentList ${elevated}`
  try {
    await runPowerShell(elevate, 0)
  } catch (error) {
    // Refusing the confirmation lands here as well
    console.warn('[firewall] Could not change the rules of Windows Firewall:', error)
  }
  return isAllowedByFirewall()
}

/**
 * Setup firewall service
 * Exposes IPC handlers to tell whether Windows Firewall blocks Cockpit, and to let it through
 */
export const setupFirewallService = (): void => {
  ipcMain.handle('firewall-is-blocked', isBlockedByFirewall)
  ipcMain.handle('firewall-allow', allowThroughFirewall)
}
