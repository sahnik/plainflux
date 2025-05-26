#!/bin/bash
# Script to build portable version for Linux/macOS

set -e

echo -e "\033[32mBuilding Plainflux Portable Edition...\033[0m"

# Check if we're in the right directory
if [ ! -d "src-tauri" ]; then
    echo -e "\033[31mError: Please run this script from the project root directory\033[0m"
    exit 1
fi

# Detect OS
OS="unknown"
ARCH=$(uname -m)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    # Determine if we're on Apple Silicon or Intel
    if [[ "$ARCH" == "arm64" ]]; then
        RUST_TARGET="aarch64-apple-darwin"
    else
        RUST_TARGET="x86_64-apple-darwin"
    fi
else
    echo -e "\033[31mUnsupported OS: $OSTYPE\033[0m"
    exit 1
fi

# Build frontend
echo -e "\033[33mBuilding frontend...\033[0m"
npm run build

# Build backend
echo -e "\033[33mBuilding backend...\033[0m"
cd src-tauri
if [[ "$OS" == "macos" ]]; then
    cargo build --release --target $RUST_TARGET
    BINARY_PATH="target/$RUST_TARGET/release/plainflux"
else
    cargo build --release
    BINARY_PATH="target/release/plainflux"
fi
cd ..

# Create portable package
echo -e "\033[33mCreating portable package...\033[0m"
PORTABLE_DIR="dist-portable"
rm -rf $PORTABLE_DIR
mkdir -p $PORTABLE_DIR

# Copy binary
cp "src-tauri/$BINARY_PATH" "$PORTABLE_DIR/Plainflux"
chmod +x "$PORTABLE_DIR/Plainflux"

# Create launcher script
if [[ "$OS" == "macos" ]]; then
    # macOS command file
    cat > "$PORTABLE_DIR/Plainflux.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./Plainflux
EOF
    chmod +x "$PORTABLE_DIR/Plainflux.command"
    LAUNCHER="Plainflux.command"
else
    # Linux shell script
    cat > "$PORTABLE_DIR/Plainflux.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
./Plainflux "$@"
EOF
    chmod +x "$PORTABLE_DIR/Plainflux.sh"
    LAUNCHER="Plainflux.sh"
fi

# Create README
cat > "$PORTABLE_DIR/README.txt" << EOF
Plainflux Portable Edition
=========================

Version: $(grep '"version"' src-tauri/tauri.conf.json | cut -d'"' -f4)
Built: $(date +%Y-%m-%d)
Platform: $OS-$ARCH

This is the portable version of Plainflux that doesn't require installation.

HOW TO RUN:
-----------
- Double-click $LAUNCHER
- Or run ./Plainflux from terminal

NOTES LOCATION:
---------------
Your notes will be stored in: ~/Notes

SETTINGS:
---------
EOF

if [[ "$OS" == "macos" ]]; then
    echo "App settings are stored in: ~/Library/Application Support/com.plainflux.app" >> "$PORTABLE_DIR/README.txt"
else
    echo "App settings are stored in: ~/.config/com.plainflux.app" >> "$PORTABLE_DIR/README.txt"
fi

cat >> "$PORTABLE_DIR/README.txt" << 'EOF'

PORTABLE USE:
-------------
To make this truly portable with notes on a USB drive:
1. Create a "Notes" folder next to the Plainflux binary
2. The app will detect and use this local folder (feature to be implemented)

REQUIREMENTS:
-------------
EOF

if [[ "$OS" == "linux" ]]; then
    cat >> "$PORTABLE_DIR/README.txt" << 'EOF'
- WebKitGTK 4.1 or later
- GTK 3
Install on Ubuntu/Debian: sudo apt install libwebkit2gtk-4.1-0
Install on Fedora: sudo dnf install webkit2gtk4.1
EOF
fi

# Create desktop file for Linux
if [[ "$OS" == "linux" ]]; then
    cat > "$PORTABLE_DIR/Plainflux.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Plainflux
Comment=Modern note-taking app with backlinks
Exec=/path/to/Plainflux.sh
Icon=/path/to/icon.png
Categories=Utility;TextEditor;Office;
Keywords=notes;markdown;knowledge;
StartupNotify=true
Terminal=false

# To install:
# 1. Edit Exec and Icon paths to absolute paths
# 2. Copy to ~/.local/share/applications/
# 3. Run: update-desktop-database ~/.local/share/applications/
EOF
fi

# Get binary size
BINARY_SIZE=$(du -h "$PORTABLE_DIR/Plainflux" | cut -f1)
echo -e "\033[36mBinary size: $BINARY_SIZE\033[0m"

# Create archive
if [[ "$OS" == "macos" ]]; then
    ARCHIVE_NAME="Plainflux-Portable-macOS-$ARCH.tar.gz"
    tar -czf "$ARCHIVE_NAME" -C "$PORTABLE_DIR" .
else
    ARCHIVE_NAME="Plainflux-Portable-Linux-$ARCH.tar.gz"
    tar -czf "$ARCHIVE_NAME" -C "$PORTABLE_DIR" .
fi

ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo -e "\n\033[32mBuild complete!\033[0m"
echo -e "\033[32mPortable package: $ARCHIVE_NAME ($ARCHIVE_SIZE)\033[0m"
echo -e "\033[33mExtract and run $LAUNCHER to start\033[0m"