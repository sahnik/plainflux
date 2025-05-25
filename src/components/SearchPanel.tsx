import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Note } from '../types';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  results: Note[];
  onResultSelect: (note: Note) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch, results, onResultSelect }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <div className="search-panel">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-container">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="search-input"
          />
        </div>
      </form>

      <div className="search-results">
        {results.map((note) => (
          <div
            key={note.path}
            className="search-result"
            onClick={() => onResultSelect(note)}
          >
            <div className="note-title">{note.title}</div>
            <div className="note-preview">
              {note.content.substring(0, 100)}...
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};