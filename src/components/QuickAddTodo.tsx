import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, AlertCircle, Tag } from 'lucide-react';
import './QuickAddTodo.css';

interface QuickAddTodoProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (content: string) => void;
  currentNotePath?: string;
}

type TodoPriority = 'none' | 'high' | 'medium' | 'low';

const isTodoPriority = (value: string): value is TodoPriority =>
  value === 'none' || value === 'high' || value === 'medium' || value === 'low';

export const QuickAddTodo: React.FC<QuickAddTodoProps> = ({
  isOpen,
  onClose,
  onAdd,
  currentNotePath
}) => {
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('none');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Reset form
      setContent('');
      setPriority('none');
      setDueDate('');
      setTags('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    let todoText = content.trim();

    // Add priority
    if (priority !== 'none') {
      todoText += ` !${priority}`;
    }

    // Add due date
    if (dueDate) {
      todoText += ` @due(${dueDate})`;
    }

    // Add tags
    if (tags.trim()) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      tagList.forEach(tag => {
        const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
        todoText += ` ${formattedTag}`;
      });
    }

    onAdd(todoText);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-add-overlay" onClick={onClose}>
      <div className="quick-add-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="quick-add-header">
          <h3>Quick Add Task</h3>
          <button
            className="quick-add-close"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="quick-add-field">
            <label>Task</label>
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What needs to be done?"
              className="quick-add-input"
            />
          </div>

          <div className="quick-add-row">
            <div className="quick-add-field quick-add-field-half">
              <label>
                <AlertCircle size={14} />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isTodoPriority(value)) {
                    setPriority(value);
                  }
                }}
                className="quick-add-select"
              >
                <option value="none">None</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="quick-add-field quick-add-field-half">
              <label>
                <Calendar size={14} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="quick-add-input"
              />
            </div>
          </div>

          <div className="quick-add-field">
            <label>
              <Tag size={14} />
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, urgent, meeting (comma separated)"
              className="quick-add-input"
            />
          </div>

          {currentNotePath && (
            <div className="quick-add-note-info">
              Task will be added to: <strong>{currentNotePath.split('/').pop()?.replace('.md', '')}</strong>
            </div>
          )}

          <div className="quick-add-actions">
            <button
              type="button"
              onClick={onClose}
              className="quick-add-button quick-add-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="quick-add-button quick-add-button-primary"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
