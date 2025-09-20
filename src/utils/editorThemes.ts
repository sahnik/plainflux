import { Extension } from '@codemirror/state';
import { EditorView } from 'codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Create a dynamic theme that reads from CSS variables
export function createDynamicTheme(themeType: 'dark' | 'light' | 'custom' = 'dark'): Extension {
  // Use specific cursor colors based on theme
  const cursorColor = themeType === 'light' ? '#000000' : '#ffffff';

  const theme = EditorView.theme({
    '&': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-primary)',
      fontSize: 'var(--font-size-base)',
    },
    '.cm-content': {
      padding: '12px',
      caretColor: cursorColor,
      lineHeight: '1.6',
    },
    '.cm-focused .cm-cursor': {
      borderLeftColor: cursorColor,
      borderLeftWidth: '2px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: `${cursorColor} !important`,
      borderLeftWidth: '2px !important',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: `${cursorColor} !important`,
      borderLeftWidth: '2px !important',
    },
    '.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--active-color) !important',
    },
    '.cm-content ::selection': {
      backgroundColor: 'var(--active-color) !important',
      color: 'var(--text-primary) !important',
    },
    '.cm-line ::selection': {
      backgroundColor: 'var(--active-color) !important',
      color: 'var(--text-primary) !important',
    },
    '.cm-panels': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid var(--border-color)',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid var(--border-color)',
    },
    '.cm-searchMatch': {
      backgroundColor: '#ffa50040',
      outline: '1px solid #ffa500',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#ffa50080',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#99ff0025',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'var(--hover-color)',
      outline: '1px solid var(--border-color)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-secondary)',
      border: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-secondary)',
    },
    '.cm-tooltip': {
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      fontSize: 'calc(var(--font-size-base) - 1px)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--active-color)',
        color: 'var(--text-primary)',
      },
    },
  });

  return theme;
}

// Dark theme syntax highlighting
export const darkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#569cd6' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#9cdcfe' },
  { tag: [t.function(t.variableName), t.labelName], color: '#dcdcaa' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#4fc1ff' },
  { tag: [t.definition(t.name), t.separator], color: '#d4d4d4' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#4ec9b0' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#d4d4d4' },
  { tag: [t.meta, t.comment], color: '#6a9955' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#569cd6', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#9cdcfe' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#569cd6' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#ce9178' },
  { tag: t.invalid, color: '#f44747' },
]);

// Light theme syntax highlighting
export const lightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#0000ff' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#001080' },
  { tag: [t.function(t.variableName), t.labelName], color: '#795e26' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#0070c1' },
  { tag: [t.definition(t.name), t.separator], color: '#000000' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#267f99' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#000000' },
  { tag: [t.meta, t.comment], color: '#008000' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#0000ff', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#001080' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#0000ff' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#a31515' },
  { tag: t.invalid, color: '#cd3131' },
]);

// Create syntax highlighting based on theme
export function createSyntaxHighlighting(theme: 'dark' | 'light' | 'custom'): Extension {
  // For custom themes, use dark highlighting as a base
  const highlightStyle = theme === 'light' ? lightHighlightStyle : darkHighlightStyle;
  return syntaxHighlighting(highlightStyle);
}