import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { EditorSelection, StateEffect, StateField } from '@codemirror/state';

// Define an effect to add a highlight
const addHighlight = StateEffect.define<{ from: number; to: number }>();

// Define an effect to clear highlights
const clearHighlight = StateEffect.define();

// State field to track highlighted lines
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(addHighlight)) {
        const deco = Decoration.line({
          attributes: { style: 'background-color: rgba(255, 235, 59, 0.3)' }
        });
        highlights = Decoration.set([deco.range(effect.value.from)]);
      } else if (effect.is(clearHighlight)) {
        highlights = Decoration.none;
      }
    }
    return highlights;
  },
  provide: f => EditorView.decorations.from(f)
});

// Export the extension
export const highlightLineExtension = highlightField;

/**
 * Scroll to a specific line number in the editor
 */
export function scrollToLine(view: EditorView, lineNumber: number): void {
  try {
    const line = view.state.doc.line(lineNumber);

    // Scroll the line into view
    view.dispatch({
      selection: EditorSelection.create([EditorSelection.range(line.from, line.from)]),
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    });

    // Optionally set focus to the editor
    view.focus();
  } catch (error) {
    console.error(`Failed to scroll to line ${lineNumber}:`, error);
  }
}

/**
 * Highlight a specific line temporarily using CodeMirror decorations
 */
export function highlightLine(view: EditorView, lineNumber: number, duration: number = 2000): void {
  try {
    const line = view.state.doc.line(lineNumber);

    // Add the highlight decoration
    view.dispatch({
      effects: addHighlight.of({ from: line.from, to: line.to })
    });

    // Remove the highlight after the duration
    setTimeout(() => {
      view.dispatch({
        effects: clearHighlight.of(null)
      });
    }, duration);
  } catch (error) {
    console.error(`Failed to highlight line ${lineNumber}:`, error);
  }
}

/**
 * Scroll to a line and highlight it after scrolling completes
 */
export function scrollToLineAndHighlight(view: EditorView, lineNumber: number, duration: number = 2000): void {
  scrollToLine(view, lineNumber);

  // Wait for the scroll to complete before highlighting
  // requestAnimationFrame ensures we wait for the next paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      highlightLine(view, lineNumber, duration);
    });
  });
}
