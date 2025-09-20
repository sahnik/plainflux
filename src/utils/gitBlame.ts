import { Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin, WidgetType } from '@codemirror/view';
import { GitBlameInfo } from '../types';
import { tauriApi } from '../api/tauri';

let currentBlameInfo: GitBlameInfo[] = [];

class BlameWidget extends WidgetType {
  constructor(private info: GitBlameInfo) {
    super();
  }

  eq(other: BlameWidget) {
    return this.info.commit_hash === other.info.commit_hash;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'blame-info';
    span.style.cssText = `
      position: absolute;
      right: 12px;
      font-size: 10px;
      color: rgba(150, 150, 150, 0.5);
      font-family: monospace;
      white-space: nowrap;
      cursor: default;
      background-color: var(--bg-primary);
      padding: 0 4px;
      border-radius: 2px;
    `;

    const date = new Date(this.info.timestamp * 1000);
    const relativeDate = this.formatRelativeDate(date);

    span.textContent = relativeDate;
    span.title = `Last changed: ${date.toLocaleDateString()} by ${this.info.author}\n${this.info.summary}`;

    return span;
  }

  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'now' : `${diffMinutes}m`;
      }
      return `${diffHours}h`;
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}mo`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years}y`;
    }
  }
}

const blamePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor(view: EditorView) {
      this.updateDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.updateDecorations(update.view);
      }
    }

    updateDecorations(view: EditorView) {
      const decorations: any[] = [];

      if (currentBlameInfo.length === 0) {
        this.decorations = Decoration.set([]);
        return;
      }

      const doc = view.state.doc;

      // Create decorations for each line with blame info
      for (const info of currentBlameInfo) {
        const lineNumber = info.line_number;
        if (lineNumber <= doc.lines) {
          const line = doc.line(lineNumber);

          // Add blame widget at the end of the line
          decorations.push(
            Decoration.widget({
              widget: new BlameWidget(info),
              side: 1,
            }).range(line.to)
          );
        }
      }
      this.decorations = Decoration.set(decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export async function loadBlameInfo(filePath: string): Promise<void> {
  try {
    const isRepo = await tauriApi.isGitRepo();
    if (!isRepo) {
      currentBlameInfo = [];
      return;
    }

    currentBlameInfo = await tauriApi.getGitBlame(filePath);
  } catch (error) {
    console.warn('Failed to load git blame info:', error);
    currentBlameInfo = [];
  }
}

export function createGitBlameExtension(enabled: boolean = true): Extension {
  if (!enabled) {
    return [];
  }
  return [blamePlugin];
}

export function updateBlameInfo(view: EditorView, filePath: string, enabled: boolean = true): void {
  if (!enabled) {
    currentBlameInfo = [];
    view.dispatch({});
    return;
  }

  loadBlameInfo(filePath).then(() => {
    // Force update of decorations
    view.dispatch({});
  });
}