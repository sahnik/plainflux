#!/bin/bash
# Build all portable versions locally

set -e

echo "Building all portable versions..."

# Get version from tauri.conf.json
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | cut -d'"' -f4)
echo "Version: $VERSION"

# Create output directory
OUTPUT_DIR="portable-builds-v$VERSION"
mkdir -p "$OUTPUT_DIR"

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building macOS portable..."
    ./scripts/build-portable.sh
    mv Plainflux-Portable-*.tar.gz "$OUTPUT_DIR/" 2>/dev/null || true
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Building Linux portable..."
    ./scripts/build-portable.sh
    mv Plainflux-Portable-*.tar.gz "$OUTPUT_DIR/" 2>/dev/null || true
fi

echo ""
echo "Portable builds complete!"
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "To upload to an existing GitHub release:"
echo "1. Go to https://github.com/sahnik/plainflux/releases"
echo "2. Find the release for v$VERSION"
echo "3. Click 'Edit' on the release"
echo "4. Drag and drop the files from $OUTPUT_DIR"
echo "5. Click 'Update release'"
echo ""
echo "Or use GitHub CLI:"
echo "gh release upload v$VERSION $OUTPUT_DIR/*"