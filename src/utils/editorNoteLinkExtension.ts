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
  onLinkOpenInNewTab: (noteName: string) => void,
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
        // Add mousedown handler to capture middle-click
        this.view.dom.addEventListener('mousedown', (e) => {
          const target = e.target as HTMLElement;
          const linkElement = target.closest('.note-link-mark');

          if (linkElement && linkElement instanceof HTMLElement) {
            const noteName = linkElement.getAttribute('data-note-name');
            if (noteName) {
              // Middle mouse button - open in new tab
              if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
                onLinkOpenInNewTab(noteName);
                return;
              }
            }
          }
        });

        // Add click handler for regular clicks
        this.view.dom.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
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

        // Add context menu handler
        this.view.dom.addEventListener('contextmenu', (e) => {
          const target = e.target as HTMLElement;
          const linkElement = target.closest('.note-link-mark');

          if (linkElement && linkElement instanceof HTMLElement) {
            const noteName = linkElement.getAttribute('data-note-name');
            if (noteName) {
              e.preventDefault();
              e.stopPropagation();
              this.showContextMenu(e, noteName);
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

      showContextMenu(e: MouseEvent, noteName: string) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.note-link-context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }

        // Create context menu element
        const menu = document.createElement('div');
        menu.className = 'note-link-context-menu context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.zIndex = '1000';

        // Add "Open in New Tab" option
        const openInNewTabItem = document.createElement('button');
        openInNewTabItem.className = 'context-menu-item';
        openInNewTabItem.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span>Open in New Tab</span>
        `;

        openInNewTabItem.addEventListener('click', () => {
          onLinkOpenInNewTab(noteName);
          menu.remove();
        });

        menu.appendChild(openInNewTabItem);
        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (event: MouseEvent) => {
          if (!menu.contains(event.target as Node)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };

        // Delay adding the click listener to prevent immediate closure
        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 10);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [plugin];
}