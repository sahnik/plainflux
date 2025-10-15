import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, Tag } from 'lucide-react';
import './QuickAddBookmark.css';

interface QuickAddBookmarkProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, title?: string, description?: string, tags?: string) => void;
}

export const QuickAddBookmark: React.FC<QuickAddBookmarkProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      urlInputRef.current?.focus();
      // Reset form
      setUrl('');
      setTitle('');
      setDescription('');
      setTags('');
    }
  }, [isOpen]);

  const validateUrl = (urlStr: string): boolean => {
    try {
      new URL(urlStr);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Validate URL
    if (!validateUrl(url)) {
      alert('Please enter a valid URL (must include http:// or https://)');
      return;
    }

    onAdd(
      url.trim(),
      title.trim() || undefined,
      description.trim() || undefined,
      tags.trim() || undefined
    );
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-add-bookmark-overlay" onClick={onClose}>
      <div className="quick-add-bookmark-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="quick-add-bookmark-header">
          <h3>Add Bookmark</h3>
          <button
            className="quick-add-bookmark-close"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="quick-add-bookmark-field">
            <label>
              <Link2 size={14} />
              URL (required)
            </label>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="quick-add-bookmark-input"
              required
            />
          </div>

          <div className="quick-add-bookmark-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title for the bookmark"
              className="quick-add-bookmark-input"
            />
          </div>

          <div className="quick-add-bookmark-field">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="quick-add-bookmark-textarea"
              rows={3}
            />
          </div>

          <div className="quick-add-bookmark-field">
            <label>
              <Tag size={14} />
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, documentation, reference (comma separated)"
              className="quick-add-bookmark-input"
            />
          </div>

          <div className="quick-add-bookmark-actions">
            <button
              type="button"
              onClick={onClose}
              className="quick-add-bookmark-button quick-add-bookmark-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="quick-add-bookmark-button quick-add-bookmark-button-primary"
            >
              Add Bookmark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
