import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Note } from '../types';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  results: Note[];
  onResultSelect: (note: Note) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch, results, onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const lastSearchedQuery = useRef<string>('');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query changes
  useEffect(() => {
    // Only search if the query is different from the last searched query
    if (debouncedQuery !== lastSearchedQuery.current) {
      lastSearchedQuery.current = debouncedQuery;
      if (debouncedQuery) {
        onSearch(debouncedQuery);
      } else if (debouncedQuery === '') {
        // Clear results when query is empty
        onSearch('');
      }
    }
  }, [debouncedQuery, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Still allow immediate search on Enter
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