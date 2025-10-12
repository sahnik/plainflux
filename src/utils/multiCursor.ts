import { keymap } from '@codemirror/view';
import {
  selectNextOccurrence,
  selectSelectionMatches
} from '@codemirror/search';

/**
 * Multi-cursor editing extension for CodeMirror 6
 *
 * Keybindings:
 * - Cmd/Ctrl+D: Select next occurrence of current selection
 * - Cmd/Ctrl+Shift+L: Select all occurrences of current selection
 */
export const multiCursorKeymap = keymap.of([
  {
    key: 'Mod-d',
    run: selectNextOccurrence,
    preventDefault: true
  },
  {
    key: 'Mod-Shift-l',
    run: selectSelectionMatches,
    preventDefault: true
  }
]);
