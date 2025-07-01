import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

// Create a state effect for updating the search term
const setSearchTermEffect = StateEffect.define<string>();

// Define the decoration style for highlights
const highlightDecoration = Decoration.mark({
  class: 'cm-search-highlight'
});

// Create a state field to manage the search highlights
const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Check if there's a search term update effect
    for (const effect of tr.effects) {
      if (effect.is(setSearchTermEffect)) {
        const searchTerm = effect.value;
        if (!searchTerm) {
          return Decoration.none;
        }
        
        // Create decorations for all occurrences of the search term
        const decorationList = [];
        const doc = tr.state.doc;
        const text = doc.toString();
        const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          decorationList.push(
            highlightDecoration.range(match.index, match.index + match[0].length)
          );
        }
        
        return Decoration.set(decorationList);
      }
    }
    
    // Map decorations through document changes
    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f)
});

// Create the theme extension for highlight styling
const searchHighlightTheme = EditorView.theme({
  '.cm-search-highlight': {
    backgroundColor: '#ffeb3b',
    color: '#000'
  }
});

// Export the extension and the effect setter
export function createSearchHighlightExtension() {
  return [searchHighlightField, searchHighlightTheme];
}

export function setSearchTerm(view: EditorView, searchTerm: string) {
  view.dispatch({
    effects: setSearchTermEffect.of(searchTerm)
  });
}

// Function to scroll to the first match
export function scrollToFirstMatch(view: EditorView, searchTerm: string) {
  if (!searchTerm) return;
  
  const doc = view.state.doc;
  const text = doc.toString();
  const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const match = regex.exec(text);
  
  if (match) {
    const pos = match.index;
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: 'center' })
    });
  }
}