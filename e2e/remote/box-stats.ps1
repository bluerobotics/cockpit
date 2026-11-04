# CPU and memory of every process on this machine while a case runs, sampled once a second by Windows' own typeperf.
#   box-stats.ps1 start   begins sampling (after the app is up: typeperf only sees processes alive when it starts)
#   box-stats.ps1 stop    ends it and prints JSON: the logical CPU count, this machine's UTC offset, the role of each
#                         Cockpit process (main, renderer, gpu-process, utility) by PID, and the CSV typeperf wrote
param([Parameter(Mandatory)][ValidateSet('start', 'stop')][string]$Action)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:USERPROFILE 'e2e'
$csv = Join-Path $dir 'box-stats.csv'
$pidFile = Join-Path $dir 'box-stats.pid'

if ($Action -eq 'start') {
  if (Test-Path $pidFile) { Stop-Process -Id (Get-Content $pidFile) -Force -ErrorAction SilentlyContinue }
  Remove-Item -Force -ErrorAction SilentlyContinue $csv, $pidFile
  $counters = @(
    '\Processor(_Total)\% Processor Time',
    '\System\Processor Queue Length',
    '\Memory\Available MBytes',
    '\Process(*)\% Processor Time',
    '\Process(*)\Working Set - Private',
    '\Process(*)\ID Process'
  )
  $quoted = ($counters | ForEach-Object { '"' + $_ + '"' }) -join ' '
  # Created through WMI rather than Start-Process: anything started inside the ssh session dies when it closes.
  $created = Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{
    CommandLine = "typeperf $quoted -si 1 -f CSV -o `"$csv`" -y"
  }
  if ($created.ReturnValue -ne 0) { throw "typeperf did not start ($($created.ReturnValue))" }
  Set-Content $pidFile $created.ProcessId
  return
}

# The roles are read before the sampler stops, while the app is still running.
$roles = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(Cockpit|electron)\.exe$' } | ForEach-Object {
    $role = if ($_.CommandLine -match '--type=([\w-]+)') { $Matches[1] } else { 'main' }
    [pscustomobject]@{ pid = $_.ProcessId; role = $role }
  })
if (Test-Path $pidFile) {
  Stop-Process -Id (Get-Content $pidFile) -Force -ErrorAction SilentlyContinue
  Remove-Item -Force $pidFile
}
Start-Sleep -Milliseconds 500
[pscustomobject]@{
  cores = [Environment]::ProcessorCount
  utcOffsetMinutes = [TimeZoneInfo]::Local.GetUtcOffset((Get-Date)).TotalMinutes
  roles = $roles
  csv = if (Test-Path $csv) { [IO.File]::ReadAllText($csv) } else { '' }
} | ConvertTo-Json -Depth 4 -Compress
