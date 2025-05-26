# PowerShell script to build portable Windows version
Write-Host "Building Plainflux Portable Edition..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "src-tauri")) {
    Write-Host "Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Build the frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed" -ForegroundColor Red
    exit 1
}

# Build the Rust backend
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location src-tauri
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Create portable package
Write-Host "Creating portable package..." -ForegroundColor Yellow
$portableDir = "dist-portable"
if (Test-Path $portableDir) {
    Remove-Item -Recurse -Force $portableDir
}
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null

# Copy executable
Copy-Item "src-tauri/target/release/plainflux.exe" "$portableDir/"

# Copy WebView2 loader if it exists
if (Test-Path "src-tauri/target/release/WebView2Loader.dll") {
    Copy-Item "src-tauri/target/release/WebView2Loader.dll" "$portableDir/"
}

# Create batch launcher
@"
@echo off
title Plainflux
echo Starting Plainflux...
start "" "%~dp0plainflux.exe"
"@ | Out-File -FilePath "$portableDir/Plainflux.bat" -Encoding ASCII

# Create README
@"
Plainflux Portable Edition
=========================

Version: $(Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json).version
Built: $(Get-Date -Format "yyyy-MM-dd")

This is the portable version of Plainflux that doesn't require installation.

HOW TO RUN:
-----------
- Double-click Plainflux.bat (recommended)
- Or double-click plainflux.exe

FIRST RUN:
----------
- The app may prompt to install Microsoft Edge WebView2 Runtime
- This is a one-time system requirement (not installed in portable folder)
- Download from: https://go.microsoft.com/fwlink/p/?LinkId=2124703

NOTES LOCATION:
---------------
Your notes will be stored in: %USERPROFILE%\Notes

SETTINGS:
---------
App settings are stored in: %APPDATA%\com.plainflux.app

PORTABLE USE:
-------------
To make this truly portable with notes on a USB drive:
1. Create a "Notes" folder next to plainflux.exe
2. The app will detect and use this local folder instead

TROUBLESHOOTING:
----------------
- If the app doesn't start, ensure .NET Framework 4.7.2+ is installed
- For WebView2 issues, install the runtime from the link above
- Check Windows Event Viewer for detailed error messages

"@ | Out-File -FilePath "$portableDir/README.txt" -Encoding UTF8

# Create version info
@{
    Version = (Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json).version
    BuildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    BuildMachine = $env:COMPUTERNAME
    BuildUser = $env:USERNAME
} | ConvertTo-Json | Out-File -FilePath "$portableDir/version.json" -Encoding UTF8

# Calculate file sizes
$exeSize = (Get-Item "$portableDir/plainflux.exe").Length / 1MB
Write-Host "Executable size: $([math]::Round($exeSize, 2)) MB" -ForegroundColor Cyan

# Create ZIP archive
$zipName = "Plainflux-Portable-Windows-x64.zip"
Write-Host "Creating $zipName..." -ForegroundColor Yellow
Compress-Archive -Path "$portableDir/*" -DestinationPath $zipName -Force

$zipSize = (Get-Item $zipName).Length / 1MB
Write-Host "`nBuild complete!" -ForegroundColor Green
Write-Host "Portable package: $zipName ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
Write-Host "Extract and run Plainflux.bat to start" -ForegroundColor Yellow