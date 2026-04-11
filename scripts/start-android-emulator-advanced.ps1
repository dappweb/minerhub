# Android emulator launcher that centers the real window

param(
    [string]$avdName,
    [int]$screenIndex = 0,
    [switch]$interactive,
    [switch]$listOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

if (-not ('NativeMethods' -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeMethods {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@
}

function Get-RequiredEnv([string]$name) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [Environment]::GetEnvironmentVariable($name, 'User')
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Machine')
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$name is not set"
    }
    return $value
}

function Get-AvdList([string]$emulatorPath) {
    $list = @(& $emulatorPath -list-avds)
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to read AVD list'
    }
    return @($list | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Select-Avd([string[]]$avdList) {
    if ($avdName) {
        if ($avdList -notcontains $avdName) {
            throw "AVD not found: $avdName"
        }
        return $avdName
    }

    if (-not $interactive) {
        return $avdList[0]
    }

    Write-Host 'Available virtual devices:' -ForegroundColor Yellow
    for ($i = 0; $i -lt $avdList.Count; $i++) {
        Write-Host "  [$i] $($avdList[$i])"
    }

    $choice = Read-Host 'Choose device index, press Enter for 0'
    if ([string]::IsNullOrWhiteSpace($choice)) {
        return $avdList[0]
    }
    if ($choice -notmatch '^\d+$') {
        throw 'Device index must be a number'
    }
    $index = [int]$choice
    if ($index -lt 0 -or $index -ge $avdList.Count) {
        throw 'Device index is out of range'
    }
    return $avdList[$index]
}

function Get-TargetScreen([int]$index) {
    $screens = @([System.Windows.Forms.Screen]::AllScreens)
    if ($screens.Length -eq 0) {
        throw 'No displays were detected'
    }
    if ($index -lt 0 -or $index -ge $screens.Length) {
        throw "screenIndex is out of range. Valid range: 0..$($screens.Length - 1)"
    }
    return $screens[$index]
}

function Center-ProcessWindow($process, $screen) {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        $process.Refresh()
        if ($process.HasExited) {
            throw 'Emulator process exited before the window could be positioned'
        }

        if ($process.MainWindowHandle -ne 0) {
            $rect = New-Object NativeMethods+RECT
            if ([NativeMethods]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) {
                $width = $rect.Right - $rect.Left
                $height = $rect.Bottom - $rect.Top
                if ($width -gt 0 -and $height -gt 0) {
                    $workingArea = $screen.WorkingArea
                    $targetX = $workingArea.Left + [Math]::Max(0, [int](($workingArea.Width - $width) / 2))
                    $targetY = $workingArea.Top + [Math]::Max(0, [int](($workingArea.Height - $height) / 2))
                    [void][NativeMethods]::MoveWindow($process.MainWindowHandle, $targetX, $targetY, $width, $height, $true)
                    return @{ X = $targetX; Y = $targetY; Width = $width; Height = $height }
                }
            }
        }

        [System.Threading.Thread]::Sleep(500)
    }

    throw 'Timed out waiting for the emulator window'
}

try {
    $androidHome = Get-RequiredEnv 'ANDROID_HOME'
    $emulatorPath = Join-Path $androidHome 'emulator\emulator.exe'
    if (-not (Test-Path $emulatorPath)) {
        throw "Emulator not found: $emulatorPath"
    }

    $avdList = Get-AvdList $emulatorPath
    if ($avdList.Length -eq 0) {
        throw 'No Android virtual devices were found'
    }

    if ($listOnly) {
        $avdList | ForEach-Object { Write-Host $_ }
        exit 0
    }

    $selectedAvd = Select-Avd $avdList
    $targetScreen = Get-TargetScreen $screenIndex

    Write-Host 'Detected displays:' -ForegroundColor Yellow
    $screens = @([System.Windows.Forms.Screen]::AllScreens)
    for ($i = 0; $i -lt $screens.Length; $i++) {
        $bounds = $screens[$i].WorkingArea
        $marker = if ($i -eq $screenIndex) { '*' } else { ' ' }
        Write-Host " $marker [$i] $($screens[$i].DeviceName) $($bounds.Width)x$($bounds.Height) @ ($($bounds.Left), $($bounds.Top))"
    }

    Write-Host "Launching AVD: $selectedAvd" -ForegroundColor Green
    $arguments = @(
        '-avd', $selectedAvd,
        '-no-snapshot-load',
        '-netdelay', 'none',
        '-netspeed', 'full'
    )

    $process = Start-Process -FilePath $emulatorPath -ArgumentList $arguments -PassThru
    $position = Center-ProcessWindow -process $process -screen $targetScreen

    Write-Host "Emulator started and centered on screen $screenIndex" -ForegroundColor Green
    Write-Host "Window position: ($($position.X), $($position.Y)) size: $($position.Width)x$($position.Height)" -ForegroundColor Cyan
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
