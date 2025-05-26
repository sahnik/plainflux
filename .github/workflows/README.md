# GitHub Actions Workflows

This directory contains GitHub Actions workflows for continuous integration and automated releases.

## Workflows

### CI (`ci.yml`)
Runs on every push to main and on pull requests:
- Runs tests on all platforms (Ubuntu, macOS, Windows)
- Checks Rust formatting with `cargo fmt`
- Runs Clippy linting
- Checks TypeScript types
- Runs ESLint (if configured)

### Build (`build.yml`)
Triggered on version tags (`v*`) or manually:
- Builds the application for all platforms
- Creates universal binary for macOS (Intel + Apple Silicon)
- Creates draft releases with built artifacts

### Build Simple (`build-simple.yml`)
Alternative build workflow that:
- Builds installers for all platforms
- Additionally creates portable Windows executable
- Uploads all artifacts to GitHub releases

### Build Portable (`build-portable.yml`)
Dedicated workflow for portable builds:
- Creates standalone executables without installers
- Packages with launch scripts and documentation
- Supports Windows (.zip), macOS (.tar.gz), and Linux (.tar.gz)
- No installation required - just extract and run

### Add Portable to Release (`add-portable-to-release.yml`)
Manually triggered workflow to add portable builds to existing releases:
- Input: release tag (e.g., v0.9.0)
- Builds portable versions for all platforms
- Uploads them to the specified release
- Useful for adding portable builds to releases created before this feature

### Manual Release (`release.yml`)
Manually triggered workflow for creating releases:
- Input: version number (e.g., 1.0.0)
- Creates a GitHub release
- Builds for all platforms
- Uploads artifacts to the release
- Publishes the release when all builds complete

## Creating a Release

### Option 1: Tag-based Release
1. Update version in `package.json`, `Cargo.toml`, and `tauri.conf.json`
2. Commit the changes
3. Create and push a tag:
   ```bash
   git tag v0.9.0
   git push origin v0.9.0
   ```
4. The build workflow will automatically create a draft release

### Option 2: Manual Release
1. Go to Actions tab in GitHub
2. Select "Manual Release" workflow
3. Click "Run workflow"
4. Enter the version number (without 'v' prefix)
5. The workflow will create the tag and release

## Platform Notes

### macOS
- Builds universal binary supporting both Intel and Apple Silicon
- Requires code signing for distribution (add signing certificate to secrets)

### Windows
- Builds MSI installer
- Consider code signing for SmartScreen warnings

### Linux
- Builds AppImage for maximum compatibility
- Requires additional system libraries on the build machine

## Repository Settings Required

**Important**: For the workflows to create releases, you must:
1. Go to Settings → Actions → General in your repository
2. Under "Workflow permissions", select "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"
4. Save changes

## Secrets Required

For full functionality, add these secrets to your repository:
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `APPLE_CERTIFICATE`: (Optional) For macOS code signing
- `APPLE_CERTIFICATE_PASSWORD`: (Optional) For macOS code signing
- `WINDOWS_CERTIFICATE`: (Optional) For Windows code signing
- `WINDOWS_CERTIFICATE_PASSWORD`: (Optional) For Windows code signing