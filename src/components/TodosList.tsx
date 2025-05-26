import React from 'react';
import { Todo } from '../api/tauri';
import { CheckSquare, FileText } from 'lucide-react';
import './TodosList.css';

interface TodosListProps {
  todos: Todo[];
  onTodoToggle: (todo: Todo) => void;
  onNoteClick: (notePath: string) => void;
}

export const TodosList: React.FC<TodosListProps> = ({ todos, onTodoToggle, onNoteClick }) => {
  // Group todos by note
  const todosByNote = todos.reduce((acc, todo) => {
    if (!acc[todo.note_path]) {
      acc[todo.note_path] = [];
    }
    acc[todo.note_path].push(todo);
    return acc;
  }, {} as Record<string, Todo[]>);

  const getNoteName = (path: string) => {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.md', '');
  };

  return (
    <div className="todos-list">
      <div className="todos-header">
        <CheckSquare size={20} />
        <h3>All Tasks</h3>
      </div>
      
      {Object.keys(todosByNote).length === 0 ? (
        <div className="todos-empty">
          No incomplete tasks found
        </div>
      ) : (
        <div className="todos-content">
          {Object.entries(todosByNote).map(([notePath, noteTodos]) => (
            <div key={notePath} className="todos-note-group">
              <div 
                className="todos-note-header"
                onClick={() => onNoteClick(notePath)}
              >
                <FileText size={16} />
                <span>{getNoteName(notePath)}</span>
              </div>
              
              <div className="todos-items">
                {noteTodos.map((todo) => (
                  <div key={`${todo.note_path}-${todo.line_number}`} className="todo-item">
                    <label className="todo-label">
                      <input
                        type="checkbox"
                        checked={todo.is_completed}
                        onChange={() => onTodoToggle(todo)}
                      />
                      <span className="todo-content">{todo.content}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};