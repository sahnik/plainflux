# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A cross-platform note-taking application built with Tauri (Rust backend) and React (frontend) that supports backlinks, tagging, and knowledge graph visualization similar to Obsidian and Logseq.

## Technology Stack

- **Backend**: Tauri (Rust)
- **Frontend**: React
- **Storage**: Markdown files on filesystem
- **Caching**: SQLite (for note links and tags)

## Project Structure (Expected)

- `src-tauri/`: Rust backend code
  - `src/main.rs`: Main Tauri application entry point
  - `src/commands.rs`: Tauri commands exposed to frontend
  - `src/note_manager.rs`: File system operations for notes
  - `src/cache.rs`: SQLite caching logic
- `src/`: React frontend code
  - `components/`: UI components
  - `hooks/`: Custom React hooks
  - `utils/`: Utility functions
- `public/`: Static assets

## Development Commands

Once the project is initialized:

### Tauri + React Setup
```bash
# Install dependencies
npm install

# Run development server
npm run tauri dev

# Build for production
npm run tauri build

# Run tests
npm test

# Lint frontend code
npm run lint
```

### Rust/Backend Commands
```bash
# Run Rust tests
cd src-tauri && cargo test

# Check Rust code
cd src-tauri && cargo check

# Format Rust code
cd src-tauri && cargo fmt
```

## Key Implementation Details

### Note Storage
- Notes are stored as `.md` files in the user's filesystem
- File system directory structure is preserved in the UI
- Auto-save functionality should debounce writes

### Editor
- CodeMirror 6 (with @codemirror/lang-markdown)
- Preview Renderer: markdown-it, remark, or Marked
- Syntax Themes: OneDark / GitHub Light / Obsidian Dark

### Note Linking
- Links use `[[Note Name]]` syntax
- Cache all links in SQLite for fast lookup
- Update cache on file changes

### Tagging System
- Tags use `#tagname` format
- Tags are extracted and cached in SQLite
- Support autocomplete from cached tags

### Daily Notes
- Create `Daily Notes` folder if not exists
- File naming: `YYYY-MM-DD.md`
- Auto-create today's note on app launch

### UI Architecture
- 4-column layout with resizable columns (except icon column)
- Column 1: Navigation icons (fixed width)
- Column 2: List view (notes/tags/search)
- Column 3: Editor with tabs
- Column 4: Note metadata (backlinks)

### Knowledge Graph
- Use a graph visualization library (e.g., vis.js, d3.js)
- Nodes = notes, Edges = links
- Interactive: drag nodes, click to open

## Important Considerations

1. **File System Watch**: Implement file watchers to detect external changes
2. **Performance**: Use virtual scrolling for large note lists
3. **Search**: Consider full-text search implementation (SQLite FTS or similar)
4. **Markdown Rendering**: Use a library like remark/rehype for consistent rendering
5. **Cross-Platform Paths**: Handle path differences between OS platforms carefully