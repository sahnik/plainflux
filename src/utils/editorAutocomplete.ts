import { CompletionContext, CompletionResult, Completion, autocompletion } from '@codemirror/autocomplete';
import { NoteMetadata } from '../types';
import React from 'react';

interface AutocompleteData {
  notes: NoteMetadata[];
  tags: string[];
}

// Helper to extract note title from metadata
function getNoteTitle(note: NoteMetadata): string {
  return note.title.replace(/\.md$/, '');
}

// Create note link completions
function createNoteCompletions(notes: NoteMetadata[], from: number, to: number, hasClosingBrackets: boolean): CompletionResult | null {
  const options: Completion[] = notes.map(note => ({
    label: getNoteTitle(note),
    type: 'note',
    apply: hasClosingBrackets ? getNoteTitle(note) : `${getNoteTitle(note)}]]`,
  }));

  return {
    from,
    to,
    options,
    filter: true,
  };
}

// Create tag completions
function createTagCompletions(tags: string[], from: number, to: number): CompletionResult | null {
  const options: Completion[] = tags.map(tag => ({
    label: `#${tag}`,
    type: 'tag',
    apply: `#${tag}`,
  }));

  return {
    from,
    to,
    options,
    filter: true,
  };
}

// Main autocomplete function
export function createAutocompleteExtension(dataRef: React.MutableRefObject<AutocompleteData>) {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        const { state, pos } = context;
        const line = state.doc.lineAt(pos);
        const textBefore = line.text.slice(0, pos - line.from);
        
        // Check for note link pattern [[...
        const noteLinkMatch = textBefore.match(/\[\[([^\]]*)?$/);
        if (noteLinkMatch) {
          const from = line.from + noteLinkMatch.index! + 2; // After [[
          
          // Check if there are already closing brackets after cursor
          const textAfter = line.text.slice(pos - line.from);
          const hasClosingBrackets = textAfter.startsWith(']]');
          
          return createNoteCompletions(dataRef.current.notes, from, pos, hasClosingBrackets);
        }
        
        // Check for tag pattern #...
        const tagMatch = textBefore.match(/(^|\s)#(\w*)$/);
        if (tagMatch) {
          const from = line.from + tagMatch.index! + tagMatch[1].length; // Start of #
          return createTagCompletions(dataRef.current.tags, from, pos);
        }
        
        return null;
      }
    ],
    activateOnTyping: true,
    maxRenderedOptions: 20,
  });
}