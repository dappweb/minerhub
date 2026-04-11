@echo off
REM Coin Planet App - iOS/Android Emulator Installation Script
REM This script builds and installs the app to the Android emulator

cd /d "C:\Users\Administrator\Documents\GitHub\minerhub\app-client"

echo.
echo ========================================
echo Coin Planet Mobile App - Android Setup
echo ========================================
echo.

REM Check if emulator is running
echo Checking for connected Android devices...
"C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb" devices

echo.
echo Starting Android application build...
echo This may take 10-15 minutes on first run.
echo (Gradle will download dependencies)
echo.

REM Build with Gradle
cd /d "C:\Users\Administrator\Documents\GitHub\minerhub\app-client\android"

echo Executing: gradlew.bat assembleDebug
call gradlew.bat assembleDebug

if %ERRORLEVEL% GEQ 1 (
    echo Build failed! Check errors above.
    pause
    exit /b 1
)

echo Build completed successfully!
echo.

REM Find and install the APK
echo.
echo Looking for generated APK...
set APK_PATH=C:\Users\Administrator\Documents\GitHub\minerhub\app-client\android\app\build\outputs\apk\debug\app-debug.apk

if not exist "%APK_PATH%" (
    echo ERROR: APK not found at %APK_PATH%
    pause
    exit /b 1
)

echo Found: %APK_PATH%
echo Installing to Android emulator...

"C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb" install -r "%APK_PATH%"

if %ERRORLEVEL% GEQ 1 (
    echo Installation failed! Make sure emulator is running.
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! App installed to emulator.
echo ========================================
echo.
echo Launching app...
"C:\Users\Administrator\AppData\Local\Android\Sdk\platform-tools\adb" shell am start -n com.coinplanet.mobile/.MainActivity

echo.
echo App should be launching on the emulator now!
pause
