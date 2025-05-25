## Overview
Note taking application supporting backlinks and tagging similar to Obsidian and Logseq.
## Technology
* Tauri (rust)
* React
* Cross platform & portable (no installation required)
* Caching of note links and tags for quick search without having to read all notes.  Consider sqlite

## Features
* Notes are written in markdown format
* Notes are saved directly to the filesystem as markdown files
* Notes are saved automatically
* File system directory structure is reflected in the application
* Notes can be linked to each other with the [[Note]] syntax
* Daily notes.  Create a Daily Notes folder if not already existing and each day automatically add a new daily note to it named in YYYY-MM-DD format.
* Tags in hashtag format can be added anywhere in a note.
* Autocomplete when adding notes or tags.
* Knowledge graph, a visualization of how notes are related.
	* Notes are nodes and the relationships between notes (links) are edges.
	* Graph should have some basic interaction capabilities like moving nodes by click and drag.
	* Clicking on a node/note opens the note.
* Full search capability of both notes and tags.
* Capability to add/paste images or other media into notes.
* Checkboxes and task lists in "- [ ]" format 

## User Interface
* 4 column view
	* Left most column is a stack of icons, for example notes, tags, or search which changes the active view in the 2nd column.  This is similar to how it looks in vscode.
	* Second column is the list of notes, tags or search results
	* Third column is the main note viewing and editing pane.  It should support tabs to have multiple notes open at once.  It should also have a button to switch between editing and rendered view.
	* Fourth column will contain information about the current open note, like backlinks (other notes which contain links to this note).
* Columns should be resizable.  Icon stack column can be fixed.
* Option to switch between a light and dark theme