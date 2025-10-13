# Plainflux

A modern, cross-platform note-taking application with backlinks, tags, and knowledge graph visualization. Built with Tauri and React for a native desktop experience.

![Version](https://img.shields.io/badge/version-0.9.10-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### 📝 Markdown-First
- Write notes in standard Markdown format
- Files saved directly to your filesystem as `.md` files
- Auto-save functionality with debouncing
- Full control over your data - no proprietary formats

### 🔗 Smart Linking
- Create connections between notes using `[[Note Name]]` syntax
- Automatic backlink tracking shows which notes reference the current note
- Knowledge graph visualization of all note connections
- Interactive graph with drag-and-drop node positioning

### 🏷️ Tagging System
- Add tags anywhere with `#tagname` format
- Tag autocomplete suggestions
- Browse all notes by tag
- Fast tag search with SQLite caching

### 📅 Daily Notes
- Automatic daily note creation
- Customizable templates with dynamic variables
- Quick access via keyboard shortcut or sidebar
- Organized in dedicated "Daily Notes" folder

### 🔍 Powerful Search
- Real-time search as you type
- Search through note content, titles, and tags
- Results update automatically with 300ms debouncing
- Fast performance with indexed caching

### 📁 File Management
- Reflects your filesystem directory structure
- Create, rename, and delete notes and folders
- Drag-and-drop file organization
- Context menu operations

### ✅ Advanced Task Management
- **Smart Todos**: Track tasks with `- [ ]` syntax across all notes
- **Priorities**: Set importance levels with `!high`, `!medium`, `!low`
- **Due Dates**: Add deadlines with `@due(2025-01-15)` or `📅 2025-01-15`
- **Recurring Tasks**: Automatic recreation with `@repeat(daily)` or `@every(Monday)`
- **Nested Subtasks**: Hierarchical task structures with indentation
- **Quick Actions**: Bulk operations and quick-add dialog (Cmd/Ctrl+Shift+T)
- **Filtering & Sorting**: By status, priority, due date, tags, and more
- **Progress Tracking**: Visual indicators for subtask completion
- **Jump to Context**: Click any task to navigate to its source note

### ✨ Rich Editing Experience
- Split view: Edit and preview side-by-side
- Syntax highlighting for Markdown
- Multi-cursor editing and code folding
- Block references with heading links
- Content transclusion (preview-only embedding)
- Image paste and display support
- Multiple notes open in tabs

### 🎨 Modern Interface
- Clean 4-column layout inspired by VS Code
- Resizable panels for customized workspace
- Dark and light themes
- Keyboard shortcuts for common actions

### 🔄 Git Integration
- Automatic version control for your notes
- Initialize Git repos directly from the app
- Commit history tracking
- Protect your work with automatic versioning

### 🔍 Enhanced Full-Text Search (FTS5)
- Lightning-fast search with SQLite FTS5
- Context snippets showing matching content
- Search across all note content, titles, and metadata
- Real-time results with intelligent ranking

## What's New in v0.9.10

### 🎯 Major Task Management Overhaul
This release brings a comprehensive task management system that rivals dedicated todo apps:

- **Priority System**: Color-coded priorities (!high, !medium, !low) with visual indicators
- **Due Date Support**: Multiple formats supported - @due(), due:, and 📅 emoji syntax
- **Smart Filtering**: Filter by status, date range, priority, and tags
- **Advanced Sorting**: Sort by note, due date, priority, alphabetical, or completion status
- **Nested Subtasks**: Create hierarchical task structures with automatic progress tracking
- **Recurring Tasks**: Tasks automatically recreate themselves in your daily note when completed
  - Supports daily, weekly, monthly patterns
  - Specific weekday patterns (every Monday, Tuesday, etc.)
  - Preserves all metadata (priority, tags, etc.)
- **Quick Actions**:
  - Bulk selection and operations
  - Quick-add dialog (Cmd/Ctrl+Shift+T)
  - Jump to source note with one click

### 📝 Editor Enhancements
- **Multi-cursor editing**: Select and edit multiple locations simultaneously
- **Code folding**: Collapse/expand sections for better document navigation
- **Block references**: Link to specific headings with [[Note#heading]] syntax
- **Content transclusion**: Embed content from other notes (preview-only)

### 🐛 Bug Fixes & Improvements
- Fixed Clippy linting warnings for better code quality
- Improved CI/CD pipeline compliance
- Enhanced Help documentation with comprehensive task management guide
- Better error handling for recurring task creation

## Installation

### Download Pre-built Binaries
Visit the [Releases](https://github.com/sahnik/plainflux/releases) page to download the latest version for your platform:

#### Installers
- **macOS**: Plainflux.dmg
- **Windows**: Plainflux.msi or Plainflux.exe (NSIS installer)
- **Linux**: Plainflux.AppImage or .deb package

#### Portable Versions (No Installation Required)
- **Windows**: Plainflux-windows-portable.zip
- **macOS**: Plainflux-macOS-portable.tar.gz
- **Linux**: Plainflux-Linux-portable.tar.gz

### Build from Source

Prerequisites:
- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

```bash
# Clone the repository
git clone https://github.com/your-username/plainflux.git
cd plainflux

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build

# Build portable version (no installer)
# Windows:
./scripts/build-portable.ps1
# macOS/Linux:
./scripts/build-portable.sh
```

## Usage

### Getting Started
1. Launch Plainflux
2. Choose or create a folder for your notes
3. Start writing! Create your first note with the "New Note" button

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Quick switcher
- `Cmd/Ctrl + E`: Toggle edit/preview mode
- `Cmd/Ctrl + N`: New note
- `Cmd/Ctrl + ,`: Open settings

### Linking Notes
Create links between notes by typing `[[` and selecting from the autocomplete menu, or type the full note name manually.

### Daily Notes
Click the calendar icon in the sidebar or use the daily note shortcut to create/open today's note. Customize the template in Settings.

### Template Variables
Use these in your daily note template:
- `{{date}}` - Current date (2024-05-26)
- `{{date_long}}` - Full date (Sunday, May 26, 2024)
- `{{time}}` - Current time (14:30)
- `{{year}}`, `{{month}}`, `{{day}}` - Date components
- `{{weekday}}` - Day of week

## Technology Stack

- **Frontend**: React, TypeScript, CodeMirror 6
- **Backend**: Tauri (Rust)
- **Storage**: Local filesystem (Markdown files)
- **Caching**: SQLite for links and tags
- **Styling**: CSS with CSS Variables for theming

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Building and Releasing

See [PORTABLE_BUILD_GUIDE.md](PORTABLE_BUILD_GUIDE.md) for detailed information on creating portable builds.

### Adding Portable Builds to Existing Releases

If you have a release without portable builds:
1. Go to [Actions](https://github.com/sahnik/plainflux/actions)
2. Run "Add Portable Builds to Existing Release" workflow
3. Enter the release tag (e.g., v0.9.0)
4. Portable builds will be automatically added

## Acknowledgments

- Inspired by [Obsidian](https://obsidian.md/) and [Logseq](https://logseq.com/)
- Built with [Tauri](https://tauri.app/) for cross-platform desktop apps
- Icons from [Lucide](https://lucide.dev/)
