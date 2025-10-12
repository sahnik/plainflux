import React, { useState, useMemo } from 'react';
import { Todo } from '../api/tauri';
import { CheckSquare, FileText, Filter, ChevronDown, ChevronRight, Calendar, AlertCircle, CheckCheck, X } from 'lucide-react';
import './TodosList.css';

interface TodosListProps {
  todos: Todo[];
  onTodoToggle: (todo: Todo) => void;
  onNoteClick: (notePath: string, lineNumber?: number) => void;
}

type SortOption = 'note' | 'alphabetical' | 'completion' | 'due_date' | 'priority';
type FilterOption = 'all' | 'incomplete' | 'completed';
type DateFilterOption = 'all' | 'today' | 'this_week' | 'overdue' | 'no_date';
type PriorityFilterOption = 'all' | 'high' | 'medium' | 'low' | 'no_priority';

export const TodosList: React.FC<TodosListProps> = ({ todos, onTodoToggle, onNoteClick }) => {
  const [sortBy, setSortBy] = useState<SortOption>('note');
  const [filterBy, setFilterBy] = useState<FilterOption>('incomplete');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterOption>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedNotes, setCollapsedNotes] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<number>>(new Set());

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

  // Date helper functions
  const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getEndOfWeekString = () => {
    const date = new Date();
    const dayOfWeek = date.getDay();
    const daysUntilSunday = 7 - dayOfWeek;
    date.setDate(date.getDate() + daysUntilSunday);
    return date.toISOString().split('T')[0];
  };

  const isOverdue = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    return dueDate < getTodayString();
  };

  const isDueToday = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    return dueDate === getTodayString();
  };

  const isDueThisWeek = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    const today = getTodayString();
    const endOfWeek = getEndOfWeekString();
    return dueDate >= today && dueDate <= endOfWeek;
  };

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let filtered = todos;

    // Filter by completion status
    if (filterBy === 'incomplete') {
      filtered = filtered.filter(todo => !todo.is_completed);
    } else if (filterBy === 'completed') {
      filtered = filtered.filter(todo => todo.is_completed);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      filtered = filtered.filter(todo => {
        switch (dateFilter) {
          case 'today':
            return isDueToday(todo.due_date);
          case 'this_week':
            return isDueThisWeek(todo.due_date);
          case 'overdue':
            return isOverdue(todo.due_date) && !todo.is_completed;
          case 'no_date':
            return !todo.due_date;
          default:
            return true;
        }
      });
    }

    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(todo => {
        if (priorityFilter === 'no_priority') {
          return !todo.priority;
        }
        return todo.priority === priorityFilter;
      });
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
      case 'due_date':
        sorted.sort((a, b) => {
          // Overdue first, then by date, no date last
          const aOverdue = isOverdue(a.due_date) && !a.is_completed;
          const bOverdue = isOverdue(b.due_date) && !b.is_completed;

          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;

          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;

          return a.due_date.localeCompare(b.due_date);
        });
        break;
      case 'priority':
        sorted.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const aPriority = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] : 999;
          const bPriority = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] : 999;
          return aPriority - bPriority;
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
  }, [todos, sortBy, filterBy, dateFilter, priorityFilter, searchTerm, selectedTags]);

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

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';

    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getPriorityClass = (priority: string | null | undefined): string => {
    if (!priority) return '';
    return `priority-${priority}`;
  };

  const getPriorityLabel = (priority: string | null | undefined): string => {
    if (!priority) return '';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  // Helper to build nested todo hierarchy
  const buildTodoHierarchy = (todos: Todo[]) => {
    const rootTodos: Todo[] = [];
    const todoMap = new Map<number, Todo & { children?: Todo[] }>();

    // Create a map of all todos by line number
    todos.forEach(todo => {
      todoMap.set(todo.line_number, { ...todo, children: [] });
    });

    // Build the hierarchy
    todos.forEach(todo => {
      const todoWithChildren = todoMap.get(todo.line_number)!;
      if (todo.parent_line && todoMap.has(todo.parent_line)) {
        const parent = todoMap.get(todo.parent_line)!;
        parent.children = parent.children || [];
        parent.children.push(todoWithChildren);
      } else {
        rootTodos.push(todoWithChildren);
      }
    });

    return rootTodos;
  };

  // Calculate subtask completion
  const getSubtaskProgress = (todo: Todo & { children?: Todo[] }, allTodos: Todo[]): { completed: number; total: number } => {
    const children = allTodos.filter(t =>
      t.note_path === todo.note_path &&
      t.parent_line === todo.line_number
    );

    if (children.length === 0) {
      return { completed: 0, total: 0 };
    }

    let completed = 0;
    let total = children.length;

    children.forEach(child => {
      if (child.is_completed) {
        completed++;
      }
      // Recursively count nested subtasks
      const childProgress = getSubtaskProgress(child as any, allTodos);
      completed += childProgress.completed;
      total += childProgress.total;
    });

    return { completed, total };
  };

  // Bulk action handlers
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedTodoIds(new Set());
  };

  const toggleTodoSelection = (todoId: number) => {
    const newSelection = new Set(selectedTodoIds);
    if (newSelection.has(todoId)) {
      newSelection.delete(todoId);
    } else {
      newSelection.add(todoId);
    }
    setSelectedTodoIds(newSelection);
  };

  const selectAll = () => {
    const allIds = new Set(filteredAndSortedTodos.map(t => t.id));
    setSelectedTodoIds(allIds);
  };

  const deselectAll = () => {
    setSelectedTodoIds(new Set());
  };

  const bulkToggleComplete = () => {
    selectedTodoIds.forEach(id => {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        onTodoToggle(todo);
      }
    });
    setSelectedTodoIds(new Set());
    setSelectionMode(false);
  };

  const selectedCount = selectedTodoIds.size;

  // Recursive function to render a todo and its children
  const renderTodoItem = (todo: Todo & { children?: Todo[] }, allTodos: Todo[]): React.ReactNode => {
    const tags = extractTags(todo.content);
    const contentWithoutTags = todo.content.replace(/#\w+/g, '').trim();
    const overdueClass = isOverdue(todo.due_date) && !todo.is_completed ? 'overdue' : '';
    const subtaskProgress = getSubtaskProgress(todo, allTodos);
    const hasSubtasks = subtaskProgress.total > 0;

    return (
      <div key={`${todo.note_path}-${todo.line_number}`} className="todo-item-container">
        <div
          className={`todo-item ${todo.is_completed ? 'completed' : ''} ${getPriorityClass(todo.priority)} ${overdueClass} ${selectionMode && selectedTodoIds.has(todo.id) ? 'selected' : ''}`}
          onClick={() => selectionMode && toggleTodoSelection(todo.id)}
          style={{ marginLeft: `${todo.indent_level * 20}px` }}
        >
          <label className="todo-label">
            {selectionMode ? (
              <input
                type="checkbox"
                checked={selectedTodoIds.has(todo.id)}
                onChange={() => toggleTodoSelection(todo.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <input
                type="checkbox"
                checked={todo.is_completed}
                onChange={() => onTodoToggle(todo)}
              />
            )}
            <div className="todo-content-wrapper">
              <div className="todo-main-content">
                <span
                  className="todo-content"
                  onClick={() => handleTodoClick(todo)}
                  title={`Jump to line ${todo.line_number}`}
                >
                  {contentWithoutTags}
                </span>
                <div className="todo-metadata">
                  {hasSubtasks && (
                    <span className="todo-subtask-progress">
                      {subtaskProgress.completed}/{subtaskProgress.total} subtasks
                    </span>
                  )}
                  {todo.priority && (
                    <span className={`todo-priority ${getPriorityClass(todo.priority)}`}>
                      <AlertCircle size={12} />
                      {getPriorityLabel(todo.priority)}
                    </span>
                  )}
                  {todo.due_date && (
                    <span className={`todo-due-date ${isOverdue(todo.due_date) && !todo.is_completed ? 'overdue' : ''}`}>
                      <Calendar size={12} />
                      {formatDate(todo.due_date)}
                    </span>
                  )}
                </div>
              </div>
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
        {todo.children && todo.children.length > 0 && (
          <div className="todo-children">
            {todo.children.map(child => renderTodoItem(child, allTodos))}
          </div>
        )}
      </div>
    );
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

      {selectionMode ? (
        <div className="todos-bulk-actions">
          <div className="todos-bulk-header">
            <button
              className="todos-bulk-cancel"
              onClick={toggleSelectionMode}
              title="Cancel selection"
            >
              <X size={16} />
            </button>
            <span className="todos-bulk-count">
              {selectedCount} selected
            </span>
            <div className="todos-bulk-controls">
              {selectedCount > 0 ? (
                <button
                  className="todos-bulk-btn"
                  onClick={deselectAll}
                >
                  Deselect All
                </button>
              ) : (
                <button
                  className="todos-bulk-btn"
                  onClick={selectAll}
                >
                  Select All
                </button>
              )}
            </div>
          </div>
          {selectedCount > 0 && (
            <div className="todos-bulk-action-buttons">
              <button
                className="todos-bulk-action-btn"
                onClick={bulkToggleComplete}
              >
                <CheckCheck size={16} />
                Toggle Complete
              </button>
            </div>
          )}
        </div>
      ) : (
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
            <button
              className="todos-control-btn"
              onClick={toggleSelectionMode}
              title="Bulk select"
            >
              <CheckCheck size={16} />
            </button>
          </div>
        </div>
      )}

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
            <label className="todos-filter-label">Due:</label>
            <div className="todos-filter-buttons">
              <button
                className={`todos-filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDateFilter('all')}
              >
                All
              </button>
              <button
                className={`todos-filter-btn ${dateFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setDateFilter('overdue')}
              >
                Overdue
              </button>
              <button
                className={`todos-filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
                onClick={() => setDateFilter('today')}
              >
                Today
              </button>
              <button
                className={`todos-filter-btn ${dateFilter === 'this_week' ? 'active' : ''}`}
                onClick={() => setDateFilter('this_week')}
              >
                This Week
              </button>
              <button
                className={`todos-filter-btn ${dateFilter === 'no_date' ? 'active' : ''}`}
                onClick={() => setDateFilter('no_date')}
              >
                No Date
              </button>
            </div>
          </div>

          <div className="todos-filter-group">
            <label className="todos-filter-label">Priority:</label>
            <div className="todos-filter-buttons">
              <button
                className={`todos-filter-btn ${priorityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('all')}
              >
                All
              </button>
              <button
                className={`todos-filter-btn priority-high ${priorityFilter === 'high' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('high')}
              >
                High
              </button>
              <button
                className={`todos-filter-btn priority-medium ${priorityFilter === 'medium' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('medium')}
              >
                Medium
              </button>
              <button
                className={`todos-filter-btn priority-low ${priorityFilter === 'low' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('low')}
              >
                Low
              </button>
              <button
                className={`todos-filter-btn ${priorityFilter === 'no_priority' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('no_priority')}
              >
                No Priority
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
                className={`todos-filter-btn ${sortBy === 'due_date' ? 'active' : ''}`}
                onClick={() => setSortBy('due_date')}
              >
                Due Date
              </button>
              <button
                className={`todos-filter-btn ${sortBy === 'priority' ? 'active' : ''}`}
                onClick={() => setSortBy('priority')}
              >
                Priority
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
                    {buildTodoHierarchy(noteTodos).map(todo => renderTodoItem(todo, noteTodos))}
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
