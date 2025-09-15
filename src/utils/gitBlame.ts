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
    const div = document.createElement('div');
    div.className = 'blame-info';
    div.style.cssText = `
      position: absolute;
      right: 10px;
      top: 0;
      font-size: 11px;
      color: rgba(150, 150, 150, 0.6);
      font-family: monospace;
      pointer-events: none;
      z-index: 1;
      white-space: nowrap;
    `;
    
    const date = new Date(this.info.timestamp * 1000);
    const formattedDate = date.toLocaleDateString();
    
    div.textContent = `${this.info.author} • ${this.info.commit_hash} • ${formattedDate}`;
    div.title = this.info.summary;
    
    return div;
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

export function createGitBlameExtension(): Extension {
  return [blamePlugin];
}

export function updateBlameInfo(view: EditorView, filePath: string): void {
  loadBlameInfo(filePath).then(() => {
    // Force update of decorations
    view.dispatch({});
  });
}