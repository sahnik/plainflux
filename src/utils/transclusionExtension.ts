import { ViewPlugin, EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { tauriApi } from '../api/tauri';
import { parseBlockReference } from './blockReferences';

/**
 * Widget that renders transcluded content
 */
class TransclusionWidget extends WidgetType {
  constructor(
    private link: string,
    private content: string | null,
    private error: string | null,
    private onNavigate: (noteName: string, blockId?: string) => void
  ) {
    super();
  }

  eq(other: TransclusionWidget) {
    return this.link === other.link && this.content === other.content && this.error === other.error;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'transclusion-wrapper';

    if (this.error) {
      wrapper.className += ' transclusion-error';
      wrapper.textContent = `Error: ${this.error}`;
      return wrapper;
    }

    if (this.content === null) {
      wrapper.className += ' transclusion-loading';
      wrapper.textContent = 'Loading...';
      return wrapper;
    }

    // Create header with link info and navigation button
    const header = document.createElement('div');
    header.className = 'transclusion-header';

    const linkInfo = document.createElement('span');
    linkInfo.className = 'transclusion-link';
    linkInfo.textContent = `![[${this.link}]]`;
    header.appendChild(linkInfo);

    const navButton = document.createElement('button');
    navButton.className = 'transclusion-nav-button';
    navButton.textContent = '→';
    navButton.title = 'Go to source';
    navButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { noteName, blockId } = parseBlockReference(this.link);
      this.onNavigate(noteName, blockId || undefined);
    });
    header.appendChild(navButton);

    wrapper.appendChild(header);

    // Create content area
    const contentDiv = document.createElement('div');
    contentDiv.className = 'transclusion-content';

    // Simple markdown rendering (basic support for now)
    const rendered = this.renderMarkdown(this.content);
    contentDiv.innerHTML = rendered;

    wrapper.appendChild(contentDiv);

    return wrapper;
  }

  private renderMarkdown(text: string): string {
    // Basic markdown rendering
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>');

    return html;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * ViewPlugin to handle transclusions
 */
export function createTransclusionExtension(
  onNavigate: (noteName: string, blockId?: string) => void
) {
  // Cache for transcluded content
  const contentCache = new Map<string, { content: string | null; error: string | null }>();

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: import('@codemirror/view').ViewUpdate) {
        // Only rebuild if document changed AND not currently typing
        if (update.docChanged) {
          // Check if the changes involve transclusion syntax
          let shouldRebuild = false;
          update.changes.iterChanges(() => {
            shouldRebuild = true;
          });

          if (shouldRebuild) {
            // Use a small delay to avoid rebuilding while typing
            const currentDoc = update.state.doc;
            const currentView = update.view;
            setTimeout(() => {
              if (currentView.state.doc === currentDoc) {
                this.decorations = this.buildDecorations(currentView);
              }
            }, 300);
          }
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const text = doc.toString();

        // Match transclusion syntax: ![[Note Name]] or ![[Note#block-id]]
        // Only match complete patterns on their own line
        const transclusionRegex = /^!\[\[([^\]]+)\]\]\s*$/gm;
        let match;

        while ((match = transclusionRegex.exec(text)) !== null) {
          const link = match[1];
          const from = match.index;
          const to = from + match[0].length;

          // Skip if this is part of current editing position (cursor is nearby)
          const cursorPos = view.state.selection.main.head;
          if (cursorPos >= from - 2 && cursorPos <= to + 2) {
            continue; // Skip rendering transclusions near cursor
          }

          // Check if we have cached content for this link
          let cached = contentCache.get(link);

          if (!cached) {
            // Start loading the content
            cached = { content: null, error: null };
            contentCache.set(link, cached);

            tauriApi.resolveTransclusion(link)
              .then((content) => {
                contentCache.set(link, { content, error: null });
                // Trigger a redraw only if not currently editing
                setTimeout(() => {
                  if (view.hasFocus && view.state.selection.main.head >= from - 10 && view.state.selection.main.head <= to + 10) {
                    return; // Don't update if cursor is near
                  }
                  view.dispatch({});
                }, 100);
              })
              .catch((error) => {
                contentCache.set(link, { content: null, error: error.toString() });
                view.dispatch({});
              });
          }

          // Create decoration with widget
          const widget = Decoration.widget({
            widget: new TransclusionWidget(link, cached.content, cached.error, onNavigate),
            side: 1,
            block: true,
          });

          // Replace the line with the widget
          const line = doc.lineAt(from);
          builder.add(line.from, line.from, widget);

          // Hide the original text
          builder.add(from, to, Decoration.replace({}));
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
