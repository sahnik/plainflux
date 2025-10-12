import React, { useState, useMemo } from 'react';
import { Todo } from '../api/tauri';
import { CheckSquare, FileText, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import './TodosList.css';

interface TodosListProps {
  todos: Todo[];
  onTodoToggle: (todo: Todo) => void;
  onNoteClick: (notePath: string, lineNumber?: number) => void;
}

type SortOption = 'note' | 'alphabetical' | 'completion';
type FilterOption = 'all' | 'incomplete' | 'completed';

export const TodosList: React.FC<TodosListProps> = ({ todos, onTodoToggle, onNoteClick }) => {
  const [sortBy, setSortBy] = useState<SortOption>('note');
  const [filterBy, setFilterBy] = useState<FilterOption>('incomplete');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedNotes, setCollapsedNotes] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Extract tags from todo content
  const extractTags = (content: string): string[] => {
    const tagRegex = /#(\w+)/g;
    const matches = content.matchAll(tagRegex);
    return Array.from(matches, m => m[1]);
  };

  // Get all unique tags from todos
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    todos.forEach(todo => {
      extractTags(todo.content).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [todos]);

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let filtered = todos;

    // Filter by completion status
    if (filterBy === 'incomplete') {
      filtered = filtered.filter(todo => !todo.is_completed);
    } else if (filterBy === 'completed') {
      filtered = filtered.filter(todo => todo.is_completed);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(todo =>
        todo.content.toLowerCase().includes(term)
      );
    }

    // Filter by selected tags
    if (selectedTags.size > 0) {
      filtered = filtered.filter(todo => {
        const todoTags = extractTags(todo.content);
        return Array.from(selectedTags).some(tag => todoTags.includes(tag));
      });
    }

    // Sort todos
    const sorted = [...filtered];
    switch (sortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => a.content.localeCompare(b.content));
        break;
      case 'completion':
        sorted.sort((a, b) => {
          if (a.is_completed === b.is_completed) {
            return a.note_path.localeCompare(b.note_path);
          }
          return a.is_completed ? 1 : -1;
        });
        break;
      case 'note':
      default:
        sorted.sort((a, b) => {
          const noteCompare = a.note_path.localeCompare(b.note_path);
          if (noteCompare !== 0) return noteCompare;
          return a.line_number - b.line_number;
        });
    }

    return sorted;
  }, [todos, sortBy, filterBy, searchTerm, selectedTags]);

  // Group todos by note
  const todosByNote = useMemo(() => {
    return filteredAndSortedTodos.reduce((acc, todo) => {
      if (!acc[todo.note_path]) {
        acc[todo.note_path] = [];
      }
      acc[todo.note_path].push(todo);
      return acc;
    }, {} as Record<string, Todo[]>);
  }, [filteredAndSortedTodos]);

  const getNoteName = (path: string) => {
    const parts = path.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return filename.replace('.md', '');
  };

  const toggleNoteCollapse = (notePath: string) => {
    const newCollapsed = new Set(collapsedNotes);
    if (newCollapsed.has(notePath)) {
      newCollapsed.delete(notePath);
    } else {
      newCollapsed.add(notePath);
    }
    setCollapsedNotes(newCollapsed);
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

  // Calculate completion stats per note
  const getNoteStats = (notePath: string) => {
    const noteTodos = todosByNote[notePath] || [];
    const completed = noteTodos.filter(t => t.is_completed).length;
    const total = noteTodos.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

  const totalStats = useMemo(() => {
    const completed = filteredAndSortedTodos.filter(t => t.is_completed).length;
    const total = filteredAndSortedTodos.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }, [filteredAndSortedTodos]);

  const handleTodoClick = (todo: Todo) => {
    onNoteClick(todo.note_path, todo.line_number);
  };

  return (
    <div className="todos-list">
      <div className="todos-header">
        <CheckSquare size={20} />
        <h3>All Tasks</h3>
        <div className="todos-stats">
          {totalStats.total > 0 && (
            <span className="todos-stats-text">
              {totalStats.completed}/{totalStats.total} ({totalStats.percentage}%)
            </span>
          )}
        </div>
      </div>

      <div className="todos-controls">
        <div className="todos-search">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="todos-search-input"
          />
        </div>

        <div className="todos-control-buttons">
          <button
            className={`todos-control-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="todos-filters">
          <div className="todos-filter-group">
            <label className="todos-filter-label">Show:</label>
            <div className="todos-filter-buttons">
              <button
                className={`todos-filter-btn ${filterBy === 'all' ? 'active' : ''}`}
                onClick={() => setFilterBy('all')}
              >
                All
              </button>
              <button
                className={`todos-filter-btn ${filterBy === 'incomplete' ? 'active' : ''}`}
                onClick={() => setFilterBy('incomplete')}
              >
                Incomplete
              </button>
              <button
                className={`todos-filter-btn ${filterBy === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterBy('completed')}
              >
                Completed
              </button>
            </div>
          </div>

          <div className="todos-filter-group">
            <label className="todos-filter-label">Sort by:</label>
            <div className="todos-filter-buttons">
              <button
                className={`todos-filter-btn ${sortBy === 'note' ? 'active' : ''}`}
                onClick={() => setSortBy('note')}
              >
                Note
              </button>
              <button
                className={`todos-filter-btn ${sortBy === 'alphabetical' ? 'active' : ''}`}
                onClick={() => setSortBy('alphabetical')}
              >
                A-Z
              </button>
              <button
                className={`todos-filter-btn ${sortBy === 'completion' ? 'active' : ''}`}
                onClick={() => setSortBy('completion')}
              >
                Status
              </button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="todos-filter-group">
              <label className="todos-filter-label">Tags:</label>
              <div className="todos-tags-filter">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`todos-tag-btn ${selectedTags.has(tag) ? 'active' : ''}`}
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

      {Object.keys(todosByNote).length === 0 ? (
        <div className="todos-empty">
          {filterBy === 'completed' && todos.every(t => !t.is_completed)
            ? 'No completed tasks yet'
            : 'No tasks found'}
        </div>
      ) : (
        <div className="todos-content">
          {Object.entries(todosByNote).map(([notePath, noteTodos]) => {
            const stats = getNoteStats(notePath);
            const isCollapsed = collapsedNotes.has(notePath);

            return (
              <div key={notePath} className="todos-note-group">
                <div
                  className="todos-note-header"
                  onClick={() => toggleNoteCollapse(notePath)}
                >
                  <button className="todos-collapse-btn">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <FileText size={16} />
                  <span className="todos-note-name">{getNoteName(notePath)}</span>
                  <div className="todos-note-stats">
                    <span className="todos-progress-text">
                      {stats.completed}/{stats.total}
                    </span>
                    <div className="todos-progress-bar">
                      <div
                        className="todos-progress-fill"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="todos-items">
                    {noteTodos.map((todo) => {
                      const tags = extractTags(todo.content);
                      const contentWithoutTags = todo.content.replace(/#\w+/g, '').trim();

                      return (
                        <div
                          key={`${todo.note_path}-${todo.line_number}`}
                          className={`todo-item ${todo.is_completed ? 'completed' : ''}`}
                        >
                          <label className="todo-label">
                            <input
                              type="checkbox"
                              checked={todo.is_completed}
                              onChange={() => onTodoToggle(todo)}
                            />
                            <div className="todo-content-wrapper">
                              <span
                                className="todo-content"
                                onClick={() => handleTodoClick(todo)}
                                title={`Jump to line ${todo.line_number}`}
                              >
                                {contentWithoutTags}
                              </span>
                              {tags.length > 0 && (
                                <div className="todo-tags">
                                  {tags.map(tag => (
                                    <span key={tag} className="todo-tag">#{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
