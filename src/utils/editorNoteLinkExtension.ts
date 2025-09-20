import { Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';

function createNoteLinkDecorations(view: EditorView, noteExists: (noteName: string) => boolean): DecorationSet {
  const marks: { from: number; to: number; decoration: Decoration }[] = [];
  const doc = view.state.doc;

  // Search for complete [[Note Name]] patterns in the document
  for (let line = 1; line <= doc.lines; line++) {
    const lineText = doc.line(line);
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = linkRegex.exec(lineText.text)) !== null) {
      const noteName = match[1];
      const from = lineText.from + match.index;
      const to = from + match[0].length;
      const exists = noteExists(noteName);

      // Create a mark decoration that styles the link but keeps the text editable
      const decoration = Decoration.mark({
        class: 'note-link-mark',
        attributes: {
          'data-note-name': noteName,
          'data-note-exists': exists.toString(),
          style: `
            color: ${exists ? '#4ec9b0' : '#ff6b6b'};
            background-color: ${exists ? 'rgba(78, 201, 176, 0.1)' : 'rgba(255, 107, 107, 0.1)'};
            padding: 2px 4px;
            border-radius: 3px;
            cursor: pointer;
            text-decoration: none;
            font-style: ${exists ? 'normal' : 'italic'};
            border: 1px solid transparent;
            transition: all 0.2s ease;
          `
        }
      });

      marks.push({
        from,
        to,
        decoration
      });
    }
  }

  return Decoration.set(
    marks.map(({ from, to, decoration }) => decoration.range(from, to))
  );
}

export function createNoteLinkExtension(
  onLinkClick: (noteName: string) => void,
  noteExists: (noteName: string) => boolean
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      view: EditorView;

      constructor(view: EditorView) {
        this.view = view;
        this.decorations = createNoteLinkDecorations(view, noteExists);
        this.setupClickHandler();
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = createNoteLinkDecorations(update.view, noteExists);
        }
      }

      setupClickHandler() {
        // Add click handler to the editor DOM
        this.view.dom.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;

          // Check if the clicked element or its parent has the note-link-mark class
          const linkElement = target.closest('.note-link-mark');
          if (linkElement && linkElement instanceof HTMLElement) {
            const noteName = linkElement.getAttribute('data-note-name');
            if (noteName) {
              e.preventDefault();
              e.stopPropagation();
              onLinkClick(noteName);
            }
          }
        });

        // Add hover effects
        this.view.dom.addEventListener('mouseenter', (e) => {
          const target = e.target as HTMLElement;
          const linkElement = target.closest('.note-link-mark');
          if (linkElement && linkElement instanceof HTMLElement) {
            const exists = linkElement.getAttribute('data-note-exists') === 'true';
            linkElement.style.borderColor = exists ? '#4ec9b0' : '#ff6b6b';
            linkElement.style.textDecoration = 'underline';
          }
        }, true);

        this.view.dom.addEventListener('mouseleave', (e) => {
          const target = e.target as HTMLElement;
          const linkElement = target.closest('.note-link-mark');
          if (linkElement && linkElement instanceof HTMLElement) {
            linkElement.style.borderColor = 'transparent';
            linkElement.style.textDecoration = 'none';
          }
        }, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [plugin];
}