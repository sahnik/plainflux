import { foldGutter, foldKeymap } from '@codemirror/language';
import { keymap } from '@codemirror/view';
import { foldAll, unfoldAll } from '@codemirror/language';

/**
 * Code folding extension for CodeMirror 6
 *
 * Features:
 * - Fold/unfold markdown headings
 * - Fold/unfold code blocks
 * - Fold/unfold lists
 * - Gutter indicators for foldable regions
 *
 * Keybindings:
 * - Cmd/Ctrl+Shift+[: Fold current section
 * - Cmd/Ctrl+Shift+]: Unfold current section
 * - Cmd/Ctrl+K Cmd/Ctrl+0: Fold all
 * - Cmd/Ctrl+K Cmd/Ctrl+J: Unfold all
 */
export function createFoldingExtension() {
  return [
    foldGutter({
      openText: '▼',
      closedText: '▶'
    }),
    keymap.of(foldKeymap),
    keymap.of([
      {
        key: 'Mod-k Mod-0',
        run: foldAll
      },
      {
        key: 'Mod-k Mod-j',
        run: unfoldAll
      }
    ])
  ];
}
