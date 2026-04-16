param(
  [string]$DeviceId = "emulator-5554",
  [string]$PackageName = "com.coinplanet.mobile",
  [string]$MainActivity = "com.coinplanet.mobile/.MainActivity",
  [string]$ReportPath = "./reports/lifecycle-report.json",
  [switch]$AutoInstall
)

$ErrorActionPreference = "Stop"

function Get-AdbCommand {
  $common = "C:/Users/Administrator/AppData/Local/Android/Sdk/platform-tools/adb.exe"
  if (Test-Path $common) {
    return $common
  }
  if ($env:ANDROID_HOME) {
    $candidate = Join-Path $env:ANDROID_HOME "platform-tools/adb.exe"
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  if ($env:ANDROID_SDK_ROOT) {
    $candidate = Join-Path $env:ANDROID_SDK_ROOT "platform-tools/adb.exe"
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return "adb"
}

$adb = Get-AdbCommand
$results = @()

$deviceListRaw = (& $adb devices | Out-String)
if ([string]::IsNullOrWhiteSpace($DeviceId)) {
  $firstDevice = ($deviceListRaw -split "`n" | Where-Object { $_ -match "\sdevice$" } | Select-Object -First 1)
  if ($firstDevice) {
    $DeviceId = ($firstDevice -split "\s+")[0].Trim()
  }
}

function Add-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )
  $script:results += [pscustomobject]@{
    name = $Name
    passed = $Passed
    detail = $Detail
    ts = (Get-Date).ToString("o")
  }
}

function Invoke-Adb {
  param([string[]]$Cmd)
  & $adb @Cmd
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds = 20,
    [string]$FailMessage = "Timeout waiting for condition"
  )
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds 500
  }
  throw $FailMessage
}

function Is-AppForeground {
  $focus = (Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "dumpsys", "window") | Out-String)
  $currentFocus = (($focus -split "`n") | Where-Object { $_ -match "mCurrentFocus" } | Select-Object -First 1)
  return ($currentFocus -match $PackageName)
}

function Is-AppRunning {
  $procId = (Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "pidof", $PackageName) | Out-String).Trim()
  return -not [string]::IsNullOrWhiteSpace($procId)
}

function Run-Test {
  param(
    [string]$Name,
    [scriptblock]$Body
  )
  try {
    & $Body
    Add-Result -Name $Name -Passed $true -Detail "OK"
    Write-Host "[PASS] $Name"
  } catch {
    Add-Result -Name $Name -Passed $false -Detail $_.Exception.Message
    Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
  }
}

# 1) Device check
Run-Test "device-online" {
  $devices = (Invoke-Adb -Cmd @("devices") | Out-String)
  if ($devices -notmatch "$DeviceId\s+device") {
    throw "Device $DeviceId not online"
  }
}

# 2) App install check
Run-Test "app-installed" {
  $pkg = (Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "pm", "path", $PackageName) | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($pkg)) {
    if ($AutoInstall) {
      Write-Host "Installing app via npm run android..."
      npm run android -- --device $DeviceId | Out-Null
      $pkg = (Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "pm", "path", $PackageName) | Out-String).Trim()
      if ([string]::IsNullOrWhiteSpace($pkg)) {
        throw "Install failed"
      }
    } else {
      throw "App not installed. Re-run with -AutoInstall"
    }
  }
}

# 3) Cold start
Run-Test "cold-start" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "force-stop", $PackageName) | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "start", "-W", "-n", $MainActivity) | Out-Null
  Wait-Until -Condition { Is-AppForeground } -FailMessage "App did not reach foreground"
}

# 4) UI smoke
Run-Test "ui-smoke" {
  $remote = "/sdcard/uidump.xml"
  $localDir = Join-Path (Get-Location) "reports"
  if (-not (Test-Path $localDir)) { New-Item -Path $localDir -ItemType Directory | Out-Null }
  $local = Join-Path $localDir "uidump.xml"

  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "uiautomator", "dump", $remote) | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "pull", $remote, $local) | Out-Null

  $xml = Get-Content $local -Raw
  if (($xml -notmatch $PackageName) -and ($xml -notmatch "Coin Planet") -and ($xml -notmatch "设备中心") -and ($xml -notmatch "Device Center")) {
    throw "Expected package/text not found in UI dump"
  }
}

# 5) Background -> Foreground
Run-Test "background-foreground" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "start", "-W", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.HOME") | Out-Null
  Wait-Until -Condition { -not (Is-AppForeground) } -FailMessage "App still foreground after HOME"
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "start", "-W", "-n", $MainActivity) | Out-Null
  Wait-Until -Condition { Is-AppForeground } -FailMessage "App did not return to foreground"
}

# 6) Deep link wake
Run-Test "deeplink-launch" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "coinplanet://lifecycle-test") | Out-Null
  Wait-Until -Condition { Is-AppForeground } -FailMessage "App not foreground after deep link"
}

# 7) Rotation stress (app should survive even if locked portrait)
Run-Test "rotation-stress" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "settings", "put", "system", "accelerometer_rotation", "0") | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "settings", "put", "system", "user_rotation", "1") | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "settings", "put", "system", "user_rotation", "0") | Out-Null
  if (-not (Is-AppRunning)) {
    throw "App process not running after rotation stress"
  }
}

# 8) Force-stop and relaunch
Run-Test "force-stop-relaunch" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "force-stop", $PackageName) | Out-Null
  if (Is-AppRunning) {
    throw "App still running after force-stop"
  }
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "am", "start", "-W", "-n", $MainActivity) | Out-Null
  Wait-Until -Condition { Is-AppForeground } -FailMessage "App failed to relaunch"
}

# 9) Offline -> Online recovery smoke
Run-Test "network-toggle-smoke" {
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "svc", "wifi", "disable") | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "svc", "data", "disable") | Out-Null
  if (-not (Is-AppRunning)) { throw "App crashed after disabling network" }

  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "svc", "wifi", "enable") | Out-Null
  Invoke-Adb -Cmd @("-s", $DeviceId, "shell", "svc", "data", "enable") | Out-Null

  if (-not (Is-AppRunning)) { throw "App crashed after enabling network" }
}

$passed = ($results | Where-Object { $_.passed }).Count
$failed = ($results | Where-Object { -not $_.passed }).Count
$total = $results.Count

$report = [pscustomobject]@{
  timestamp = (Get-Date).ToString("o")
  deviceId = $DeviceId
  package = $PackageName
  passed = [int]$passed
  failed = [int]$failed
  total = [int]$total
  results = $results
}

$reportAbs = Resolve-Path -Path "." | ForEach-Object { Join-Path $_.Path $ReportPath }
$reportDir = Split-Path $reportAbs -Parent
if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }
$report | ConvertTo-Json -Depth 6 | Out-File -Encoding UTF8 $reportAbs

Write-Host ""
Write-Host "Lifecycle test summary: $passed passed / $failed failed / $total total"
Write-Host "Report: $reportAbs"

if ($failed -gt 0) {
  exit 1
}
