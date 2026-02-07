import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCloseTabState,
  getOpenInNewTabState,
  getRemoveTabsState,
  getRenamedFolderTabs,
  getReplaceActiveTabState,
  isNotePathInsideFolder,
  mapTabsByPath,
} from '../.tmp-tests/src/utils/tabState.js';

const makeNote = (path, title = path) => ({
  path,
  title,
  content: `# ${title}`,
  last_modified: 0,
});

const makeTab = (path, isDirty = false) => ({
  note: makeNote(path),
  isDirty,
});

describe('tabState', () => {
  it('opens in new tab or focuses existing tab', () => {
    const tabs = [makeTab('/notes/A.md'), makeTab('/notes/B.md')];

    const existing = getOpenInNewTabState(tabs, 0, makeNote('/notes/B.md'));
    assert.equal(existing.tabs.length, 2);
    assert.equal(existing.activeTabIndex, 1);

    const created = getOpenInNewTabState(tabs, 0, makeNote('/notes/C.md'));
    assert.equal(created.tabs.length, 3);
    assert.equal(created.tabs[2].note.path, '/notes/C.md');
    assert.equal(created.activeTabIndex, 2);
  });

  it('replaces active tab or opens first tab when none exist', () => {
    const emptyResult = getReplaceActiveTabState([], 0, makeNote('/notes/New.md'));
    assert.equal(emptyResult.tabs.length, 1);
    assert.equal(emptyResult.tabs[0].note.path, '/notes/New.md');
    assert.equal(emptyResult.activeTabIndex, 0);

    const tabs = [makeTab('/notes/A.md'), makeTab('/notes/B.md')];
    const replaceResult = getReplaceActiveTabState(tabs, 1, makeNote('/notes/Replaced.md'));
    assert.equal(replaceResult.tabs[1].note.path, '/notes/Replaced.md');
    assert.equal(replaceResult.activeTabIndex, 1);
  });

  it('closes tabs and keeps active index consistent', () => {
    const tabs = [makeTab('/notes/A.md'), makeTab('/notes/B.md'), makeTab('/notes/C.md')];

    const closeActiveLast = getCloseTabState(tabs, 2, 2);
    assert.deepEqual(closeActiveLast.tabs.map(tab => tab.note.path), ['/notes/A.md', '/notes/B.md']);
    assert.equal(closeActiveLast.activeTabIndex, 1);

    const closeBeforeActive = getCloseTabState(tabs, 2, 1);
    assert.deepEqual(closeBeforeActive.tabs.map(tab => tab.note.path), ['/notes/A.md', '/notes/C.md']);
    assert.equal(closeBeforeActive.activeTabIndex, 1);

    const closeOnly = getCloseTabState([makeTab('/notes/Only.md')], 0, 0);
    assert.equal(closeOnly.tabs.length, 0);
    assert.equal(closeOnly.activeTabIndex, 0);
  });

  it('updates tab by path for note rename/content updates', () => {
    const tabs = [makeTab('/notes/A.md'), makeTab('/notes/B.md')];
    const updated = mapTabsByPath(tabs, '/notes/B.md', tab => ({
      ...tab,
      note: { ...tab.note, path: '/notes/B-renamed.md' },
      isDirty: false,
    }));

    assert.equal(updated[0].note.path, '/notes/A.md');
    assert.equal(updated[1].note.path, '/notes/B-renamed.md');
  });

  it('removes tabs and preserves active tab when possible', () => {
    const tabs = [makeTab('/notes/A.md'), makeTab('/notes/B.md'), makeTab('/notes/C.md')];

    const removeNonActive = getRemoveTabsState(tabs, 1, tab => tab.note.path === '/notes/C.md');
    assert.deepEqual(removeNonActive.tabs.map(tab => tab.note.path), ['/notes/A.md', '/notes/B.md']);
    assert.equal(removeNonActive.activeTabIndex, 1);

    const removeActive = getRemoveTabsState(tabs, 1, tab => tab.note.path === '/notes/B.md');
    assert.deepEqual(removeActive.tabs.map(tab => tab.note.path), ['/notes/A.md', '/notes/C.md']);
    assert.equal(removeActive.activeTabIndex, 1);

    const removeAll = getRemoveTabsState(tabs, 1, () => true);
    assert.equal(removeAll.tabs.length, 0);
    assert.equal(removeAll.activeTabIndex, 0);
  });

  it('matches note paths inside folders and avoids false positives', () => {
    assert.equal(isNotePathInsideFolder('/vault/work/project/Task.md', 'work/project'), true);
    assert.equal(isNotePathInsideFolder('C:\\vault\\work\\project\\Task.md', 'work/project'), true);
    assert.equal(isNotePathInsideFolder('/vault/work/projects/Task.md', 'work/project'), false);
    assert.equal(isNotePathInsideFolder('/vault/work/project/Task.md', ''), false);
  });

  it('renames folder paths only for tabs in the renamed folder', () => {
    const tabs = [
      makeTab('/vault/work/project/Task.md'),
      makeTab('/vault/work/project/sub/Deep.md'),
      makeTab('/vault/work/other/Keep.md'),
    ];

    const renamed = getRenamedFolderTabs(tabs, 'work/project', 'work/project-renamed');

    assert.equal(renamed[0].note.path, '/vault/work/project-renamed/Task.md');
    assert.equal(renamed[1].note.path, '/vault/work/project-renamed/sub/Deep.md');
    assert.equal(renamed[2].note.path, '/vault/work/other/Keep.md');
  });
});
