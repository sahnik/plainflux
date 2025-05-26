# Portable Build Guide

This guide explains how to create and distribute portable builds of Plainflux.

## What are Portable Builds?

Portable builds are standalone executables that don't require installation. Users can:
- Run directly without admin rights
- Use from USB drives
- Keep multiple versions
- Avoid system modifications

## For Existing Releases

If you have an existing release without portable builds:

### Option 1: Use GitHub Actions (Recommended)

1. Go to [Actions](https://github.com/sahnik/plainflux/actions)
2. Find "Add Portable Builds to Existing Release"
3. Click "Run workflow"
4. Enter the tag name (e.g., `v0.9.0`)
5. Click "Run workflow"
6. Wait for builds to complete (~15-20 minutes)
7. Portable builds will be automatically added to the release

### Option 2: Build Locally and Upload

#### On Windows:
```powershell
# Build portable version
./scripts/build-portable.ps1

# Upload using GitHub CLI
gh release upload v0.9.0 Plainflux-Portable-Windows-x64.zip

# Or manually upload via GitHub web interface
```

#### On macOS/Linux:
```bash
# Build portable version
./scripts/build-portable.sh

# Upload using GitHub CLI
gh release upload v0.9.0 Plainflux-Portable-*.tar.gz

# Or manually upload via GitHub web interface
```

## For New Releases

New releases will automatically include portable builds if you're using the GitHub Actions workflows.

### Manual Process:

1. Create your release tag
2. Let the build workflows run
3. Portable builds will be included automatically

### Workflow Files:
- `build-simple.yml` - Includes Windows portable with regular builds
- `build-portable.yml` - Dedicated portable build workflow
- `add-portable-to-release.yml` - Add portable to existing releases

## Portable Build Contents

### Windows (.zip)
- `plainflux.exe` - Main executable
- `Plainflux.bat` - Launcher script
- `WebView2Loader.dll` - WebView2 support (if needed)
- `README.txt` - Instructions

### macOS (.tar.gz)
- `Plainflux` - Universal binary (Intel + Apple Silicon)
- `Plainflux.command` - Launcher script
- `README.txt` - Instructions

### Linux (.tar.gz)
- `Plainflux` - Main executable
- `Plainflux.sh` - Launcher script
- `Plainflux.desktop` - Desktop file template
- `README.txt` - Instructions

## Testing Portable Builds

1. Extract the archive to a test location
2. Run the launcher script
3. Verify the app starts correctly
4. Check that notes are saved to the correct location
5. Test on a system without Plainflux installed

## Requirements

### Windows
- Windows 10/11
- WebView2 Runtime (prompts to install if missing)

### macOS
- macOS 10.13 or later
- May require Gatekeeper approval on first run

### Linux
- WebKitGTK 4.1
- GTK 3
- Modern Linux distribution

## Troubleshooting

### Windows Issues
- **Localhost connection error**: This means the frontend assets aren't bundled. Ensure you use `npm run tauri build` not just `cargo build`
- If app doesn't start, check for WebView2 Runtime
- Run as administrator if file access issues occur
- Check Windows Event Viewer for detailed errors

### macOS Issues
- Right-click and select "Open" if Gatekeeper blocks
- Check Console.app for error messages
- Ensure the binary has execute permissions

### Linux Issues
- Install WebKitGTK: `sudo apt install libwebkit2gtk-4.1-0`
- Check library dependencies: `ldd Plainflux`
- Run from terminal to see error messages

## Distribution

When announcing portable builds:
1. Mention they don't require installation
2. Note the platform-specific requirements
3. Link to this guide for troubleshooting
4. Highlight the benefits (USB portability, no admin rights)