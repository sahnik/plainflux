import type { Note, Tab } from '../types';

export interface TabsStateTransition {
  tabs: Tab[];
  activeTabIndex: number;
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/');

const trimPathSlashes = (path: string): string => path.replace(/^\/+|\/+$/g, '');

export function getOpenInNewTabState(
  tabs: Tab[],
  _activeTabIndex: number,
  note: Note,
): TabsStateTransition {
  const existingTabIndex = tabs.findIndex(tab => tab.note.path === note.path);
  if (existingTabIndex !== -1) {
    return {
      tabs,
      activeTabIndex: existingTabIndex,
    };
  }

  return {
    tabs: [...tabs, { note, isDirty: false }],
    activeTabIndex: tabs.length,
  };
}

export function getReplaceActiveTabState(
  tabs: Tab[],
  activeTabIndex: number,
  note: Note,
): TabsStateTransition {
  if (tabs.length === 0) {
    return {
      tabs: [{ note, isDirty: false }],
      activeTabIndex: 0,
    };
  }

  const safeIndex = Math.min(activeTabIndex, tabs.length - 1);
  const updatedTabs = [...tabs];
  updatedTabs[safeIndex] = { note, isDirty: false };

  return {
    tabs: updatedTabs,
    activeTabIndex: safeIndex,
  };
}

export function getCloseTabState(
  tabs: Tab[],
  activeTabIndex: number,
  closeIndex: number,
): TabsStateTransition {
  if (closeIndex < 0 || closeIndex >= tabs.length) {
    return { tabs, activeTabIndex };
  }

  const newTabs = tabs.filter((_, index) => index !== closeIndex);
  if (newTabs.length === 0) {
    return { tabs: [], activeTabIndex: 0 };
  }

  if (closeIndex === activeTabIndex) {
    const newActiveIndex = closeIndex >= newTabs.length ? newTabs.length - 1 : closeIndex;
    return { tabs: newTabs, activeTabIndex: newActiveIndex };
  }

  if (closeIndex < activeTabIndex) {
    return { tabs: newTabs, activeTabIndex: activeTabIndex - 1 };
  }

  return { tabs: newTabs, activeTabIndex };
}

export function mapTabsByPath(
  tabs: Tab[],
  path: string,
  updater: (tab: Tab) => Tab,
): Tab[] {
  return tabs.map(tab => (tab.note.path === path ? updater(tab) : tab));
}

export function getRemoveTabsState(
  tabs: Tab[],
  activeTabIndex: number,
  predicate: (tab: Tab) => boolean,
): TabsStateTransition {
  if (tabs.length === 0) {
    return { tabs, activeTabIndex };
  }

  const currentActivePath = tabs[activeTabIndex]?.note.path;
  const remainingTabs = tabs.filter(tab => !predicate(tab));

  if (remainingTabs.length === 0) {
    return { tabs: [], activeTabIndex: 0 };
  }

  if (currentActivePath) {
    const activePathIndex = remainingTabs.findIndex(tab => tab.note.path === currentActivePath);
    if (activePathIndex !== -1) {
      return { tabs: remainingTabs, activeTabIndex: activePathIndex };
    }
  }

  return {
    tabs: remainingTabs,
    activeTabIndex: Math.min(activeTabIndex, remainingTabs.length - 1),
  };
}

export function isNotePathInsideFolder(notePath: string, folderPath: string): boolean {
  const normalizedFolder = trimPathSlashes(normalizePath(folderPath));
  if (!normalizedFolder) {
    return false;
  }

  const normalizedNotePath = trimPathSlashes(normalizePath(notePath));
  const boundedNotePath = `/${normalizedNotePath}/`;
  const boundedFolderPath = `/${normalizedFolder}/`;
  return boundedNotePath.includes(boundedFolderPath);
}

export function getRenamedFolderTabs(
  tabs: Tab[],
  oldFolderPath: string,
  newFolderPath: string,
): Tab[] {
  const normalizedOldFolder = trimPathSlashes(normalizePath(oldFolderPath));
  const normalizedNewFolder = trimPathSlashes(normalizePath(newFolderPath));

  if (!normalizedOldFolder) {
    return tabs;
  }

  const oldSegment = `/${normalizedOldFolder}/`;
  const newSegment = `/${normalizedNewFolder}/`;

  return tabs.map(tab => {
    const normalizedTabPath = normalizePath(tab.note.path);
    if (!normalizedTabPath.includes(oldSegment)) {
      return tab;
    }

    const updatedNormalizedPath = normalizedTabPath.replace(oldSegment, newSegment);
    const updatedPath = tab.note.path.includes('\\')
      ? updatedNormalizedPath.replace(/\//g, '\\')
      : updatedNormalizedPath;

    return {
      ...tab,
      note: { ...tab.note, path: updatedPath },
    };
  });
}
