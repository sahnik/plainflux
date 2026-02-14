import React, { useState, useMemo } from 'react';
import { Bookmark } from '../types';
import { Bookmark as BookmarkIcon, FileText, Filter, ChevronDown, ChevronRight, ExternalLink, Tag, Trash2, Edit } from 'lucide-react';
import { tauriApi } from '../api/tauri';
import './BookmarksList.css';

interface BookmarksListProps {
  bookmarks: Bookmark[];
  onBookmarkDelete: (id: number) => void;
  onBookmarkUpdate: (id: number, title?: string, description?: string, tags?: string) => void;
  onNoteClick: (notePath: string, lineNumber?: number) => void;
}

type SortOption = 'domain' | 'date' | 'alphabetical';
type FilterOption = 'all' | 'from_notes' | 'manual';
type ViewMode = 'flat' | 'grouped';

interface DomainGroup {
  domain: string;
  bookmarks: Bookmark[];
}

export const BookmarksList: React.FC<BookmarksListProps> = ({
  bookmarks,
  onBookmarkDelete,
  onBookmarkUpdate,
  onNoteClick,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(null);

  // Extract tags from bookmarks
  const extractTags = (tagsStr: string | null): string[] => {
    if (!tagsStr) return [];
    return tagsStr.split(',').map(t => t.trim()).filter(t => t);
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    bookmarks.forEach(bookmark => {
      extractTags(bookmark.tags).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [bookmarks]);

  // Get all unique domains
  const allDomains = useMemo(() => {
    const domainSet = new Set<string>();
    bookmarks.forEach(bookmark => {
      domainSet.add(bookmark.domain);
    });
    return Array.from(domainSet).sort();
  }, [bookmarks]);

  // Filter and sort bookmarks
  const filteredAndSortedBookmarks = useMemo(() => {
    let filtered = bookmarks;

    // Filter by source
    if (filterBy === 'from_notes') {
      filtered = filtered.filter(b => b.note_path !== null);
    } else if (filterBy === 'manual') {
      filtered = filtered.filter(b => b.note_path === null);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.url.toLowerCase().includes(term) ||
        b.title?.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term) ||
        b.tags?.toLowerCase().includes(term)
      );
    }

    // Filter by selected tags
    if (selectedTags.size > 0) {
      filtered = filtered.filter(b => {
        const bookmarkTags = extractTags(b.tags);
        return Array.from(selectedTags).some(tag => bookmarkTags.includes(tag));
      });
    }

    // Filter by selected domain
    if (selectedDomain) {
      filtered = filtered.filter(b => b.domain === selectedDomain);
    }

    // Sort bookmarks
    const sorted = [...filtered];
    switch (sortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'domain':
        sorted.sort((a, b) => {
          const domainCompare = a.domain.localeCompare(b.domain);
          if (domainCompare !== 0) return domainCompare;
          return (a.subdomain || '').localeCompare(b.subdomain || '');
        });
        break;
    }

    return sorted;
  }, [bookmarks, sortBy, filterBy, searchTerm, selectedTags, selectedDomain]);

  // Group bookmarks by domain
  const groupedBookmarks = useMemo(() => {
    const groups = new Map<string, DomainGroup>();

    filteredAndSortedBookmarks.forEach(bookmark => {
      if (!groups.has(bookmark.domain)) {
        groups.set(bookmark.domain, {
          domain: bookmark.domain,
          bookmarks: [],
        });
      }
      groups.get(bookmark.domain)!.bookmarks.push(bookmark);
    });

    return Array.from(groups.values()).sort((a, b) => a.domain.localeCompare(b.domain));
  }, [filteredAndSortedBookmarks]);

  const toggleDomainCollapse = (domain: string) => {
    const newCollapsed = new Set(collapsedDomains);
    if (newCollapsed.has(domain)) {
      newCollapsed.delete(domain);
    } else {
      newCollapsed.add(domain);
    }
    setCollapsedDomains(newCollapsed);
  };

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
  };

  const handleBookmarkClick = async (url: string) => {
    try {
      await tauriApi.openUrlExternal(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const shortenUrl = (url: string, maxLength: number = 60): string => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  const getNoteName = (path: string) => {
    const parts = path.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return filename.replace('.md', '');
  };

  const renderBookmarkItem = (bookmark: Bookmark): React.ReactNode => {
    const tags = extractTags(bookmark.tags);
    const displayTitle = bookmark.title || 'Untitled';
    const displayUrl = shortenUrl(bookmark.url);

    return (
      <div key={bookmark.id} className="bookmark-item">
        <div className="bookmark-header">
          <BookmarkIcon size={16} className="bookmark-icon" />
          <div className="bookmark-main">
            <div className="bookmark-title-row">
              <span
                className="bookmark-title"
                onClick={() => handleBookmarkClick(bookmark.url)}
                title={bookmark.url}
              >
                {displayTitle}
                <ExternalLink size={12} className="external-link-icon" />
              </span>
              <div className="bookmark-actions">
                <button
                  className="bookmark-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setEditingBookmark(bookmark);
                    setEditTitle(bookmark.title || '');
                    setEditDescription(bookmark.description || '');
                    setEditTags(bookmark.tags || '');
                  }}
                  title="Edit bookmark"
                >
                  <Edit size={14} />
                </button>
                <button
                  className="bookmark-action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDeletingBookmark(bookmark);
                  }}
                  title="Delete bookmark"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="bookmark-url" title={bookmark.url}>
              {displayUrl}
            </div>
            {bookmark.description && (
              <div className="bookmark-description">{bookmark.description}</div>
            )}
            <div className="bookmark-metadata">
              <span className="bookmark-domain-badge">{bookmark.domain}</span>
              {bookmark.subdomain && (
                <span className="bookmark-subdomain-badge">{bookmark.subdomain}</span>
              )}
              {bookmark.note_path && (
                <span
                  className="bookmark-source"
                  onClick={() => onNoteClick(bookmark.note_path!, bookmark.line_number || undefined)}
                  title={`Jump to ${getNoteName(bookmark.note_path)} (line ${bookmark.line_number})`}
                >
                  <FileText size={12} />
                  {getNoteName(bookmark.note_path)}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="bookmark-tags">
                {tags.map(tag => (
                  <span key={tag} className="bookmark-tag">
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bookmarks-list">
      <div className="bookmarks-header">
        <BookmarkIcon size={20} />
        <h3>Bookmarks</h3>
        <div className="bookmarks-stats">
          <span className="bookmarks-stats-text">
            {filteredAndSortedBookmarks.length} bookmark{filteredAndSortedBookmarks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="bookmarks-controls">
        <div className="bookmarks-search">
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bookmarks-search-input"
          />
        </div>

        <div className="bookmarks-control-buttons">
          <button
            className={`bookmarks-control-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Grouped view"
          >
            Group
          </button>
          <button
            className={`bookmarks-control-btn ${viewMode === 'flat' ? 'active' : ''}`}
            onClick={() => setViewMode('flat')}
            title="Flat view"
          >
            List
          </button>
          <button
            className={`bookmarks-control-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bookmarks-filters">
          <div className="bookmarks-filter-group">
            <label className="bookmarks-filter-label">Show:</label>
            <div className="bookmarks-filter-buttons">
              <button
                className={`bookmarks-filter-btn ${filterBy === 'all' ? 'active' : ''}`}
                onClick={() => setFilterBy('all')}
              >
                All
              </button>
              <button
                className={`bookmarks-filter-btn ${filterBy === 'from_notes' ? 'active' : ''}`}
                onClick={() => setFilterBy('from_notes')}
              >
                From Notes
              </button>
              <button
                className={`bookmarks-filter-btn ${filterBy === 'manual' ? 'active' : ''}`}
                onClick={() => setFilterBy('manual')}
              >
                Manual
              </button>
            </div>
          </div>

          <div className="bookmarks-filter-group">
            <label className="bookmarks-filter-label">Sort by:</label>
            <div className="bookmarks-filter-buttons">
              <button
                className={`bookmarks-filter-btn ${sortBy === 'date' ? 'active' : ''}`}
                onClick={() => setSortBy('date')}
              >
                Date Added
              </button>
              <button
                className={`bookmarks-filter-btn ${sortBy === 'domain' ? 'active' : ''}`}
                onClick={() => setSortBy('domain')}
              >
                Domain
              </button>
              <button
                className={`bookmarks-filter-btn ${sortBy === 'alphabetical' ? 'active' : ''}`}
                onClick={() => setSortBy('alphabetical')}
              >
                A-Z
              </button>
            </div>
          </div>

          {allDomains.length > 0 && (
            <div className="bookmarks-filter-group">
              <label className="bookmarks-filter-label">Domain:</label>
              <div className="bookmarks-domain-filter">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="bookmarks-domain-select"
                >
                  <option value="">All Domains</option>
                  {allDomains.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div className="bookmarks-filter-group">
              <label className="bookmarks-filter-label">Tags:</label>
              <div className="bookmarks-tags-filter">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`bookmarks-tag-btn ${selectedTags.has(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {filteredAndSortedBookmarks.length === 0 ? (
        <div className="bookmarks-empty">
          No bookmarks found
        </div>
      ) : (
        <div className="bookmarks-content">
          {viewMode === 'grouped' ? (
            groupedBookmarks.map(group => {
              const isCollapsed = collapsedDomains.has(group.domain);
              return (
                <div key={group.domain} className="bookmarks-domain-group">
                  <div
                    className="bookmarks-domain-header"
                    onClick={() => toggleDomainCollapse(group.domain)}
                  >
                    <button className="bookmarks-collapse-btn">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <span className="bookmarks-domain-name">{group.domain}</span>
                    <div className="bookmarks-domain-count">
                      {group.bookmarks.length}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="bookmarks-items">
                      {group.bookmarks.map(bookmark => renderBookmarkItem(bookmark))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bookmarks-items">
              {filteredAndSortedBookmarks.map(bookmark => renderBookmarkItem(bookmark))}
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      {editingBookmark && (
        <div className="bookmark-edit-overlay" onClick={() => setEditingBookmark(null)}>
          <div className="bookmark-edit-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bookmark-edit-header">
              <h3>Edit Bookmark</h3>
              <button
                className="bookmark-edit-close"
                onClick={() => setEditingBookmark(null)}
              >
                ×
              </button>
            </div>

            <div className="bookmark-edit-content">
              <div className="bookmark-edit-field">
                <label>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Bookmark title"
                  autoFocus
                />
              </div>

              <div className="bookmark-edit-field">
                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="bookmark-edit-field">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              <div className="bookmark-edit-url">
                <strong>URL:</strong> {editingBookmark.url}
              </div>
            </div>

            <div className="bookmark-edit-actions">
              <button
                className="bookmark-edit-btn bookmark-edit-btn-cancel"
                onClick={() => setEditingBookmark(null)}
              >
                Cancel
              </button>
              <button
                className="bookmark-edit-btn bookmark-edit-btn-save"
                onClick={() => {
                  onBookmarkUpdate(
                    editingBookmark.id,
                    editTitle || undefined,
                    editDescription || undefined,
                    editTags || undefined
                  );
                  setEditingBookmark(null);
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingBookmark && (
        <div className="bookmark-delete-overlay" onClick={() => setDeletingBookmark(null)}>
          <div className="bookmark-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bookmark-delete-header">
              <h3>Delete Bookmark?</h3>
            </div>

            <div className="bookmark-delete-content">
              <p>Are you sure you want to delete this bookmark?</p>
              <div className="bookmark-delete-info">
                <strong>{deletingBookmark.title || 'Untitled'}</strong>
                <div className="bookmark-delete-url">{deletingBookmark.url}</div>
              </div>
              <p className="bookmark-delete-warning">This action cannot be undone.</p>
            </div>

            <div className="bookmark-delete-actions">
              <button
                className="bookmark-delete-btn bookmark-delete-btn-cancel"
                onClick={() => setDeletingBookmark(null)}
              >
                Cancel
              </button>
              <button
                className="bookmark-delete-btn bookmark-delete-btn-delete"
                onClick={() => {
                  onBookmarkDelete(deletingBookmark.id);
                  setDeletingBookmark(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
