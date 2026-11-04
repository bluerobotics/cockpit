# Started by the E2ELaunch scheduled task, so the app opens on the logged-in desktop (session 1)
# rather than in the SSH session's invisible one. The runner writes launch.json before each start.
$spec = Get-Content -Raw "$PSScriptRoot\launch.json" | ConvertFrom-Json
$app = Start-Process -FilePath $spec.exe -ArgumentList $spec.args -WorkingDirectory (Split-Path $spec.exe) -PassThru

# A capture card records the whole screen, so the app has to fill it. Only a process in this session can
# reach the window; ssh cannot.
# Cockpit resizes its window once after opening it, which can undo a maximise that landed first, so keep
# maximising it until it has stayed maximised for a few seconds.
if ($spec.maximize) {
  Add-Type -Namespace E2E -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool IsZoomed(System.IntPtr h);
'@
  $settled = 0
  for ($i = 0; $i -lt 240 -and $settled -lt 12; $i++) {
    Start-Sleep -Milliseconds 250
    $app.Refresh()
    $h = $app.MainWindowHandle
    if ($h -eq 0) { continue }
    if ([E2E.Win]::IsZoomed($h)) { $settled++ } else { $settled = 0; [E2E.Win]::ShowWindow($h, 3) | Out-Null }
  }
}
